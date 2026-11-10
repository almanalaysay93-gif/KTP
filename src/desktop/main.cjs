const { app, BrowserWindow, dialog, session } = require("electron");
const { fork } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const { isAllowedUrl } = require("./policy.cjs");

app.setName("KTP");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");

let backend;
let window;
let origin;
let quitting = false;
let stopped;
let readyTimer;
const smoke = process.argv.includes("--installer-smoke-test");

function permitted(raw) {
  return isAllowedUrl(raw, origin);
}

async function stop() {
  if (stopped) return stopped;
  stopped = new Promise(resolve => {
    clearTimeout(readyTimer);
    if (
      !backend ||
      !backend.pid ||
      backend.exitCode !== null ||
      backend.signalCode !== null
    )
      return resolve();
    const timer = setTimeout(() => {
      backend.kill();
      resolve();
    }, 40_000);
    backend.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    // Disconnected workers already run their own graceful cleanup handler.
    try {
      if (backend.connected) backend.send({ type: "ktp:shutdown" }, () => {});
    } catch {
      /* A concurrent disconnect still triggers worker cleanup. */
    }
  });
  return stopped;
}

function fail(message) {
  if (quitting) return;
  quitting = true;
  clearTimeout(readyTimer);
  if (smoke) console.error(message);
  else dialog.showErrorBox("KTP could not start", message);
  void stop().then(() => app.exit(1));
}

async function start() {
  const root = app.getAppPath();
  const extension = process.platform === "win32" ? ".exe" : "";
  const rust = app.isPackaged
    ? path.join(process.resourcesPath, "bin", `ktp-backend${extension}`)
    : path.join(
        root,
        "src",
        "rust-backend",
        "target",
        "debug",
        `ktp-backend${extension}`
      );
  const python = app.isPackaged
    ? path.join(
        process.resourcesPath,
        "python",
        process.platform === "win32" ? "python.exe" : "bin/python3"
      )
    : process.env.KTP_PYTHON;

  // The renderer cannot load a remote site, open a new window or use Node APIs.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !permitted(details.url) })
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 390,
    minHeight: 640,
    show: !smoke,
    title: "KTP",
    backgroundColor: "#d8cbb3",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      offscreen: smoke,
      backgroundThrottling: !smoke,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!permitted(url)) event.preventDefault();
  });
  await window.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(
        '<!doctype html><html><head><meta charset="utf-8"><title>KTP</title></head><body style="background:#d8cbb3;color:#1e1e1c;font:20px system-ui;display:grid;place-items:center;height:90vh"><p>Starting your local KTP workspace…</p></body></html>'
      )
  );
  backend = fork(path.join(root, "dist", "run-local.mjs"), [], {
    cwd: root,
    execPath: process.execPath,
    execArgv: [],
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      KTP_PACKAGED: "1",
      KTP_LOCAL_DEV: "0",
      KTP_APP_ROOT: root,
      KTP_BACKEND_PATH: rust,
      ...(python ? { KTP_PYTHON: python } : {}),
      PORT: "0",
    },
  });
  // Never copy patient data, passwords or upstream error payloads into a log.
  backend.stdout.on("data", () => {});
  backend.stderr.on("data", () => {});
  backend.on("error", () =>
    fail(
      "The bundled local service could not start. Your saved data has not been removed."
    )
  );
  backend.on("exit", () => {
    if (!quitting)
      fail(
        "The local service stopped unexpectedly. Close and reopen KTP. Your saved data is kept separately from the application."
      );
  });
  readyTimer = setTimeout(
    () =>
      fail(
        "The local workspace took too long to start. Close other KTP windows and try again."
      ),
    90_000
  );
  backend.on("message", async message => {
    if (message?.type === "ktp:error")
      return fail(
        "The local workspace could not start. Check that the data folder is available and another KTP instance is not running."
      );
    if (message?.type !== "ktp:ready" || origin) return;
    try {
      const url = new URL(message.url);
      if (
        url.protocol !== "http:" ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        url.username ||
        url.password
      )
        throw new Error();
      origin = url.origin;
      clearTimeout(readyTimer);
      await window.loadURL(`${origin}/login`);
      if (smoke) {
        let ready = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          ready = await window.webContents.executeJavaScript(
            "!!document.querySelector('input[type=password]')"
          );
          if (ready) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!ready) throw new Error();
        await new Promise(resolve => setTimeout(resolve, 400));
        if (process.env.KTP_INSTALLER_SCREENSHOT) {
          const destination = path.resolve(
            process.env.KTP_INSTALLER_SCREENSHOT
          );
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(
            destination,
            (await window.webContents.capturePage()).toPNG()
          );
        }
        console.log("KTP_INSTALLER_SMOKE_OK");
        quitting = true;
        await stop();
        app.exit(0);
      }
    } catch {
      fail("KTP could not open its local interface.");
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    void stop().then(() => app.quit());
  });
  app
    .whenReady()
    .then(start)
    .catch(() => fail("The desktop application could not initialize."));
}
