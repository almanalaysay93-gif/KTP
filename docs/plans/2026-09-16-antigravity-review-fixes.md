# SKTI NurseTrack: Antigravity fix handoff

Date: 2026-09-16
Repository: `D:/al projects/sktiNODandNAtracker`
Reviewed baseline: `cb2b418`
Owner: Antigravity

## 1. Objective and boundaries

Fix findings F1 through F4, then return evidence for review.
This document is the implementation handoff requested by Don.
The current handoff session prepares and delivers the plan.
It does not deploy changes or send staff email.

Read `AGENTS.md` and the installed communication skills before implementation.
Check the current branch, HEAD, worktree, and active writers before changing files.
The repository changed during the original review.
Preserve `a3d9f98` profile query improvements and `cb2b418` assignment name fixes.
Use an isolated worktree if another agent is writing to the checkout.
Do not overwrite another agent's changes.
Keep implementation within these four findings and their required tests.
Do not commit, push, merge, deploy, modify production data, or send real email under this handoff alone.
Prepare a reviewable diff and report first.

## 2. Evidence and implementation order

The review found these defects in the inspected source:

- **F1, high:** Email changes retain the old Google link, but Google login refuses to replace that link.
- **F2, high:** The profile calculates compliance from object truthiness instead of the server percentage.
- **F3:** The Vercel handler has no scheduled reminder entry point or configured cron job.
- **F4:** Both email passes increment `sent` without checking the delivery result.

Implement F1, then F2, then F4, then F3.
F3 depends on truthful F4 results before automatic execution is enabled.
Use separate implementation and review scopes when the repository requires multiple agents.
Give each writing agent an isolated worktree.

Baseline checks passed: `pnpm check`, `pnpm build`, and 97 tests.
Five integration tests were skipped.
These results do not prove authenticated browser behavior or production email delivery.
The live anonymous nurse API returned 403.
The supervisor and staff sign-in pages loaded successfully.

## 3. F1: Repair email changes and Google access

### Files

- `server/db.ts`: `changeNurseAccountEmail`, `adminSetNurseAccountEmail`, and `autoLinkNurseByEmail`.
- `server/_core/trpc.ts`: `staffProcedure`.
- `server/_core/oauth.ts`: the Google callback and verified email handoff.
- `server/routers/staffAccount.ts`: email mutation and response behavior.
- `client/src/pages/MyProfilePage.tsx`: successful email-change feedback and navigation.
- `server/staffAccount.test.ts` and `server/staffAccount.authMode.test.ts`.
- `docs/plans/2026-09-15-staff-signin-claim-then-google-design.md`: sections 5.5 and E9/E10.

### Required behavior

Preserve the accepted design: retain `linkedUserId` until the new Google login, then bind the new account.
The retained identifier must not authorize the old email after the change.
Require the authenticated user's normalized email to match the current nurse `accountEmail` on each Google staff request.
Use the authenticated server identity, never an email supplied by the browser.
Audit claim-cookie fallback so it cannot restore old-account access after an email replacement.
Preserve the approved first-visit claim flow and its limited session behavior.

Allow a verified Google login matching the current `accountEmail` to replace the obsolete link.
Use a transaction or conditional database update that detects concurrent email edits and link changes.
Do not make an unconditional update after a separate read.
Prevent one Google account from acquiring another nurse's record.
Preserve normalized email uniqueness and supervisor email exclusions.
Reject archived or ineligible staff consistently with the existing sign-in rules.
Apply the same semantics to supervisor email replacement.
Preserve supervisor clear behavior: clear both email and link so first-visit claim can resume.

After a successful staff email change, clear stale profile queries and direct the user to sign in with the new email.
Explain that the old Google session no longer grants profile access.
Handle a failed email change without losing the old valid access.

### Acceptance tests

