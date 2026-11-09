/** Real local launcher/password/Rust/PostgreSQL flow, with a disposable data folder. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

const data = await mkdtemp(path.join(tmpdir(), "ktp-local-test-"));
const probe = createServer().listen(0, "127.0.0.1");
await once(probe, "listening");
const port = (probe.address() as { port: number }).port;
await new Promise<void>(resolve => probe.close(() => resolve()));
const origin = `http://127.0.0.1:${port}`;
const repository = path.resolve(import.meta.dirname, "..");
const packaged = process.env.KTP_TEST_PACKAGED === "1";
const password = "SyntheticOnly#LocalPassword2026";
let service: ChildProcess | undefined;
let log = "";
async function start() {
  service = spawn(
    process.execPath,
    packaged
      ? ["dist/run-local.mjs"]
      : ["--import", "tsx", "scripts/run-local.ts"],
    {
      cwd: repository,
      env: {
        ...process.env,
        LOCAL_APP_DATA_DIR: data,
        PORT: String(port),
        KTP_LOCAL_DEV: "0",
        ...(packaged
          ? {
              KTP_APP_ROOT: repository,
              KTP_BACKEND_PATH: path.join(
                repository,
                "build/installer/bin",
                process.platform === "win32" ? "ktp-backend.exe" : "ktp-backend"
              ),
            }
          : {}),
        // A stale cloud configuration must never be selected by this launcher.
        DATABASE_URL:
          "postgres://ignored:ignored@cloud-must-not-be-used.invalid/ignored",
        RUST_BACKEND_URL: "https://cloud-must-not-be-used.invalid",
        RESEND_API_KEY: "synthetic-must-be-disabled",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    }
  );
  service.stdout!.on("data", chunk => {
    log += chunk;
  });
  service.stderr!.on("data", chunk => {
    log += chunk;
  });
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      if ((await fetch(`${origin}/api/local-auth/status`)).ok) return;
    } catch {}
    if (service.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Local launcher did not start: ${log}`);
}
async function stop() {
  if (!service || service.exitCode !== null) return;
  const exited = once(service, "exit");
  if (service.connected) service.send({ type: "ktp:shutdown" });
  else service.kill("SIGTERM");
  await exited;
}
const request = (
  route: string,
  body: unknown,
  cookie?: string,
  extra: Record<string, string> = {}
) =>
  fetch(`${origin}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
async function rpc(method: string, cookie: string, input?: unknown) {
  const response =
    input === undefined
      ? await fetch(`${origin}/api/trpc/${method}`, { headers: { cookie } })
      : await request(`/api/trpc/${method}`, { json: input }, cookie);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result.result.data.json;
}
try {
  await start();
  assert.deepEqual(
    await (await fetch(`${origin}/api/local-auth/status`)).json(),
    { setupRequired: true }
  );
  assert.equal(await rpc("auth.me", ""), null);
  for (const route of ["start", "callback", "logout"]) {
    const response = await fetch(`${origin}/api/oauth/${route}`, {
      redirect: "manual",
    });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal(
    (
      await request("/api/local-auth/setup", { password }, undefined, {
        origin: "https://attacker.invalid",
      })
    ).status,
    403
  );
  const setup = await request("/api/local-auth/setup", { password });
  assert.equal(setup.status, 200);
  const cookie = setup.headers.getSetCookie()[0].split(";")[0];
  assert.ok(setup.headers.getSetCookie()[0].includes("HttpOnly"));
  const credentials = await readFile(
    path.join(data, "credentials.json"),
    "utf8"
  );
  assert.ok(!credentials.includes(password));
  if (process.platform !== "win32")
    assert.equal(
      (await stat(path.join(data, "credentials.json"))).mode & 0o777,
      0o600
    );
  assert.equal((await rpc("auth.me", cookie)).isAdmin, true);
  assert.deepEqual(
    await rpc("patients.list", cookie),
    [],
    "Fresh local installs must not contain demo patients"
  );
  await rpc("patients.create", cookie, {
    hrn: "LOCAL-PERSIST-1",
    patientType: "Recipient",
    firstName: "Local",
    lastName: "Fixture",
    stage: "Orientation",
  });
  assert.equal((await rpc("patients.list", cookie)).length, 1);
  assert.equal(
    (await request("/api/local-auth/setup", { password })).status,
    409
  );
  assert.equal(
    (
      await request("/api/local-auth/login", {
        password: "IncorrectPassword#2026",
      })
    ).status,
    401
  );
  await stop();
  await start();
  assert.deepEqual(
    await (await fetch(`${origin}/api/local-auth/status`)).json(),
    { setupRequired: false }
  );
  assert.equal(
    (await rpc("patients.list", cookie))[0].hrn,
    "LOCAL-PERSIST-1",
    "Database and sessions persist across restart"
  );
  const login = await request("/api/local-auth/login", { password });
  assert.equal(login.status, 200);
  const newCookie = login.headers.getSetCookie()[0].split(";")[0];
  assert.equal((await rpc("auth.me", newCookie)).isAdmin, true);
  const logout = await request("/api/local-auth/logout", {});
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.getSetCookie()[0].startsWith("app_session_id=;"));
  const testEmail = await rpc("automations.sendTestEmail", newCookie, {
    to: "synthetic@example.invalid",
    templateName: "TestNotice",
  });
  assert.equal(
    testEmail.status,
    "mock",
    "Cloud email must stay disabled locally"
  );
  assert.ok(!log.includes(password));
  console.log(
    "PASS: local password setup/login, Rust access, empty fresh registry, persisted data and sessions after restart, disabled Google/cloud configuration, mock email and logout"
  );
} finally {
  await stop();
  // Keep the disposable directory available for inspection; it contains synthetic data only.
}
