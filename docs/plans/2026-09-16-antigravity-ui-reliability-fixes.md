# SKTI NurseTrack: UI reliability and load-time fix plan

Date: 2026-09-16
Implementation owner: Antigravity
Repository: `D:/al projects/sktiNODandNAtracker`
Inspected baseline: `62429b0`

## 1. Scope and evidence

Fix the six user-reported behaviors below.
This plan covers implementation, verification, release preparation, and rollback.
It does not authorize deployment, deletion of production notifications, or changes to real staff records.

The baseline contains `0e8f4c0`, which claims the earlier F1 through F4 fixes.
Preserve those changes and verify their relevant tests after this work.
Do not assume the earlier review findings still describe the current implementation.
Check HEAD, worktree changes, and active writers before implementation.
Follow `AGENTS.md` and isolate concurrent writing agents in separate worktrees.

Use U1 through U6 for this plan to avoid confusion with the earlier F1 through F4 findings.

- **U1, high:** All five export buttons remain disabled in the user's session.
- **U2, high:** AI report generation stops after approximately five seconds without a visible report or error.
- **U3, medium:** Dialysis Occupancy does not open a new tab when clicked.
- **U4, high:** Duplicate renewal notifications remain, and the notification drawer closes slowly.
- **U5, medium:** Search briefly shows `No nurses found` before returning May Flor Sanchez.
- **U6, performance:** Areas, NOD, NA, Trainings, Seminars, and Calendar show one to two seconds of skeletons.

These are user observations, not new browser reproductions by Codex.
Source inspection confirms several contributing patterns, but not every production root cause.
Record network and browser evidence before claiming a root cause.

## 2. Implementation order

1. Capture the current failures and check the deployed source version.
2. Fix U1 and U2 so operations complete or show an actionable error.
3. Fix U3 and U5 with focused browser checks.
4. Fix U4 generation, history presentation, and drawer behavior separately.
5. Measure U6, then optimize only the demonstrated bottlenecks.
6. Run the full checks and prepare the final evidence report.

## 3. U1: Restore every export action

### Source evidence and files

`client/src/pages/Settings.tsx`, `ExportTab` and `ExportButton`, mounts five export queries immediately.
Each button is disabled while its query is pending.
The component does not display a query error or offer retry.
`client/src/main.tsx` uses `httpBatchLink`, so simultaneous exports can share a network request.
`server/routers/settings.ts`, `exportData`, performs full-table reads.
The `all` option reads four tables sequentially and overlaps the four individual export requests.
These patterns can amplify latency, but they do not establish why this user's requests remained pending.

### Required changes

Capture each export request's status, duration, response size, and authorization result.
Check whether one slow operation delays the whole batch.
Check database errors, query retries, and function termination.
Do not expose exported staff data in diagnostic logs.

Fetch only the selected export after the user clicks its button.
Use the real entity union rather than casting every entity to `"nurses"`.
Keep each button idle and enabled until its own export starts.
Disable only the active action and show an explicit progress label.
Show a persistent error beside the action with retry after failure.
Restore the action after failure or timeout.
Keep the server's supervisor authorization check.
Fetch a current snapshot when clicked rather than silently downloading old cached records.
Create the JSON download only after a successful response.
Use a descriptive filename and release the object URL after the download has started.

Define empty exports explicitly, using valid JSON arrays and a clear empty-data message.
Check the supported backup contract before changing the `All (JSON backup)` label or payload.
The current `all` response contains nurses, credentials, trainings, and assignments only.
Do not call it a complete restorable system backup unless its reference data and restore contract support that claim.
Preserve existing output keys unless a documented version change is necessary.
Use a consistent database snapshot for the combined export when tables can change during the request.
Handle large results within measured function and response limits, without silently truncating records.

### Acceptance

- U1-T1: Each of the five named buttons downloads its expected JSON artifact.
- U1-T2: Visiting the Export tab does not start five bulk exports.
- U1-T3: A selected export shows progress, then returns to an enabled state.
- U1-T4: Empty data, denied access, database failure, offline mode, and timeout show clear terminal states.
- U1-T5: Parse each downloaded artifact and compare its keys, row counts, and identifiers with controlled fixtures.
- U1-T6: A failure in one export does not disable the other actions.
- U1-T7: A staff or anonymous session cannot obtain supervisor exports through the direct API.

## 4. U2: Make AI report generation reliable and observable

### Source evidence and files

- `client/src/pages/AiInsights.tsx`: report mutation, local report state, and toast-only failure handling.
- `server/routers/aiInsights.ts`: report mutation and error translation.
- `server/_core/aiInsights.ts`: data digest, provider request, response parsing, and content validation.
- `server/_core/env.ts`: configured provider variables.
- `vercel.json`: current API function duration is 15 seconds.

The provider fetch has no explicit timeout in the inspected source.
Response validation rejects missing content, but does not enforce a nonblank string.
The page renders the report only when its value is truthy.
The reported five-second behavior does not prove a function timeout.

