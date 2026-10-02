# KTP Motion Specification: Clinical Email Automation Control Center and Patient Self-Upload

This document defines motion transitions for the Kidney Transplant Patient Tracker (KTP).
All motion parameters comply with the medical environment requirements.
Every transition preserves clinical calm, clarity, and stability.

## 1. Clinical Motion Principles

Medical software requires high legibility and zero disorientation.
Animations must not create cognitive burden or delay urgent clinical tasks.

- M1 (Zero Vestibular Stress): Movement uses small translation distances between 4 pixels and 16 pixels.
- M2 (Asymmetric Cadence): Enter transitions use gentle deceleration curves. Exit transitions complete in 120 ms or less so the interface never feels sluggish.
- M3 (Strict Hierarchy): Primary feedback moves first. Secondary status badges transition with staggered delays.
- M4 (Non-Distracting Ambient Indicators): In-flight processes use gentle luminous pulse effects instead of aggressive flashing or mechanical vibration.
- M5 (Total Reduced Motion Compliance): Users with vestibular sensitivity receive immediate state updates with zero transforms.

## 2. Spring and Timing Tokens

All Framer Motion springs use values established in the KTP motion architecture.

| Code | Spring Name | Stiffness | Damping | Mass | Target Surface | Purpose |
|---|---|---|---|---|---|---|
| S1 | `press` | 520 | 30 | 0.8 | Admin and Patient | Button touch compression and release |
| S2 | `pop` | 260 | 22 | 0.9 | Admin | Panel entrances and toast notifications |
| S3 | `layout` | 380 | 34 | 1.0 | Admin | Tab sliding indicator and list reordering |
| S4 | `gentle` | 220 | 30 | 1.0 | Patient | All patient portal motion with zero overshoot |

Duration constants for standard CSS transitions:
- `DURATION.exit`: 120 ms
- `DURATION.reducedFade`: 150 ms
- `DURATION.fade`: 200 ms
- `DURATION.hover`: 180 ms
- `DURATION.pulse`: 2000 ms
- `DURATION.scan`: 1800 ms

## 3. Email Automation Control Center Specification

Admin surfaces operate under `MotionRoot intensity="full"`.
All transitions remain subtle and authoritative.

### 3.1 Tab Switching Transitions

The email automation center includes five tabs: Overview, Automation Rules, Active Queues, Dispatch Log, and Email Templates.

1. Active Tab Indicator:
   - Uses `SharedPill` with `id="email-tab-pill"`.
   - The indicator morphs between tabs using spring S3 (`SPRINGS.layout`).
   - The active button host clears its native background and shadow through `SHARED_PILL_HOST`.
   - Motion duration is approximately 240 ms with zero layout jitter.

2. Tab Panel Content Switch:
   - Wrapped in `<AnimatePresence mode="wait">`.
   - Enter variant: `{ opacity: 0, y: 8 }` to `{ opacity: 1, y: 0 }`.
   - Enter transition: Spring S3 for translation and 200 ms linear for opacity.
   - Exit variant: `{ opacity: 0, y: -4 }`.
   - Exit transition: 120 ms duration with cubic-bezier(0.16, 1, 0.3, 1).

### 3.2 Status Pill Pulse Effects During Active Dispatch

Email dispatch queue states require clear visual feedback.
States include QUEUED, DISPATCHING, DELIVERED, FAILED, and PENDING_RETRY.

1. Idle or Final States (QUEUED, DELIVERED, FAILED):
   - Render static status chips.
   - Colors: `--olive` for delivered, `--brick` for failed, `--surface-2` for queued.
   - No continuous animation runs.

2. Active In-Flight States (DISPATCHING, PENDING_RETRY):
   - Uses the `StatusPulse` component (`client/src/components/motion/StatusPulse.tsx`).
   - Dot indicator breathes with a 2.0 s radial expanding halo.
   - Keyframe `motion-status-pulse`: scale expands from 1.0 to 2.2 while opacity fades from 0.8 to 0.
   - Outer pill container displays a soft ring pulse (`motion-status-pill-pulse`) expanding to scale 1.04 by 1.15.
   - Tones: `blue` for active background SMTP dispatch, `amber` for automatic retry delay.

### 3.3 Dispatch Log List and Filter Tray Transitions

