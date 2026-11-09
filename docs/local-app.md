# Run KTP locally

KTP runs on this computer with a local password, its own PostgreSQL database,
the Rust API, and the existing React interface. It needs no Supabase account,
Google account, OAuth credentials, or externally hosted database. This is a
localhost application opened in your browser, not a packaged desktop installer.

## First launch

Install Node.js 22 or newer, pnpm 10.4.1, and stable Rust. In the project folder:

```sh
pnpm install --frozen-lockfile
pnpm local
```

Installation and the first build need internet access to obtain dependencies.
The PostgreSQL binary for your platform is included by the pinned
`embedded-postgres` package; no separate PostgreSQL installation is needed.
The launcher repairs its required local symlinks automatically.

Open **http://127.0.0.1:3000/login** and create a password of 12–128 characters.
There is no default password and no signup with an external provider.
Subsequent launches can use the already built app without rebuilding:

```sh
pnpm start
```

Keep the terminal open while using KTP. Press Ctrl+C to stop all its services.
Use `pnpm local` again after updating application source; use `pnpm dev` for
local development with Vite. `PORT` can select a different browser port.

After installation/build, normal startup uses installed local binaries and does
not fetch dependencies. Local email dispatch is mock-only. Cloud object storage,
external AI extraction and Google sign-in are disabled by the launcher. Fonts use
system fallbacks rather than a Google Fonts request. Python document/OCR features
still need their existing Python dependencies installed; the Rust rewrite is
not complete and the interface is still React.

## Your data

The default data directory is:

| System | Directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\KTP` |
| macOS | `~/Library/Application Support/KTP` |
| Linux | `~/.local/share/ktp`, or `$XDG_DATA_HOME/ktp` |

Set `LOCAL_APP_DATA_DIR` to an absolute directory to choose another location.
The launcher prints the selected folder. It contains:

- `database/`: persistent PostgreSQL data.
- `credentials.json`: salted scrypt password hash and credential revision.
- `instance.json`: generated private database and session secrets.
- `app.lock`: prevents two app instances from using one data directory.

Fresh installations have an empty patient registry. Patient email addresses are
optional contact information, not Google login credentials. One local
administrator manages the workspace; local patient self-registration is not
implemented.

Stop KTP before backing up the **whole data directory**. Do not publish or commit
that folder. The UI password protects application access; it does not encrypt
the database files or backups. Use the computer's account and disk protections.
No password recovery email or remote reset exists. If a local administrator
needs to reset a forgotten password, stop KTP, back up the data folder, and
rename `credentials.json` to a private backup name. On next launch, set a new
password. Existing records remain, and old credential-bound sessions are rejected.

The local launcher deliberately overrides old `DATABASE_URL`, Rust origin,
Google, Resend and S3 settings so an old `.env` cannot select a hosted service.
All three services bind to loopback. Authentication additionally rejects
non-loopback peers, unexpected hosts, cross-origin writes and non-JSON bodies.
Passwords are hashed with scrypt, credentials publish atomically with private
permissions, login attempts are limited, and sessions last eight hours.

## Existing hosted records

The old Supabase database has not been downloaded, modified or deleted. Existing
hosted records are not automatically copied into this new local database. You can
import an exported patient list using the local patient import screen. Moving
historical clinical records requires a separate database export/restore process.
Legacy cloud provisioning scripts and the Vercel deployment bundle/config were
removed. Some historical design documents still describe the former cloud app.
Obsolete scripts contained an embedded database credential; that credential was
removed from current source, but an active former database should have its
password rotated because removal does not erase Git history.

## Verification

```sh
pnpm check
pnpm test:rust
pnpm build
pnpm test:local
```

The local integration test uses a temporary data folder and synthetic patients.
It verifies setup/login, Rust authorization, ignored cloud configuration, data
and session persistence across restart, mock email, logout and disabled Google
routes. Unit tests cover password validation, setup races, private files,
loopback/origin restrictions, rate limiting and malformed credential files.
Linux was tested in this environment. Windows and macOS platform support comes
from the embedded database package and has not been exercised here.