### Required changes

Reproduce with a controlled supervisor session and inspect the actual mutation response.
Record separate timings for data collection, provider response, and response parsing.
Verify that the deployed environment has the intended provider configuration without printing secret values.
Use a correlation identifier to connect a user-visible failure with sanitized server logs.

Implement explicit idle, generating, success, and failure states in the report card.
Keep a persistent inline error and retry action instead of relying only on a toast.
Reject missing, whitespace-only, non-string, and malformed report content on the server.
Validate the client response defensively before replacing the current report.
Keep the last successful report visible when regeneration fails.
Do not clear it when a new request starts.
Allow only one active generation per page interaction.
Ignore obsolete results after navigation or a newer request.

Set a provider timeout that leaves time for data collection and an error response within the function budget.
Measure normal generation before choosing a value.
If valid reports exceed that budget, select a supported duration or a durable asynchronous job design.
Do not simply shorten the request until it fails faster.
Map missing configuration, provider refusal, rate limit, malformed JSON, empty content, and timeout to safe messages.
Do not return raw provider HTML, secrets, or the full staff digest to the browser as an error.
Never substitute fabricated report content for an upstream failure.

### Acceptance

- U2-T1: A valid report is visible with its generation timestamp.
- U2-T2: Provider 401, 429, 500, HTML, malformed JSON, empty content, and timeout produce persistent visible errors.
- U2-T3: Every attempt reaches success or failure and restores the action.
- U2-T4: Regeneration failure preserves the previous report.
- U2-T5: Double-clicking does not create concurrent requests.
- U2-T6: An authenticated browser run proves the actual deployed provider path when authorized test access is available.

Use synthetic roster data and a mocked provider for automated failures.
Mark live provider verification as unverified if it cannot be performed.

## 5. U3: Use a real external navigation link

### Source evidence and files

Both desktop navigation and mobile More navigation in `client/src/components/DashboardLayout.tsx` use `window.open`.
The declared destination is `https://dialysis-occupancy-board.vercel.app`.
The reported failure could involve browser popup policy or click interception.
Do not assume either without a browser trace.

Render external navigation as a native anchor with the exact destination.
Use `target="_blank"` and `rel="noopener noreferrer"`.
Use the existing component's `asChild` support where appropriate.
Do not nest an anchor inside a button.
Keep the current page unchanged and preserve the new-tab accessible label.
Close the mobile menu without cancelling the anchor's default action.

### Acceptance

- U3-T1: Desktop click opens the declared destination in a new tab.
- U3-T2: Mobile More navigation does the same and closes its menu.
- U3-T3: Keyboard activation and modifier-click work as native links.
- U3-T4: The original AI Insights page and any report remain intact.

Record the new page event and destination URL, not just that the click handler executed.

## 6. U4: Stop duplicate notifications and remove sticky dismissal

### Source evidence and files

- `server/reminders.ts`: eligibility, reminder creation, and notification creation.
- `server/db.ts`: batch insert helpers, notification reads, and unread totals.
- `drizzle/schema.ts` and an additive migration if durable event identity is absent.
- `server/routers/notifications.ts` and the current scheduled/manual reminder entry points.
- `client/src/components/DashboardLayout.tsx`: `NotificationsBell` and `NotificationRow`.
- `client/src/components/ui/sheet.tsx`: overlay, transition, and focus behavior.

The reminder engine reads existing reminders, then derives notification payloads from candidate events.
Notification creation must be tied to database-confirmed new events, not only the earlier in-memory check.
The expired branch also creates notification payloads on each eligible pass.
Inspect the batch helper and existing constraints before selecting the repair.
The row handler calls refresh immediately and again after 200 milliseconds.
Remove redundant refresh work after confirming it serves no separate purpose.

### Generation and history

Give each notification event a durable identity using credential, renewal cycle, notification kind, and threshold where applicable.
Keep different credentials, renewal cycles, and legitimate threshold transitions distinct.
Use a database uniqueness rule or transactional insert path to enforce that identity under concurrency.
Create a notification only for an event actually accepted by the database.
Ensure a retry after partial failure neither duplicates nor loses the event.
Test scheduled and manual runs together, including expired credentials.
Preserve the earlier scheduler lock and email delivery protections.

Distinguish historical duplicate rows from newly generated duplicates.
Prepare a read-only duplicate report with candidate groups and survivor rules.
Never merge notifications solely because their names or message text match.
For confirmed duplicates, define one visible event and matching unread counts using the same rule.
Preserve audit rows until a separate cleanup is authorized.
If deletion is required, prepare a dry-run script, backup, exact row list, and rollback before requesting approval.
Do not invoke the general staff database deduplication action to clean notifications.

### Drawer dismissal

