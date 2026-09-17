# SKTI NurseTrack Feature Bug Fix Plan

Date: 2026-09-17.
Base: `main` at `ab4a5d7`, equal to `origin/main`.
Production: `https://nodandnatracker.vercel.app`, Vercel function region `syd1`, `maxDuration` 15 seconds.
Status: implemented on local branches, not pushed.

| Branch | Commit | Findings |
|--------|--------|----------|
| `fix/login-route` | `466890f` | F8 |
| `fix/training-record-edit` | `62cbfd2` | F3 |
| `fix/page-load-reliability` | `903aa9b` | A1 to A6, F1, F2, F7 |
| `fix/reports` | `d43ccc5` | F4, F6 (stacked on `fix/page-load-reliability`) |
| `fix/ai-insights-report` | `80b5096` | F5 (stacked on `fix/reports`) |

A trial merge of all five branches had no conflicts.
The merged tree passed `tsc --noEmit`, 190 Vitest tests, and `vite build`.

## 1. Scope

This plan covers eight reported defects.

| ID | Defect | Root cause status |
|----|--------|-------------------|
| F1 | `/nurses` stays on the skeleton loader. | Probable. Needs a signed-in trace. |
| F2 | `/nurses?type=Nursing%20Attendant` stays on the skeleton loader. | Same cause as F1. |
| F3 | Trainings, Edit Training Record for ACLS opens with blank fields. | Confirmed in source. |
| F4 | Reports, Training Summary card click does nothing. | Not confirmed. Needs a signed-in trace. |
| F5 | AI Insights, Generate Report shows `Unexpected token A ... is not valid JSON`. | Probable. Matches a Vercel timeout page. |
| F6 | Reports, Training Compliance and Area Exposure show a license table. | Partly confirmed in source. |
| F7 | Settings skeleton stays for more than 6 seconds. | Probable. Same class as F1. |
| F8 | `/login` shows 404 instead of sign-in. | Confirmed in source and on production. |

## 2. Evidence collected

1. `client/src/App.tsx` has no `/login` route.
   The catch-all route renders `NotFound`.
2. Production returns HTTP 200 with the SPA shell for `/login`.
   The client router then renders the 404 page.
3. `client/src/pages/Trainings.tsx:698` contains `const existing = recordId ? undefined : undefined;`.
   The dialog never reads the record, so every field starts empty.
4. The same dialog sends `status: "Scheduled"` on Save because the status state starts at `"Scheduled"`.
   An edit of a Completed record through the blank dialog can change its status to Scheduled.
5. `server/routers/trainings.ts` `updateRecord` has no `trainingId` field.
   Zod strips the value, so a training type change in the dialog is silently ignored.
6. Training record mutations invalidate `trainings.listRecords`.
   The page reads `trainings.initial`, so the list does not refresh after a save.
7. `client/src/main.tsx` uses `httpBatchLink`.
   All queries that start in the same tick travel in one HTTP request, and the response waits for the slowest procedure.
8. `client/src/main.tsx` sets no `retry` option.
   React Query retries a failed query 3 times with backoff, and `isLoading` stays true for all attempts.
9. `Nurses.tsx`, `Settings.tsx`, `Trainings.tsx`, and `Reports.tsx` have no error state.
   A slow or failed query shows a skeleton until all retries end.
10. An unauthenticated call to `settings.getAll` on production took 2.97 seconds cold and 0.42 seconds warm.
    That call does no database work, so cold start alone costs about 2.5 seconds.
11. Every authenticated request runs `touchUserSession`, which is one `UPDATE ... RETURNING`.
12. `countUnreadNotifications` in `server/db.ts` selects all unread rows with no limit, then counts them in memory.
    This query runs in the same batch as each admin page query.
13. `settings.getAll` is one small `SELECT`.
    A 6 second wait for it can only come from request overhead or from a slow sibling query in the batch.
