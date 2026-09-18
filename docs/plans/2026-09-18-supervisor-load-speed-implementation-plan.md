# Supervisor Dashboard Load Speed Implementation Plan

> **For Agent:** REQUIRED SUB-SKILL: Use `do` or phased execution to implement this plan task-by-task.
> Apply Simplified Technical English rules: keep sentences short, direct, and unambiguous.

**Goal:** Reduce supervisor dashboard initial load time from ~1.08 MB (267 KB gzip) to ~90-120 KB gzip, lower page transitions below 1 second via client caching and prefetching, and reduce server cold starts by deferring heavy module initialization.

**Design Document:** [`docs/plans/2026-09-18-supervisor-load-speed-design.md`](file:///D:/al%20projects/sktiNODandNAtracker/docs/plans/2026-09-18-supervisor-load-speed-design.md)

**Target Metric:** Median initial content load in ~2.0 seconds on mobile 4G; median page transitions under 1.0 second.

---

## Phase 0: Documentation & Existing Patterns Discovery

### 1. Existing System Files
- Client entry & router: [`client/src/App.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/App.tsx)
- Client build configuration: [`vite.config.ts`](file:///D:/al%20projects/sktiNODandNAtracker/vite.config.ts)
- Query client & tRPC setup: [`client/src/main.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/main.tsx)
- Navigation and sidebar items: [`client/src/components/DashboardLayout.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/components/DashboardLayout.tsx)
- Serverless entrypoint: [`server/vercel.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/vercel.ts)
- Server database initialization: [`server/db.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/db.ts) and [`server/localDb.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/localDb.ts)
- Storage client initialization: [`server/storage.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/storage.ts)

### 2. Allowed APIs & Signatures
- **React.lazy**: `const Page = React.lazy(() => import("./pages/Page"))`
- **React.Suspense**: `<Suspense fallback={<DashboardLayoutSkeleton />}>{children}</Suspense>`
- **Rollup manualChunks**:
  ```ts
  output: {
    manualChunks: {
      "vendor-react": ["react", "react-dom", "wouter"],
      "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs"],
      "vendor-charts": ["recharts"],
      "vendor-icons": ["lucide-react"],
    }
  }
  ```
- **Query Cache Persistence**: `@tanstack/react-query-persist-client` with synchronous `localStorage` adapter or custom persister supporting account ID namespace, 12-hour expiry, and build timestamp invalidation.
- **Dynamic Imports**: `const { getSqliteDb } = await import("./localDb");` (only when `!process.env.DATABASE_URL`).

### 3. Anti-Patterns to Avoid
- Do NOT split core shell dependencies (`DashboardLayout`, `SignInPanel`, `wouter`, `useAuth`) into lazy chunks; keep them in the main bundle to avoid layout flicker.
- Do NOT persist non-allowlisted queries (`auth.me`, mutation caches, report downloads, errors, or sensitive email logs).
- Do NOT run aggressive prefetching in parallel; limit to maximum 1 concurrent network prefetch request to prevent serverless throttling.
- Do NOT introduce service workers or offline database replicas; browser `localStorage` query persistence suffices for fast warm transitions.

---

## Phase 1: Serverless Cold Start & Module Initialization Optimization

### Objective
Defer loading of heavyweight libraries (`better-sqlite3`, `exceljs`, AWS S3 SDK) on Vercel production serverless cold starts. When `DATABASE_URL` is set, SQLite is never loaded. Excel parsing loads only upon accessing smart import endpoints. S3 client initializes only upon storage operations.

### Tasks

#### Task 1.1: Lazy-load SQLite engine in database modules
- **Files:**
  - Modify: [`server/db.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/db.ts)
  - Modify: [`server/routers/seminars.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/routers/seminars.ts)
  - Test: [`server/admin-access.test.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/admin-access.test.ts)
- **Step 1:** Replace top-level static `import { getSqliteDb } from "./localDb"` with dynamic `await import("./localDb")` inside fallback branches where `!db` or `!process.env.DATABASE_URL`.
- **Step 2:** Ensure test environment continues passing without `DATABASE_URL`.
- **Step 3:** Run `pnpm test` to verify zero test regressions.

#### Task 1.2: Lazy-load ExcelJS and Import Handlers in Serverless Entry
- **Files:**
  - Modify: [`server/vercel.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/vercel.ts)
  - Modify: [`server/_core/index.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/_core/index.ts)
- **Step 1:** Wrap `importStaffEmailsHandler`, `importStaffRosterHandler`, `importStaffAreasHandler`, and `importStaffTrainingsHandler` with dynamic route registration:
  ```ts
  app.post("/api/import-staff-roster", async (req, res, next) => {
    const { importStaffRosterHandler } = await import("./importStaffRoster");
    return importStaffRosterHandler(req, res);
  });
  ```
