# KTP Design Tokens, snapshot 001

Source: `client/src/styles/clay.css` (:root, @media, @theme inline), `client/src/index.css` (shadcn mapping), `client/src/lib/motion.ts`. One token per line, sorted within group. Light theme only.

## Color: neutrals

Sorted by role, light to dark.

| token | value | role |
|---|---|---|
| `--ground` | `#e2e5d5` | page background (olive sage) |
| `--surface-1` | `#f3f4ec` | raised clay card and cell face |
| `--surface-2` | `#fbfbf7` | top surface: popover, active tab, avatar ring |
| `--sunken` | `#d8dcc9` | tray well, skeleton, disabled fill |
| `--row-hover` | `#e9ecdf` | table row hover |
| `--hairline` | `#cbd0bb` | 1px dividers and borders |
| `--line-strong` | `#6b735c` | input border, header rule, disabled text |
| `--ink` | `#2a301e` | primary text, focus ring |
| `--ink-muted` | `#545b45` | secondary text |

## Color: brand

| token | value | role |
|---|---|---|
| `--brick` | `#ae3c30` | single action color, primary button |
| `--brick-hover` | `#9a3328` | brick hover state |
| `--coral` | `#de7e78` | logo heart |
| `--emergency-ink` | `#fff4ef` | text on emergency band |
| `--focus` | `var(--ink)` | focus ring source |
| `--focus-ring` | `var(--focus)` | focus ring color, overridable |
| `--lilac` | `#ccb4ba` | logo lung |
| `--maroon` | `#6c120c` | deep brand, brick shadow base |
| `--mauve` | `#9c6060` | logo kidney |
| `--on-brick` | `#fffaf6` | text on brick |
| `--peach` | `#fcd8cc` | logo highlight, skeleton sheen, focus on dark |
| `--peach-tint` | `#f8e2d8` | selected cell, accent |
| `--sage` | `#727e60` | sage brand, donor-exchange |
| `--sage-deep` | `#56613f` | deep sage brand |
| `--sage-tint` | `#e1e7d2` | center cell fill |

## Color: status

| token | value | role |
|---|---|---|
| `--done` | `#1d6433` | done text |
| `--done-bg` | `#dcefdc` | done chip fill |
| `--due-soon` | `#7a4800` | due soon text |
| `--due-soon-bg` | `#faebc6` | due soon chip fill |
| `--filed` | `#0b5e57` | filed text |
| `--filed-bg` | `#d3ede8` | filed chip fill |
| `--info` | `#1d5470` | info text |
| `--info-bg` | `#dcebf2` | info chip fill |
| `--lab-high` | `#8a1a5e` | lab high text |
| `--lab-high-bg` | `#f7ddec` | lab high fill |
| `--lab-low` | `#2a4a9a` | lab low text |
| `--lab-low-bg` | `#e0e7f7` | lab low fill |
| `--lab-normal` | `#3f4733` | lab normal text |
| `--lab-normal-bg` | `#e2e5d8` | lab normal fill |
| `--overdue` | `#a3143f` | overdue text (raspberry) |
| `--overdue-bg` | `#fbe1e8` | overdue chip fill |
| `--planned` | `#4a5238` | planned text |
| `--superseded` | `#5f6357` | superseded text |
| `--superseded-bg` | `#e6e7e0` | superseded chip fill |

## Color: chart series (clay)

| token | value | role |
|---|---|---|
| `--series-1` | `#ae3c30` | chart series 1 (brick) |
| `--series-2` | `#2f3a1c` | chart series 2 (forest) |
| `--series-3` | `#a77410` | chart series 3 (ochre) |
| `--series-4` | `#8a6c95` | chart series 4 (plum) |
| `--series-5` | `#d0706a` | chart series 5 (coral) |

## Radius

Concentric rule: inner radius = outer radius minus padding. Sorted by size.

| token | value | role |
|---|---|---|
| `--r-xs` | `8px` | radius xs |
| `--r-sm` | `12px` | radius sm |
| `--r-md` | `16px` | radius md, cell, shadcn --radius |
| `--r-lg` | `22px` | radius lg, cell at desktop |
| `--r-xl` | `28px` | radius xl, tray |
| `--r-2xl` | `36px` | radius 2xl, tray at desktop |
| `--r-pill` | `999px` | pill radius |

## Spacing

4px base. Layout tokens carry responsive overrides after the semicolon.