14. `generateInsightsReport` loads 6 tables, then calls OpenRouter with a 10 second timeout.
    Digest time plus cold start plus 10 seconds can pass the 15 second Vercel limit.
    Vercel then returns a plain text page that starts with `An error occurred`.
    The tRPC client parses that page as JSON, which gives `Unexpected token 'A'`.
15. `reports.generate` for `trainingCompliance` runs one query per area, per staff member, and per required training.
    That is an N+1 pattern that can pass the 15 second limit.
16. `reports.generate` for `areaExposure` returns raw assignment rows, not time per nurse per area.
    Its second column has the key `employeeId`, the label `License Number`, and the value of the latest license number.
    The report therefore looks like a license list.
17. `ReportView` in `Reports.tsx` has no error branch.
    A failed report query shows "No data for this report yet."
18. Report cards are `Card` elements with `onClick`.
    They are not focusable and have no keyboard activation.

## 3. Limits of this investigation

1. The Chrome extension was not connected, so no signed-in production trace exists.
2. The local `.env` has no `DATABASE_URL`, so no local Postgres timing exists.
3. The Supabase project region is not known.
   Assumption: the region is not `syd1`-adjacent, which adds latency to each query.
4. F4 has no confirmed root cause.
   Phase 0 must reproduce it before a fix starts.

## 4. Phase 0: Reproduce and measure

Do this phase before any code change.

1. Sign in as a supervisor on production in Chrome with DevTools open.
2. Open `/nurses` with the cache disabled.
3. Record for each `/api/trpc/` request: the procedure list in the URL, the HTTP status, the total time, and the `content-type`.
4. Repeat for `/nurses?type=Nursing%20Attendant`, `/settings`, and `/reports`.
5. On `/reports`, click each of the six cards.
   Record the request, the status, the time, and the rendered column headers.
6. On `/reports`, run `document.elementFromPoint(x, y)` at the center of the Training Summary card.
   Confirm that the card is the top element and no overlay covers it.
7. On `/ai-insights`, click Generate Report.
   Record the status, the time, and the first 200 characters of the response body.
8. On `/trainings`, open Edit for one ACLS record.
   Record the empty fields.
   Do not click Save.
9. In Vercel logs, filter on `/api/trpc` for the same time window.
   Record the function duration and any `FUNCTION_INVOCATION_TIMEOUT` entries.
10. In the Supabase dashboard, record the project region.
11. Run this read-only audit query to find records that a blank-dialog save could have changed:

```sql
select id, "nurseId", "trainingId", status, "completionDate", "updatedAt"
from nursetrack."nurseTrainings"
where status = 'Scheduled' and "completionDate" is not null
order by "updatedAt" desc;
```

Exit criteria: each of F1, F2, F4, F5, F6, and F7 has a recorded request, status, and duration.

## 5. Phase 1: Shared foundations

These changes support several findings.
Do them first.

### A1. Per-procedure timing

1. Add a timing middleware in `server/_core/trpc.ts` for `publicProcedure`, `protectedProcedure`, `staffProcedure`, and `adminProcedure`.
2. Log `path`, `type`, and duration when the duration is more than 1000 ms.
3. Do not log input values, because inputs can contain staff data.

### A2. Query retry policy

1. In `client/src/main.tsx`, set `retry` in the default query options.
2. Do not retry a `TRPCClientError` with an HTTP status from 400 to 499.
3. Retry other errors 1 time.
4. Result: a failed query shows an error in about 16 seconds at most, not in about 60 seconds.

### A3. Clear error for a non-JSON response

1. In the `httpBatchLink` `fetch` wrapper in `client/src/main.tsx`, read the response `content-type`.
2. When the response is not OK and the type is not JSON, throw `new Error("The server did not respond in time (HTTP <status>). Try again.")`.
3. tRPC wraps the thrown error in a `TRPCClientError` with that message.
4. Keep the current `UNAUTHORIZED` redirect logic unchanged.

### A4. Shared error state component

1. Create `client/src/components/nursetrack/QueryErrorState.tsx`.
2. Props: `title`, `error`, and `onRetry`.
3. Show the error message and a Retry button that calls `refetch`.

