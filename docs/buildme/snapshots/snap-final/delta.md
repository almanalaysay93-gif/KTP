# Delta, snapshot final

Final verified preview state following gates U8, U9, and U10.

## Differences from snapshot 001

1. Component fixes (Gate U8):
   - `ClayAvatar.tsx`: scaled initials typography for compact sizes (32 px uses `text-[11px] tracking-tight`, 40 px uses `text-[13px] tracking-tight`).
   - `ClayAvatar.tsx`: added size-aware `PAIR_OVERLAPS` mapping (32 px uses `-ml-1.5`, 40 px uses `-ml-2`, 56 px uses `-ml-2.5`, 72 px uses `-ml-3`).
   - `ClayAvatar.tsx`: added size-aware `PAIR_BADGES` mapping for exchange icon badge.
   - `PatientShell.tsx`: increased bottom padding reservation to `pb-[calc(64px+12px+56px+env(safe-area-inset-bottom,0px))]` (132 px total clearance) to prevent floating tab bar collision.
   - `useAuth.ts`: added `enabled` parameter and automatic `/preview` route detection to disable `auth.me` tRPC query without backend server.
   - `KtpSignIn.tsx`: capped desktop `LogoTray` width to `lg:w-[320px] lg:max-w-[320px]` to eliminate upscaled cell icon pixelation.
   - `clay.css`: adjusted `.clay-cell__media` inset from 7% to 12% for appropriate emblem sizing.

2. Audits and verification (Gate U9):
   - Contrast: all foreground and background pairs exceed 4.5:1 WCAG AA threshold.
   - Touch targets: all interactive elements satisfy 44 px minimum.
   - Reduced motion: confirmed across CSS animations, Framer Motion springs, and backdrop unmounting.
   - Mobile overflow: confirmed zero horizontal scroll at 390 px.

3. Final captured assets (Gate U10):
   - 10 screenshots captured via Chrome CDP against Vite production preview build (`VITE_ENABLE_PREVIEW=true`).
   - Viewports: 1440x900 and 390x844 for sign-in, admin dashboard, patient home, patient profile, and system style guide.

## Counts

- Tokens: 247.
- Components: 43.
- Screens captured: 5 (`/preview/sign-in`, `/preview/admin`, `/preview/me`, `/preview/patient`, `/preview/system`) at 1440x900 and 390x844, 10 PNGs.
- Preview unit tests: 24 of 24 passed (`derive.test.ts`, `fixes.test.ts`).