| token | value | role |
|---|---|---|
| `--space-1` | `4px` |  |
| `--space-2` | `8px` |  |
| `--space-3` | `12px` |  |
| `--space-4` | `16px` |  |
| `--space-5` | `20px` |  |
| `--space-6` | `24px` |  |
| `--space-8` | `32px` |  |
| `--space-10` | `40px` |  |
| `--space-12` | `48px` |  |
| `--space-16` | `64px` |  |
| `--space-20` | `80px` |  |
| `--card-pad` | `16px ; 1024+: 24px` | card padding (16, 24 at desktop) |
| `--cell-min-h` | `112px ; 1024+: 148px` | cell min height (112, 148 at desktop) |
| `--cell-pad` | `16px ; 1024+: 20px` | cell padding (16, 20 at desktop) |
| `--section-gap` | `32px ; 1024+: 48px` | section gap (32, 48 at desktop) |
| `--tray-gutter` | `10px ; 768+: 14px ; 1024+: 16px` | Nine-Cell Tray gutter (10, 14, 16 by breakpoint) |

## Type: families

| token | value | role |
|---|---|---|
| `--ff-body` | `"Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif` | body family |
| `--ff-data` | `"Atkinson Hyperlegible Mono", ui-monospace, monospace` | numbers and data family |
| `--ff-display` | `"Gabarito", ui-sans-serif, system-ui, sans-serif` | display family |

## Type: fluid and stepped sizes

fs = font-size, lh = line-height. Fluid roles clamp 320 to 1440. Stepped roles switch at 1024. Patient surfaces keep mobile values at every width.

| token | value | role |
|---|---|---|
| `--fs-body-lg` | `clamp(1.0625rem, 1.045rem + 0.089vw, 1.125rem)` |  |
| `--fs-body-sm` | `0.9375rem ; 1024+: 0.875rem` |  |
| `--fs-button` | `1rem ; 1024+: 0.9375rem` |  |
| `--fs-caption` | `0.875rem ; 1024+: 0.75rem` |  |
| `--fs-data` | `1rem ; 1024+: 0.875rem` |  |
| `--fs-data-lg` | `clamp(1.25rem, 1.179rem + 0.357vw, 1.5rem)` |  |
| `--fs-display` | `clamp(1.75rem, 1.536rem + 1.071vw, 2.5rem)` |  |
| `--fs-headline` | `clamp(1.375rem, 1.268rem + 0.536vw, 1.75rem)` |  |
| `--fs-label` | `0.875rem ; 1024+: 0.8125rem` |  |
| `--fs-numeral-xl` | `clamp(2.25rem, 1.893rem + 1.786vw, 3.5rem)` |  |
| `--fs-title` | `clamp(1.125rem, 1.089rem + 0.179vw, 1.25rem)` |  |
| `--lh-body-lg` | `clamp(1.625rem, 1.589rem + 0.179vw, 1.75rem)` |  |
| `--lh-body-sm` | `1.375rem ; 1024+: 1.25rem` |  |
| `--lh-button` | `1.25rem` |  |
| `--lh-caption` | `1.25rem ; 1024+: 1rem` |  |
| `--lh-data` | `1.5rem ; 1024+: 1.25rem` |  |
| `--lh-data-lg` | `clamp(1.5rem, 1.429rem + 0.357vw, 1.75rem)` |  |
| `--lh-display` | `clamp(2rem, 1.786rem + 1.071vw, 2.75rem)` |  |
| `--lh-headline` | `clamp(1.75rem, 1.643rem + 0.536vw, 2.125rem)` |  |
| `--lh-label` | `1.125rem ; 1024+: 1rem` |  |
| `--lh-numeral-xl` | `clamp(2.5rem, 2.143rem + 1.786vw, 3.75rem)` |  |
| `--lh-title` | `clamp(1.5rem, 1.464rem + 0.179vw, 1.625rem)` |  |

## Type: role classes