### A5. Isolate slow procedures from page loads

1. Replace `httpBatchLink` with `splitLink`.
2. Send `notifications.unreadCount`, `notifications.list`, and `areas.list` through a separate `httpBatchLink`.
3. Send all other operations through the current `httpBatchLink`.
4. Alternative: use `httpBatchStreamLink`, which tRPC v11 supports.
   Do not use it before a Vercel test confirms that streamed responses work behind the `/api/(.*)` rewrite.

### A6. Client test support

1. Add `client/src/**/*.test.ts` to `include` in `vitest.config.ts`.
2. Keep the `node` environment.
3. Test only pure functions from client code.
   The repo has no React component test harness.

## 6. Phase 2: Fixes per finding

### F1 and F2. Nurses list skeleton

Cause, probable:

1. The `nurses.initial` response waits for the whole batch, which includes `notifications.unreadCount` and `areas.list`.
2. `nurses.initial` loads all columns of all nurses and all credential rows.
3. Cold start, database connection, and the auth `UPDATE` add to each request.
4. The page has no error state, and retries extend the skeleton.

F2 has the same cause.
The `type` parameter only changes a client-side filter and does not start a different query.

Steps:

1. Apply A2, A3, A4, and A5.
2. In `Nurses.tsx`, read `error` and `refetch` from `trpc.nurses.initial.useQuery`.
3. When `error` exists and `initial` does not exist, render `QueryErrorState`.
4. In `server/db.ts`, replace `countUnreadNotifications` with one SQL query that counts distinct logical keys.
   Use the same key rule as `getNotificationLogicalKey`.
   Add a test that the new count equals the old count for a fixture with duplicate rows.
5. In `server/db.ts`, add `getLatestLicenseInfoPerNurse` with `select distinct on ("nurseId") ... order by "nurseId", "expiryDate" desc`.
   Use it in `nurses.initial` and `nurses.list` in place of `getAllNurseLicenseInfos`.
   Keep the SQLite branch.
6. Not done: the `nurses` table has no large columns, so a column list gives no measurable gain.
7. When Phase 0 shows that the database region differs from `syd1`, move the Vercel function region to the nearest region in `vercel.json`.
   This is a production configuration change.
   Get approval before the change.

Acceptance:

1. A warm load of `/nurses` shows data in less than 1.5 seconds.
2. A cold load shows data in less than 5 seconds.
3. When the API fails, the page shows the error state with Retry in less than 20 seconds.
4. `/nurses?type=Nursing%20Attendant` shows only Nursing Attendants and the NA tab is active.
5. The skeleton never stays without an end.

### F3. Edit Training Record opens blank

Cause, confirmed: the dialog never loads the record.

Steps:

1. In `Trainings.tsx`, store the selected record, not only `editRecordId`.
   Find it in `initial.records` by id.
2. Change `TrainingRecordDialog` to take `record` in place of `recordId`.
3. Create `client/src/lib/trainingRecordForm.ts` with two pure functions:
   - `recordToFormState(record)` converts a record to form strings. Dates use `dateKey` from `shared/nursetrack` in `YYYY-MM-DD` form.
   - `formStateToUpdate(initial, current)` returns only the changed fields. A cleared date returns `null`.
4. Initialize each `useState` from `recordToFormState(record)`.
5. Render the dialog with `key={record?.id ?? "new"}` so a new record always gets new state.
6. In edit mode, show the training type as read-only text.
   `updateRecord` does not accept `trainingId`, so an editable select is misleading.
   See decision D1.
7. On Save in edit mode, send `{ id, ...formStateToUpdate(initial, current) }`.
   Disable Save when no field changed.
8. Delete the line `const existing = recordId ? undefined : undefined;`.
9. In all record and catalog mutations on the page, invalidate `trainings.initial` in addition to the current keys.
10. Add `client/src/lib/trainingRecordForm.test.ts`.
    Test that an ACLS record with status Completed, provider, dates, hours, CPD units, certificate number, and remarks maps to filled form values.
    Test that an unchanged form gives an empty update.
    Test that a cleared expiry date gives `expiryDate: null`.
