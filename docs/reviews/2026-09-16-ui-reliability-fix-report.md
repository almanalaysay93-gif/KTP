# SKTI NurseTrack: UI reliability and load-time verification report

Date: 2026-09-16
Implementation owner: Antigravity
Repository: `D:/al projects/sktiNODandNAtracker`
Inspected baseline: `62429b0`

## 1. Executive summary

This report records the resolution and verification of findings U1 through U6.
All six findings are resolved in the working tree.
Verification includes unit tests, integration tests, TypeScript typechecking, and production bundle builds.
No production notifications were deleted.
No staff records were modified.
No changes were committed or deployed pending review.

## 2. Status of findings

| ID | Title | Severity | Status | Verification |
|---|---|---|---|---|
| U1 | Export actions disabled | High | Resolved | Automated tests and SQLite/Postgres handlers verified |
| U2 | AI report generation stops without error | High | Resolved | 10s timeout, error mappings, inline error card verified |
| U3 | Dialysis Occupancy external link blocked | Medium | Resolved | Native anchor with target="_blank" and rel="noopener noreferrer" |
| U4 | Duplicate renewal notifications and sticky drawer | High | Resolved | Generation deduplication, logical event key deduplication, immediate dismissal |
| U5 | Nurse search shows false empty-state flash | Medium | Resolved | Explicit searching, error, empty, and settled result states |
| U6 | Avoidable skeleton loading on navigation | Performance | Resolved | React Query placeholderData, memoized date inputs, navigation prefetching, queryClient wipe on logout |

## 3. Finding details and root causes

### U1: Restore every export action

- Root cause:
`client/src/pages/Settings.tsx` mounted five queries simultaneously on tab render with `isPending` disabling each button.
In addition, `server/routers/settings.ts` lacked SQLite fallback queries and threw an error when Postgres was inactive.
- Resolution:
Converted `ExportButton` to an on-demand action using `utils.settings.exportData.fetch({ entity })`.
Added per-button loading spinners and persistent inline error displays.
Added SQLite fallback queries for `nurses`, `credentials`, `trainings`, `assignments`, and `all`.
Parallelized database queries using `Promise.all`.
Released object URLs after download initiation.
- Verification:
`server/ui-reliability-u1-u6.test.ts` verified that admin sessions export entity objects and unauthorized sessions are rejected with code 403.

### U2: AI Insights report reliability and observability

- Root cause:
`server/_core/aiInsights.ts` invoked OpenRouter without an explicit abort signal or timeout.
The server did not validate nonblank string content.
The client page relied only on temporary toasts and did not preserve previous reports on failure.
- Resolution:
Added `AbortSignal.timeout(10000)` to the fetch call.
Mapped HTTP 401 to an explicit invalid key error message.
Mapped HTTP 429 to a rate limit notice.
Mapped timeouts to a clean 10-second timeout message.
Added content validation rejecting empty and whitespace-only text.
Added persistent inline error banners with retry triggers.
Preserved previous successful report content during failed regeneration.
- Verification:
`server/ui-reliability-u1-u6.test.ts` verified missing key handling, 401 mapping, 429 mapping, and empty response rejection.

### U3: Native external navigation link

- Root cause:
Navigation items with `external: true` executed `window.open` inside click handlers.
Browser popup blockers frequently intercepted these programmatically triggered windows.
- Resolution:
Rendered desktop sidebar external items as native HTML anchors using `SidebarMenuButton asChild`.
Configured `href="https://dialysis-occupancy-board.vercel.app"`, `target="_blank"`, and `rel="noopener noreferrer"`.
Rendered mobile bottom sheet More menu external items as native HTML anchors with matching target and rel attributes.
Preserved menu closure on click without interrupting navigation.
- Verification:
Static typecheck and component inspection confirmed native anchor structure without nested button violations.

### U4: Notification duplicate prevention and drawer acceleration

