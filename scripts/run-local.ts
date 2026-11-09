/** Start the database, Rust API and browser app together on this computer. */
import { execFile, spawn, type ChildProcess } from "node:child_process";
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
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root =
  process.env.KTP_APP_ROOT || path.resolve(import.meta.dirname, "..");
const packaged = Boolean(
  process.env.KTP_APP_ROOT || process.env.KTP_BACKEND_PATH
);
const development = process.env.KTP_LOCAL_DEV === "1" && !packaged;
const execFileAsync = promisify(execFile);
class StartupError extends Error {}
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
let startupStage = "configuration";
const diagnostics = process.env.KTP_INSTALLER_DIAGNOSTICS === "1";
let childrenShutdown: Promise<void> | undefined;
let databaseStartup: Promise<void> | undefined;
let databaseStarted = false;

function notify(message: {
  type: "ktp:ready" | "ktp:error";
  url?: string;
  message?: string;
}) {
  if (process.connected) {
    try {
      process.send?.(message, () => {});
    } catch {}
  }
}

function ensureRunning() {
  if (stopping) throw new StartupError("KTP startup was cancelled.");
}

async function freePort(preferred = 0): Promise<number> {
  const server = createServer();
  server.listen(preferred, "127.0.0.1");
  try {
    await once(server, "listening");
  } catch (error) {
    if (preferred && (error as NodeJS.ErrnoException).code === "EADDRINUSE")
      return freePort();
    throw error;
  }
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
      throw new StartupError(
        "The local app lock needs inspection before KTP can start."
      );
    try {
      process.kill(pid, 0);
    } catch (probe) {
      if ((probe as NodeJS.ErrnoException).code === "ESRCH") {
        await unlink(file);
        return acquireLock();
      }
      throw probe;
    }
    throw new StartupError("KTP is already running for this data folder.");
  }
}

