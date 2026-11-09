# Rust backend verification — 2026-11-08

## Scope and source

Baseline: `a6dca57` (`feat(metrics): add patient and transplant analytics`).
Local branch: `rust/backend-migration`.

Authorized work: begin the staged Rust migration, retaining React and PostgreSQL.
This change implements three admin read procedures, shared session verification,
and a reversible server-side opt-in. It does not finish the full application
rewrite. No commits, pushes, production configuration changes, or deployments
were performed. Tests used randomly named temporary PostgreSQL databases and
synthetic identities. Temporary database cleanup is part of the integration test.

The isolated review/metrics worktree was `/workspace/KTP-metrics`; the primary
agent integrated its metrics module into `/workspace/KTP` and ran all checks.
Only the primary agent changed manifests and lockfiles.

## Results

| Check                       | Evidence                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rust unit and HTTP tests    | 8 passed, 0 failed                                                                                                   |
| Rust formatting             | `cargo fmt --check` passed                                                                                           |
| Rust linting                | `cargo clippy --locked --all-targets -- -D warnings` passed                                                          |
| TypeScript                  | `tsc --noEmit` passed                                                                                                |
| Node/React regression suite | 22 files, 150 tests passed                                                                                           |
| Production build            | Vite and esbuild completed; existing large-chunk warning remains                                                     |
| PostgreSQL compatibility    | `pnpm test:rust:integration` passed against PostgreSQL 17                                                            |
| Browser console             | No page errors on the migrated workflows                                                                             |
| Browser/API/data            | Authenticated metrics, status switch, patient list and profile loaded with HTTP 200; profile read inserted its audit |

The full JavaScript suite ran with RapidOCR installed in a temporary Python
virtual environment and `vitest run --testTimeout=30000`. Without that dependency,
the existing image OCR test fails; with the default five-second timeout it can
time out on this machine. No OCR code, requirements, or test timeouts were changed.

## Browser flow

Verification skill: [Vercel verification](skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/verification/SKILL.md).

Story: existing React admin pages load through Node's tRPC adapter, delegate their
selected reads to Rust, query the shared PostgreSQL schema, and render the
existing response shapes.

Chromium/Playwright ran against local Node and Rust services with a synthetic,
Node-compatible signed admin cookie. The browser received HTTP 200 for
`auth.me`, `dashboard.metrics`, `patients.list`, `patients.getById`, and the
unmigrated `doctors.list` and `clinical.get` calls used by those pages. Switching
the metrics status to All rendered the complete analysis. The profile read
produced one `VIEW_PATIENT_PROFILE` row for the fixture patient.

The initial browser selectors needed correction for the existing surname-first
layout and its hidden mobile copy; no application change was required.

- [Metrics screenshot](rust-metrics.png)
- [Patient list screenshot](rust-patients.png)

## Limits and remaining work

The real Google OAuth exchange was not exercised because no provider credentials
were configured. Its existing implementation remains in Node. Patient portal
consent/access rules, clinical mutations, messaging, files, imports/OCR, settings,
scheduled jobs, and the Leptos frontend remain migration work.

Rust direct metrics reads require the existing catalog synchronization to have
run. The supported Node adapter enforces that synchronization before delegation.
The current Vercel configuration still deploys Node; Rust production hosting is
not configured or tested here. See [run instructions](../rust-backend-migration.md).