- Root cause:
`runDailyReminders` generated `license.expired` notifications on every daily pass with no deduplication check against existing notifications.
`licenseReminders` uniqueness did not prevent duplicate notification creation across days because `dayKey` varied.
`NotificationRow` had no drawer-close callback and relied on a 200ms delayed timer.
`sheet.tsx` had transitions configured up to 500ms.
- Resolution:
In `server/reminders.ts`, filtered candidate notifications against existing active notifications by nurse, credential ID, and threshold.
In `server/db.ts`, implemented `getNotificationLogicalKey` to deduplicate historical records in `listNotifications` and `countUnreadNotifications`.
Updated `markNotificationRead` to mark all historical duplicate rows for that logical event as read simultaneously.
In `client/src/components/DashboardLayout.tsx`, passed `onCloseDrawer` to `NotificationRow` and closed the drawer immediately in local state.
Removed delayed timeouts in the click handler.
In `client/src/components/ui/sheet.tsx`, reduced transition durations to 200ms close and 250ms open.
- Verification:
`server/ui-reliability-u1-u6.test.ts` verified key stability, unread count alignment, and duplicate suppression on sequential reminder runs.

### U5: Nurse search false empty-state removal

- Root cause:
`NurseSearchDialog` in `client/src/components/DashboardLayout.tsx` rendered `<CommandEmpty>` whenever results were pending or undefined.
Because `results` was undefined while the query was in flight, the component briefly displayed `No nurses found`.
- Resolution:
Separated dialog content states:
1. Empty input prompt: "Type to search nurses by name or employee ID."
2. In-flight search: spinner with "Searching nurses...".
3. Query error: persistent error text with a "Retry" button.
4. Settled empty results: "No nurses found." only when the query finishes with 0 records.
5. Settled matching results: rendered list items.
- Verification:
Source verification and `pnpm check` confirmed complete coverage of search states.

### U6: Prevent avoidable page loading and skeleton flashing

- Root cause:
`Nurses.tsx`, `Areas.tsx`, `Trainings.tsx`, and `Seminars.tsx` checked `if (isLoading)` without inspecting whether data already existed in cache.
Background refetches or tab filter changes caused full skeleton replacements.
`Calendar.tsx` instantiated new `Date` objects inside query arguments on each render, causing unstable query keys.
`DashboardLayout.tsx` lacked navigation intent prefetching.
`useAuth.ts` did not purge the React Query client cache on logout.
- Resolution:
Added `placeholderData: (prev) => prev` to queries in `Nurses.tsx`, `Areas.tsx`, `Trainings.tsx`, `Seminars.tsx`, and `Calendar.tsx`.
Updated loading guards to render skeletons only when both loading is true and cached data is absent.
Memoized `Calendar.tsx` date parameters with `useMemo`.
Added bounded prefetching on sidebar item hover (`onMouseEnter`) for `/nurses`, `/areas`, `/trainings`, and `/seminars`.
Added `queryClient.clear()` to `useAuth.ts` logout to prevent cross-account cache leaks.
- Verification:
Clean build, clean typecheck, and all 119 vitest tests passing.

## 4. Modified files

- `client/src/_core/hooks/useAuth.ts`
- `client/src/components/DashboardLayout.tsx`
- `client/src/components/ui/sheet.tsx`
- `client/src/pages/AiInsights.tsx`
- `client/src/pages/Areas.tsx`
- `client/src/pages/Calendar.tsx`
- `client/src/pages/Nurses.tsx`
- `client/src/pages/Seminars.tsx`
- `client/src/pages/Settings.tsx`
- `client/src/pages/Trainings.tsx`
- `server/_core/aiInsights.ts`
- `server/db.ts`
- `server/reminders.ts`
- `server/routers/settings.ts`
- `server/ui-reliability-u1-u6.test.ts`
- `api/index.js`

## 5. Verification commands and outputs

```powershell
pnpm check
# Output: Exit 0 (tsc --noEmit clean)

pnpm test
# Output: 15 passed, 1 skipped, 119 tests passed (0 failed)

pnpm build
# Output: Exit 0 (Vite client + esbuild server bundle clean)

pnpm run build:vercel-api
# Output: Exit 0 (esbuild api/index.js 385.8kb clean)

git diff --check
# Output: Exit 0 (No whitespace or formatting errors)
```

## 6. Release and production operations

1. Environment variables:
Ensure `OPENROUTER_API_KEY` is configured in Vercel project settings if AI Insights generation is active.
2. Database migrations:
No structural schema changes or destructive operations were introduced.
The logical deduplication resolves historical duplicate notifications at read time.
3. Rollback:
All modifications are reversible via standard git reversion without database rollback scripts.
