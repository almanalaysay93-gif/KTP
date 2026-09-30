---
name: KTP
description: Private pre and post kidney transplant tracker for Organ Transplant Services. Light clay, logo palette, nine-cell tray.
---

<!-- SEED: build contract written before implementation by U2 (impeccable-director). Values are normative for U3 to U5. Re-run /impeccable document after U5 ships to record the built system. -->

# Design System: KTP

Owner: U2. Consumers: U3 (tokens, clay components), U4 (motion), U5 (screens), U7 to U9 (gates). Product truth lives in `PRODUCT.md`. Brief item map: 1 Identity = Overview, 2 Palette = Colors, 3 Clay = Elevation & Depth + Shapes, 4 Type = Typography, 5 Grid = Layout, 6 Components, 7 Screens, 8 Motion, 9 Accessibility.

## Overview

**Creative North Star: "The Nine-Cell Tray."** The OTS mark is nine care cells ruled by forest-green lines around one center cell: two people passing a kidney. KTP turns that mark into its structure. Overview surfaces are **trays**: a sunken clay well whose gutters are the logo's grid lines, recessed. Inside sit raised clay **cells**, each one a thing to act on. Transplant patients already live with this object: the compartment pill organizer they open twice a day for tacrolimus. The admin gets one scan surface for triage; the patient gets familiar compartments instead of a dashboard.

**The one distinctive decision:** the 3x3 tray is the product's only hero structure. Admin dashboard triage, the patient profile summary, and the sign-in brand moment are 3x3 trays; the patient home uses a 1x3 strip (one row of the grid). Everything else is quiet clay cards and flat tables so the tray stays special.

**The Center Cell Rule.** In every 3x3 tray the center cell holds people (the active cohort, or this recipient and their linked donor), tinted sage like the donor-exchange icon. It never holds an alarm count.

**The Actionable Cell Rule.** A cell exists only if tapping it navigates or filters. No decorative cells, no empty filler. One 3x3 tray per screen, maximum.

**Key characteristics:** earthy clay (sage-putty ground, chalk cells, brick action), light from the top-left, hyperlegible type, clinical numbers in a monospace, status always word + icon + color, springy on admin, calm on patient.

### Generic patterns this product must avoid

- The incumbent NurseTrack look: glass panels, `backdrop-filter`, logo watermark behind content, navy and teal. Retire every `.glass-*` class on KTP surfaces.
- Stock shadcn: `h-9 rounded-md` buttons, 1px border plus `shadow-sm` cards, zinc or slate neutrals, blue focus glow.
- Candy claymorphism: baby blue, pink, and lavender blobs, 3D emoji, floating spheres, cartoon doctors. KTP clay is earthy and logo-derived.
- Neumorphism: same-color extrusions with no contrast, borderless invisible inputs.
- The hero-metric template: identical cards of big number, tiny label, green arrow, sparkline. Tray cells differ by content and state.
- Three equal feature cards with an icon in a colored circle; centered empty hero with two CTAs (the sign-in is a split with the tray).
- Warm cream ground with a serif display and terracotta accent (the brick is here, so the ground is sage and the type is sans).
- Purple or blue gradients, gradient text, neon or outer glows, colored left-border stripe cards, uppercase tracked eyebrow labels.
- Emoji anywhere, stock hospital photos, anatomy clipart beyond the logo, confetti on clinical events, spinners as page loaders, pie charts for stages, red and green as the only status signal.

## Colors

Strategy: Restrained. Sage-olive neutrals own 85% of every screen; brick is the single action color; status hues are reserved and never decorative. All neutrals share one olive hue (about 115 to 125) so grays never drift warm or cool.

### Neutrals and surfaces

| Token | Role | Hex | OKLCH |
|---|---|---|---|
| `--ground` | page background (sage putty) | `#e2e5d5` | `oklch(91.5% 0.022 115.4)` |
| `--surface-1` | clay cards, tray cells (chalk) | `#f3f4ec` | `oklch(96.4% 0.011 112.4)` |
| `--surface-2` | raised on raised: popovers, toasts, secondary buttons, tab pill | `#fbfbf7` | `oklch(98.7% 0.005 106.5)` |
| `--sunken` | tray wells, input wells, skeletons, tracks, disabled fills | `#d8dcc9` | `oklch(88.6% 0.026 116.6)` |
| `--row-hover` | flat table row hover | `#e9ecdf` | `oklch(93.7% 0.018 117.3)` |
| `--hairline` | flat table dividers (decorative only) | `#cbd0bb` | `oklch(84.8% 0.029 117.9)` |
| `--line-strong` | input borders, dashed planned chip, disabled text, upcoming stepper line | `#6b735c` | `oklch(54.2% 0.036 123.2)` |
| `--ink` | forest ink: text, icons, focus ring | `#2a301e` | `oklch(29.8% 0.032 123.3)` |
| `--ink-muted` | secondary text, placeholders, inactive nav | `#545b45` | `oklch(45.8% 0.035 122.1)` |

### Brand roles

| Token | Role | Hex | OKLCH |
|---|---|---|---|
| `--brick` | **primary action** fill, active link text, selected-cell bar | `#ae3c30` | `oklch(51.7% 0.151 29.2)` |
| `--brick-hover` | primary hover | `#9a3328` | `oklch(47.1% 0.140 29.4)` |
| `--maroon` | primary pressed, emergency band, recipient initials | `#6c120c` | `oklch(34.6% 0.124 29.1)` |
| `--on-brick` | text on brick and maroon buttons | `#fffaf6` | `oklch(98.8% 0.008 61.5)` |
| `--sage-deep` | **secondary**: people, center cell text, progress fill | `#56613f` | `oklch(47.4% 0.054 123.0)` |
| `--sage` | people icons only (3.89:1, glyphs not text) | `#727e60` | `oklch(57.5% 0.047 125.6)` |
| `--sage-tint` | center cell fill, donor avatar fill | `#e1e7d2` | `oklch(91.8% 0.029 119.9)` |
| `--peach` | **accent**: clay highlight on brick, focus ring on dark | `#fcd8cc` | `oklch(90.9% 0.044 39.3)` |
| `--peach-tint` | selected cell and row fill, recipient avatar fill | `#f8e2d8` | `oklch(92.8% 0.028 46.1)` |
| `--coral`, `--mauve`, `--lilac` | decorative only (backdrop cells, illustrations) | `#de7e78`, `#9c6060`, `#ccb4ba` | `oklch(69.7% 0.120 24.4)`, `oklch(55.5% 0.079 19.9)`, `oklch(79.2% 0.029 0.9)` |
| `--emergency-ink` | text on the emergency band | `#fff4ef` | `oklch(97.4% 0.014 46.2)` |
| `--focus` | focus ring (ink); on maroon or brick contexts use `--peach` | `#2a301e` | as ink |

