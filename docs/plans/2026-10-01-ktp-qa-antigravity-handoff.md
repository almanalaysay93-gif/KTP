# KTP QA fix plan and Antigravity handoff

Date: 2026-10-01, Asia/Manila.
Repository: `D:\al projects\KTP`.
Source report: `D:\Downloads\KTP-QA-Report-2026-10-01.pdf`, 13 pages.
Report SHA-256: `43717C8FF600C52520099B662F66B15F5AD35483E5070EB6A9A84091F6CCED33`.
Inspected baseline: `main`, commit `d426d6faf27c80cdc51ea12280aa2ae9e5d13a7d`.
The working tree was clean before this document was added.
Status: Plan ready for implementation. Application fixes have not been made in this planning task.
Implementation update: See [the local fix receipt](2026-10-01-ktp-qa-fix-receipt.md) for the completed changes and checks.

## Antigravity assignment

Implement A1 through A5 below, then complete A6.
Read the repository instructions and inspect the current diff before edits.
Recheck this plan against the current commit because another agent may have changed the code.
Preserve unrelated work and the existing `d426d6f` fix.
Use a local branch named `fix/ktp-qa-2026-10-01` if that name is available.
Do not reset an existing branch to this baseline.
Keep changes limited to the nine report issues and their direct causes.
Do not build the full calendar, messaging, laboratory, or service workflow in this fix batch.
Do not commit, push, deploy, change deployment protection, or migrate production data without separate authorization.
Use isolated test data for write tests.
Do not copy patient details, cookies, credentials, or environment values into evidence files.
Report an access blocker with the exact missing prerequisite, then continue independent local work.

## Evidence and limits

- E1: All 13 PDF pages were extracted. Embedded Patients and Settings screenshots were inspected.
- E2: Current source confirms missing admin routes and preview data in production dashboard selectors.
- E3: `pnpm check` passed on the inspected baseline.
- E4: `pnpm test` passed: 73 tests in 8 files. OAuth configuration warnings appeared in test output.
- E5: An unauthenticated request to `https://ktp-alai2.vercel.app/site.webmanifest` returned HTTP 302 to `vercel.com/sso-api`.
- E6: `https://ktp-beryl.vercel.app/site.webmanifest` returned HTTP 200 with `application/manifest+json` and valid KTP JSON.
- E7: Signed-in production flows were not repeated during this planning task. The report supplies that behavioral evidence.
- E8: A production build was not run during this planning task. Existing tests do not prove closure of the reported defects.

The report used `ktp-alai2.vercel.app`.
The local Vercel metadata names project `ktp`.
Record the tested alias, deployment ID, and commit before any live acceptance test.
Do not assume that two aliases serve the same deployment.
The screenshot paths under `/workspace/ktp-e2e-oct1/` belong to the reviewer and are not local artifact paths.

## Issue coverage

```toon
issues[9]{id,severity,pdf_page,action}:
  KTP-1,High,4,A3
  KTP-2,High,5,A3
  KTP-3,Critical,6,A1
  KTP-4,High,7,A2
  KTP-5,High,8,A2
  KTP-6,High,8,A2
  KTP-7,Medium,9,A4
  KTP-8,Low-Medium,10,A4
  KTP-9,Low,11,A5
```

## A1. Verify and finish the patient profile repair

Addresses KTP-3 first.
The report recorded `TypeError: e.slice is not a function` when the enrolled patient profile opened.
Commit `d426d6f` already accepts `Date` values in several formatters and supplies doctor objects to `PatientHeader`.
Treat this as a partial source repair until the actual profile flow passes.
The minified report stack does not establish the exact original source line.

Inspect these existing files:

- `client/src/pages/PatientDetailPage.tsx`
- `client/src/components/ktp/admin/PatientHeader.tsx`
- `client/src/components/ktp/admin/format.ts`
- `client/src/pages/preview/mock/dates.ts`
- `client/src/pages/preview/mock/derive.ts`
- `shared/ktp.ts`
- `client/src/components/ErrorBoundary.tsx`
- `server/routers/patients.ts`
- `drizzle/schema.ts`

Implementation:

