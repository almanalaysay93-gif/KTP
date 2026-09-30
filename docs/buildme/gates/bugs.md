# Gate U8: Bug Hunter Report

Owner: Antigravity.
Date: 2026-10-01.
Scope: `client/src/components/clay/ClayAvatar.tsx`, `client/src/components/ktp/patient/PatientShell.tsx`, `client/src/_core/hooks/useAuth.ts`, `client/src/components/ktp/KtpSignIn.tsx`, `client/src/styles/clay.css`.

Verdict: PASS.
All four carry findings from U7 and the handoff document are investigated, resolved, and verified.

## Findings and fixes

### F1: Linked-donor avatar clipping in profile header and center cell

Location: `client/src/components/clay/ClayAvatar.tsx`.
Status: Fixed.
Cause: The previous implementation used a fixed 12 px overlap (`-ml-3`) across all avatar sizes.
On a 32 px avatar (`size-8`), a 12 px overlap plus the 2 px ring covered the right half of the recipient initials.
For Analyn Villacorta and Ramil Villacorta, "AV" and "RV" clipped visually to "A\ RV".
Fix:
Scaled the initials typography in `SIZES`:
Size 32 now uses `size-8 text-[11px] tracking-tight`.
Size 40 now uses `size-10 text-[13px] tracking-tight`.
Added size-aware overlap mapping `PAIR_OVERLAPS`:
Size 32 uses `-ml-1.5` (6 px).
Size 40 uses `-ml-2` (8 px).
Size 56 uses `-ml-2.5` (10 px).
Size 72 uses `-ml-3` (12 px).
Added size-aware exchange icon badge mapping `PAIR_BADGES`.
Evidence:
Unit test suite in `client/src/pages/preview/mock/fixes.test.ts`.
Negative control test executed: mutating size 32 overlap to `-ml-3` produced an assertion failure.
Restoring `-ml-1.5` passed all 24 tests.

### F2: Patient-home bottom padding covered by floating navigation

Location: `client/src/components/ktp/patient/PatientShell.tsx`.
Status: Fixed.
Cause: The `<main>` element previously reserved 108 px (`64px+12px+32px`).
The floating tab bar has a 64 px height, a 12 px offset, and a `clay-2` elevation shadow extending upward.
On a 390 px mobile viewport, the tab bar shadow and top edge crowded the last card in the feed.
Fix:
Increased bottom padding in `PatientShell.tsx` to `pb-[calc(64px+12px+56px+env(safe-area-inset-bottom,0px))]`.
This reservation provides 132 px total clearance, ensuring the last card scrolls completely clear of the floating navigation bar.
Evidence:
Verified in `client/src/components/ktp/patient/PatientShell.tsx`.
CSS compilation verified in Vite production build.

### F3: Unnecessary global auth.me request on preview routes

Location: `client/src/_core/hooks/useAuth.ts`.
Status: Fixed.
Cause: `useAuth` ran `trpc.auth.me.useQuery(undefined)` unconditionally.
When preview routes run without the API server, requests to `/api/trpc/auth.me` receive the Vite fallback HTML.
tRPC failed while parsing the HTML document, producing client console errors.
Fix:
Added an `enabled` field to `UseAuthOptions`.
Derived `queryEnabled = options?.enabled ?? !window.location.pathname.startsWith("/preview")`.
Passed `enabled: queryEnabled` to `trpc.auth.me.useQuery`.
Set `loading: false` when query execution is disabled on preview routes.
Evidence:
When loading preview routes, `trpc.auth.me` is disabled.
No network requests or parsing errors occur.

### F4: Pixelated sign-in logo cells on desktop

Location: `client/src/components/ktp/KtpSignIn.tsx`, `client/src/styles/clay.css`.
Status: Fixed.
Cause: On desktop viewports, `LogoTray` expanded to 460 px width.
With `inset: 7%`, each 48 px source organ graphic stretched across 135 px cells, causing visible blur and pixelation.
Fix:
Capped desktop `LogoTray` dimensions in `KtpSignIn.tsx` to `lg:w-[320px] lg:max-w-[320px]`.
Adjusted `.clay-cell__media` inset in `client/src/styles/clay.css` from 7% to 12%.
Cell graphics now render at approximately 64 px within 87 px cells.
This sizing aligns with the source asset resolution and provides sharp rendering.
Evidence:
Sign-in layout balance and CSS rules verified.

## Verification

The following automated checks passed:

1. `pnpm check`: 0 errors.
2. `npx vitest run client/src/pages/preview`: 24 of 24 tests passed across 2 test files.
3. `npx vite build`: build succeeded cleanly.