Close the drawer immediately in local UI state, independently of network requests.
Check Close, the corner control, Escape, and outside click.
Remove delayed callbacks that can refresh or reopen a dismissed drawer.
Keep focus restoration, scroll release, and reduced-motion behavior correct.
Profile long notification lists before adding virtualization or pagination.
Keep dismissal responsive even when notification queries are slow or fail.

### Acceptance

- U4-T1: Two sequential and two concurrent passes produce one notification for the same logical event.
- U4-T2: Repeated expired checks do not create repeated identical notifications.
- U4-T3: A new cycle or legitimate new threshold can create a new notification.
- U4-T4: Historical duplicates appear once under the approved identity rule, with consistent unread counts.
- U4-T5: Slow or failed network requests do not block any dismissal control.
- U4-T6: The overlay releases focus and pointer access after closing, with no delayed reopening.

## 7. U5: Remove the false empty-search flash

Update `NurseSearchDialog` in `client/src/components/DashboardLayout.tsx`.
The inspected component reads only `data` and always renders the nonblank-query empty message.
It does not distinguish loading, success, and error.

Render `Type to search nurses` only for an empty query.
Render a loading state while the active nonblank query is unresolved.
Render `No nurses found` only after that query succeeds with zero results.
Render a separate failure state with retry.
Use a short debounce only if request measurements justify it.
Keep the typed text responsive and prevent stale results from replacing the active query.
Preserve server multi-word matching and NOD/NA coverage.

### Acceptance

- U5-T1: A delayed search for May Flor Sanchez shows loading, then her result, without an empty-state flash.
- U5-T2: A completed unmatched query shows the empty state.
- U5-T3: A failed query shows an error rather than an empty result.
- U5-T4: Rapid query changes do not show results from an obsolete query.
- U5-T5: Keyboard selection opens the correct staff profile.

## 8. U6: Reduce avoidable page loading

Treat one to two seconds of initial skeleton display as latency, not an application hang.
Measure before setting a performance claim.

Inspect these files:

- `client/src/main.tsx`: query defaults, transport batching, and authentication cache handling.
- `client/src/pages/Areas.tsx`, `Nurses.tsx`, `Trainings.tsx`, `Seminars.tsx`, and `Calendar.tsx`.
- Their routers under `server/routers/`, plus relevant database helpers.
- `client/src/App.tsx` and navigation transition components when render delay remains after responses arrive.

Record first visit, warm revisit, NOD-to-NA switch, and post-edit navigation for each named page.
Separate network, authentication, database, payload, rendering, and animation time.
Record the tested device, network, deployed commit, and cache state.
Compare at least five runs per measured case and report the median and slowest observation.

The current query client already has a five-minute stale time.
Find why repeated navigation still needs a full skeleton before increasing cache duration.
Reuse stable query keys and shared NOD/NA roster data where the data contract is identical.
Keep existing data visible during background refresh and show a small refresh state.
Do not show another account's cached data after sign-out or account switching.
Preserve mutation invalidation so newly edited records appear promptly.
Reduce demonstrated sequential queries, repeated per-record lookups, and oversized payloads.
Use bounded prefetch on navigation intent only when it improves measured behavior.
Avoid prefetching every heavy page at login.
Do not remove loading states or add fake data to disguise latency.

### Acceptance

- U6-T1: Warm navigation with valid cached data does not replace content with a full-page skeleton.
- U6-T2: Cold navigation shows an honest loading state, then records or an explicit error.
- U6-T3: Before/after measurements demonstrate improvement for the actual bottleneck.
- U6-T4: Staff, training, seminar, and calendar edits invalidate all relevant views correctly.
- U6-T5: Account switching cannot expose the previous account's cached data.

## 9. Verification and completion report

Add regression checks that fail against the current behavior before applying fixes.
Use disposable data for database tests and a mocked provider for AI failure tests.
Use actual downloaded files, new browser page events, visible report states, and drawer interactions as browser evidence.
Do not replace browser acceptance with a typecheck result.

Run:

```powershell
pnpm check
pnpm test
pnpm build
pnpm run build:vercel-api
git diff --check
git status --short
```

Generate the Vercel bundle through its command, never by hand.
Report all skipped tests and authenticated checks that remain unavailable.
Do not claim success from a toast or a successful network response alone.

Write `docs/reviews/2026-09-16-ui-reliability-fix-report.md` with U1 through U6 status.
Include changed files, baseline/final commits, root causes, failed-before/passed-after evidence, and browser artifacts.
Include export validation, AI terminal states, popup evidence, duplicate counts, search states, and load-time measurements.
List production configuration, migration, and historical cleanup steps separately.

## 10. Release and rollback

Prepare a reviewable diff before a separately authorized release.
Apply additive database constraints only after identifying and safely handling conflicting historical rows.
Keep notification audit data and duplicate reports for rollback.
Revert individual UI changes if necessary without removing authorization checks or durable duplicate protection.
If an AI provider issue persists, retain visible failure and retry behavior instead of reporting a false success.
Release acceptance requires repeating the user's exact six workflows against the deployed revision.