### Status roles (never brick; always icon + word)

| Status | fg | bg | fg OKLCH | Icon (lucide) | Chip form |
|---|---|---|---|---|---|
| Overdue | `#a3143f` | `#fbe1e8` | `oklch(46.5% 0.174 11.8)` | `TriangleAlert` | filled |
| Due soon (7 days) | `#7a4800` | `#faebc6` | `oklch(45.0% 0.100 66.1)` | `Clock` | filled |
| Planned / upcoming / Open | `#4a5238` | transparent, 1.5px dashed `--line-strong` | `oklch(42.4% 0.042 122.1)` | `CalendarClock` | hollow |
| Done | `#1d6433` | `#dcefdc` | `oklch(44.7% 0.105 149.9)` | `CircleCheck` | filled |
| Filed (claim) | `#0b5e57` | `#d3ede8` | `oklch(43.5% 0.073 185.8)` | `FileCheck2` | filled |
| Superseded | `#5f6357` | `#e6e7e0` | `oklch(49.2% 0.019 122.1)` | `History` | filled, values struck through |
| Lab Low | `#2a4a9a` | `#e0e7f7` | `oklch(43.2% 0.136 264.8)` | `ArrowDown` | filled |
| Lab High | `#8a1a5e` | `#f7ddec` | `oklch(43.2% 0.159 349.0)` | `ArrowUp` | filled |
| Lab Normal | `#3f4733` | `#e2e5d8` | `oklch(38.4% 0.034 125.7)` | `Check` | filled, quiet |
| Info | `#1d5470` | `#dcebf2` | `oklch(42.3% 0.073 234.6)` | `Info` | filled |

Separation from brick (OKLab deltaE x100, normal / deutan / protan): Overdue 7.5 / 6.2 / 8.6, Due soon 11.4 / 7.1 / 3.9, High 13.6 / 13.7 / 13.9. Overdue and brick also never share a form: brick is a solid button, Overdue is a tinted chip with an icon. Done vs Filed and Low vs Info collapse under tritanopia (deltaE 0.9 and 2.2), which is why the icon and word are mandatory.

### Chart series (render on `--surface-1` or `--surface-2` only)

| Series | Hex | OKLCH | vs surface-1 |
|---|---|---|---|
| 1 brick | `#ae3c30` | `oklch(51.7% 0.151 29.2)` | 5.44 |
| 2 forest | `#2f3a1c` | `oklch(33.0% 0.051 125.6)` | 10.88 |
| 3 ochre | `#a77410` | `oklch(59.6% 0.121 76.9)` | 3.68 |
| 4 lilac plum | `#8a6c95` | `oklch(57.5% 0.071 316.8)` | 4.07 |
| 5 coral deep | `#d0706a` | `oklch(65.3% 0.122 24.7)` | 3.05 |

Minimum pairwise deltaE across the five: 12.1 normal, 8.2 deutan, 9.0 protan, 8.0 tritan. Lab trend charts are single-series: line and normal points in series 2 (forest), reference range as a `--sage-tint` band, High points in Lab High with an up-triangle marker, Low points in Lab Low with a down-triangle. Stage counts are ordinal: draw them as a rail (sequential lightness of `--sage-deep`), never a pie. Direct-label every series; legends only as backup.

### shadcn variable mapping (U3 writes this in `index.css`)

`--background` ground, `--foreground` ink, `--card` surface-1, `--card-foreground` ink, `--popover` surface-2, `--primary` brick, `--primary-foreground` on-brick, `--secondary` surface-2, `--secondary-foreground` ink, `--muted` sunken, `--muted-foreground` ink-muted, `--accent` peach-tint, `--accent-foreground` ink, `--destructive` `#a3143f`, `--border` hairline, `--input` line-strong, `--ring` ink, `--chart-1..5` series 1 to 5, `--sidebar` ground, `--sidebar-primary` brick, `--sidebar-accent` surface-1, `--sidebar-border` hairline, `--sidebar-ring` ink. Delete the `.dark` block (light only).

### Contrast table (WCAG 2.x, computed)

| Pair | Ratio | Need | | Pair | Ratio | Need |
|---|---|---|---|---|---|---|
| ink on ground | 10.65 | 4.5 | | Overdue fg on its bg | 6.24 | 4.5 |
| ink on surface-1 | 12.31 | 4.5 | | Overdue fg on surface-1 | 6.95 | 4.5 |
| ink on surface-2 | 13.15 | 4.5 | | Overdue fg on row-hover | 6.42 | 4.5 |
| ink on sunken | 9.74 | 4.5 | | Due soon fg on its bg | 6.45 | 4.5 |
| ink on peach-tint | 10.95 | 4.5 | | Due soon fg on surface-1 | 6.88 | 4.5 |
| ink on sage-tint | 10.76 | 4.5 | | Planned fg on surface-1 | 7.42 | 4.5 |
| ink on row-hover | 11.38 | 4.5 | | Done fg on its bg | 5.96 | 4.5 |
| ink-muted on ground | 5.54 | 4.5 | | Filed fg on its bg | 6.19 | 4.5 |
| ink-muted on surface-1 | 6.41 | 4.5 | | Superseded fg on its bg | 4.95 | 4.5 |
| ink-muted on surface-2 | 6.84 | 4.5 | | Superseded fg on row-hover | 5.14 | 4.5 |
| ink-muted on sunken | 5.07 | 4.5 | | Lab Low fg on its bg | 6.66 | 4.5 |
| ink-muted on peach-tint | 5.70 | 4.5 | | Lab High fg on its bg | 6.91 | 4.5 |
| on-brick on brick | 5.81 | 4.5 | | Lab Normal fg on its bg | 7.61 | 4.5 |
| on-brick on brick-hover | 7.04 | 4.5 | | Info fg on its bg | 6.74 | 4.5 |
| on-brick on maroon | 11.71 | 4.5 | | sage-deep on surface-1 | 5.97 | 4.5 |
| emergency-ink on maroon | 11.24 | 4.5 | | sage-deep on ground | 5.16 | 4.5 |
| maroon on surface-2 (Call button) | 11.71 | 4.5 | | maroon on peach-tint (initials) | 9.75 | 4.5 |
| brick text on surface-1 | 5.44 | 4.5 | | brick text on ground | 4.70 | 4.5 |
| peach on ink (unread badge) | 10.28 | 4.5 | | on-brick on ink (tooltip) | 13.15 | 4.5 |
| line-strong (input border) on surface-1 | 4.48 | 3.0 | | line-strong on sunken | 3.54 | 3.0 |
| line-strong on ground | 3.88 | 3.0 | | disabled text (line-strong) on sunken | 3.54 | 3.0 |
| focus ring (ink) on ground | 10.65 | 3.0 | | focus ring (ink) on surface-1 | 12.31 | 3.0 |
| focus ring (peach) on maroon | 9.16 | 3.0 | | selected bar (brick) on peach-tint | 4.83 | 3.0 |
| sage icon on surface-1 | 3.89 | 3.0 | | progress fill (sage-deep) on sunken track | 4.72 | 3.0 |