1. Reproduce the enrolled profile through Patients and a direct numeric URL on the current build.
2. Compare the decoded `patients.getById` payload with the header input contract.
3. Add a typed adapter for patient header and list data where the API and display types differ.
4. Preserve nullable fields. Derive age from a valid birth date, or display an explicit unavailable value.
5. Normalize supported date inputs without a blanket string conversion that invents dates from arbitrary objects.
6. Handle null, empty, invalid strings, and invalid `Date` values without `RangeError`, `NaN`, or a false 1970 date.
7. Preserve calendar dates. Format actual timestamps in Asia/Manila where the UI promises Manila time.
8. Pass the current date explicitly to surgery-day calculations. Production must not use the preview `MOCK_TODAY` default.
9. Validate the full route ID as a positive safe integer. Do not accept a partial value such as `1abc` through `parseInt`.
10. Distinguish invalid ID, missing patient, denied access, request failure, and loading states.
11. Add a profile-level error boundary with retry and Back to patients actions.
12. Reset that boundary when the patient ID changes. Preserve the surrounding application navigation.

Current gaps include `toISOString()` on an invalid `Date` and mock-date defaults in `daysSinceSurgery`.
The database patient ID is numeric, from `patients.id` in `drizzle/schema.ts`.
Do not replace this identifier with HRN or UUID because the report suggested those as examples.

Acceptance:

- T1: The enrolled patient opens from Patients, refresh, and a copied numeric URL without a global crash.
- T2: Null and invalid date fixtures remain readable. Valid dates retain the intended day and timezone.
- T3: Linked patient and doctor details resolve without string-versus-number comparison failures.
- T4: `/patients/p08`, `/patients/1abc`, and an absent numeric ID produce controlled states without a request for the wrong patient.
- T5: A simulated render failure stays inside the profile area. Retry and return navigation work.

## A2. Use one live dashboard dataset

Addresses KTP-4, KTP-5, and KTP-6 as one connected fix.

Confirmed causes:

- F1: `TriagePanel.tsx:41` calls `patientsFor(selection)` without live data.
- F2: `triage.ts:67` defaults that function to `MOCK_DATASET`, which contains preview IDs such as `p08`.
- F3: `TriagePanel.tsx:94` calls `servicesDueSoon()` with the same preview-data problem.
- F4: `Dashboard.tsx:96` treats all patients as active. Its workup count includes all recipients, including Post-KT.
- F5: Dashboard search filters the selected panel, while its placeholder promises general patient search.
- F6: Dashboard rendering checks only `dashQuery.isLoading` and does not expose query errors correctly.

Edit these existing files as needed:

- `server/routers/dashboard.ts`
- `server/dbPatients.ts` and `server/routers/patients.ts`
- `client/src/pages/Dashboard.tsx`
- `client/src/components/ktp/admin/triage.ts`
- `client/src/components/ktp/admin/TriagePanel.tsx`
- `client/src/components/ktp/admin/TriageLists.tsx`
- `client/src/pages/preview/AdminDashboardPreview.tsx`
- `client/src/pages/preview/PatientProfilePreview.tsx`

Implementation:

1. Return the patients required by the dashboard from `dashboard.initial` using its existing single `listPatients` read.
2. Remove the separate dashboard `patients.list` request after its data comes from that response.
3. Derive stage totals, cell totals, and panel rows from this one response with the same predicates.
4. Make dataset and date inputs explicit in shared selectors. Remove implicit mock defaults from production paths.
5. Have preview callers pass their mock dataset and fixed date explicitly.
6. Put reusable display types and pure helpers outside the preview folder when production needs them.
7. Keep canonical numeric patient IDs through the API, adapters, list keys, and profile navigation.
8. Remove the affected `as any` conversions instead of hiding data-contract mismatches.
9. Keep unconnected service datasets empty. Never substitute preview services or invent clinical records.
10. Give a nonempty dashboard search its own results list over enrolled patients, independent of the selected triage cell.
11. Match trimmed, case-insensitive first name, last name, and HRN, consistent with `patients.list`.
12. Include patient status in search results so an inactive record does not imply active triage membership.
13. Label search results separately from triage totals. Clearing search restores the prior selection.
14. Handle loading, failure, retry, and true empty states without showing failed requests as zero patients.
15. Invalidate the dashboard query after successful patient enrollment, edits, and status changes.

Use these exact triage predicates:

- D1: Active means `status === "Active"`.
- D2: Recipient workup means active Recipient with `stage !== "PostKT"`.
- D3: Post-KT means active Recipient with `stage === "PostKT"`.
- D4: Donors means active Donor. Donor workup excludes `PostDonation`.
- D5: Stage counts use the same active filter plus patient type and stage.
- D6: With empty search, each card total equals its complete panel dataset before the six-row display limit.

Acceptance:

- T6: Every dashboard patient link opens the same API record as Patients. No preview patient appears on production routes.
- T7: Each people cell and stage count equals its expanded list, including zero results and more than six records.
- T8: A mixed fixture covers active workup, active Post-KT, active donors, inactive, deceased, and transferred patients.
- T9: From the default Overdue selection, name and HRN searches find the enrolled record identified in report page 8.
- T10: A no-match search is empty. Clear-search restores the selected cell. Case and surrounding spaces do not change matches.
- T11: A failed dashboard request shows retry. Recovery uses live data, and enrollment or edits refresh the dashboard.
- T12: Preview pages still show explicit sample data. Production date calculations use the current Manila date.

## A3. Remove unavailable destinations from production navigation

Addresses KTP-1 and KTP-2.
`App.tsx` has patient routes `/me/calendar` and `/me/messages`, but no admin `/calendar` or `/messages` route.
Those patient routes are not substitutes for admin workflows.
The selected fix is to hide unavailable admin controls until their real workflows exist.
This choice follows the report and avoids expanding this batch into new features.

Implementation:

1. Define one production admin navigation map for Dashboard, Patients, and Settings.
2. Replace repeated `ADMIN_HREFS` maps in Dashboard, Patients, PatientDetail, PatientEnroll, and Settings.
3. Make `AdminShell` omit unavailable destinations in production, including desktop rail and mobile drawer.
4. Preserve explicit preview behavior for preview callers. Omitting an href alone currently leaves a clickable preview-only button.
5. Hide dashboard Messages and Notifications entry points, including both bell buttons.
6. Hide profile Send message controls on both desktop and phone until a supported admin destination exists.
7. Remove the `/nurses` recovery button from `client/src/pages/NotFound.tsx`.
8. Keep a working role-aware Return Home action. Retain protected Patients navigation only where appropriate.
9. Test direct obsolete URLs through the controlled not-found page and its working return action.

Also inspect `PatientHeader.tsx` and all production `AdminShell` callers for residual message links.
Do not add a blank page and claim that Calendar or Messages works.

Acceptance:

- T13: No visible production admin control targets `/calendar`, `/messages`, or `/nurses`.
- T14: Desktop sidebar, icon rail, mobile drawer, dashboard bells, and profile actions satisfy T13.
- T15: Direct unsupported URLs have working recovery. Existing `/me/*` authorization behavior remains intact.

## A4. Make Patients and Settings usable on phones

Addresses KTP-7 and KTP-8.
`PatientsPage.tsx:125` already contains an inner horizontal scroll area, but the screenshot shows no useful scroll cue.
`ClayTabs.tsx` uses a single line with `shrink-0` triggers, which hides Settings choices from the initial phone view.

Implementation:

1. Add a mobile patient card layout in `client/src/pages/PatientsPage.tsx` below the existing desktop table breakpoint.
2. Reuse the same query, filters, and data for cards and the table.
3. Show name, HRN, type, stage, status, nephrologist, and fellow with visible labels.
4. Use a real keyboard-accessible profile link. Keep the full HRN readable without breaking it at every hyphen.
5. Allow long names and email addresses to wrap within `min-width: 0` containers.
6. Preserve loading, empty, and error states in both layouts.
7. In `Settings.tsx`, wrap the three tab triggers with a local responsive class override.
8. Allow automatic tab-list height and retain Radix selection, focus, and arrow-key behavior.
9. Keep the shared default tab style unless a shared change is necessary and its callers are checked.
10. Do not hide root horizontal overflow to conceal the defect.

Acceptance:

- T16: At 360, 390, and 430 px, all patient fields remain reachable and no page-level horizontal overflow occurs.
- T17: Long names, email addresses, and HRNs do not cover adjacent content. Profile links work by touch and keyboard.
- T18: All three Settings choices are visible before interaction. Each panel opens, including Care Team Doctors.
- T19: Check phone landscape, 1024 px, and 1440 px. Capture the 390 x 844 views used in the report.

