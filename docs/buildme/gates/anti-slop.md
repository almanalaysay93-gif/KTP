# Gate U7: Anti-Slop Enforcer

Owner: Agent 7 (anti-slop-enforcer). Date: 2026-09-30. Scope: `client/src/styles/clay.css`, `client/src/components/clay/*`, `client/src/components/motion/*`, `client/src/lib/motion.ts`, `client/src/components/ktp/**`, `client/src/pages/preview/**`.

**Verdict: PASS.** 0 block after one fix round. Before: 1 block, 5 warn. After: 0 block, 2 warn (one exempt-by-brief, one carried to U8).

## Method

- Rendered: Vite dev server on 5173, Python Playwright with system Chrome. `/preview/sign-in`, `/preview/admin`, `/preview/me`, `/preview/patient` at 1440x900 and 390x844 (viewport and full page after a scroll pass so in-view reveals settle). Mid-animation frames captured by waiting until an element in `main` sits between 0.15 and 0.85 opacity. Loading, empty, and error states captured via `?state=`.
- DOM probe per page: computed `background-image` gradients, `backdrop-filter`, running CSS animations, `document.fonts.check` for the three families, horizontal overflow, and the full `innerText` scanned for the VOICE.md 6.1 banned list, the long and short dashes, "!" and placeholder strings. Patient pages were also scanned for the VOICE.md 6.2 avoid list.
- Source: `rg` over the scope for the VOICE.md 6.1 grep gate, placeholders, C2 openers, gradients, glass, default Tailwind palettes, 3-column grids, icon circles, uppercase eyebrows, side stripes, emoji, pure black, glows, spinners, `h-screen`.

## Detector table

| Detector | Status | Evidence | Fix applied | Remaining warnings |
|---|---|---|---|---|
| V1 Gradient | pass | 3 gradients, all 2-stop, logo hues, specified in DESIGN.md: skeleton sheen (`clay.css:361`, peach), tilt highlight (`Tilt3D.tsx:140`, white), backdrop soft cells (`OrganGridBackdrop.tsx:99`, peach, lilac, sage). No purple or blue. | none | none |
| V2 Card grid | exempt-by-brief | The only 3-column card grids are the Nine-Cell Tray (admin, profile), the 1x3 patient strip, and the style-guide swatch grid (`DesignSystemPreview.tsx:223`, dev page). Bottom tray rows and the strip share the label, numeral, sub-line shape. | none | none (see Exemptions) |
| V3 Default palette | pass | Zero Tailwind default palette classes and zero shadcn default hexes in scope; tokens are logo-sampled (`clay.css` root block). | none | none |
| V4 Hero | warn, fixed | Sign-in is a split (tray left, card right) at 1440 and a stack with one Google button at 390: layout passes. Sub-signal "blob background": the three backdrop soft cells rendered as solid, viewport-clipped panels (peach cut by the top edge behind the admin title, lilac behind the profile linked-donor block, sage behind the sign-in footer). | Soft-cell strength lowered to the wireframe's "10% opacity" presence | none |
| V5 Icon | warn, fixed | `ServiceTracker.tsx:54`: every tracker row repeated its service glyph inside an identical clay-sunken circle (4 rows), duplicating the tray cell icons. | Plain 20 px ink-muted glyph, no disc (Flat Data Rule) | none |
| V6 Glassmorphism | pass | 0 elements with `backdrop-filter` on all 8 renders; no translucent cards; RescheduleDialog scrim is opaque ink. | none | none |
| C1 Buzzword | pass | 0 hits in source and in rendered text of all 8 renders. | none | none |
| C2 Structure | pass | Section heads are nouns from COPY.md ("Appointments", "What is due next", "Claim deadlines", "Messages", "Overdue services", "Patients by stage"). No section opens with any of the four C2 opener verbs. | none | none |
| C3 Empty superlative | pass | 0 hits. Only proof points from VOICE.md section 7 appear (org name, "Established 2017", RA 10173). | none | none |
| C4 Placeholder | warn, exempt-by-brief | No lorem, "Your Company", taglines, or generic names (all names from COPY.md 6.2). One placeholder-looking string: `PatientHomePreview.tsx:22` "Sample hotline 0000 000 0000" in the emergency band. | none (see Exemptions) | 1 |
| M1 Parallax | exempt-by-brief | `OrganGridBackdrop` scroll and pointer parallax renders on admin surfaces (dashboard, profile) and on the 1440 fine-pointer sign-in only; absent on `/preview/me` and on sign-in at 390 and under reduced motion (verified: backdrop not in DOM with `reduced_motion=reduce`). No scroll-jacking. | none | none |
| M2 Loading | warn, fixed | `clay.css:362`: admin skeleton sheen ran `infinite`, so the admin loading state shimmered for as long as the load stalled. Loading copy is sr-only ("Loading dashboard...", region `aria-busy`), never visible text without progress. | One 1.6 s sweep per mount, then a static well (`fill-mode: both` parks the band off-screen). Verified: all 12 sheen animations `finished` at 3.5 s | none |
| M3 Animation spam | block, fixed | `KtpSignIn.tsx:53` ran the admin "full" preset on wide fine-pointer sign-in: tray well zoom (scale 0.98), cell stagger with rise and scale 0.92, center cell overshoot to 1.04, card rise with scale 0.98. That is stagger + bounce + zoom in one viewport on a screen patients use; the waiver covers admin surfaces only. Patient home: 2 entrance types on first paint (next-up rise, strip stagger), pass. Admin: full blast, exempt. | Nested `MotionRoot intensity="lively"` around the sign-in `main`; the backdrop still reads the outer intensity | none |