| class | declaration |
|---|---|
| `.type-body` | `font-family: var(--ff-body); font-weight: 400; font-size: 1rem; line-height: 1.5rem;` |
| `.type-body-lg` | `font-family: var(--ff-body); font-weight: 400; font-size: var(--fs-body-lg); line-height: var(--lh-body-lg);` |
| `.type-body-sm` | `font-family: var(--ff-body); font-weight: 400; font-size: var(--fs-body-sm); line-height: var(--lh-body-sm);` |
| `.type-button` | `font-family: var(--ff-body); font-weight: 700; font-size: var(--fs-button); line-height: var(--lh-button);` |
| `.type-caption` | `font-family: var(--ff-body); font-weight: 400; font-size: var(--fs-caption); line-height: var(--lh-caption);` |
| `.type-data` | `font-family: var(--ff-data); font-weight: 400; font-size: var(--fs-data); line-height: var(--lh-data); font-variant-numeric: tabular-nums;` |
| `.type-data-lg` | `font-family: var(--ff-data); font-weight: 600; font-size: var(--fs-data-lg); line-height: var(--lh-data-lg); font-variant-numeric: tabular-nums;` |
| `.type-display` | `font-family: var(--ff-display); font-weight: 800; font-size: var(--fs-display); line-height: var(--lh-display); letter-spacing: -0.02em;` |
| `.type-field-label` | `font-family: var(--ff-body); font-weight: 700; font-size: 0.9375rem; line-height: 1.25rem;` |
| `.type-headline` | `font-family: var(--ff-display); font-weight: 700; font-size: var(--fs-headline); line-height: var(--lh-headline); letter-spacing: -0.01em;` |
| `.type-label` | `font-family: var(--ff-body); font-weight: 700; font-size: var(--fs-label); line-height: var(--lh-label); letter-spacing: 0.01em;` |
| `.type-numeral-xl` | `font-family: var(--ff-data); font-weight: 600; font-size: var(--fs-numeral-xl); line-height: var(--lh-numeral-xl); letter-spacing: -0.01em; font-variant-numeric: tabular-nums;` |
| `.type-title` | `font-family: var(--ff-display); font-weight: 700; font-size: var(--fs-title); line-height: var(--lh-title);` |

## Elevation shadows

| token | value | role |
|---|---|---|
| `--clay-1` | `0 1px 2px rgb(var(--tint) / .10), 4px 6px 14px -4px rgb(var(--tint) / .18), inset 2px 2px 3px rgb(255 255 255 / .85), inset -2px -3px 5px rgb(var(--tint) / .08)` | elevation 1: chips, avatars, active tab |
| `--clay-2` | `0 2px 4px rgb(var(--tint) / .08), 8px 12px 24px -8px rgb(var(--tint) / .22), inset 3px 3px 5px rgb(255 255 255 / .90), inset -4px -5px 9px rgb(var(--tint) / .09)` | elevation 2: cell, card |
| `--clay-3` | `0 4px 8px rgb(var(--tint) / .08), 16px 22px 44px -12px rgb(var(--tint) / .28), inset 4px 4px 7px rgb(255 255 255 / .95), inset -6px -7px 12px rgb(var(--tint) / .10)` | elevation 3: hover, dialogs |
| `--clay-brick` | `0 1px 2px rgb(108 18 12 / .20), 4px 6px 14px -4px rgb(108 18 12 / .35), inset 2px 2px 3px rgb(252 216 204 / .55), inset -3px -4px 6px rgb(108 18 12 / .45)` | brick button elevation |
| `--clay-brick-pressed` | `inset 3px 4px 8px rgb(108 18 12 / .55), inset -2px -2px 4px rgb(252 216 204 / .30)` | brick button pressed |
| `--clay-disabled` | `inset 1px 1px 2px rgb(var(--tint) / .10)` | disabled inset |
| `--clay-pressed` | `inset 3px 4px 8px rgb(var(--tint) / .20), inset -2px -2px 5px rgb(255 255 255 / .70)` | pressed inset |
| `--clay-sunken` | `inset 3px 4px 9px rgb(var(--tint) / .16), inset -3px -3px 6px rgb(255 255 255 / .75)` | sunken well inset |
| `--tint` | `42 48 30` | forest RGB triplet for shadow tint |

## Motion: CSS timing

| token | value | role |
|---|---|---|
| `--dur-color` | `120ms` | CSS color transition |
| `--dur-layer` | `150ms` | CSS hover layer fade |
| `--ease-out-soft` | `cubic-bezier(0.16, 1, 0.3, 1)` | CSS ease-out |

## Tailwind theme aliases (clay.css @theme inline)