**Adjusted during this pass:** (1) ground darkened from `#e6e8dc` to `#e2e5d5` and sunken from `#dcdfd0` to `#d8dcc9` for clearer clay steps; (2) input border raised from `#7c846a` (2.89:1 on sunken, fail) to `#6b735c` (3.54:1); (3) sage `#727e60` fails as text (3.89:1) so text uses `--sage-deep`; (4) coral `#de7e78` fails as a chart line (2.6:1) so series 5 is `#d0706a`; (5) the ink focus ring fails on maroon (1.12:1) so dark contexts switch the ring to peach (9.16:1); (6) disabled text `#80866f` read 2.70:1 on sunken, replaced by line-strong (3.54:1). `--hairline` (1.43:1) is decorative: rows are also separated by alignment and spacing.

## Typography

**Display:** Gabarito (600, 800). **Body and UI:** Atkinson Hyperlegible Next (400, 500, 700). **Numerals and data:** Atkinson Hyperlegible Mono (400, 600). Fallbacks: `ui-sans-serif, system-ui, sans-serif` and `ui-monospace, monospace`.

**Why.** Atkinson Hyperlegible was drawn by the Braille Institute for low-vision readers: it separates 0/O, 1/l/I, 5/S, 8/B. In KTP a misread creatinine, tacro level, or HRN is a clinical error, and patients are mixed-age on low-end screens, so hyperlegibility is the functional requirement, not a style. The Mono sibling makes every number tabular (count-ups never jitter, table columns align) with the same disambiguated shapes. Gabarito is a sturdy geometric sans with round bowls: it echoes the geometric OTS wordmark but holds weight on clay where the thin wordmark would dissolve. No serif (dashboard), no Inter.

**Loading.** One request: `https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;600&family=Atkinson+Hyperlegible+Next:wght@400;500;700&family=Gabarito:wght@600;800&display=swap` with `preconnect` to both Google hosts. Measured latin woff2: Next 34.0 KB, Gabarito 34.2 KB, Mono 17.8 KB (86 KB total, budget 90 KB). No `preload` (Google file URLs are versioned); rely on `preconnect` and `display=swap`.

| Role | Face, weight, tracking | 320 size / line | 1440 size / line | CSS size | Use |
|---|---|---|---|---|---|
| numeral-xl | Mono 600, -0.01em | 36 / 40 | 56 / 60 | `clamp(2.25rem, 1.893rem + 1.786vw, 3.5rem)` | tray counts, next-up date |
| display | Gabarito 800, -0.02em | 28 / 32 | 40 / 44 | `clamp(1.75rem, 1.536rem + 1.071vw, 2.5rem)` | one per screen: title or patient name |
| headline | Gabarito 700, -0.01em | 22 / 28 | 28 / 34 | `clamp(1.375rem, 1.268rem + 0.536vw, 1.75rem)` | section heads |
| title | Gabarito 700 | 18 / 24 | 20 / 26 | `clamp(1.125rem, 1.089rem + 0.179vw, 1.25rem)` | card and cell labels |
| data-lg | Mono 600 | 20 / 24 | 24 / 28 | `clamp(1.25rem, 1.179rem + 0.357vw, 1.5rem)` | latest lab value, secondary counts |
| body-lg | Next 400 | 17 / 26 | 18 / 28 | `clamp(1.0625rem, 1.045rem + 0.089vw, 1.125rem)` | patient body text |
| body | Next 400 | 16 / 24 | 16 / 24 | `1rem` | admin body, forms, field labels (700, 15 / 20) |
| button | Next 700 | 16 / 20 | 15 / 20 | steps at 1024 | buttons, tabs |
| body-sm | Next 400 or 500 | 15 / 22 | 14 / 20 | steps at 1024 | admin table cells |
| data | Mono 400 | 16 / 24 | 14 / 20 | steps at 1024 | HRN, dates and values in tables |
| label | Next 700, +0.01em | 14 / 18 | 13 / 16 | steps at 1024 | chips, badges, tab-bar labels |
| caption | Next 400 | 14 / 20 | 12 / 16 | steps at 1024 | timestamps, helper text |

**The Numbers Are Evidence Rule.** Every count, lab value, date in a table, HRN, and countdown is set in Atkinson Hyperlegible Mono. Units follow in `--ink-muted` at the next size down. Dates read `Fri 2 Oct 2026`, times `9:00 AM` (Asia/Manila); a relative phrase ("in 3 days", "12 days overdue") always sits next to the absolute date.

**The Patient Floor Rule.** Nothing on a patient surface is under 14 px; patient body is body-lg. Gabarito is never under 18 px. Sentence case everywhere, no uppercase labels, body lines capped at 68ch.

## Layout

