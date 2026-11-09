# Local app verification — 2026-11-09

The user's confirmed direction is a local app with a local password, without
Supabase or Google signup. This supersedes the earlier OAuth migration stage.
The current source remains uncommitted; no remote resources were contacted,
changed or deleted, and no hosted patient data was imported.

## Delivered

- The local launcher manages a private, persistent PostgreSQL database, the Rust
  API, and the browser interface. All services bind to loopback. Default start
  and development commands use this launcher.
- First-run password setup and local login replace Google. Credentials use
  scrypt with a random salt; setup publishes atomically; private files and
  directories are checked; sessions bind to the credential revision.
- Loopback peer/Host checks, same-origin JSON writes, eight-hour cookies, and a
  bounded login attempt budget protect local authentication.
- Cloud connection values are overridden. Google provider code, the Rust OAuth
  module, obsolete Supabase utilities with embedded credentials, and Vercel's
  generated bundle/config are removed. Old Google URLs return Gone at Node and
  are unavailable in Rust.
- Fresh local installs have no demo patients. Email addresses are optional contact
  information. Local email is mock-only, even with an old provider key.
- Remote font requests were removed; the browser uses system font fallbacks.

## Evidence

| Check | Result |
| --- | --- |
| Local auth unit tests | 11 passed: real scrypt, wrong passwords, setup race, persistence, file modes, revision, rate limit, peer/origin/body restrictions and malformed/symlink files |
| JavaScript regression | 167 passed before the additional local-email policy assertion; that assertion also passed in the focused suite |
| Rust | 34 unit tests plus 1 HTTP boundary test passed |
| TypeScript, formatting, Clippy | Passed, Clippy warnings denied |
| Build | Vite + esbuild passed; existing large-chunk warning remains |
| PostgreSQL compatibility | Complete prior read/write/import/automation/patient-lab suite passed; removed Google endpoints checked |
| Local integration | Real launcher, local password, Rust authorization, empty registry, record persistence and sessions across restart, mock email, ignored cloud config, logout and clean service shutdown passed |
| Browser | Setup, dashboard and patient registry passed with all external requests blocked; zero external requests and zero page exceptions |

The local integration test creates a private temporary folder with synthetic data.
It supplies an unusable cloud database URL and a fake provider key to verify that
neither controls the local runtime. It stops/restarts the application and reads
back the patient record through the actual Node → Rust → local PostgreSQL flow.
It confirms the password is absent from credential files/logs and checks 0600
credential permissions on Linux.

Browser artifacts: [password setup](local-password-setup.png) and
[local patient registry](local-patient-registry.png). The PostgreSQL package and
application were exercised on Linux; Windows/macOS support was not tested here.
The full OCR regression used the existing temporary RapidOCR environment and a
30-second test timeout; its Python dependencies were not removed.

## Boundaries

This is a localhost browser app, not a native desktop installer. The React UI,
password gateway, document/OCR services and some storage/orchestration work still
use Node/Python alongside Rust. Installation/build needs internet access; normal
production startup uses installed local binaries. The UI password does not encrypt
the database or its backups. Existing Supabase records remain at their original
location unless separately exported/imported.

The former scripts' embedded database credential was removed from current source;
Git history is unchanged. Rotate that credential if the former database remains
active. Nothing in this task attempted to use or rotate a remote credential.

The repository-mandated parallel work used isolated KTP-labs (local authentication)
and KTP-zbenefit (local sign-in UI and contact/privacy copy) worktrees. The primary
agent integrated changes and alone changed manifests and lockfiles. See
[local-app.md](../local-app.md) for operation and backups and
[rust-backend-source.sha256](rust-backend-source.sha256) for current artifact hashes.
