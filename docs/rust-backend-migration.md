# Rust backend and local app

The current app runs locally with a password and an embedded PostgreSQL database.
Google OAuth and Supabase configuration have been removed from the local runtime.
See [local-app.md](local-app.md) for setup, data location, backups and verification.
Earlier verification reports describe earlier source snapshots, including the
now-removed Google integration.

## Start

Install Node.js 22+, pnpm 10.4.1 and stable Rust, then:

```sh
pnpm install --frozen-lockfile
pnpm local
```

Open `http://127.0.0.1:3000/login` and set your local password. Later launches use
`pnpm start`. `pnpm dev` runs the same local database and Rust API with Vite.

The launcher manages all services and their shutdown, stores data in the user's
application-data folder, generates private database/session secrets, and ignores
old hosted connection configuration. No cloud resources are provisioned or
contacted. The database is local PostgreSQL, preserving the existing Rust/SQLx
work without requiring a separate database installation.

## Rust coverage

Rust handles patient enrollment/edit/archive, patient/clinical reads, dashboards
and complete metrics, service/lab/checklist/appointment/claim mutations, correction
revisions, Z Benefit, doctors, settings, broadcasts, notifications, import
check/commit, templates, email logs and manual appointment sweeps. Patient
submission saves a separate report, reference snapshots and an atomic audit,
fixing the old nonexistent-service-ID failure in Node too. Its pending-review
marker is in the note; the existing result-storage status is Done.

Node serves the React frontend, validates tRPC requests and forwards authenticated
operations to the local Rust API. Local password authentication creates compatible,
eight-hour sessions bound to the current private credential revision. Both
services recognize the local administrator only while local mode is active.
The Rust service checks that local-mode bindings and database hosts are loopback.

The generic adapters remain available for development compatibility tests.
Ordinary requests time out after ten seconds, test-email operations after thirty
seconds and manual sweeps after five minutes. Writes are never automatically
retried and upstream error details are redacted.

Clinical writes preserve reference ranges and save revisions/audits atomically.
Import commit validates all rows, serializes imports and saves recipients before
donors; one invalid row rolls back the batch. Patient authorization rechecks
consent, current identity and ownership inside its data transaction.

Email is mock-only in local mode even if old provider keys are present. Sweeps
use an advisory lock and reservations to suppress duplicate sends. Outside local
mode, uncertain provider outcomes still require reconciliation. Source limitations
remain: appointment sweeps use a fixed two-day window; overdue-lab and digest
triggers are configuration only.

## Remaining Rust migration

The interface remains React. Files/photo storage, document parsing and OCR,
schema/catalog initialization, scheduled job orchestration and password routes
still have Node/Python responsibilities. This is a working local app with a Rust
backend, not a finished all-Rust desktop distribution. No hosted records have
been migrated automatically or deleted.

## Checks

```sh
pnpm check
pnpm test:rust
cargo fmt --manifest-path src/rust-backend/Cargo.toml --check
cargo clippy --locked --manifest-path src/rust-backend/Cargo.toml --all-targets -- -D warnings
pnpm build
pnpm test:local
```

The broader compatibility suite uses a disposable PostgreSQL server and creates
and drops a randomly named database:

```sh
RUST_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres pnpm test:rust:integration
```

It compares Node and Rust reads, writes, dates, snapshots, revisions, audits,
metrics, imports and templates, then checks concurrency, ownership, revocation,
rollback and injected database failures. Google endpoints are now verified as
removed, rather than tested through a provider.