Spacing scale (Tailwind 4 default step, 4 px base): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Tray gutter (the grid line): 10 px under 768, 14 px at 768 to 1023, 16 px at 1024 and up; tray padding equals its gutter. Cards pad 16 (mobile) or 24 (desktop). Section gap 32 (mobile) or 48 (desktop). Space above a heading is 32; below it 12.

| Width | Columns | Margin | Gutter | Admin navigation | Patient navigation | Content max |
|---|---|---|---|---|---|---|
| 320 | 4 | 16 | 12 | top bar 56 + drawer | floating bottom tab bar | fluid |
| 390 (patient design width) | 4 | 16 | 12 | top bar 56 + drawer | floating bottom tab bar | fluid |
| 768 | 8 | 24 | 16 | top bar 64 + drawer | floating bottom tab bar | 640 (patient) |
| 1024 | 12 | 32 | 20 | 80 icon rail (tooltips) | top pill nav | 960 |
| 1280+ and 1440 | 12 | 32 | 24 | 264 sidebar | top pill nav | admin 1120, patient 1040 |

Trays: 3 columns at 1024 and up. From 390 to 1023, 3x3 trays reflow to 2 columns with the center cell spanning both; DOM order stays row-major so reading order never changes. The patient 1x3 strip stays 3 columns at every width. Asymmetric desktop splits (tray 7 cols plus panel 5 cols) collapse to one column under 1024. Only data tables may scroll horizontally, inside their own container with a sticky first column.

## Elevation & Depth

Light comes from the top-left, always. Clay = soft outer drop shadow + inner top-left highlight + inner bottom-right shade, tinted forest (`42 48 30`) or, on brick, maroon and peach. Surfaces stay opaque: text never sits on translucency.

```css
:root {
  --tint: 42 48 30;                       /* forest ink */
  --clay-1: 0 1px 2px rgb(var(--tint) / .10), 4px 6px 14px -4px rgb(var(--tint) / .18),
            inset 2px 2px 3px rgb(255 255 255 / .85), inset -2px -3px 5px rgb(var(--tint) / .08);
  --clay-2: 0 2px 4px rgb(var(--tint) / .08), 8px 12px 24px -8px rgb(var(--tint) / .22),
            inset 3px 3px 5px rgb(255 255 255 / .90), inset -4px -5px 9px rgb(var(--tint) / .09);
  --clay-3: 0 4px 8px rgb(var(--tint) / .08), 16px 22px 44px -12px rgb(var(--tint) / .28),
            inset 4px 4px 7px rgb(255 255 255 / .95), inset -6px -7px 12px rgb(var(--tint) / .10);
  --clay-pressed: inset 3px 4px 8px rgb(var(--tint) / .20), inset -2px -2px 5px rgb(255 255 255 / .70);
  --clay-sunken: inset 3px 4px 9px rgb(var(--tint) / .16), inset -3px -3px 6px rgb(255 255 255 / .75);
  --clay-brick: 0 1px 2px rgb(108 18 12 / .20), 4px 6px 14px -4px rgb(108 18 12 / .35),
                inset 2px 2px 3px rgb(252 216 204 / .55), inset -3px -4px 6px rgb(108 18 12 / .45);
  --clay-brick-pressed: inset 3px 4px 8px rgb(108 18 12 / .55), inset -2px -2px 4px rgb(252 216 204 / .30);
  --clay-disabled: inset 1px 1px 2px rgb(var(--tint) / .10);
}
```

| Level | Token | Used by |
|---|---|---|
| Sunken | `--clay-sunken` on `--sunken` | tray wells, input wells, tab and stepper tracks, skeletons |
| 1 | `--clay-1` on surface-1 or surface-2 | buttons, avatars, stepper nodes, chips-as-filters, list containers, bottom tab bar items |
| 2 | `--clay-2` on surface-1 | cards, tray cells at rest, bottom tab bar slab, next-up card |
| 3 | `--clay-3` on surface-2 | hovered cells and cards, popovers, toasts, dialogs, sign-in card |

**States.** Hover (fine pointers only): `translateY(-2px)` and one level up. Never transition `box-shadow`; put the next level on a `::after` layer and fade its opacity (180 ms). Active: `--clay-pressed` (or `--clay-brick-pressed`) applied instantly plus the squish in Motion. Selected (tray cell, filter): pressed shadow, `--peach-tint` fill, and a 4 x 32 px brick bar at the bottom edge, inset 16 px. Disabled: `--sunken` fill, `--clay-disabled`, text `--line-strong`, no hover, `cursor: not-allowed`. Focus: `outline: 3px solid var(--focus); outline-offset: 3px` on `:focus-visible` (outline, not box-shadow, so it never fights the clay stack); on maroon or brick backgrounds the ring is `--peach`. Clay containers never use `overflow: hidden` where a child can take focus, and keep 8 px or more padding so rings are not clipped.

**The Flat Data Rule.** Clay is for objects you touch. These stay flat: data tables (patients, lab values, service records, history), rows inside list cards, calendar grid cells, chart plot areas, consent and privacy text, tooltips (ink fill), sidebar items at rest, and inline links. Flat zones use `--hairline` row dividers and a 1.5 px `--line-strong` header rule.

**Performance guard.** Patient surfaces cap at level 2 (level 3 only for dialogs and toasts) and at 12 clay elements per viewport. Max blur radius 44 px. No `backdrop-filter` anywhere.

## Shapes

| Token | px | Used by |
|---|---|---|
| `--r-xs` | 8 | table focus, small tags |
| `--r-sm` | 12 | inputs, small icon buttons |
| `--r-md` | 16 | buttons, segmented controls, tray cells under 1024 |
| `--r-lg` | 22 | tray cells at 1024 and up, mobile cards |
| `--r-xl` | 28 | desktop cards, dialogs, trays under 1024, bottom tab bar, emergency band |
| `--r-2xl` | 36 | trays at 1024 and up, sign-in card |
| `--r-pill` | 999 | chips, avatars, tab and stepper tracks, badges |

**The Concentric Rule.** Inner radius = outer radius minus padding, rounded to the nearest step (tray 36 with 16 gutter holds 22 cells; tray 28 with 10 gutter holds 16 cells). Border policy: clay surfaces carry no borders; depth comes from shadow. Inputs keep a 1.5 px `--line-strong` border because a well alone cannot meet 3:1. No colored side stripes.

