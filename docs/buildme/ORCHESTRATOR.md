# BuildMe Orchestrator Checkpoint

Owner: Agent 0 (main session). Every agent reads this file first and writes only the files its unit owns.

## Design Read (confirmed 2026-09-30)

Reading this as: a private pre/post kidney transplant patient tracker (admin console + mobile patient portal) for one KT admin and recipients/donors, in a light claymorphism language using the Organ Transplant Services logo palette, on React 19 + Tailwind 4 + framer-motion, with full-blast spring motion on admin surfaces, lively but calmer motion on patient surfaces, reduced-motion honored everywhere, noindex.

## Inputs every agent must read

- Product spec: `docs/plans/2026-09-30-ktp-patient-tracker-design.md` (data model, screens in section 7, statuses).
- Clinical reference: `docs/reference/kt-evaluation-monitoring-guide.md`.
- Logo: `client/public/branding/ots-logo.png` (wordmark), `client/public/branding/ots-mark.png` (3x3 organ grid mark).
- Existing UI kit: `client/src/components/ui/*` (shadcn), Tailwind 4 tokens in `client/src/index.css`, `framer-motion` 12, `recharts` 2, `lucide-react`, router `wouter`.

## Logo palette (sampled)

| Name | Hex | Source in logo |
|---|---|---|
| forest ink | `#2a301e` | wordmark text, grid lines |
| brick | `#ae3c30` | organ circles |
| maroon | `#6c120c` | liver, pancreas |
| coral rose | `#de7e78` | heart |
| mauve | `#9c6060` | kidneys |
| sage | `#727e60` | donor-exchange icon |
| lilac blush | `#ccb4ba` | lungs |
| peach cream | `#fcd8cc` | circle highlights |

## Hard rules (all agents)

1. Light theme only. No dark mode work.
2. `prefers-reduced-motion: reduce` is never waived: transforms off, opacity fades of 150ms or less only.
3. Text contrast 4.5:1 minimum on every clay surface, touch targets 44px minimum, visible focus ring.
4. No real patient data anywhere. Mock data uses clearly fictional names.
5. No em-dashes (the long dash character) in any copy, docs, or code comments you write. Use commas, colons, or periods.
6. No new npm dependencies. Everything needed is installed.
7. Files stay under 500 lines.
8. Do not touch nurse-era pages or server code. Those are removed later in spec phase 1.
9. Commit only your own files, with a normal conventional-commit message. No Co-Authored-By trailer.

## Brief exemptions (tiebreak: user brief wins)

- Motion "3 entrance types per viewport" limit is waived on admin surfaces (user asked for full-blast animation). Patient surfaces keep the limit.
- Agent 6 (llms.txt), Agent 11 (references), Agent 13 (post-launch), and Design Arena are skipped. Site is noindex (private health data).

## Work units

| Unit | Agent(s) | Owns (writes only these) | Depends on |
|---|---|---|---|
| U1 Copy | 9 content-voice | `docs/buildme/VOICE.md`, `docs/buildme/COPY.md` | spec |
| U2 Direction | 1 impeccable-director | `docs/buildme/PRODUCT.md`, `docs/buildme/DESIGN.md` | spec |
| U3 Design system | 2 frontend-architect + 3 taste-specialist | `client/src/styles/clay.css`, `client/src/index.css` (token block + import only), `client/index.html` (fonts, theme-color, noindex meta), `client/public/robots.txt`, `client/src/components/clay/*`, `client/src/pages/preview/PreviewRoutes.tsx` (initial), `client/src/pages/preview/DesignSystemPreview.tsx`, `client/src/App.tsx` (one gated `/preview` mount only) | U2 |
| U4 Motion primitives | 5 motion-specialist | `client/src/lib/motion.ts`, `client/src/components/motion/*` | U2, U3 |
| U5 Screens | builder (2 + 5 skills) | `client/src/components/ktp/*`, `client/src/pages/preview/*` (adds routes to `PreviewRoutes.tsx`) | U1, U3, U4 |
| U6 Snapshot 001 | 12 token-snapshotter | `docs/buildme/snapshots/snap-001/*` | U5 |
| U7 Gate: slop | 7 anti-slop-enforcer | `docs/buildme/gates/anti-slop.md` + fixes in U3 to U5 files | U5 |
| U8 Gate: bugs | 8 bug-hunter | `docs/buildme/gates/bugs.md` + fixes | U7 |
| U9 Gate: perf/a11y | 10 perf-a11y-auditor | `docs/buildme/gates/perf-a11y.md` + fixes | U8 |
| U10 Snapshot final | 12 token-snapshotter | `docs/buildme/snapshots/snap-final/*` | U9 |

Budgets: each unit at most 20% of session tokens, at most 2 revision rounds.

## Wow screens (U5 scope)

1. Sign-in (`/preview/sign-in`): built as reusable `KtpSignIn` component, Google sign-in button, logo, consent note.
2. Admin dashboard (`/preview/admin`): counts by type and stage, overdue services, claims due within 7 days, reschedule requests, superseded unfiled claims (spec 7.1).
3. Patient home (`/preview/me`): mobile-first, next due items, claim deadlines, upcoming appointments, unread messages with emergency banner (spec 7.2).
4. Patient profile tracker (`/preview/patient`): admin view of one patient, stage stepper, 4-item tracker (Meds, Laboratory, Tacro, X-ray and USD) with last, next due, claim status, labs trend chart (spec 7.1).

Preview routes render without auth or tRPC. They are enabled when `import.meta.env.DEV` is true or `VITE_ENABLE_PREVIEW === "true"`.

## Verification commands

- Types: `pnpm check`
- Client build: `npx vite build`
- Preview server for screenshots and audits: `VITE_ENABLE_PREVIEW=true npx vite build && npx vite preview --port 4173` then open `http://localhost:4173/preview/...`
- Screenshots: Python Playwright is installed (`python -c "import playwright"`). Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Lighthouse via `npx -y lighthouse`.

## Log

- Phase 0 (2026-09-30): Grill Me confirmed. Contracts above written. Next: dispatch U1 and U2 in parallel.
- U1 done (`5748675`): VOICE.md, COPY.md with fictional mock dataset. Open: meaning of "Meds claim" and who files claims (copy kept neutral).
- U2 done (`ed7dc3f`): PRODUCT.md, DESIGN.md. Signature: "Nine-Cell Tray" (logo 3x3 grid as sunken tray of raised clay cells, max one per screen, center cell = people). Fonts: Gabarito (display), Atkinson Hyperlegible Next (body), Atkinson Hyperlegible Mono (numbers). Brick `#ae3c30` = actions only; overdue = raspberry `#a3143f`; page bg sage `#e2e5d5`. Success targets in PRODUCT.md marked "(inferred)".
- Next: U3 design system (sole writer, main tree).
- U3 done (`53519d8`) after one rate-limit resume: clay.css tokens, 12 clay components, `/preview/system` style guide, gated `/preview` mount, noindex + robots Disallow. `pnpm check` 0 errors before and after. Orchestrator merge-audit: screenshots at 1440 and 390 reviewed, approved. Deviations: `.dark` block kept, tab track 52px, hover fade 150ms.
- Next: U4 motion primitives (sole writer, main tree).