| utility token | maps to |
|---|---|
| `--color-brick` | `var(--brick)` |
| `--color-brick-hover` | `var(--brick-hover)` |
| `--color-coral` | `var(--coral)` |
| `--color-done` | `var(--done)` |
| `--color-done-bg` | `var(--done-bg)` |
| `--color-due-soon` | `var(--due-soon)` |
| `--color-due-soon-bg` | `var(--due-soon-bg)` |
| `--color-emergency-ink` | `var(--emergency-ink)` |
| `--color-filed` | `var(--filed)` |
| `--color-filed-bg` | `var(--filed-bg)` |
| `--color-ground` | `var(--ground)` |
| `--color-hairline` | `var(--hairline)` |
| `--color-info` | `var(--info)` |
| `--color-info-bg` | `var(--info-bg)` |
| `--color-ink` | `var(--ink)` |
| `--color-ink-muted` | `var(--ink-muted)` |
| `--color-lab-high` | `var(--lab-high)` |
| `--color-lab-high-bg` | `var(--lab-high-bg)` |
| `--color-lab-low` | `var(--lab-low)` |
| `--color-lab-low-bg` | `var(--lab-low-bg)` |
| `--color-lab-normal` | `var(--lab-normal)` |
| `--color-lab-normal-bg` | `var(--lab-normal-bg)` |
| `--color-lilac` | `var(--lilac)` |
| `--color-line-strong` | `var(--line-strong)` |
| `--color-maroon` | `var(--maroon)` |
| `--color-mauve` | `var(--mauve)` |
| `--color-on-brick` | `var(--on-brick)` |
| `--color-overdue` | `var(--overdue)` |
| `--color-overdue-bg` | `var(--overdue-bg)` |
| `--color-peach` | `var(--peach)` |
| `--color-peach-tint` | `var(--peach-tint)` |
| `--color-planned` | `var(--planned)` |
| `--color-row-hover` | `var(--row-hover)` |
| `--color-sage` | `var(--sage)` |
| `--color-sage-deep` | `var(--sage-deep)` |
| `--color-sage-tint` | `var(--sage-tint)` |
| `--color-series-1` | `var(--series-1)` |
| `--color-series-2` | `var(--series-2)` |
| `--color-series-3` | `var(--series-3)` |
| `--color-series-4` | `var(--series-4)` |
| `--color-series-5` | `var(--series-5)` |
| `--color-sunken` | `var(--sunken)` |
| `--color-superseded` | `var(--superseded)` |
| `--color-superseded-bg` | `var(--superseded-bg)` |
| `--color-surface-1` | `var(--surface-1)` |
| `--color-surface-2` | `var(--surface-2)` |
| `--font-display` | `var(--ff-display)` |
| `--font-mono` | `var(--ff-data)` |
| `--font-sans` | `var(--ff-body)` |
| `--radius-2xl` | `var(--r-2xl)` |
| `--radius-lg` | `var(--r-lg)` |
| `--radius-md` | `var(--r-md)` |
| `--radius-sm` | `var(--r-sm)` |
| `--radius-xl` | `var(--r-xl)` |
| `--radius-xs` | `var(--r-xs)` |

## shadcn mapping (index.css :root)

| token | value | role |
|---|---|---|
| `--accent` | `var(--peach-tint)` |  |
| `--accent-foreground` | `var(--ink)` |  |
| `--background` | `var(--ground)` |  |
| `--border` | `var(--hairline)` | border |
| `--card` | `var(--surface-1)` |  |
| `--card-foreground` | `var(--ink)` |  |
| `--chart-1` | `var(--series-1)` | chart series |
| `--chart-2` | `var(--series-2)` | chart series |
| `--chart-3` | `var(--series-3)` | chart series |
| `--chart-4` | `var(--series-4)` | chart series |
| `--chart-5` | `var(--series-5)` | chart series |
| `--destructive` | `var(--overdue)` | overdue raspberry |
| `--destructive-foreground` | `var(--on-brick)` |  |
| `--foreground` | `var(--ink)` |  |
| `--input` | `var(--line-strong)` | input border |
| `--muted` | `var(--sunken)` |  |
| `--muted-foreground` | `var(--ink-muted)` |  |
| `--popover` | `var(--surface-2)` |  |
| `--popover-foreground` | `var(--ink)` |  |
| `--primary` | `var(--brick)` | brick action |
| `--primary-foreground` | `var(--on-brick)` |  |
| `--radius` | `var(--r-md)` | shadcn base radius |
| `--ring` | `var(--ink)` | focus ring |
| `--secondary` | `var(--surface-2)` |  |
| `--secondary-foreground` | `var(--ink)` |  |
| `--sidebar` | `var(--ground)` |  |
| `--sidebar-accent` | `var(--surface-1)` |  |
| `--sidebar-accent-foreground` | `var(--ink)` |  |
| `--sidebar-border` | `var(--hairline)` |  |
| `--sidebar-foreground` | `var(--ink)` |  |
| `--sidebar-primary` | `var(--brick)` |  |
| `--sidebar-primary-foreground` | `var(--on-brick)` |  |
| `--sidebar-ring` | `var(--ink)` |  |