- **Step 2:** Rebuild serverless API with `pnpm run build:vercel-api`.
- **Step 3:** Confirm bundle size and startup initialization without static `exceljs` evaluation.

#### Task 1.3: Lazy-load AWS SDK in Storage Provider
- **Files:**
  - Modify: [`server/storage.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/storage.ts)
  - Test: [`server/photo-upload-storage.test.ts`](file:///D:/al%20projects/sktiNODandNAtracker/server/photo-upload-storage.test.ts)
- **Step 1:** Change top-level `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` imports to dynamic imports inside `getClient()` and `storagePut()` when `ENV.s3BucketName` exists.
- **Step 2:** Run `pnpm test server/photo-upload-storage.test.ts`.

#### Verification Checklist Phase 1:
- [ ] `pnpm check` returns 0 TypeScript errors.
- [ ] `pnpm test` passes all 190 tests.
- [ ] `pnpm run build:vercel-api` bundles clean serverless artifact without static `exceljs` initialization on main path.

---

## Phase 2: Client Code Splitting & Vendor Chunking

### Objective
Reduce initial JavaScript transfer size by converting route components to `React.lazy` and configuring Rollup `manualChunks` to split stable vendor packages.

### Tasks

#### Task 2.1: Configure Rollup Vendor Chunking in Vite
- **Files:**
  - Modify: [`vite.config.ts`](file:///D:/al%20projects/sktiNODandNAtracker/vite.config.ts)
- **Step 1:** Add `build.rollupOptions` in `vite.config.ts`:
  ```ts
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("wouter")) return "vendor-react";
            if (id.includes("@radix-ui") || id.includes("class-variance-authority") || id.includes("clsx") || id.includes("tailwind-merge")) return "vendor-ui";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("@tanstack") || id.includes("@trpc") || id.includes("superjson")) return "vendor-query";
          }
        },
      },
    },
  }
  ```
- **Step 2:** Run `pnpm run build` and inspect generated chunks in `dist/public/assets`. Verify main bundle drops below 300 KB raw.

#### Task 2.2: Convert Pages to Lazy Loading with Chunk Recovery
- **Files:**
  - Create: `client/src/lib/lazyWithRetry.ts`
  - Modify: [`client/src/App.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/App.tsx)
- **Step 1:** Create `lazyWithRetry` helper that catches dynamic import errors (common after new production deployments) and reloads the window once with a `sessionStorage` guard before showing `QueryErrorState`.
- **Step 2:** Replace static page imports in `App.tsx` with `lazyWithRetry`:
  - Supervisor pages: `Dashboard`, `Nurses`, `NurseProfile`, `NurseEditPage`, `Areas`, `AreaDetail`, `Trainings`, `Seminars`, `SeminarDetail`, `Licenses`, `CalendarPage`, `Reports`, `SettingsPage`, `SmartImportPage`, `AiInsightsPage`, `StaffMessages`.
  - Staff portal pages: `StaffFeed`, `StaffTrainingCalendar`, `MyProfilePage`, `StaffSignInPage`.
  - Public pages: `PrivacyPolicy`, `TermsOfService`.
- **Step 3:** Retain `DashboardLayout`, `DashboardLayoutSkeleton`, `SignInPanel`, `ErrorBoundary`, and `NotFound` as static imports.
- **Step 4:** Wrap `<Switch>` routes inside `<Suspense fallback={<DashboardLayoutSkeleton />}>`.

#### Verification Checklist Phase 2:
- [ ] Initial bundle size dropped to under 150 KB raw (under 50 KB gzip) for login and initial shell.
- [ ] Every supervisor route loads on demand when navigated.
- [ ] Reload guard triggers once if a simulated chunk fetch returns 404.
- [ ] `pnpm run build` succeeds without warnings about 500 KB unminified chunks.

---

## Phase 3: Browser Data Cache for Supervisor Records

### Objective
Enable instantaneous rendering on subsequent visits and page navigations by caching allowlisted supervisor query results in browser `localStorage` with supervisor account scoping, 12-hour expiration, and build version validation.

### Tasks