## Violations (before)

| file:line | detector | signal | severity | prescription (applied) |
|---|---|---|---|---|
| `client/src/components/ktp/KtpSignIn.tsx:53` (with `lib/motion.ts:253-283`) | M3 | Sign-in at 1440 fine pointer: zoom well + staggered rise-zoom cells + center overshoot + zoom card, 3 or more entrance types on a shared, patient-facing screen | block | Run the sign-in tray and card on the patient preset (one rise-and-fade family on `gentle`, no overshoot, no zoom) via a nested `MotionRoot intensity="lively"`; keep the wireframe's backdrop on the outer root. ORCHESTRATOR brief exemptions: waiver is admin only |
| `client/src/components/motion/OrganGridBackdrop.tsx:15-17` | V4 (blob background) | Soft cells at strength 48 / 32 / 14 read as solid rounded panels clipped by the viewport edges, colliding with the admin title, the profile linked-donor block, and the sign-in footer | warn | Strength 32 / 16 / 6: each hue shifts about 10 RGB units from the ground, matching the DESIGN.md sign-in wireframe "3 soft cells ... 10% opacity" while keeping pale and deep tokens even |
| `client/src/components/ktp/admin/ServiceTracker.tsx:54` | V5 | Same line icon in an identical clay icon circle on every tracker row | warn | Plain glyph, `text-ink-muted`, no disc; field indent `max-lg:pl-14` to `pl-8` so fields still align under the title. DESIGN.md Flat Data Rule (rows inside list cards stay flat) |
| `client/src/styles/clay.css:362` | M2 | Skeleton sheen loops forever while loading | warn | `clay-sheen 1.6s linear 0s 1 both`; `MotionPreview.tsx` notes updated to say "once (1.6 s), then rest" |
| `client/src/pages/preview/PatientHomePreview.tsx:22` | C4 | "Sample hotline 0000 000 0000" reads as template filler | warn | Kept, exempt-by-brief (below) |
| `client/public/branding/cells/cell-*.png` via `components/ktp/signin/LogoTray.tsx:4` | V (craft) | Sign-in tray logo cells are soft and pixelated at 130 px (source mark is about 158 px wide), reads as upscaled clip art | warn | Carry to U8 (merge-audit item 1): re-slice from a higher resolution mark or cap cell size at the source resolution. Not fixed here: needs a new asset or a layout change |

## Exemptions (exempt-by-brief)