## Components

Icons: lucide-react, stroke 1.75, 20 px (24 in the tab bar), `aria-hidden` unless standalone. Hit area 44 x 44 minimum everywhere, 48 for patient primary actions.

| Component | Spec | Hover / Active | Focus / Disabled | Loading / Empty / Error |
|---|---|---|---|---|
| Button primary | brick fill, on-brick text, `--clay-brick`, r-md; heights sm 44, md 48, lg 52 (patient and sign-in); pad x 16/20/24; icon 20, gap 8; one per region | brick-hover + lift / maroon + brick-pressed + squish | ring; disabled recipe | label width locked, 16 px indeterminate ring replaces icon, `aria-busy`; n/a; n/a |
| Button secondary | surface-2, ink text, `--clay-1` | lift + clay-2 / pressed + squish | ring; disabled recipe | as primary |
| Button ghost | transparent, ink text (brick for inline actions), no shadow | `--sunken` at 60% / pressed | ring; line-strong text | as primary |
| Destructive | ghost with Overdue fg text; filled Overdue only inside its confirm dialog | as ghost | ring | as primary |
| Icon button | 44 square (48 patient), secondary styling, r-md, `aria-label` plus tooltip | lift / pressed | ring; disabled recipe | indeterminate ring |
| Card | surface-1, `--clay-2`, r-xl desktop, r-lg mobile, pad 24/16; header = title + optional ghost action | lift only when the whole card is a link | ring on the link; n/a | skeleton wells; sunken well with one sentence + one action, no illustration; Info bar with Retry |
| Tray (signature) | `--sunken` well, `--clay-sunken`, r-2xl (r-xl under 1024), gutter = pad; `role="group"` + `aria-label` | n/a | roving tabindex, arrow keys | 9 empty sunken cells (skeleton) |
| Tray cell / stat tile | surface-1 (center: sage-tint), `--clay-2`, r-lg (r-md under 1024), min-h 148 desktop, 112 mobile, 96 in the patient strip, pad 20/16; label (title) top-left, icon top-right, numeral-xl bottom-left, chip or sub-line under | tilt + clay-3 (admin) / pressed + squish; selected recipe | ring (fits in gutter); n/a | sunken well at cell size; zero shows count in ink-muted + Done chip "Clear"; count becomes `--` with "Could not load" and a Retry icon button |
| Status chip | flat, r-pill, h 28 admin / 32 patient, pad x 10, gap 6, icon 14/16, label style; forms per Colors | filter chips only: lift / pressed | ring; n/a | n/a |
| Input | `--sunken` well, `--clay-sunken`, 1.5 px line-strong border, r-sm, h 48 (52 patient), pad x 14; label above (700 15/20), helper below (caption) | border ink / n/a | ring + ink border; ground fill, hairline border, line-strong text | trailing indeterminate ring; n/a; 2 px Overdue border, icon + message below, `aria-invalid`, `aria-describedby` |
| Avatar | 32 / 40 / 56 / 72, r-pill, `--clay-1` ring 2 px surface-2; photo or initials (Next 700): recipient peach-tint + maroon, donor sage-tint + ink; pair = two overlapped 12 px with a sage exchange arrow | n/a | ring if link | sunken disc; initials; photo error falls back to initials |
| Stepper | sunken pill track, nodes 28 on `--clay-1`: done = sage-deep fill + check, current = ink fill + peach dot + bold label, upcoming = hollow sunken; connectors 4 px sage-deep (done), dashed line-strong (upcoming); `<ol>` with `aria-current="step"` | node tooltip (admin) | ring on focusable nodes | skeleton track; n/a; n/a |
| Tabs | sunken pill track r-pill, h 44, tabs flat button style in ink-muted; active = surface-2 pill `--clay-1` with ink text (shared layout) | ink text / pressed | ring; line-strong | n/a; n/a; n/a |
| Progress ring | 44 / 64 / 72, stroke 6/8, sunken track, sage-deep fill (Done green at 100%), value in Mono center; `role="progressbar"` | n/a | n/a | sunken ring; "0 of 42"; `--` |
| Skeleton | sunken wells matching final geometry, r matches target | n/a | n/a | admin: peach sheen sweep 1.6 s; patient: static; region `aria-busy="true"` + sr-only "Loading" |
| Table row | flat, h 52 admin, body-sm + data; sticky surface-1 header with 1.5 px line-strong rule | row-hover / n/a | inset ring (offset -3 px); n/a | 6 skeleton rows; one-row message + action; one-row message + Retry |
| Superseded row | Superseded fg text, values struck through, Superseded chip, excluded from charts | row-hover | as row | n/a |
| Toast | surface-2, `--clay-3`, r-xl, w 360 (mobile full width minus 32), status icon + title + body + optional action + close 44; `role="status"`, errors `role="alert"`; 5 s, pauses on hover or focus | n/a | ring on actions | n/a |
| Bottom tab bar (patient) | floating slab inset 12 from sides and bottom (+ safe area), h 64, surface-2, `--clay-2`, r-xl; 5 items (Home, Labs, Checklist, Calendar, Messages), icon 24 + label 14/16 700; active = surface-1 pill `--clay-1`, ink; inactive ink-muted; unread badge ink fill + peach Mono numeral (not red: unread is not an alarm) | pressed | ring (peach not needed, slab is light); n/a | n/a |
| Sidebar (admin) | 264 wide on ground (no panel), OTS wordmark 200 wide top, items h 44: icon + label 15/20 600 ink-muted; active = surface-1 pill `--clay-1`, ink, shared layout; count badges as tab bar; bottom: admin avatar + email + Sign out ghost; rail 80 at 1024 to 1279, drawer (dialog, clay-3) under 1024 | sunken 60% / pressed | ring; n/a | n/a |
| Emergency band | maroon, r-xl, pad 16/20, phone icon + text in emergency-ink, Call button = surface-2 `--clay-1` with maroon text; `<aside aria-label="Emergency contact">`, `tel:` link; never animates after first paint | Call: lift / pressed | peach ring | always rendered, text from `emergencyHotlineText` |

