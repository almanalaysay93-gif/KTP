# Windows installer

The installer is built for Windows x64. It installs KTP for the current Windows
user and creates desktop and Start menu shortcuts. It does not require a
Supabase account, Google sign-in, a terminal, or separate Node.js, Rust,
PostgreSQL or Python installations on the target computer.

## Install and use

Download the [verified Windows installer artifact](https://github.com/almanalaysay93-gif/KTP/actions/runs/42629792584/artifacts/13681550933),
or the `KTP-Windows-Installer` artifact from a newer successful **Windows installer**
GitHub Actions run. Unzip it, then run
`KTP-Setup-1.0.0-x64.exe`. Open **KTP** from the desktop or Start menu and create
your local password. An existing local workspace uses its existing password.

This initial installer is unsigned. Windows may show an unknown-publisher or
SmartScreen message. `SHA256SUMS.txt` accompanies the installer; compare it with
PowerShell's `Get-FileHash <installer-path> -Algorithm SHA256` before use.
No automatic updates or external sign-in are enabled.

Closing the desktop window stops the app, Rust service and local database.
Updates and uninstall require closing KTP first; the installer refuses to
force-kill a running workspace. Windows database shutdown uses `pg_ctl` to flush
and close PostgreSQL cleanly.

## Saved data

The application files live under `%LOCALAPPDATA%\Programs\KTP`.
Patient records, password hash and private instance secrets stay under
`%LOCALAPPDATA%\KTP`, as with the source version. They are never included in the
installer. Updating or uninstalling the application preserves the data folder.
Back up that whole folder while KTP is closed. A local password controls app
access; it does not encrypt database files or backups.

Existing Supabase records are not downloaded or migrated. Existing source-app
local records in the default data folder are reused. If you previously selected
a custom `LOCAL_APP_DATA_DIR`, retain that environment setting when launching
the desktop app.

## Included runtimes

- Electron provides the desktop window and embedded Node runtime.
- The Rust service is built for Windows x64 with the static C runtime.
- Embedded PostgreSQL provides the private, loopback-only database.
- CPython 3.12.10 and pinned binary wheels provide PDF, XLSX/CSV and image OCR.
  The OCR models and app-local MSVC libraries are included for offline use.

The renderer cannot load remote sites, launch new windows, request device
permissions or access Node APIs. The launcher announces readiness only after
both services are ready. Closing the window requests an orderly shutdown over
private process IPC, rather than exposing an HTTP shutdown endpoint.

## Build from source on Windows

Build prerequisites: Node.js 22+, pnpm 10.4.1, stable Rust/MSVC build tools, and
64-bit Python 3.12. These are build-machine prerequisites, not target-machine
requirements.

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm installer:python
pnpm installer:windows
```

The Python preparation step downloads the pinned official embedded ZIP, verifies
its SHA-256, installs only pinned binary wheels, and runs offline parser/OCR
checks before publishing the build folder. It refuses to overwrite a nonempty
output folder. Reuse the prepared runtime for later builds; when dependencies
change, select a new empty output location or remove only the generated
`build/installer/python` directory before preparing it again.

The output is `release/KTP-Setup-1.0.0-x64.exe`. Installer artifacts are ignored
by Git. Do not place patient data or credentials in build or release directories.

The GitHub Actions workflow performs all preparation and builds automatically.
It tests the bundled backend through setup/login, writes, restart persistence,
mock email and logout, then smoke-tests the unpacked desktop, silently installs
it, runs the installed application with system runtimes removed from PATH, and
verifies uninstall preserves a local data marker. Only the installer, digest
and synthetic first-run screenshot are uploaded; databases and credentials are
never uploaded. Artifacts are retained for 30 days.

Build evidence and checksums: [Windows installer verification](verification/windows-installer.md).