11. Add a server test that `updateRecord` with only `remarks` keeps the stored `status` and dates.
12. Confirm the new form test fails against the current behavior before the fix.
13. Review the Phase 0 audit query result with the supervisor.
    Correct a record only after the supervisor confirms each change.
    Back up the rows before any update.

Acceptance:

1. Edit on an ACLS record shows every stored value.
2. Save with no change sends no request.
3. A change to remarks only keeps the status and dates.
4. The records list shows the change without a page reload.

### F4. Training Summary card click does nothing

Cause: not confirmed.
Candidates:

1. An overlay covers the card, for example `.glass-bg` or the chat launcher.
2. The `reports.generate` request for `trainingSummary` fails or times out, and the view has no error state.
   The query returns every training record with no limit.
3. The click works, but the view looks unchanged during loading.

Steps:

1. Use the Phase 0 result to select the candidate.
2. For all candidates, change each report card to a `button` element, or add `role="button"`, `tabIndex={0}`, and Enter and Space handlers.
3. Add a visible loading state in `ReportView` with the report title, so the view change is clear.
4. Add an error branch in `ReportView` with `QueryErrorState`.
5. When candidate 1 is true, fix the overlay with `pointer-events: none` or a correct `z-index`.
6. When candidate 2 is true, select only the displayed columns, add `where nurses.archivedAt is null` in SQL, and measure again.
7. Correct the card description.
   The report returns one row per training record, not counts by category, provider, and status.
   See decision D2.

Acceptance:

1. A mouse click and the Enter key both open the Training Summary view.
2. The view shows rows, a clear empty message, or an error with Retry.

### F5. AI Insights JSON error

Cause, probable: the request passes the 15 second Vercel limit, and the client parses the Vercel text page as JSON.

Decision D3: replace the OpenRouter model call with a rule-based Python report.
The report makes no model call.
It follows the pattern of the existing inquiry chatbot: Node reads the database, and the Python service in `inquiry/` formats the answer.

Design:

1. Node keeps `buildDataDigest` in `server/_core/aiInsights.ts`.
   Node reads only the columns that the report uses.
2. Node sends the digest to a new Python endpoint `POST /api/insights/report` on the service at `INQUIRY_SERVICE_URL`.
   Node sends the same `Authorization: Bearer <INQUIRY_SERVICE_SECRET>` header as the inquiry call.
3. Python builds the report with fixed rules and returns JSON.
4. The client renders the sections.

Report sections and rules:

| Code | Section | Rule |
|------|---------|------|
| S1 | Urgent licenses | Expired, or expiry in 30 days or less. List each person with name, area, credential, and days. Sort by days, lowest first. |
| S2 | Licenses due in 6 months | Expiry in 31 to 180 days. Group by area. Show the count per area and the names. |
| S3 | Upcoming trainings and seminars | Status Scheduled and date from today to today plus 60 days. Sort by date. |
| S4 | Staffing by area | Active staff count per area. Flag an area with a count more than 2 times the median. Flag an area with 1 staff member or less. Write each flag as an observation, not as a recommendation. |
| S5 | Training coverage by area | Percent of required trainings that are Completed and not expired, per area. Use the same rule as the Training Compliance report in F6. |
| S6 | No data | When a section has no rows, show "Nothing to report." |

All dates use the Asia/Manila date that Node sends in the digest as `today_manila`.
Python does not read the system clock for report logic.

Steps:

1. Create `inquiry/insights_report.py` with pure functions: one function per section and one `build_report(digest)` function.
2. Add the `POST /api/insights/report` route in `inquiry/chat_service.py`.
   Apply the current `_is_authorized` check.
   Validate the digest shape and return HTTP 400 for a bad digest.
3. Response shape: `{ success, generated_for, sections: [{ code, title, lines: [...] }], text }`.
   `text` is the plain text form of all sections, for print and copy.