Google sign-in button follows Google identity branding: white fill, 1 px `#747775` stroke, unaltered G mark, label "Sign in with Google" in `#1f1f1f` (16.48:1), font stack `Roboto, "Atkinson Hyperlegible Next", sans-serif` (Roboto is on-device on Android, no download). KTP adds only `--clay-1` outside it, r-md, h 52, and the press squish.

## Screens

Legend: `[L1]` `[L2]` `[L3]` clay level, `[S]` sunken, `[F]` flat. Mock names are fictional.

### 1. Sign-in (`/preview/sign-in`)

The tray is the logo assembling itself: `ots-mark.png` sliced into nine cells (`background-size: 300%`, cropped about 4% inward so the drawn grid lines disappear into the tray gutters). Eye path: tray, wordmark, Google button. Not-enrolled state swaps the card body for "not enrolled" copy plus a secondary "Use another account" button; the tray stays.

```
1440 ----------------------------------------------------------------------------------------------
| ground + parallax organ-grid backdrop (3 soft cells: peach, lilac, sage, 10% opacity)            |
|                                                                                                  |
|   +--[S] TRAY 560x560 r36 gutter 16 (left)------+        +--[L3] CARD 440w r36 (right)-------+   |
|   | +--[L2]--+ +--[L2]--+ +--[L2]--+             |        | ots-logo wordmark 240w            |   |
|   | | cell 1 | | cell 2 | | cell 3 |             |        | display: welcome line (U1)        |   |
|   | +--------+ +--------+ +--------+             |        | body-lg: who this is for (U1)     |   |
|   | +--------+ +=CENTER=+ +--------+             |        |                                   |   |
|   | | cell 4 | | donor  | | cell 6 |  sage-tint  |        | [ G  Sign in with Google ] h52    |   |
|   | +--------+ | <-> R  | +--------+             |        |                                   |   |
|   | +--------+ +--------+ +--------+             |        | caption [F]: consent + Privacy    |   |
|   | | cell 7 | | cell 8 | | cell 9 |             |        | notice link (RA 10173)            |   |
|   | +--------+ +--------+ +--------+             |        +-----------------------------------+   |
|   +----------------------------------------------+                                                |
|   caption [F] bottom-left: "Private system for enrolled patients and OTS staff." (U1)             |
----------------------------------------------------------------------------------------------------
```

```
390 --------------------------------
| ots-logo wordmark 200w           |
| +--[S] TRAY 296 r28 gutter 10--+ |
| | [c1]  [c2]  [c3]   85px cells| |
| | [c4] [=C5=] [c6]             | |
| | [c7]  [c8]  [c9]             | |
| +------------------------------+ |
| display 28: welcome (U1)         |
| body-lg: one line (U1)           |
| [ G  Sign in with Google ] h52   |
| caption: consent + Privacy link  |
----------------------------------- fits 390x844, no scroll
```

### 2. Admin dashboard (`/preview/admin`)

Eye hits the Overdue services count first (top-left, largest raspberry numeral), then the triage panel it drives. Selecting a cell swaps the panel list (shared layout). The center cell anchors the cohort in sage. Stage rails give counts by type and stage.

```
1440 ----------------------------------------------------------------------------------------------
|SIDEBAR[F]| caption: Wed 30 Sep 2026            [search /] [bell 3] [+ Enroll patient: primary]    |
| wordmark | display: Triage                                                                       |
| (Dash)L1 | +--[S] NINE-CELL TRAY r36 (cols 1-7)------------+ +--[L2] TRIAGE PANEL (cols 8-12)--+  |
|  Patients| | [L2 SELECTED] [L2]           [L2]             | | title: Overdue services  7      |  |
|  Calendar| | Overdue svc   Claims <=7d    Reschedule req.  | | [F] rows h56, hairlines:        |  |
|  Messages| | 7 raspberry   5 amber        3 ink            | |  (av) Pacaldo, L.  00-418-227   |  |
|  Settings| | oldest 12d    next Fri 2 Oct  oldest 2d       | |       Tacro  due 18 Sep  12d >  |  |
|          | | [L2]          [=L2 CENTER=]  [L2]             | |  (av) Magbanua, R. 00-377-091   |  |
|          | | Superseded,   64 active      Due this week    | |       Lab    due 25 Sep   5d >  |  |
|          | | claim unfiled 41 R <-> 23 D  12 [Planned]     | |  ...                            |  |
|          | | 2 ink         sage-tint      next Thu 1 Oct   | | ghost: Open in Patients         |  |
|          | | [L2]          [L2]           [L2]             | |                                 |  |
|          | | Recipients,   Recipients,    Donors           | |                                 |  |
|          | | work-up 18    post-KT 23     23 (15 / 8)      | |                                 |  |
|          | +-----------------------------------------------+ +---------------------------------+  |
| (av)admin| [L1] STAGE RAILS: Recipients  Orient 4 | Ph1 6 | Ph2 3 | Clear 2 | PhZ 1 | Ph3 2 | PostKT 23 |
|          |                   Donors      Orient 3 | Ph1 5 | Ph2 4 | Clear 2 | Ph3 1 | PostDonation 8   |
----------------------------------------------------------------------------------------------------
```

```
390 --------------------------------
| [=] mark  Triage    [bell] [+]   |  top bar [F]
| caption: Wed 30 Sep 2026         |
| +--[S] TRAY 2 cols r28---------+ |
| | [Overdue 7 ] [Claims 5    ]  | |
| | [Resched 3 ] [Superseded 2]  | |
| | [===== CENTER 64 active ===] | |
| | [Due week 12] [Work-up 18 ]  | |
| | [Post-KT 23 ] [Donors 23  ]  | |
| +------------------------------+ |
| [L2] panel: selected list, rows  |
|  stacked 2-line [F]              |
| [L1] stage rails: scroll-x chips |
-----------------------------------
```

### 3. Patient home (`/preview/me`, designed at 390 first)

Eye hits the next-up date numeral, then its chip. The strip is one row of the logo grid. Nothing on this screen pulses or counts up. Pre-KT variant: next-up shows the next work-up item and strip cell 1 becomes checklist progress (ring).