- **F1-T1:** A linked staff member changes email. The old session immediately loses staff access.
- **F1-T2:** The new verified Google account binds to the same nurse and can read only that profile.
- **F1-T3:** A fresh login with the old email cannot reclaim the nurse after rebinding.
- **F1-T4:** Supervisor replacement and supervisor clearing follow the same rules.
- **F1-T5:** An email already in use is rejected without changing the current email or link.
- **F1-T6:** Case and whitespace normalization produce the same result across all paths.
- **F1-T7:** Concurrent login and email change cannot bind an obsolete email or another nurse.
- **F1-T8:** A retained claim cookie cannot bypass revocation. Normal first-visit claim behavior remains valid.

Use a disposable database for transaction and race tests.
Use two controlled Google accounts for browser acceptance when available.
Record that browser check as unverified if those accounts are unavailable.

## 4. F2: Display the actual compliance percentage

### Files and change

Update the `stats` calculation in `client/src/pages/NurseProfile.tsx`.
Read the typed `profileData.compliance.compliancePercent` value directly.
Remove the calculation based on `Object.keys`, `Object.values`, and Boolean conversion.
Do not derive a percentage from the number of response fields.
Do not require the training catalog to display a server percentage.
Preserve the existing server rule for a staff member with no training requirements.
Display the existing unavailable marker when compliance data is absent.
Do not invent a percentage for absent or invalid data.

### Acceptance tests

- **F2-T1:** `{ compliancePercent: 50, requiredCount: 2, completedCount: 1 }` displays `50%`.
- **F2-T2:** `{ compliancePercent: 0, requiredCount: 2, completedCount: 0 }` displays `0%`.
- **F2-T3:** A server percentage of 100 displays `100%`.
- **F2-T4:** Missing data displays the unavailable marker.
- **F2-T5:** Training edits refresh the profile and display the new server percentage.

The original component calculation reproduced `100%` for F2-T1 and `33%` for F2-T2.
Test the rendered value or the exact calculation used by the component.
Do not add a broad testing framework solely for this change.

## 5. F4: Report real email results

### Files

- `server/email/dispatcher.ts`.
- `server/email/service.ts`.
- `server/db.ts`: email history and duplicate checks.
- `server/routers/settings.ts` and `client/src/pages/Settings.tsx`.
- `server/email-dispatcher.test.ts`, `server/email-service.test.ts`, and `server/email-triggers.test.ts`.

### Required behavior

Check every `SendEmailResult` before updating counters.
Count `sent` only when the provider accepts the message.
Report failures and mock sends separately.
Use one consistent result contract across both passes, the manual trigger, and the scheduled job.
Define each counter in a code comment so skipped and attempted records cannot be confused.
Update the Settings message to show failure and mock totals accurately.
Provider acceptance is not proof of inbox delivery.

Continue processing other recipients after a handled provider failure.
Keep failed attempts eligible for a later retry.
Prevent successful messages from being resent on a repeated pass.
Do not let mock history suppress a later real delivery.
Production without email credentials must fail clearly, rather than record a mock success.
Bound provider requests with a timeout compatible with the scheduled function budget.
Keep error details useful without returning secrets or unnecessary staff data.

### Acceptance tests

- **F4-T1:** Provider acceptance increments only `sent`.
- **F4-T2:** Provider rejection, exception, and timeout increment failures, not `sent`.
- **F4-T3:** Mock mode increments only the mock counter.
- **F4-T4:** A mixed recipient batch produces exact totals and processes recipients after a failure.
- **F4-T5:** A failed message can succeed on retry. An accepted message is not resent.
- **F4-T6:** Mock history does not block a later real-mode attempt.
- **F4-T7:** The Settings result displays the same totals returned by the server.

Mock the provider in automated tests.
Do not send email to real staff to prove these cases.

## 6. F3: Add a secure Vercel reminder job

### Files and route

- `server/scheduled.ts`: expose a shared, awaited job runner.
- `server/vercel.ts`: register `GET /api/cron/daily-reminders`.
- `vercel.json`: add the cron declaration.
- `.env.example`: document `CRON_SECRET`, `APP_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` without secret values.
- `server/routers/settings.ts`: share overlap protection with the manual email pass.
- Add focused scheduler and route tests under `server/`.