| Item | Detector | Reason |
|---|---|---|
| Admin full-blast motion (dashboard tray stagger, center overshoot, count-ups, panel entrance, page transition, tilt) | M3 | ORCHESTRATOR "Brief exemptions": the 3 entrance types limit is waived on admin surfaces only. Mid-animation frame shows page rise, tray zoom, cell stagger, count-up, and panel entrance together, as briefed |
| Parallax organ-grid backdrop on admin and on the 1440 sign-in | M1 | Design Read "full-blast spring motion on admin surfaces"; DESIGN.md Motion table lists the parallax backdrop for admin, and the Screen 1 1440 wireframe lists it for sign-in. Patient home has none |
| Nine-Cell Tray 3x3 and the 1x3 patient strip | V2 | DESIGN.md Overview: "the one distinctive decision", the signature from the logo mark; cells carry distinct states (Overdue, Due soon, Planned chips, sage center cell) |
| Google brand colors in `components/ktp/signin/GoogleButton.tsx` (white fill, `#747775` stroke, `#1f1f1f` label, unaltered G mark) | V3 | Google identity branding rules, DESIGN.md Components note |
| Brick `#ae3c30` primary and raspberry `#a3143f` overdue (two reds) | V3 | Palette sampled from the OTS logo (ORCHESTRATOR palette table); DESIGN.md keeps them apart by form (solid button vs tinted chip with icon) |
| "Sample hotline 0000 000 0000" | C4 | VOICE.md 7.1 bans invented phone numbers and ORCHESTRATOR rule 4 requires clearly fictional mocks; an all-zero value cannot dial a real line, and the Call button shows a "not real" toast |

## Not slop (carry items owned by U8)

- Linked-donor `ClayAvatarPair` clips to "A\ RV" on the profile header and center cell: a layout bug.
- Patient home floating tab bar covers the bottom of the last visible card at 390: a padding bug.
- Global `auth.me` tRPC query fires on every preview route (console: `TRPCClientError ... "<!doctype"`).
- Pixelated sign-in logo cells: listed above as a craft warn.

## Pass notes

- Fonts: Gabarito, Atkinson Hyperlegible Next, and Atkinson Hyperlegible Mono all load (`document.fonts.check` true where used); no Inter, no serif.
- No horizontal overflow on any of the 8 renders.
- "Error" appears on patient pages only inside the preview state switcher, which is labelled "Preview controls. Not part of the patient screen."
- Reduced motion on sign-in after the fix: 0 transformed elements in `main`, backdrop not rendered.

## Screenshots

Before (repo): `docs/buildme/snapshots/snap-001/screenshots/{sign-in,admin,me,patient}-{1440,390}.png`.

Before mid-animation frames and after renders are stored outside the repo in the session scratchpad `C:\Users\AlAi\AppData\Local\Temp\claude\D--ai-mem-AlAi-PC\fff6366a-7b56-470c-853d-0a034ac89792\scratchpad\`:

| Set | Files |
|---|---|
| Before, mid-animation | `before-frames/admin-1440-mid.png`, `before-frames/sign-in-1440-mid.png` (zoom + overshoot), `before-frames/me-390-mid.png` |
| Before, full page and states | `before/*-full.png`, `before-states/admin-1440-loading.png` (sheen mid-sweep) |
| After, viewport and full page | `after1/{sign-in,admin,me,patient}-{1440,390}.png`, `after1/*-full.png` |
| After, mid-animation | `after1-frames/sign-in-1440-mid.png` (single rise-and-fade family), `after1-frames/admin-1440-mid.png`, `after1-frames/me-390-mid.png` |
| After, details | `after1/crop-tracker-1440.png`, `after1/crop-tracker-390.png`, `after1/admin-1440-loading-3s.png` (sheen at rest) |

## Verification

- `pnpm check`: 0 errors. `npx vite build`: passes. `npx vitest run client/src/pages/preview`: 18 of 18 pass.
- Re-run after fixes: all 13 detectors on source and on the 8 renders; 0 block. Fix rounds used: 1 of 2.
- No long or short dash characters in any changed file or in this report. Dev server stopped (port 5173 free).