```
390 --------------------------------
| (mark32) Hi, Lorna      (avatar) |  header [F] on ground, 56
| +--[L2] NEXT UP r22-----------+  |
| | [Due soon]           title  |  |
| | Tacro test                  |  |
| | Fri 2 Oct   numeral-xl      |  |
| | in 2 days (body-lg muted)   |  |
| | prep note, 1 line (U1)      |  |
| | ghost: See details          |  |
| +-----------------------------+  |
| +--[S] STRIP 1x3 gutter 10----+  |
| | [Due 2] [Claims 1] [Msgs 2] |  |  L2 cells 106x96, links
| +-----------------------------+  |
| +--[L2] APPOINTMENT-----------+  |
| | Follow-up  Fri 9 Oct 9:00 AM|  |
| | OPD 3 (caption)  [Pending]  |  |
| | [ Confirm ] primary lg 52   |  |
| | [ Request reschedule ] ghost|  |
- - - - - - fold (844 - tab bar) - -
| [L1] CLAIM DEADLINES [F] rows    |
|  Meds claim  6 Oct  [Due soon]   |
|  Laboratory  filed 28 Sep [Filed]|
| [L1] MESSAGES: unread dot, title |
| [maroon] EMERGENCY band + Call   |
| [L2] TAB BAR Home Labs Check Cal Msg |
-----------------------------------
```

```
1440 ----------------------------------------------------------------------------------------------
| wordmark 180   [S track] Home | Labs | Checklist | Calendar | Messages  (pill nav)      (avatar)   |
|                  max 1040 centered                                                               |
|   display: Hi, Lorna                                     caption: Post-KT day 214                |
|   +--[L2] NEXT UP (cols 1-7)--------------------+   +--[S] STRIP 1x3 (cols 8-12)-----------+    |
|   | [Due soon] Tacro test     Fri 2 Oct numeral |   | [Due 2]   [Claims 1]   [Messages 2]  |    |
|   | in 2 days, prep note        ghost: Details  |   +--------------------------------------+    |
|   +---------------------------------------------+   +--[L1] CLAIM DEADLINES [F rows]-------+    |
|   +--[L2] APPOINTMENT--------------------------+   | Meds claim   6 Oct   [Due soon]      |    |
|   | Follow-up Fri 9 Oct 9:00 AM   [Confirm]    |   | Laboratory   filed   [Filed]         |    |
|   | OPD 3                  [Request reschedule]|   +--------------------------------------+    |
|   +---------------------------------------------+   [L1] MESSAGES + [maroon] EMERGENCY band      |
----------------------------------------------------------------------------------------------------
```

### 4. Patient profile tracker (`/preview/patient`, admin view)

The profile is the logo with this patient at its center: the center cell is the recipient and donor link. The eight surrounding cells are the four tracker items plus appointment, claims, checklist, and lab flags. Eye path: name, stepper position, the cell carrying an Overdue chip, then the trend chart.

```
1440 ----------------------------------------------------------------------------------------------
|SIDEBAR | caption: Patients / profile         [Message: secondary] [Edit: secondary] [Record result] |
|        | (av72) display: Pacaldo, Lorna M.   HRN 00-418-227 (data)   [Recipient] [Active]           |
|        | [S track] STEPPER: (v)Orient-(v)Ph1-(v)Ph2-(v)Clear-(v)PhZ-(v)Ph3-(@)PostKT  day 214        |
|        | +--[S] PATIENT TRAY r36 (cols 1-7)-------------+ +--[L2] LAB TREND (cols 8-12)------------+ |
|        | | [L2] Meds      [L2] Laboratory [L2] Tacro    | | [S tabs] Creatinine | Tacro | Hb | WBC | |
|        | | last 2 Sep     last 24 Sep     last 18 Aug   | | data-lg: 118 umol/L  [High]  24 Sep  | |
|        | | next 2 Oct     next 24 Oct     due 18 Sep    | | [F] line (forest), sage-tint band,   | |
|        | | [Due soon]     [Planned]       [Overdue]     | |     High = plum up-triangle          | |
|        | | [L2] X-ray+USD [=CENTER=]      [L2] Next appt| |     6 results, draw-in               | |
|        | | last 12 Aug    (R)<->(D)       Fri 9 Oct     | | ghost: View as table                 | |
|        | | [Planned]      Ramon L. donor  [Confirmed]   | |                                      | |
|        | | [L2] Claims    [L2] Checklist  [L2] Lab flags| |                                      | |
|        | | 1 overdue      ring 100%       2 High 1 Low  | |                                      | |
|        | +----------------------------------------------+ +--------------------------------------+ |
|        | caption [F]: Nephrologist Dr. A. Villaflor  |  Fellow Dr. J. Ocampo  (fictional)           |
|        | [S track] TABS: (Tracker) Labs Checklist Appointments Messages History                     |
|        | [F] TABLE: Type | Label | Due | Service date | Status | Claim deadline | Claim | actions   |
----------------------------------------------------------------------------------------------------
```

```
390 --------------------------------
| [<] Patients            [...]    |  top bar [F]; ... = Message, Edit
| (av56) Pacaldo, Lorna M.         |
| HRN 00-418-227 [Recipient]       |
| [S] stepper compact: 7 dots,     |
|  "PostKT, stage 7 of 7"          |
| +--[S] TRAY 2 cols-------------+ |
| | [Meds    ] [Laboratory ]     | |
| | [Tacro !!] [X-ray+USD  ]     | |
| | [==== CENTER R <-> D ====]   | |
| | [Next appt] [Claims    ]     | |
| | [Checklist] [Lab flags ]     | |
| +------------------------------+ |
| [primary] Record result (sticky) |
| [L2] trend card, tabs scroll-x   |
| [S] tabs scroll-x, table becomes |
|  stacked 2-line rows [F]         |
-----------------------------------
```

## Motion

Library: framer-motion 12. Root wraps in `<MotionConfig reducedMotion="user">`. Animate only `transform` and `opacity`; shadow changes cross-fade a pseudo-layer.