function child(command: string, args: string[], nodeRuntime = false) {
  ensureRunning();
  const processChild = spawn(command, args, {
    cwd: root,
    env: nodeRuntime
      ? { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
      : process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(processChild);
  processChild.once("error", () => {
    console.error("Local service could not start.");
    notify({
      type: "ktp:error",
      message: "A local KTP service could not start.",
    });
    void stop(1);
  });
  return processChild;
}

function stop(code = 0) {
  gracefulExit(code);
}

async function closeServices() {
  await closeChildren();
  await database?.stop();
  if (lockHeld) await unlink(path.join(data, "app.lock")).catch(() => {});
}

function closeChildren(): Promise<void> {
  childrenShutdown ??= (async () => {
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
  })();
  return childrenShutdown;
}

async function waitForService(
  url: string,
  service: ChildProcess,
  message: string
) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    ensureRunning();
    if (service.exitCode !== null || service.signalCode !== null) break;
    try {
      if (
        (
          await fetch(url, {
            redirect: "error",
            signal: AbortSignal.timeout(1000),
          })
        ).status === 200
      )
        return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new StartupError(message);
}

async function main() {
  if (!path.isAbsolute(root))
    throw new StartupError("The application resource path must be absolute.");
  process.chdir(root);
  await mkdir(data, { recursive: true, mode: 0o700 });
  const folder = await lstat(data);
  if (
    !folder.isDirectory() ||
    folder.isSymbolicLink() ||
    (typeof process.getuid === "function" && folder.uid !== process.getuid())
  ) {
    throw new StartupError(
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
      throw new StartupError("Local instance configuration cannot be read.");
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
    throw new StartupError(
      "Invalid local instance configuration; refusing to reset existing data."
    );
  }
  const preferredPort = Number(process.env.PORT ?? (packaged ? 0 : 3000));
  if (
    !Number.isInteger(preferredPort) ||
    preferredPort < 0 ||
    preferredPort > 65535
  )
    throw new StartupError("Invalid local application port.");
  const webPort = await freePort(preferredPort);
  const databasePort = await freePort();
  const rustPort = await freePort();
  Object.assign(process.env, {
    KTP_LOCAL_MODE: "1",
    LOCAL_APP_DATA_DIR: data,
    NODE_ENV: development ? "development" : "production",
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
  const executable =
    process.env.KTP_BACKEND_PATH ||
    path.join(
      root,
      "src/rust-backend/target/debug",
      process.platform === "win32" ? "ktp-backend.exe" : "ktp-backend"
    );
  if (!path.isAbsolute(executable))
    throw new StartupError("The Rust service path must be absolute.");
  if (development) {
    const build = child("cargo", [
      "build",
      "--locked",
      "--manifest-path",
      "src/rust-backend/Cargo.toml",
    ]);
    const [buildCode] = await once(build, "exit");
    if (buildCode !== 0)
      throw new StartupError(
        "Rust build failed. Install the stable Rust toolchain and retry."
      );
  } else {
    await access(executable).catch(() => {
      throw new StartupError(
        packaged
          ? "The installed Rust service is missing. Reinstall KTP."
          : "Run pnpm local once to build the Rust application."
      );
    });
  }
  if (!development) {
    await access(path.join(root, "dist/index.js")).catch(() => {
      throw new StartupError(
        packaged
          ? "The installed application is incomplete. Reinstall KTP."
          : "Run pnpm build once before starting the local app."
      );
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
    onLog: message => {
      if (diagnostics && !databaseStarted)
        console.error("[Database bootstrap]", message);
    },
    onError: () => {},
  });
  const originalStop = database.stop.bind(database);
  let databaseShutdown: Promise<void> | undefined;
  database.stop = () =>
    (databaseShutdown ??= (async () => {
      await closeChildren();
      await databaseStartup?.catch(() => {});
      if (process.platform === "win32") {
        if (!databaseStarted) return;
        // embedded-postgres uses taskkill /f on Windows. pg_ctl instead asks the
        // server to stop and flush its persistent cluster before the app exits.
        const resolveNative = createRequire(
          import.meta.resolve("embedded-postgres")
        );
        const binaryModule = resolveNative.resolve(
          "@embedded-postgres/windows-x64"
        );
        const binaries = await import(pathToFileURL(binaryModule).href);
        await execFileAsync(
          binaries.pg_ctl,
          [
            "stop",
            "-D",
            path.join(data, "database"),
            "-m",
            "fast",
            "-w",
            "-t",
            "10",
          ],
          { windowsHide: true, timeout: 12_000 }
        );
      } else {
        await originalStop();
      }
    })());
  try {
    await access(path.join(data, "database/PG_VERSION"));
  } catch {
    startupStage = "database-initialization";
    await database.initialise();
  }
  ensureRunning();
  startupStage = "database-start";
  databaseStartup = database.start();
  await databaseStartup;
  databaseStarted = true;
  startupStage = "database-administration";
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
  startupStage = "schema-initialization";
  const db = await import("../server/db");
  if (!(await db.getDb()))
    throw new StartupError("Local database initialization failed.");
  const { prepareClinicalCatalog } = await import("../server/dbClinical");
  await prepareClinicalCatalog();
  const connection = await db.getDb();
  await (
    connection as unknown as { $client: { end(): Promise<void> } }
  ).$client.end();
  await db.getBatchClient()?.end();
  startupStage = "rust-start";
  const rust = child(executable, []);
  await waitForService(
    `http://127.0.0.1:${rustPort}/health/ready`,
    rust,
    "Local Rust API did not become ready."
  );
  startupStage = "web-start";
  const node = development
    ? child(
        process.execPath,
        [
          path.join(root, "node_modules/tsx/dist/cli.mjs"),
          "server/_core/index.ts",
        ],
        true
      )
    : child(process.execPath, [path.join(root, "dist/index.js")], true);
  for (const processChild of [rust, node])
    processChild.once("exit", code => {
      if (!stopping) void stop(code || 1);
    });
  const url = `http://127.0.0.1:${webPort}/login`;
  await waitForService(
    `http://127.0.0.1:${webPort}/api/local-auth/status`,
    node,
    "Local application did not become ready."
  );
  notify({ type: "ktp:ready", url });
  console.log(`Local KTP: ${url}`);
  console.log(`Data stays in: ${data}`);
}

asyncExitHook(closeServices, { wait: 30_000 });
process.on("message", message => {
  if (
    message &&
    typeof message === "object" &&
    "type" in message &&
    message.type === "ktp:shutdown"
  )
    stop();
});
process.on("disconnect", () => stop());
main().catch(error => {
  // Closing the desktop during startup is cancellation, not a startup failure.
  if (stopping) return;
  if (diagnostics) {
    const engineBootstrap = [
      "database-initialization",
      "database-start",
    ].includes(startupStage);
    const code =
      typeof (error as NodeJS.ErrnoException)?.code === "string"
        ? (error as NodeJS.ErrnoException).code
        : "BOOTSTRAP_FAILED";
    console.error(
      "[Startup diagnostic]",
      startupStage,
      engineBootstrap && error instanceof Error ? error.message : code
    );
  }
  const message =
    error instanceof StartupError
      ? error.message
      : "KTP could not start its local services. Close other KTP windows and try again.";
  notify({ type: "ktp:error", message });
  console.error(message);
  void stop(1);
});
