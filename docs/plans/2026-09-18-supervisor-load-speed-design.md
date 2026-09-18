# Supervisor Dashboard Load Speed Design

Date: 2026-09-18.
Base: `main` at `e04cb7c`.
Status: design accepted, not implemented.

## 1. Understanding summary

- U1: The work makes the NurseTrack supervisor dashboard at `https://nodandnatracker.vercel.app` load faster.
- U2: The first open waits for one JavaScript file of 1.08 MB raw and 267 KB compressed that holds every page.
- U3: Each page change waits for server data, and a Vercel cold start adds about 3 seconds.
- U4: Supervisors use hospital desktop computers and personal phones on mobile data.
- U5: The target is first real content in about 2 seconds on a phone and a page change in less than 1 second.
- U6: The work uses code changes only, on the free Vercel plan.
- U7: The staff portal (`/me`), new hosting, paid plans, and feature changes are not in scope.

## 2. Assumptions

- AS1: "Phone" means a mid-range Android phone on 4G, measured with Lighthouse mobile throttling.
- AS2: Traffic is small, with a few supervisors at the same time.
- AS3: Code changes can reduce cold starts but cannot remove them on the free plan.
- AS4: A page never shows data from before a save that the same supervisor made.
- AS5: Before and after measurements on production decide success.
- AS6: The first-content target applies to a signed-in supervisor who opens `/dashboard`.

## 3. Decision log

| ID | Decision | Alternatives | Reason |
|----|----------|--------------|--------|
| DL1 | Scope is the supervisor dashboard only. | Staff portal, both | User choice. |
| DL2 | Stay on the free Vercel plan and change code only. | Vercel Pro, other hosting | User choice. |
| DL3 | Browser storage is allowed, cleared on sign-out, with a 12-hour limit. | Memory only, no limit | User choice. Shared hospital computers need the limits. |
| DL4 | Target: about 2 seconds to first content on a phone, less than 1 second per page change. | No numbers | User choice. |
| DL5 | Use approach O1: code splitting, browser data cache, prefetch, and a smaller server startup. | O2 code splitting only, O3 offline app with a service worker | O2 misses the page-change target. O3 adds release-cache maintenance for a small user group. |
| DL6 | The app waits for the `auth.me` session check before it shows cached data. | Show cached data first | Cached staff data must not appear after a session ends on a shared computer. |
| DL7 | Data prefetch starts on menu hover, touch, or focus, with one request at a time. | Prefetch all pages at start | Limits server load and avoids the Vercel DDoS mitigation block. |
| DL8 | Keep-warm pings are not used. | Cron keep-warm | The free plan runs cron jobs once a day only. |

## 4. Design

### 4.1 Page code loads on demand

- `App.tsx` loads each supervisor page and each staff portal page with `React.lazy`.
- The router, the session check, `DashboardLayout`, `SignInPanel`, and `NotFound` stay in the main file.
- A `Suspense` boundary inside the layout shows the page skeleton, so the sidebar stays on screen.
- `vite.config.ts` puts React, Radix UI, the chart library, and the icons into separate vendor files.
- Browsers keep the vendor files in cache across releases, because these files change rarely.
- A failed page file load after a release causes one page reload.
- A `sessionStorage` flag stops a second reload.
- A second failure shows `QueryErrorState` with Retry.

### 4.2 Browser data cache

- The design uses `@tanstack/react-query-persist-client` with a `localStorage` persister.
- Only an allowlist of supervisor queries is stored, for example `dashboard.initial`, `nurses.initial`, `trainings.initial`, `areas.list`, `reports.list`, `settings.getAll`, calendar data, and license data.
- `auth.me`, errors, pending queries, report results, and email logs are never stored.
- The stored cache key includes the supervisor account id.
- A cache for a different account is discarded.
- A cache older than 12 hours is discarded at startup.
- Sign-out deletes the stored cache and the memory cache.
- A build version value discards the stored cache after each release.
- The existing mutation invalidation refreshes data after each save, and the persister stores the new result.

### 4.3 Prefetch

- One route table maps each supervisor menu item to its page loader and its first data query.
- Pointer enter, touch start, and keyboard focus on a menu item start both loads.
- The sidebar, the mobile menu, and the command palette use the route table.
- A data prefetch runs only when the cache has no data or the data is older than 5 minutes.
- Only one data prefetch runs at a time.
- After the first page loads, an idle callback loads the code for Dashboard, Nurses, Trainings, and Licenses.
- The idle load does not run when the browser reports data saver or a 2G connection.

### 4.4 Server startup

- `localDb` and `better-sqlite3` load only when `DATABASE_URL` is not set.
- `exceljs` and `fileExtraction` load only when Smart Import runs.
- The S3 client and presigner load at the first file operation.
- Tests keep the SQLite path, because tests run without `DATABASE_URL`.

## 5. Error handling and edge cases

- A page file that is missing after a release gets one reload, then an error card.
- Corrupt or unreadable `localStorage` data is discarded without an error on screen.
- A full `localStorage` quota stops storage for that session, and the app continues from the network.
- Private browsing without storage works from the network only.
- A session that ended shows the sign-in panel, and cached data stays hidden (DL6).

## 6. Test strategy

- Unit tests for the cache rules: other account, age over 12 hours, sign-out, version change, and the allowlist.
- Unit tests for the route table and the 5-minute prefetch rule.
- A unit test for the single reload after a failed page file load.
- A browser test that opens every supervisor route.
- A browser test that hovers Nurses, clicks it, and confirms data on screen in less than 1 second with no new `nurses.initial` request.
- The build report shows that `/login` loads only the shell and vendor files.

## 7. Success measurement

1. Run Lighthouse mobile on `/login` three times, before and after.
2. As a signed-in supervisor with mobile throttling, measure the time to first content on `/dashboard`.
3. Measure the time from a menu click on Nurses, Trainings, and Licenses to data on screen.
4. Measure warm and cold `auth.me` times, five probes each.
5. The target is met when the median first content is 2 seconds or less and the median page change is 1 second or less.

## 8. Risks

- R1: A stored cache could show another supervisor's data. The account id key and sign-out deletion control this risk.
- R2: Stored data could show an old version after a release. The build version value controls this risk.
- R3: Prefetch could increase server requests. One request at a time and the 5-minute rule control this risk.
- R4: The cold-start gain is an assumption until the before and after probes run.

## 9. Expected results

These values are assumptions until the measurements in section 7 run.

- First-open download drops from about 267 KB to about 90 KB to 120 KB compressed.
- A visited page opens at once from the stored cache.
- A prefetched page opens in less than 1 second.
- A cold start drops from about 3 seconds to about 1.5 to 2 seconds.