Retain the standalone scheduler for standalone hosting.
Do not start long-lived timers inside Vercel requests.
Await the job before returning a completed response.
Reject missing or incorrect Bearer authorization before database access or email work.
Reject requests when the configured `CRON_SECRET` is missing.
Use constant-time comparison where practical, with a length check.
Return `Cache-Control: no-store` and a small result without recipient details.

Use `0 0 * * *` for the intended daily 08:00 Asia/Manila run.
Calculate the job date explicitly in Asia/Manila.
Do not depend on the function's local timezone.
Vercel evaluates cron expressions in UTC, and invocation precision depends on the plan.
Verify the actual project plan and function limits before release.

The current API function has a 15-second limit.
Measure the whole job with representative disposable data and controlled provider latency.
Use bounded concurrency and provider timeouts.
If the job cannot finish within the configured limit, use a supported duration or a durable bounded batch design.
Do not return success while work continues without an awaited execution context.
Do not silently truncate the recipient set.

Protect against overlapping automatic and manual runs with a database-backed lock or lease.
Do not use a process-local flag as the only lock.
If a session lock is used, acquire and release it through the same dedicated database connection.
Release locks in `finally` and define recovery after a terminated function.
Use stable provider idempotency keys for repeated delivery attempts where supported.
Account for a provider accepting a message before the database records success.
Do not claim exactly-once delivery from a read-then-send duplicate check.
Keep any required migration additive and follow the repository's migration convention.

### Acceptance tests

- **F3-T1:** Missing, wrong, and unconfigured secrets produce no job work.
- **F3-T2:** A valid request awaits reminders and both email passes, then returns truthful results.
- **F3-T3:** Overlapping requests cannot send the same batch concurrently.
- **F3-T4:** A failed or timed-out pass reports failure and leaves recoverable retry state.
- **F3-T5:** A repeated successful pass does not resend the same notifications.
- **F3-T6:** Manual and scheduled execution share duplicate and overlap protection.
- **F3-T7:** The chosen workload completes within the configured function budget.
- **F3-T8:** Manila date boundaries remain correct when the server timezone is UTC.

Official references:

- [Vercel cron overview](https://vercel.com/docs/cron-jobs): production GET requests and UTC schedules.
- [Manage cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): authorization, duplicate invocations, and execution limits.
- [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing): plan-specific scheduling precision.

## 7. Validation and final handoff

First add focused regression checks that fail against the reviewed implementation.
Record that failure before applying each fix.
Run these commands after implementation:

```powershell
pnpm check
pnpm test
pnpm build
pnpm run build:vercel-api
git diff --check
git status --short
```

Generate `api/index.js` with its build command only.
Never edit the bundle by hand.
Review all generated and source changes together.
Run the new PostgreSQL race tests against a disposable database.
Do not treat the five skipped integration tests as passing evidence.
Inspect the compliance display on desktop and mobile widths.
Verify the email-change flow through the actual UI when controlled accounts are available.

Return a report under `docs/reviews/` with these fields:

- **R1:** Baseline and final source state, including uncommitted files.
- **R2:** F1 through F4 status and exact changed files.
- **R3:** Failed-before and passed-after evidence for each regression.
- **R4:** Full check totals, skipped checks, and browser evidence.
- **R5:** Migration, environment, and Vercel configuration requirements.
- **R6:** Remaining limitations and release readiness.

## 8. Release and rollback checklist

Prepare these steps for a separately authorized release.
Verify a production sender, production `APP_URL`, and `CRON_SECRET` before enabling automatic email.
Apply any additive migration before deploying code that needs it.
Verify that Vercel registers the cron and that unauthorized requests are rejected.
Use an approved test recipient for delivery evidence.
Do not trigger a staff-wide manual batch as a smoke test.
Observe a scheduled invocation before declaring automatic reminders verified.

For F3/F4 rollback, disable the cron first and preserve delivery history.
Do not delete successful message logs or idempotency records.
For an F1 regression, disable the affected email-change action until a corrected build is ready.
Do not restore stale account links blindly or reintroduce old-email access.
For F2 rollback, preserve the server percentage contract and hide an invalid value instead of displaying fabricated compliance.
