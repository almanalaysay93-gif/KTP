# Patient portal Rust migration verification — 2026-11-08

## Scope and authorization

Continues the user-authorized Rust migration on `rust/backend-migration`, based
on repository commit `a6dca57` and the prior admin-read implementation. Work is
local; no commits, pushes, production changes or deployments were performed.
The source inventory in `rust-backend-source.sha256` records the current modified
and new files after this stage.

Added current-user and enrollment checks, consent notice/acceptance, patient
profile/clinical/message reads, contact updates, appointment responses, message
acknowledgment, patient-safe hotline settings and admin clinical reads. The
existing React/tRPC contracts and PostgreSQL schema remain in use. Catalog
synchronization still runs in Node before clinical reads.

An isolated agent implemented/reviewed the clinical read module in
`/workspace/KTP-metrics`; the primary agent integrated it and owned all writes in
`/workspace/KTP`, manifests, tests and validation. Review found no blocking issues.
The React best-practices checklist covered the two changed page queries: hook
ordering and query deduplication remain intact, no new effects or client imports
were added, and the response exposes only the hotline field these pages use.

## Intentional corrections

- A message can be acknowledged only by its recipient; retrying does not insert
  duplicates. Both the Rust implementation and Node fallback enforce this.
- Appointment audits identify the authenticated user, correcting the legacy
  patient-ID actor in both implementations.
- Auto-linking cannot take an enrollment already linked to a different account.
- Malformed consent versions fail closed instead of relying on `NaN` comparison.
- Patient home/messages use a patient-scoped hotline query, fixing their existing
  forbidden requests to the admin settings endpoint without exposing other settings.

Every migrated Rust patient read/write rechecks current user, account email,
active enrollment and applicable consent inside its data transaction. Consent
and appointment audits commit with their changes. Mutations require JSON even
when the body is `{}`; cross-origin form posts receive HTTP 415.

## Automated evidence

| Check                       | Result                                                         |
| --------------------------- | -------------------------------------------------------------- |
| Rust unit/HTTP tests        | 10 passed                                                      |
| Rust formatting and Clippy  | Passed, including `-D warnings`                                |
| TypeScript                  | `tsc --noEmit` passed                                          |
| JavaScript regression tests | 157 passed across 23 files                                     |
| Production build            | Vite + esbuild passed; existing chunk-size warning remains     |
| Real PostgreSQL integration | Admin and patient compatibility suites passed on PostgreSQL 17 |

The real-database suite creates and drops a randomly named database. It tests
Node-signed sessions; current-user lookup; no enrollment takeover; mismatched or
inactive link rejection; current consent acceptance/version bump; consent audit
identity/IP/user agent; patient/doctor date restoration; own-only clinical data;
complete clinical parity with the original Node reader; appointment ownership,
cancelled/missing rejection and actor audit; cross-patient message rejection;
concurrent acknowledgment retries; Node fallback idempotence; contact isolation;
safe settings; JSON-only mutations; and deleted-user rejection. Query/context
patient-ID tampering never changes the authenticated patient's data scope.

The JavaScript suite used the temporary Python environment containing RapidOCR
and `--testTimeout=30000`, as documented in the first-stage report. No OCR
implementation, dependency manifest or test timeout setting was changed.

## Browser evidence

Story: React patient pages → Node tRPC → Rust authorization/data operation → shared
PostgreSQL → tRPC date serialization → existing React rendering.

Chromium/Playwright used local Node/Rust services, isolated synthetic PostgreSQL
fixtures and signed test sessions. Desktop admin metrics/list/profile checks
still passed. A mobile patient session then completed the consent gate, loaded
home, changed its contact number, confirmed an appointment and acknowledged its
message. The resulting contact, appointment, consent audit, appointment audit and
single acknowledgment row were checked in PostgreSQL. All recorded tRPC
requests returned HTTP 200. No page exceptions occurred.

The smoke-test selector was scoped to the fixture message after existing seed
messages made the unscoped acknowledgment button ambiguous; no product change
was needed for that test adjustment.

- [Mobile consent](rust-patient-consent.png)
- [Mobile patient home](rust-patient-home.png)
- [Mobile messages](rust-patient-messages.png)

## Remaining work

Google's real OAuth exchange is still Node-based and was not tested without
provider credentials. Admin patient writes, clinical mutations, broadcast
creation, files/photos, imports/OCR, patient lab uploads, admin settings and
scheduled work remain Node/Python migration work. The remaining Node photo/OCR/
lab-upload handlers use the Rust eligibility gate when enabled, but execute
outside that Rust transaction. The frontend remains React; Leptos is still pending.

The current deployment configuration still targets Node. Local tests do not
establish Rust production hosting or deployed behavior. See
[run instructions](../rust-backend-migration.md) for the opt-in and rollback.