Note: index.css still contains a legacy `.dark` block (unused, light theme only). Not counted.

## Motion: springs (motion.ts SPRINGS)

| token | value | role |
|---|---|---|
| `SPRINGS.gentle` | `stiffness 220, damping 30, mass 1` | All patient motion, no overshoot. zeta 1.01 |
| `SPRINGS.layout` | `stiffness 380, damping 34, mass 1` | Tab, nav, and cell-to-panel shared layout. zeta 0.87 |
| `SPRINGS.page` | `stiffness 200, damping 28, mass 1` | Route transitions. zeta 0.99 |
| `SPRINGS.pop` | `stiffness 260, damping 22, mass 0.9` | Entrances, count settle. zeta 0.72 |
| `SPRINGS.press` | `stiffness 520, damping 30, mass 0.8` | Squish and release. zeta 0.74 |
| `SPRINGS.tilt` | `stiffness 150, damping 18, mass 1` | 3D tilt follow and pointer drift. zeta 0.73 |

## Motion: durations in seconds (motion.ts DURATION)

| token | value | role |
|---|---|---|
| `DURATION.bandFade` | `0.2` | |
| `DURATION.breathe` | `2.4` | |
| `DURATION.chartLineFull` | `0.9` | |
| `DURATION.chartLineLively` | `0.6` | |
| `DURATION.color` | `0.12` | |
| `DURATION.countUp` | `0.7` | |
| `DURATION.exit` | `0.12` | |
| `DURATION.fade` | `0.2` | |
| `DURATION.hover` | `0.18` | |
| `DURATION.reducedFade` | `0.15` | |
| `DURATION.ringFill` | `0.6` | |
| `DURATION.sheen` | `1.6` | |
| `DURATION.stepperFill` | `0.6` | |

## Motion: stagger in seconds (motion.ts STAGGER)

| token | value | role |
|---|---|---|
| `STAGGER.chartPoints` | `0.04` | Chart points after the line lands. |
| `STAGGER.strip` | `0.06` | Patient strip cells. |
| `STAGGER.tray` | `0.045` | Admin tray cells, row-major. |

## Motion: easing (motion.ts EASE, EASE_CSS)

| token | value | role |
|---|---|---|
| `EASE.inOut` | `[0.77, 0, 0.175, 1]` | on-screen movement between two resting states |
| `EASE.out` | `[0.16, 1, 0.3, 1]` | strong ease-out, matches --ease-out-soft |
| `EASE_CSS.inOut` | `cubic-bezier(0.77, 0, 0.175, 1)` | CSS twin |
| `EASE_CSS.out` | `cubic-bezier(0.16, 1, 0.3, 1)` | CSS twin |

## Motion: preset constants (motion.ts buildPreset)

| token | value | role |
|---|---|---|
| `TRAY_LEAD` | `0.06s` | lead before first tray cell |
| `cell.hidden.full` | `opacity 0, y 16, scale 0.92` | admin cell entrance |
| `cell.hidden.lively` | `opacity 0, y 12` | patient cell entrance |
| `centerCell.full` | `scale [0.92, 1.04, 1] over 0.52s, times [0, 0.55, 1]` | admin center cell overshoot |
| `hoverLift` | `y -2` | fine pointer hover lift |
| `page.hidden.full` | `opacity 0, y 16` | admin route enter |
| `page.hidden.lively` | `opacity 0, y 8` | patient route enter |
| `press.full` | `scaleX 1.03, scaleY 0.94 (SPRINGS.press)` | admin button squish |
| `press.lively` | `scaleX 0.97, scaleY 0.97 (SPRINGS.gentle)` | patient press |
| `pressCell` | `scaleX 0.97, scaleY 0.97` | cell press |
| `reduced.fade` | `opacity only, 0.15s linear, exit 0.1s` | reduced motion |
| `tray.hidden.full` | `opacity 0, scale 0.98` | admin tray well |

---
Total tokens: 247