4. Create `inquiry/test_insights_report.py`.
   Use a fixed digest with one expired license, one license at 30 days, one at 31 days, one at 181 days, a training at 60 days, a training at 61 days, and an unbalanced area set.
   Assert each boundary.
5. Add the new test file to the `test:inquiry` script in `package.json`.
6. In `server/routers/aiInsights.ts`, change `generateReport` to call the Python endpoint with a 5000 ms timeout.
   When the service does not respond or returns an error, throw `TRPCError` with the message "The insights report service is not available. Try again later."
7. Delete `callOpenRouter`, `formatDigestForReport`, `formatDigestForChat`, and `answerInsightsChat` from `server/_core/aiInsights.ts`.
   No code calls `answerInsightsChat` now.
8. Keep `openRouterApiKey` and `openRouterModel` in `server/_core/env.ts`, because Smart Import (`server/_core/aiExtraction.ts`) uses them.
   Relabel the `.env.example` comment as Smart Import only.
9. Replace the OpenRouter test in `server/ui-reliability-u1-u6.test.ts` with tests that mock `fetch`:
   - a good Python response gives the sections,
   - a timeout gives the clear service message,
   - a non-JSON response gives the clear service message.
10. In `client/src/pages/AiInsights.tsx`, render each section as a heading with a list.
    Keep the Print and Copy actions on `text`.
11. Change the page text that names Nemotron 3.
    New text: "Rule-based reports from your current roster, license, and training data. No AI model is used, and nothing here changes any records."
    Rename the page title and the menu item from "AI Insights" to "Insights".
    Keep the `/ai-insights` route so saved links still work.
12. Apply A3 as a second guard for a Vercel timeout page.

Risk and check:

1. `INQUIRY_SERVICE_URL` defaults to `http://127.0.0.1:5005`.
   A Vercel function cannot reach that address.
2. Before step 6, confirm the production value of `INQUIRY_SERVICE_URL` in Vercel project settings and call `GET /health` on it.
3. When no hosted service exists, the chatbot also uses its fallback today.
   Then the Python service needs a host before this fix can work in production.
   Options: a Vercel Python function in `api/`, or a separate host such as Railway.
   Get approval for the host before deployment.

Acceptance:

1. Generate Report returns in less than 3 seconds warm.
2. The report shows sections S1 to S5 with correct boundary rows for the fixture.
3. No request goes to `openrouter.ai`.
4. When the Python service is down, the page shows the clear service message.
5. No message contains `is not valid JSON`.

### F6. Wrong table for Training Compliance and Area Exposure

Cause, partly confirmed:

1. Area Exposure returns raw assignment rows with a `License Number` column, which looks like a license table.
2. Training Compliance uses an N+1 query pattern that can time out.
3. The view has no error state and no `key` per report type.

Steps:

1. Render `ReportView` with `key={activeType}`.
2. Apply the error branch from F4.
3. Rewrite `trainingCompliance` in `server/routers/reports.ts` as set-based work:
   - one query for active areas,
   - one query for required trainings,
   - one query for active nurses with `currentAreaId`,
   - one query for Completed training records of those nurses.
   Compute the result in memory with maps.
   Use `activeNurseCondition()` so resigned and retired staff are excluded, as in the other reports.
4. Rewrite `areaExposure` to group by nurse and area.
   Output: nurse, license number, area, first start date, last end date or Present, number of assignments, total days.
   Sum the days of each assignment.
   See decision D2.
5. Rename the `employeeId` key to `licenseNumber` in `areaExposure` and `transferLog`, on the server and in `COLUMNS`.
6. Update `getLocalReportData` in `server/sqliteHelpers.ts` to return the same shapes.
7. Add tests with a fixture of 2 areas, 3 nurses, and overlapping assignments.
   Assert the compliance percent per area and the total days per nurse per area.
8. Remove the unused `expiredCount` query in `reports.list`.
   It adds one round trip to every Reports page load and its result is never used.

Acceptance:

1. Each card shows its own column set.
2. Training Compliance shows one row per area.
3. Area Exposure shows one row per nurse per area with total days.
4. Each report returns in less than 3 seconds warm.

### F7. Settings skeleton over 6 seconds

Cause, probable: request overhead and batch coupling, as in F1.
`settings.getAll` itself is one small query.

Steps:

1. Apply A2, A3, A4, and A5.
2. In `Settings.tsx`, render the page header and tabs at once.
   Show a skeleton only inside the General and Reminders cards while `getAll` loads.
3. Disable the Save buttons until `getAll` returns, so empty values are never saved.
4. Add the error state with Retry.
5. Replace the four parallel `update.mutate` calls in `save` with one `settings.updateMany` mutation.
   Four parallel calls give four success toasts and a partial save on failure.
   Validate all four values with one Zod schema.
   Write all four rows in one database transaction.
   Keep the SQLite branch with a SQLite transaction.
   Show one toast.
   Add a test that a bad value in one field saves no field.
   See decision D4.

Acceptance:

1. The Settings header shows in less than 1 second after navigation.
2. The form fields fill in less than 1.5 seconds warm.
3. One save gives one toast.

### F8. `/login` shows 404

Cause, confirmed: no route exists.

Steps:

1. Move the signed-out panel in `DashboardLayout.tsx` to `client/src/components/SignInPanel.tsx`.
2. Use `SignInPanel` in `DashboardLayout` for the signed-out case.
3. Add a `/login` route in `App.tsx` above the catch-all route:
   - loading: `DashboardLayoutSkeleton`,
   - admin user: redirect to `/dashboard`,
   - other signed-in user: redirect to `/me`,
   - no user: `SignInPanel`.
4. Keep `/staff-signin` unchanged.
5. Confirm that `vercel.json` sends `/login` to `index.html`.
   It does now.

Acceptance:

1. A signed-out visit to `/login` shows the Google sign-in panel and the staff sign-in link.
2. A signed-in supervisor visit to `/login` goes to `/dashboard`.
3. A signed-in staff visit to `/login` goes to `/me`.

## 7. Decisions

- D1 (decided 2026-09-17): The training type is read-only in Edit Training Record.
- D2 (decided 2026-09-17): Area Exposure groups rows by nurse and area.
  Training Summary keeps one row per record and gets a corrected description.
- D3 (decided 2026-09-17): AI Insights uses a rule-based Python report with no model call.
  See F5.
- D4 (decided 2026-09-17): Settings uses one `settings.updateMany` request for all four values.
  The server saves the values in one transaction, so a save is complete or has no effect.
  See F7 step 5.

## 8. Order of work

1. Phase 0 reproduction and measurement.
2. F8, because it is small and confirmed.
3. F3, because it can change stored data.
4. Phase 1 foundations A1 to A6.
5. F1, F2, and F7.
6. F6, then F4.
7. F5.

Use one branch per group: `fix/login-route`, `fix/training-record-edit`, `fix/page-load-reliability`, `fix/reports`, and `fix/ai-insights-timeout`.

## 9. Verification for each group

1. Run `pnpm check` or `tsc --noEmit`.
2. Run `pnpm test`.
3. Confirm that each new test fails before its fix.
4. Run `pnpm build`.
5. Deploy a Vercel preview.
6. Repeat the Phase 0 steps on the preview and record the times and statuses.
7. Check each page at 375 px width and at desktop width.

## 10. Unrelated defects found

These defects are out of scope.
Do not fix them in this work without approval.

1. `adminProcedure` returns `FORBIDDEN` when no user is signed in.
   The client redirect only reacts to `UNAUTHORIZED`, so an expired session does not go to sign-in.
2. The CSV export in `Reports.tsx` checks the key `compliancePct`, but the data key is `compliancePercent`.
   The check has no effect.
3. The inquiry answer in `server/routers/inquiry.ts:1107` says reports export to Excel `.xlsx`.
   The Reports page exports CSV.
4. The repository root contains two stray files named `a.employeeId).length})` and `a.staffName.toUpperCase().includes(n))`.
