import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const executable = process.argv[2];
if (!executable || !path.isAbsolute(executable))
  throw new Error("Supply an absolute path to the packaged KTP executable.");
const data = await mkdtemp(path.join(os.tmpdir(), "ktp-desktop-smoke-"));
let output = "";
const child = spawn(executable, ["--installer-smoke-test", "--disable-gpu"], {
  cwd: path.dirname(executable),
  env: {
    ...process.env,
    LOCAL_APP_DATA_DIR: data,
    KTP_INSTALLER_SCREENSHOT: path.resolve("release/smoke/first-run.png"),
    DATABASE_URL:
      "postgres://ignored:ignored@cloud-must-not-be-used.invalid/ignored",
    ...(process.platform === "win32"
      ? { PATH: path.join(process.env.SystemRoot || "C:\\Windows", "System32") }
      : {}),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", chunk => {
  output += chunk;
});
child.stderr.on("data", chunk => {
  output += chunk;
});
const timer = setTimeout(() => child.kill(), 180_000);
try {
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output);
  assert.ok(output.includes("KTP_INSTALLER_SMOKE_OK"), output);
  await assert.rejects(
    () => access(path.join(data, "app.lock")),
    error => error.code === "ENOENT"
  );
  const config = JSON.parse(
    await readFile(path.join(data, "instance.json"), "utf8")
  );
  assert.ok(config.databasePassword.length >= 32);
  assert.ok(config.sessionSecret.length >= 32);
  await access(path.join(data, "database", "PG_VERSION"));
  console.log(
    "PASS: packaged desktop starts with bundled runtimes and an isolated local database, displays password setup, and shuts down cleanly."
  );
} finally {
  clearTimeout(timer);
}