1. Filter Tray Selection:
   - Filter chips use spring S1 on press (`scaleX: 1.03, scaleY: 0.94`).
   - Releasing filter chips snaps back instantly without bouncing.

2. Dispatch Log Row Stagger:
   - New list queries enter using `StaggerList` with step 35 ms.
   - Each row enters from `{ opacity: 0, y: 10 }` to `{ opacity: 1, y: 0 }`.
   - Row exit completes in 100 ms with fade out to maintain interface response speed.

3. Dispatch Detail Drawer:
   - Slides from the right viewport edge.
   - Enter: `x: "100%"` to `x: "0%"` via spring `SPRINGS.page` (stiffness 200, damping 28).
   - Exit: `x: "100%"` in 140 ms with ease-out curve.

## 4. Patient Self-Upload Flow Specification

Patient surfaces operate under `MotionRoot intensity="lively"`.
Patient motion uses spring S4 (`gentle`, zeta 1.01) with zero overshoot.
This prevents patient anxiety and visual clutter.

### 4.1 Drop Zone and File Selection

1. Rest State:
   - Clay panel with dashed border and subtle tactile depth.

2. Drag-Over State:
   - Scale shifts to 1.01 via spring S4.
   - Border color shifts from `--hairline` to `--olive` over 150 ms.
   - Elevation shifts from clay level 1 to clay level 2.

3. File Selected Settle:
   - Selected file badge enters from `{ opacity: 0, scale: 0.96 }` to `{ opacity: 1, scale: 1.0 }`.
   - Spring S4 settles the badge smoothly in 220 ms.

### 4.2 Upload and OCR Progress Bar Animations

The upload and transcription sequence contains two distinct technical phases.
The `UploadProgress` component (`client/src/components/motion/UploadProgress.tsx`) manages these states.

1. Upload Phase (File byte transmission):
   - Progress bar fill advances from 0% to 100%.
   - Fill width interpolates using smooth CSS transition (300 ms ease-out).
   - Text counter updates smoothly without layout shift.
   - Background fill color: `--peach`.

2. Transcription and Parsing Phase (Indeterminate analysis):
   - Progress bar switches to 100% width with clinical scanner effect.
   - Keyframe `motion-scan-shimmer` sweeps a gradient highlight across the bar every 1.8 s.
   - Gradient: `from-peach/30 via-peach to-peach/30` with background size 200%.
   - Status caption displays animated sparkle icon with message "Analyzing lab report structure and extracting clinical values...".

3. Completion Phase:
   - Progress bar smoothly turns to `--olive` (success).
   - Checkmark icon scales from 0.7 to 1.0 with a soft settle.
   - Delay of 400 ms before transitioning to the verification table.

### 4.3 Extracted Lab Values Verification Transition

1. Stepper Transition:
   - `MotionStepper` fills the connector bar from left to right over 600 ms.
   - The current verification step node highlights with a soft glow.

2. Table Row Reveal:
   - Extracted lab test rows enter via staggered sequence (40 ms delay per row).
   - Rows slide upward 6 pixels with opacity fade.
   - Flagged abnormal values (High or Low) display static `StatusChip` badges with no aggressive flashing.

## 5. Accessibility and Reduced Motion Guarantees

Under `prefers-reduced-motion: reduce` or when `MotionRoot reducedMotion="always"` is active:

1. Transform Elimination:
   - All `translate`, `scale`, and `rotate` animations are disabled (`transform: none !important`).
   - No sliding tab pills or bouncing buttons occur.

2. Opacity Only Transitions:
   - Interface changes use linear opacity fades of 150 ms or less.

3. Static Process Indicators:
   - `StatusPulse` disables the breathing halo and renders a solid dot.
   - `UploadProgress` disables the scanner sweep animation.
   - Indeterminate phase displays a static progress bar with clear text description.

4. Screen Reader Integration:
   - Status indicators include accessible screen reader labels.
   - Progress bars supply `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
   - Dispatch logs announce batch completion using role status.

## 6. Implementation Architecture

The motion components and styles are located at:
- `client/src/components/motion/StatusPulse.tsx`
- `client/src/components/motion/UploadProgress.tsx`
- `client/src/components/motion/SharedPill.tsx`
- `client/src/components/motion/motion.css`
- `client/src/components/motion/index.ts`
- `client/src/lib/motion.ts`