| Spring | stiffness | damping | mass | zeta | Use |
|---|---|---|---|---|---|
| `press` | 520 | 30 | 0.8 | 0.74 | squish and release |
| `pop` | 260 | 22 | 0.9 | 0.72 | entrances, count settle |
| `layout` | 380 | 34 | 1 | 0.87 | tab, nav, and cell-to-panel shared layout |
| `tilt` | 150 | 18 | 1 | 0.73 | 3D tilt follow |
| `page` | 200 | 28 | 1 | 0.99 | route transitions |
| `gentle` | 220 | 30 | 1 | 1.01 | all patient motion (no overshoot); CSS fallback `cubic-bezier(0.16, 1, 0.3, 1)`, hover 180 ms, color 120 ms |

### Admin surfaces: full blast

| Effect | Spec |
|---|---|
| Page transition | `AnimatePresence mode="wait"`: exit opacity 0 + y -8 in 120 ms; enter y 16 to 0 + opacity, `page` |
| Staggered tile entrance | tray fades in (opacity, scale 0.98); cells from y 16, scale 0.92, stagger 45 ms row-major, `pop`; center cell last with 1.04 overshoot |
| Spring squish on press | buttons `whileTap={{ scaleX: 1.03, scaleY: 0.94 }}`, cells `scale: 0.97`, release on `press` |
| 3D tilt on cells | `(hover: hover) and (pointer: fine)` only: `perspective: 900px`, rotateX/Y up to 5 deg toward pointer, `tilt`; a radial highlight layer translates with the pointer; resets on leave |
| Count-up numbers | 0 to value over 700 ms ease-out on first view (`useInView`, once); Mono keeps width fixed |
| Parallax organ-grid backdrop | fixed, `pointer-events: none`, behind content: 3x3 outline grid at 6% ink plus 3 soft cells (peach, lilac, sage); pointer drift up to 12 px and scroll parallax 0.15 to 0.3 via `useScroll` + `useTransform`; no blur filters |
| Shared-layout indicators | tabs `layoutId="tab-pill"`, sidebar `layoutId="nav-pill"`, selected cell bar morphs into the triage panel header (`layoutId="triage"`), `layout` spring |
| Chart draw-in | reference band opacity 0 to 1 (200 ms), then line `animationDuration={900}` ease-out; points pop in after, stagger 40 ms |
| Stepper | connector fill `scaleX` 0 to 1 (600 ms) on mount; current node breathing ring (scale 1 to 1.15, opacity 0.6 to 0, every 2.4 s) |
| Toast | from y 24, scale 0.96, `pop`; exit opacity + y 8 |
| Skeleton | peach sheen sweep, 1.6 s linear loop |

### Patient surfaces: lively but calmer

Kept: page transition (y 8, `gentle`), press squish (scale 0.97 only, no stretch), bottom tab pill (`layoutId="tabbar-pill"`), one next-up entrance, strip cells stagger 60 ms, chart draw-in (600 ms), progress ring fill (600 ms), toast. Max 3 entrance types per viewport (brief limit kept).
Dropped: 3D tilt (no hover on touch, GPU cost), parallax backdrop (GPU and battery on low-end Android, vestibular risk), count-up (deadlines and dates must be readable instantly; a climbing number reads as rising stakes), all perpetual loops (breathing ring, sheen sweep), overshoot springs. The emergency band never moves.

### Reduced motion (never waived)

`prefers-reduced-motion: reduce`: no transforms of any kind (no tilt, squish, parallax, stagger offsets, layout slides); opacity fades of 150 ms or less only; count-ups render the final value; charts render complete; skeletons static; shared-layout indicators jump. Also enforce in CSS with a global `@media (prefers-reduced-motion: reduce)` block for non-framer transitions.

## Accessibility

- **Contrast:** every pair in the Colors table; any new pair must be computed and added before use. No text on translucent or image backgrounds.
- **Targets:** 44 x 44 minimum (admin included), 48 for patient primary actions, 8 px between adjacent targets. Table row actions get full 44 px hit areas.
- **Focus:** `:focus-visible` outline per Elevation; never removed; never clipped; focus moves to the page `h1` on route change; dialogs trap and restore focus.
- **Keyboard paths.** Sign-in: Google button, then Privacy link. Admin dashboard: skip link "Skip to triage", sidebar, search (`/` shortcut), Enroll, tray (one tab stop, arrows move in the 3x3, Enter or Space selects, `aria-pressed`, `aria-controls` the panel), panel rows (links), stage rails. Patient home: avatar, next-up details, strip cells, Confirm, Request reschedule, claims, messages, Call, tab bar (`<nav aria-label="Main">`, `aria-current="page"`). Profile: header actions, stepper, tray cells (open the matching tab), chart test tabs, View as table, main tabs (arrows, Home, End), table.
- **Screen readers.** Status chips: visible word plus sr-only context ("Claim status: Overdue, 3 days"), icons `aria-hidden`. Tray cells: accessible name "Overdue services, 7. Show list." Count-ups: animated node `aria-hidden`, sr-only final value. Charts: `<figure>` with `figcaption` summary ("Creatinine, 6 results, latest 118 umol/L on 24 Sep, High, rising"), SVG `aria-hidden`, and a real data table behind "View as table". Stepper: `<ol>`, sr-only "completed", "current", "upcoming". Progress ring: `role="progressbar"` with `aria-valuenow`, `aria-valuetext="38 of 42 done"`. Toasts `role="status"`; form errors `role="alert"`. Emergency band is a labelled `aside`, not a live region.
- **Reflow and zoom:** no horizontal page scroll at 320 px; 200% text zoom without loss; data tables scroll inside their own region with a labelled `tabindex="0"` container.
- **Language:** `lang="en"` on `html`; Filipino segments get `lang="fil"` (U1).

## Do's and Don'ts

### Do:
- **Do** keep brick for actions only: one primary button per region, never a status.
- **Do** pair every status and flag with an icon and a word.
- **Do** set every number in Atkinson Hyperlegible Mono with its unit in ink-muted.
- **Do** put the next due thing first on every patient screen and the most urgent count top-left on admin.

### Don't:
- **Don't** use more than one 3x3 tray per screen, or put an alarm in the center cell.
- **Don't** put clay on dense tables, chart plot areas, or long text.
- **Don't** animate `box-shadow`, `width`, `height`, `top`, or `left`; never use `backdrop-filter`.
- **Don't** use red dots for unread messages or alarm styling for routine items on patient surfaces.
- **Don't** put names, HRNs, or values in URLs, document titles, or toasts that persist.
