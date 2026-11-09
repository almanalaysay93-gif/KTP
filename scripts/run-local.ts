/** Start the database, Rust API and browser app together on this computer. */
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  open,
  readFile,
  unlink,
  access,
  chmod,
  lstat,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { asyncExitHook, gracefulExit } from "exit-hook";

const root = path.resolve(import.meta.dirname, "..");
const defaultData =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || os.homedir(), "KTP")
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "KTP")
      : path.join(
          process.env.XDG_DATA_HOME ||
            path.join(os.homedir(), ".local", "share"),
          "ktp"
        );
const data = path.resolve(process.env.LOCAL_APP_DATA_DIR || defaultData);
const children: ChildProcess[] = [];
let database: EmbeddedPostgres | undefined;
let lockHeld = false;
let stopping = false;

async function freePort(preferred = 0): Promise<number> {
  const server = createServer();
  server.listen(preferred, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

async function acquireLock() {
  const file = path.join(data, "app.lock");
  try {
    const handle = await open(file, "wx", 0o600);
    await handle.writeFile(String(process.pid));
    await handle.close();
    lockHeld = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const pid = Number(await readFile(file, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0)
      throw new Error("Local app lock needs inspection: " + file);
    try {
      process.kill(pid, 0);
    } catch (probe) {
      if ((probe as NodeJS.ErrnoException).code === "ESRCH") {
        await unlink(file);
        return acquireLock();
      }
      throw probe;
    }
    throw new Error("KTP is already running for this data folder.");
  }
}

function child(command: string, args: string[]) {
  const processChild = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  children.push(processChild);
  processChild.once("error", () => {
    console.error("Local service could not start.");
    void stop(1);
  });
  return processChild;
}

function stop(code = 0) {
  gracefulExit(code);
}

async function closeServices() {
  if (stopping) return;
  stopping = true;
  for (const processChild of [...children].reverse()) {
    if (
      processChild.exitCode !== null ||
      processChild.signalCode !== null ||
      !processChild.pid
    )
      continue;
    const exited = once(processChild, "exit");
    processChild.kill("SIGTERM");
    const timer = setTimeout(() => processChild.kill("SIGKILL"), 5000);
    await exited.catch(() => {});
    clearTimeout(timer);
  }
  // embedded-postgres registers database shutdown with this same exit-hook.
  // Its hook and this service cleanup are both awaited before process exit.
  if (lockHeld) await unlink(path.join(data, "app.lock")).catch(() => {});
}

async function main() {
  await mkdir(data, { recursive: true, mode: 0o700 });
  const folder = await lstat(data);
  if (
    !folder.isDirectory() ||
    folder.isSymbolicLink() ||
    (typeof process.getuid === "function" && folder.uid !== process.getuid())
  ) {
    throw new Error(
      "Local data folder must be a directory owned by the current user."
    );
  }
  await chmod(data, 0o700);
  await acquireLock();
  const configFile = path.join(data, "instance.json");
  let secrets: { databasePassword: string; sessionSecret: string };
  try {
    secrets = JSON.parse(await readFile(configFile, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Local instance configuration cannot be read.");
    secrets = {
      databasePassword: randomBytes(32).toString("hex"),
      sessionSecret: randomBytes(48).toString("hex"),
    };
    const file = await open(configFile, "wx", 0o600);
    await file.writeFile(JSON.stringify(secrets));
    await file.close();
  }
  if (
    typeof secrets.databasePassword !== "string" ||
    secrets.databasePassword.length < 32 ||
    typeof secrets.sessionSecret !== "string" ||
    secrets.sessionSecret.length < 32
  ) {
    throw new Error(
      "Invalid local instance configuration; refusing to reset existing data."
    );
  }
  const webPort = await freePort(Number(process.env.PORT || 3000));
  const databasePort = await freePort();
  const rustPort = await freePort();
  Object.assign(process.env, {
    KTP_LOCAL_MODE: "1",
    LOCAL_APP_DATA_DIR: data,
    NODE_ENV: process.env.KTP_LOCAL_DEV === "1" ? "development" : "production",
    DATABASE_URL: `postgres://ktp:${secrets.databasePassword}@127.0.0.1:${databasePort}/ktp`,
    JWT_SECRET: secrets.sessionSecret,
    RUST_BIND_ADDR: `127.0.0.1:${rustPort}`,
    RUST_BACKEND_URL: `http://127.0.0.1:${rustPort}`,
    APP_URL: `http://127.0.0.1:${webPort}`,
    PORT: String(webPort),
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    VITE_GOOGLE_CLIENT_ID: "",
    RESEND_API_KEY: "",
    S3_BUCKET_NAME: "",
    OPENROUTER_API_KEY: "",
  });
  const executable = path.join(
    root,
    "src/rust-backend/target/debug",
    process.platform === "win32" ? "ktp-backend.exe" : "ktp-backend"
  );
  if (process.env.KTP_LOCAL_DEV === "1") {
    const build = child("cargo", [
      "build",
      "--locked",
      "--manifest-path",
      "src/rust-backend/Cargo.toml",
    ]);
    const [buildCode] = await once(build, "exit");
    if (buildCode !== 0)
      throw new Error(
        "Rust build failed. Install the stable Rust toolchain and retry."
      );
  } else {
    await access(executable).catch(() => {
      throw new Error("Run pnpm local once to build the Rust application.");
    });
  }
  if (process.env.KTP_LOCAL_DEV !== "1") {
    await access(path.join(root, "dist/index.js")).catch(() => {
      throw new Error("Run pnpm build once before starting the local app.");
    });
  }
  database = new EmbeddedPostgres({
    databaseDir: path.join(data, "database"),
    port: databasePort,
    user: "ktp",
    password: secrets.databasePassword,
    authMethod: "scram-sha-256",
    persistent: true,
    autoRehydrateSymlinks: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: [
      "-h",
      "127.0.0.1",
      "-c",
      "unix_socket_directories=",
      "-c",
      "log_statement=none",
    ],
    onLog: () => {},
    onError: () => {},
  });
  try {
    await access(path.join(data, "database/PG_VERSION"));
  } catch {
    await database.initialise();
  }
  await database.start();
  const admin = database.getPgClient("postgres", "127.0.0.1");
  await admin.connect();
  try {
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname='ktp'"
    );
    if (!existing.rowCount) await admin.query("CREATE DATABASE ktp");
  } finally {
    await admin.end();
  }
  // Import only after local configuration is installed: .env cannot select a cloud DB.
  const db = await import("../server/db");
  if (!(await db.getDb()))
    throw new Error("Local database initialization failed.");
  const { prepareClinicalCatalog } = await import("../server/dbClinical");
  await prepareClinicalCatalog();
  const connection = await db.getDb();
  await (
    connection as unknown as { $client: { end(): Promise<void> } }
  ).$client.end();
  await db.getBatchClient()?.end();
  const rust = child(executable, []);
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await fetch(`http://127.0.0.1:${rustPort}/health/ready`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (rust.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Local Rust API did not become ready.");
  const node =
    process.env.KTP_LOCAL_DEV === "1"
      ? child(process.execPath, [
          path.join(root, "node_modules/tsx/dist/cli.mjs"),
          "server/_core/index.ts",
        ])
      : child(process.execPath, ["dist/index.js"]);
  for (const processChild of [rust, node])
    processChild.once("exit", code => {
      if (!stopping) void stop(code || 1);
    });
  console.log(`Local KTP: http://127.0.0.1:${webPort}/login`);
  console.log(`Data stays in: ${data}`);
}

asyncExitHook(closeServices, { wait: 15_000 });
main().catch(error => {
  console.error(
    error instanceof Error ? error.message : "Local startup failed."
  );
  void stop(1);
});