#### Task 3.1: Implement Supervisor Query Cache Persister
- **Files:**
  - Create: `client/src/lib/queryPersister.ts`
  - Test: `client/src/lib/queryPersister.test.ts`
  - Modify: [`client/src/main.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/main.tsx)
- **Step 1:** Define query allowlist:
  ```ts
  export const CACHED_QUERY_KEYS = [
    "dashboard.initial",
    "dashboard.stats",
    "nurses.initial",
    "nurses.list",
    "areas.list",
    "areas.areaDashboard",
    "trainings.initial",
    "seminars.list",
    "credentials.listTypes",
    "settings.getAll",
  ];
  ```
- **Step 2:** Build storage adapter with schema:
  - Cache key: `skti_cache_v1_${userId}`.
  - Payload metadata: `buildTimestamp`, `savedAt`, `userId`, `queries`.
  - Invalidation conditions: different user ID, age > 12 hours, build version mismatch, or explicit sign-out.
- **Step 3:** Register persister in `main.tsx` or attach hydrating hooks before mounting. Ensure `auth.me` always executes live over network and gates display of cached supervisor data (Decision DL6).
- **Step 4:** Wire sign-out hook in `useAuth` to purge `skti_cache_*` keys from `localStorage`.

#### Task 3.2: Unit Test Cache Invalidation Logic
- **Files:**
  - Create: `client/src/lib/queryPersister.test.ts`
- **Step 1:** Test cache save and restore for allowlisted queries.
- **Step 2:** Test rejection of non-allowlisted queries (`auth.me`, mutations, email logs).
- **Step 3:** Test purge on 12-hour age expiration.
- **Step 4:** Test purge on account switch and sign-out.
- **Step 5:** Run `pnpm test client/src/lib/queryPersister.test.ts`.

#### Verification Checklist Phase 3:
- [ ] Unit tests for persister pass with 100% assertion rate.
- [ ] Navigating to `/dashboard` or `/nurses` renders cached data instantaneously while background refetch validates fresh state.
- [ ] Sign out completely purges stored `localStorage` query entries.

---

## Phase 4: Route-Aware Prefetch Engine

### Objective
Prefetch page JavaScript chunks and primary tRPC query datasets on supervisor menu hover, touch start, or keyboard focus, constrained to maximum 1 concurrent request with a 5-minute freshness guard.

### Tasks

#### Task 4.1: Construct Supervisor Navigation Route Table
- **Files:**
  - Create: `client/src/lib/routePrefetchTable.ts`
  - Test: `client/src/lib/routePrefetchTable.test.ts`
  - Modify: [`client/src/components/DashboardLayout.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/components/DashboardLayout.tsx)
- **Step 1:** Define the prefetch registry mapping route paths to:
  1. Component loader promise (e.g. `() => import("@/pages/Nurses")`).
  2. Data prefetch callback via `trpc.useUtils()`.
- **Step 2:** Add rate-limiter and 5-minute cache freshness checker:
  - Skip prefetch if query state exists in query cache and `Date.now() - dataUpdatedAt < 5 * 60 * 1000`.
  - Queue requests to execute strictly 1 network request at a time.
- **Step 3:** Wire `onMouseEnter`, `onTouchStart`, and `onFocus` on:
  - Desktop sidebar menu buttons.
  - Mobile bottom navigation buttons.
  - Mobile "More" drawer navigation buttons.
  - Command palette nurse search results.

#### Task 4.2: Idle Background Code Preload
- **Files:**
  - Modify: [`client/src/App.tsx`](file:///D:/al%20projects/sktiNODandNAtracker/client/src/App.tsx)
- **Step 1:** After initial signed-in page mount, check `navigator.connection` (skip if `saveData === true` or `effectiveType === "2g"`).
- **Step 2:** Use `requestIdleCallback` (with `setTimeout` fallback) to preload chunk code for top supervisor destinations (`/dashboard`, `/nurses`, `/trainings`, `/licenses`).

#### Verification Checklist Phase 4:
- [ ] Hovering or tapping a navigation item prefetches chunk and data query without queuing duplicate requests.
- [ ] 5-minute freshness rule prevents duplicate network calls.
- [ ] Network tab demonstrates seamless sub-second route transitions.

---

## Phase 5: Verification & Production Benchmarking

### Tasks
- [ ] Run full TypeScript verification: `pnpm check` (0 errors).
- [ ] Run complete test suite: `pnpm test` (all tests passing).
- [ ] Run production builds: `pnpm run build && pnpm run build:vercel-api`.
- [ ] Inspect output bundles in `dist/public/assets` to verify chunk separation:
  - `index-*.js` < 150 KB.
  - Vendor chunks split cleanly (`vendor-react`, `vendor-ui`, `vendor-charts`, `vendor-icons`, `vendor-query`).
  - Lazy page chunks created individually.
- [ ] Benchmark production deployment at `https://nodandnatracker.vercel.app`:
  - Run Lighthouse Mobile 3x on `/login` and compare before/after transfer sizes.
  - Verify signed-in `/dashboard` first contentful paint under 4G throttling.
  - Confirm page transitions between `/dashboard`, `/nurses`, and `/trainings` render in under 1 second.
- [ ] Commit all changes with Conventional Commits, push to `origin/main`, and verify Vercel deployment.
