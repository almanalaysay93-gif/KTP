# Gate U9: Performance and Accessibility Audit Report

Owner: Antigravity.
Date: 2026-10-01.
Scope: KTP preview screens (`/preview/sign-in`, `/preview/admin`, `/preview/me`, `/preview/patient`, `/preview/system`, `/preview/motion`).

Verdict: PASS.
All performance, touch target, contrast, keyboard, reduced motion, and state requirements meet or exceed specification targets.

## Audit criteria and results

### 1. Contrast ratios (WCAG AA 4.5:1 threshold)

Evaluated against the palette tokens in `client/src/styles/clay.css`:

- Forest ink (`#2a301e`) on surface-2 (`#fbfbf7`): 13.15:1. PASS.
- Forest ink (`#2a301e`) on surface-1 (`#f4f6ec`): 12.49:1. PASS.
- Forest ink (`#2a301e`) on ground (`#e2e5d5`): 10.65:1. PASS.
- Muted ink (`#5c6350`) on surface-2 (`#fbfbf7`): 6.03:1. PASS.
- Muted ink (`#5c6350`) on ground (`#e2e5d5`): 4.89:1. PASS.
- Brick action red (`#ae3c30`) on surface-2 (`#fbfbf7`): 5.80:1. PASS.
- Brick action red (`#ae3c30`) on ground (`#e2e5d5`): 4.70:1. PASS.
- Overdue raspberry (`#a3143f`) on surface-2 (`#fbfbf7`): 7.42:1. PASS.
- Overdue raspberry (`#a3143f`) on ground (`#e2e5d5`): 6.01:1. PASS.
- Due soon ochre (`#8f531d`) on surface-2 (`#fbfbf7`): 5.91:1. PASS.
- Due soon ochre (`#8f531d`) on ground (`#e2e5d5`): 4.79:1. PASS.
- Sage deep (`#475438`) on surface-2 (`#fbfbf7`): 7.81:1. PASS.
- Maroon (`#6c120c`) on peach tint (`#f8e2d8`): 10.42:1. PASS.
- Forest ink (`#2a301e`) on sage tint (`#e1e7d2`): 9.80:1. PASS.

All text pairings exceed the 4.5:1 WCAG AA minimum standard.

### 2. Touch target sizing (44 px minimum)

Evaluated across all interactive elements:

- Navigation buttons: `min-h-11` (44 px). PASS.
- Action buttons (`ClayButton`): sizes sm (36 px with 44 px target pad), md (44 px), lg (48 px). PASS.
- Mobile bottom navigation bar: `h-16` (64 px) with full-height tap regions. PASS.
- Linked donor profile buttons: `min-h-11` with `px-2 py-1`. PASS.
- Stepper nodes and tabs: `min-h-11`. PASS.
- Form inputs and controls: 44 px height with visible focus states. PASS.

### 3. Keyboard navigation and focus states

- Skip links provided on both patient portal (`Skip to main content`) and admin console (`Skip to triage`).
- Focus styling: `.clay-focus` applies a distinct, high-contrast double ring (`2px var(--surface-2)`, `2px var(--brick)`).
- Tab indices and aria attributes properly coordinated:
  - Radio groups and state toggles use `aria-pressed`.
  - Steppers use `aria-current="step"`.
  - Navigation bars use `<nav aria-label="...">` and `aria-current="page"`.
  - Trays support roving focus and arrow key navigation.

### 4. Reduced motion compliance

- System preference `prefers-reduced-motion: reduce` honored across all primitives.
- CSS media query in `client/src/styles/clay.css` and `motion.css` forces animation and transition durations to 0.01 ms.
- Framer Motion `MotionRoot` collapses springs to static values and disables transforms.
- Parallax backdrop unmounts under reduced motion.
- In-view count-ups render target values immediately.
- Skeleton loading sheen terminates after one 1.6 s cycle, preventing infinite looping.

### 5. Viewport layout and mobile overflow

- Root layouts apply `overflow-x-clip`.
- Verified at 1440 px desktop and 390 px mobile viewports.
- No horizontal scrollbars or clipping observed.
- Nine-Cell Tray reflows responsively on narrow viewports.
- Bottom padding on mobile patient shell provides 132 px total clearance, keeping cards clear of the floating bar.

### 6. Component states

All preview screens provide and verify complete state implementations:

- Loading states: single-pass skeleton wells with `aria-busy`.
- Empty states: contextual recovery messaging and actions.
- Error states: inline recovery buttons with retry handlers.
- Ready states: high-density clinical telemetry cards and charts.

## Automated verification

Automated test suites pass:

1. `pnpm check`: 0 errors.
2. `npx vitest run client/src/pages/preview`: 24 of 24 tests passed across 2 test files.
3. `npx vite build`: production build passed cleanly.
