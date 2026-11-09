# Rust migration verification — 2026-11-09

Baseline: `a6dca57`; local branch: `rust/backend-migration`. Source remains
uncommitted. No push, deployment or production database changes occurred.
The current source inventory is [rust-backend-source.sha256](rust-backend-source.sha256).
Earlier reports describe earlier stages; this report covers the expanded backend.

## Implemented scope

Rust now handles patient enrollment/edit/archive, all eleven clinical action
routes, appointment calendars, Z Benefit, doctors/settings, broadcasts, patient
notifications, import check/commit, automation configuration/templates/logs,
mock/provider dispatch and manual appointment sweeps. Existing tRPC procedures
delegate when `RUST_BACKEND_URL` is set. Google callback routing also delegates;
standalone start/logout routes are available. Patient lab submissions save through
Rust; the broken Node fallback is fixed too. React still renders the UI.

Writing agents used isolated `/workspace/KTP-labs` and `/workspace/KTP-zbenefit`
worktrees. The primary agent integrated files and alone changed manifests/locks.
Independent review found and prompted fixes for the secure nonce cookie,
recipient type revalidation, import whitespace/email rules, email lock contention,
and delivery-log failure handling.

## Validation

| Check | Result |
| --- | --- |
| Rust unit + HTTP boundary tests | 36 + 1 passed |
| Formatting and Clippy | Passed, warnings denied |
| TypeScript | `tsc --noEmit` passed |
| Full JavaScript regression | 25 files, 165 tests passed |
| Production build | Vite + esbuild passed; existing large-chunk warning |
| PostgreSQL parity and failure paths | Passed on local PostgreSQL 17.11 |
| Browser/API/database flows | Passed with synthetic fixtures, every observed tRPC response HTTP 200, no page exceptions |

The complete JavaScript suite used the temporary RapidOCR environment and
`vitest run --testTimeout=30000`; no application OCR dependencies or test timeout
settings were changed. The managed Docker socket was unavailable after resume,
so testing used PostgreSQL 17.11 binaries from the published embedded-postgres
package in a user-owned scratch directory, bound to loopback. Every integration
run creates and drops a randomly named database. No application database URL is
used for fixture setup.

PostgreSQL checks compare the Node and Rust implementations for complete metrics,
clinical reads and persisted write results, saved ranges/flags, correction
revisions, checklist progress, appointments, audits and Z Benefit projections.
They also exercise patient-submitted labs, snapshots/flags, Node fallback parity,
consent revocation and audit-failure rollback; enrollment/donor rules, partial updates, archive, settings
audit order, broadcast recipient sets, own notifications, import row errors and
warnings, recipient-first links, rollback and concurrent duplicate imports.

Automation checks compare twelve template/data combinations, configuration,
log projections and pagination with Node. Mock-only sweeps verify telemetry,
deduplication and nonblocking conflicts during concurrent config updates.
Injected PostgreSQL triggers reject delivery-log inserts and updates: predispatch
failure produces a retryable failed reservation; postdispatch log failure keeps
the known delivery result, exposes the pending log and does not send twice.
Both processes explicitly receive an empty `RESEND_API_KEY`; no test emails
leave the local environment.

OAuth checks verify random nonce generation, host-only HttpOnly cookies,
exact callback binding, invalid/missing nonce rejection, JSON-only logout,
restricted proxy redirects, separate session/nonce cookies and redacted errors.
They never contact Google. Real OAuth and live Resend delivery remain unverified.

## Browser evidence

Chromium exercised the existing React app with Node on port 3010 and Rust on
3011, sharing a disposable PostgreSQL database and synthetic session cookies.
The checks read persisted rows after the user actions.

- Admin: metrics/status filter, patient list/profile and access audit, automation
  settings save, mock test email, template preview, new patient enrollment with
  audit, and broadcast recipient rows.
- Mobile patient: consent acceptance/audit, home, contact edit, appointment
  confirmation with the authenticated user audit, message acknowledgment, and
  CSV document parsing through lab submission and result readback.

Screenshots: [automations](rust-automations.png),
[enrollment](rust-enrollment.png), [broadcast](rust-broadcast.png),
[metrics](rust-metrics.png), [patient list](rust-patients.png),
[consent](rust-patient-consent.png), [patient home](rust-patient-home.png),
[patient messages](rust-patient-messages.png), [patient labs](rust-patient-labs.png).

## Limits and continuation

This is a staged migration. File/photo storage, document extraction and OCR,
schema/catalog initialization, scheduled jobs, and the
React UI remain to be migrated. Patient reports use the existing Done result-storage
status and a pending-verification note, rather than a new approval-state column. Production still deploys Node.

Manual email sweeps retain the source's fixed two-day appointment window;
overdue-lab and digest triggers remain configuration only. Uncertain provider
outcomes and interrupted pending reservations require manual reconciliation to
avoid duplicate delivery. Live provider behavior is outside this test evidence.
`APP_URL` must match the browser-facing origin for the Rust OAuth callback.
Node fallback retains its legacy account-linking and redirect validation logic.