## A5. Correct the manifest test target and verify asset delivery

Addresses KTP-9.
The live HTTP probes reproduced Vercel protection on the report alias and a valid manifest on the production alias.
This evidence does not justify adding wildcard CORS headers or disabling application authentication.

Inspect `client/index.html`, `client/public/site.webmanifest`, `vercel.json`, and the deployed alias mapping.

Implementation:

1. Confirm the canonical production deployment and its source commit from Vercel metadata.
2. Keep the relative manifest URL when it resolves correctly on that deployment.
3. Verify manifest JSON, content type, icon responses, and redirect chain on the intended alias.
4. Check the current SPA rewrite before changing it. Do not infer a static-file failure from the broad pattern alone.
5. If a static asset actually resolves to HTML, add a narrow routing correction and recheck production assets.
6. For a protected deployment, test whether `crossorigin="use-credentials"` sends the authorized session for the manifest request.
7. Apply that attribute only if it resolves the observed protected-session failure without broader access changes.
8. If the report used the wrong alias, record the target correction and repeat browser acceptance on the intended production alias.
9. Leave an unresolved protected-alias requirement open instead of claiming that a different host fixes it.
10. Request separate authorization if a deployment protection setting must change. Do not weaken API or patient access controls.

Acceptance:

- T20: The intended app origin serves valid manifest JSON with HTTP 200 and a manifest-compatible content type.
- T21: The browser shows no manifest CORS or SSO redirect failure on that origin. The declared icon loads successfully.
- T22: Record both alias results. Preserve application authentication and patient authorization.

## A6. Verification, delivery, and rollback

Add focused regression tests where their behavior fits existing test discovery.
Suggested files are `client/src/lib/ktpPatientView.test.ts`, `client/src/lib/ktpDashboard.test.ts`, and `server/dashboard.test.ts`.
The current Vitest configuration does not discover component-folder tests.
Extend discovery only if a component test is needed, and prove that the new test actually ran.
Use a browser test for profile rendering, responsive layout, navigation, and search behavior.
Do not replace browser acceptance with source-text assertions.
Confirm each new regression test fails on the relevant pre-fix behavior or a safe local mutation.
The existing server setup uses a temporary SQLite database and removes external database configuration.
Keep that isolation and remove only test records created by the test run.

Run these commands from the repository after implementation:

```powershell
pnpm check
pnpm test
pnpm run build:vercel-api
pnpm exec vite build
git diff --check
```

Inspect generated output without committing generated bundles by hand.
Repeat the nine report flows through an authorized admin session on the candidate deployment when one is available.
Verify admin data rejection for a signed-out caller and a patient caller.
Keep patient identity, Google account linkage, consent checks, and existing audit behavior intact.
Use no production mutation to prove test failure.
Capture before/after screenshots for KTP-7 and KTP-8, plus profile, dashboard, and search evidence.
For KTP-5, record each observed card count beside the full list total and current filters.
For KTP-9, record status, content type, redirect host, and browser console result without cookies or tokens.

Write the implementation receipt to `docs/plans/2026-10-01-ktp-qa-fix-receipt.md`.
Give every KTP issue a status: fixed and verified, fixed locally only, already fixed and reverified, or blocked.
Include changed files, source commit, tested URL, commands, test counts, screenshots, and remaining limits.
Do not mark the report closed based only on passing unit tests or an HTTP 200 application shell.

Keep A1, A2, A3, A4, and A5 reviewable as separate logical changes.
No database migration is expected for this plan.
If a release is later authorized, record its deployment ID and the previous verified deployment before promotion.
Rollback only the affected fix commits, or restore the previous verified deployment if a release fails.
Never revert unrelated work or reset the repository to this document's baseline.

## Related findings outside this fix batch

- R1: `AdminShell` still shows a sample account and a preview-only sign-out action, as report page 11 also notes.
- R2: `PatientDetailPage` opens Record result with a null claim record, while that workflow remains unconnected.
- R3: Other patient detail tabs still show Phase A3 placeholders.

Report these separately with evidence.
Do not silently expand the nine-issue batch to implement these workflows.
