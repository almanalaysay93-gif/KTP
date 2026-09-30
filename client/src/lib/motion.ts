/*
 * KTP motion contract. Source of truth: docs/buildme/DESIGN.md, section "Motion".
 * Two intensities: "full" (admin surfaces, full blast) and "lively" (patient surfaces, calmer).
 * A third mode, "reduced", wins over both whenever the OS asks for reduced motion
 * (or a MotionRoot forces it): opacity fades of 150 ms or less, no transforms of any kind.
 * Animate only transform and opacity. Shadows cross-fade a pseudo-layer in clay.css.
 */
import { createContext, useContext, useSyncExternalStore } from "react";
import { useReducedMotion, type TargetAndTransition, type Transition, type Variants } from "framer-motion";

export type MotionIntensity = "full" | "lively";
export type MotionMode = MotionIntensity | "reduced";

type Bezier = readonly [number, number, number, number];

/* Springs (stiffness, damping, mass straight from the DESIGN.md table). */
export const SPRINGS = {
  /** Squish and release. zeta 0.74 */
  press: { type: "spring", stiffness: 520, damping: 30, mass: 0.8 },
  /** Entrances, count settle. zeta 0.72 */
  pop: { type: "spring", stiffness: 260, damping: 22, mass: 0.9 },
  /** Tab, nav, and cell-to-panel shared layout. zeta 0.87 */
  layout: { type: "spring", stiffness: 380, damping: 34, mass: 1 },
  /** 3D tilt follow and pointer drift. zeta 0.73 */
  tilt: { type: "spring", stiffness: 150, damping: 18, mass: 1 },
  /** Route transitions. zeta 0.99 */
  page: { type: "spring", stiffness: 200, damping: 28, mass: 1 },
  /** All patient motion, no overshoot. zeta 1.01 */
  gentle: { type: "spring", stiffness: 220, damping: 30, mass: 1 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof SPRINGS;

/** Durations in seconds (framer-motion units). CSS twins live in motion.css. */
export const DURATION = {
  exit: 0.12,
  reducedFade: 0.15,
  fade: 0.2,
  hover: 0.18,
  color: 0.12,
  bandFade: 0.2,
  countUp: 0.7,
  stepperFill: 0.6,
  ringFill: 0.6,
  chartLineFull: 0.9,
  chartLineLively: 0.6,
  sheen: 1.6,
  breathe: 2.4,
} as const;

/** Stagger steps in seconds. */
export const STAGGER = {
  /** Admin tray cells, row-major. */
  tray: 0.045,
  /** Patient strip cells. */
  strip: 0.06,
  /** Chart points after the line lands. */
  chartPoints: 0.04,
} as const;

export const EASE = {
  /** Strong ease-out; matches --ease-out-soft and the gentle CSS fallback. */
  out: [0.16, 1, 0.3, 1] as Bezier,
  /** Ease-in-out for on-screen movement between two resting states. */
  inOut: [0.77, 0, 0.175, 1] as Bezier,
} as const;

export const EASE_CSS = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
} as const;

/** Variant labels shared by every preset. */
export const V = { hidden: "hidden", show: "show", exit: "exit" } as const;

/* Intensity model */

export interface MotionSettings {
  intensity: MotionIntensity;
  /** true when a MotionRoot sets reducedMotion="always" (an in-app preference or a preview toggle). */
  forceReduced: boolean;
}

/** Default is the calmer patient intensity, so a surface that forgets its MotionRoot never goes full blast. */
export const MotionSettingsContext = createContext<MotionSettings>({ intensity: "lively", forceReduced: false });

export function useMotionIntensity(): MotionIntensity {
  return useContext(MotionSettingsContext).intensity;
}

/** The mode every primitive renders with: reduced motion always wins. */
export function useMotionMode(): MotionMode {
  const { intensity, forceReduced } = useContext(MotionSettingsContext);
  const osReduced = useReducedMotion();
  return forceReduced || osReduced ? "reduced" : intensity;
}

/* Fine pointer gate for hover-only effects (tilt, pointer drift). */

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
let finePointerQuery: MediaQueryList | null = null;
function getFinePointerQuery() {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  finePointerQuery ??= window.matchMedia(FINE_POINTER);
  return finePointerQuery;
}
function subscribeFinePointer(onChange: () => void) {
  const query = getFinePointerQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeFinePointer,
    () => getFinePointerQuery()?.matches ?? false,
    () => false,
  );
}

/* Presets */

const reducedFade: Transition = { duration: DURATION.reducedFade, ease: "linear" };
const fadeIn = (delay = 0): Transition => ({ duration: DURATION.fade, ease: EASE.out, delay });

/** The spring for a named role at a mode. Patient motion is always gentle; reduced motion jumps. */
export function pickSpring(name: SpringName, mode: MotionMode): Transition {
  if (mode === "reduced") return { duration: 0 };
  if (mode === "lively") return SPRINGS.gentle;
  return SPRINGS[name];
}

/** Delay of one tray cell: row-major order, the center cell (if any) last. */
export function trayCellDelay(index: number, centerIndex: number, total: number, step: number) {
  if (centerIndex < 0 || centerIndex >= total) return index * step;
  if (index === centerIndex) return (total - 1) * step;
  return (index > centerIndex ? index - 1 : index) * step;
}

/** Lead before the first cell, so the tray well starts fading first. */
const TRAY_LEAD = 0.06;

/**
 * Delays live on the parent (delayChildren), never on the cell variant, so a cell that returns
 * from hover or press uses its release spring with no entrance delay.
 */
function trayShow(centerIndex: number, step: number): Transition {
  return { delayChildren: (i: number, total: number) => TRAY_LEAD + trayCellDelay(i, centerIndex, total, step) };
}

export interface MotionPreset {
  mode: MotionMode;
  reduced: boolean;
  /** Stagger step for trays and lists at this mode (0 when reduced). */
  stagger: number;
  /** Route transition: hidden, show, exit. */
  page: Variants;
  /** Tray well fade (admin adds scale 0.98) that staggers its cells, center cell last. Pass -1 for no center. */
  tray: (centerIndex: number) => Variants;
  /** One tray cell. Admin center cell overshoots to 1.04. */
  cell: (center: boolean) => Variants;
  /** Container for generic staggered lists. */
  list: Variants;
  listItem: Variants;
  /** One-off entrance (the patient next-up card, a panel). */
  entrance: Variants;
  toast: Variants;
  /** whileTap targets. undefined under reduced motion. */
  pressButton?: TargetAndTransition;
  pressCell?: TargetAndTransition;
  /** Release spring for squish and hover. */
  pressTransition: Transition;
  /** whileHover lift for raised clay (fine pointers only; framer ignores touch hover). */
  hoverLift?: TargetAndTransition;
  /** Shared-layout indicators (tab-pill, nav-pill, tabbar-pill, triage). */
  layout: Transition;
}

function buildPreset(mode: MotionMode): MotionPreset {
  if (mode === "reduced") {
    const fade: Variants = {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: reducedFade },
      exit: { opacity: 0, transition: { duration: 0.1, ease: "linear" } },
    };
    return {
      mode,
      reduced: true,
      stagger: 0,
      page: fade,
      tray: () => fade,
      cell: () => fade,
      list: { hidden: {}, show: {} },
      listItem: fade,
      entrance: fade,
      toast: fade,
      pressTransition: { duration: 0 },
      layout: { duration: 0 },
    };
  }

  if (mode === "lively") {
    const g = SPRINGS.gentle;
    return {
      mode,
      reduced: false,
      stagger: STAGGER.strip,
      page: {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { ...g, opacity: fadeIn() } },
        exit: { opacity: 0, transition: { duration: DURATION.exit, ease: EASE.out } },
      },
      tray: (center) => ({
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { ...fadeIn(), ...trayShow(center, STAGGER.strip) } },
      }),
      cell: () => ({
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { ...g, opacity: fadeIn() } },
      }),
      list: { hidden: {}, show: { transition: { staggerChildren: STAGGER.strip } } },
      listItem: {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { ...g, opacity: fadeIn() } },
      },
      entrance: {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { ...g, opacity: fadeIn() } },
      },
      toast: {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { ...g, opacity: fadeIn() } },
        exit: { opacity: 0, y: 8, transition: { duration: DURATION.exit, ease: EASE.out } },
      },
      pressButton: { scaleX: 0.97, scaleY: 0.97 },
      pressCell: { scaleX: 0.97, scaleY: 0.97 },
      pressTransition: g,
      hoverLift: { y: -2 },
      layout: g,
    };
  }

  const pop = SPRINGS.pop;
  return {
    mode,
    reduced: false,
    stagger: STAGGER.tray,
    page: {
      hidden: { opacity: 0, y: 16 },
      show: { opacity: 1, y: 0, transition: { ...SPRINGS.page, opacity: fadeIn() } },
      exit: { opacity: 0, y: -8, transition: { duration: DURATION.exit, ease: EASE.out } },
    },
    tray: (center) => ({
      hidden: { opacity: 0, scale: 0.98 },
      show: { opacity: 1, scale: 1, transition: { ...pop, opacity: fadeIn(), ...trayShow(center, STAGGER.tray) } },
    }),
    cell: (center) =>
      center
        ? {
            hidden: { opacity: 0, y: 16, scale: 0.92 },
            show: {
              opacity: 1,
              y: 0,
              scale: [0.92, 1.04, 1],
              transition: {
                ...pop,
                opacity: fadeIn(),
                scale: { duration: 0.52, times: [0, 0.55, 1], ease: [EASE.out, EASE.inOut] },
              },
            },
          }
        : {
            hidden: { opacity: 0, y: 16, scale: 0.92 },
            show: { opacity: 1, y: 0, scale: 1, transition: { ...pop, opacity: fadeIn() } },
          },
    list: { hidden: {}, show: { transition: { staggerChildren: STAGGER.tray } } },
    listItem: {
      hidden: { opacity: 0, y: 12 },
      show: { opacity: 1, y: 0, transition: { ...pop, opacity: fadeIn() } },
    },
    entrance: {
      hidden: { opacity: 0, y: 16, scale: 0.98 },
      show: { opacity: 1, y: 0, scale: 1, transition: { ...pop, opacity: fadeIn() } },
    },
    toast: {
      hidden: { opacity: 0, y: 24, scale: 0.96 },
      show: { opacity: 1, y: 0, scale: 1, transition: { ...pop, opacity: fadeIn() } },
      exit: { opacity: 0, y: 8, transition: { duration: DURATION.exit, ease: EASE.out } },
    },
    pressButton: { scaleX: 1.03, scaleY: 0.94 },
    // scaleX and scaleY (not scale), so releasing a press never replays the entrance scale.
    pressCell: { scaleX: 0.97, scaleY: 0.97 },
    pressTransition: SPRINGS.press,
    hoverLift: { y: -2 },
    layout: SPRINGS.layout,
  };
}

const PRESETS: Record<MotionMode, MotionPreset> = {
  full: buildPreset("full"),
  lively: buildPreset("lively"),
  reduced: buildPreset("reduced"),
};

/** Stable preset objects (safe to pass straight to motion props). */
export function getMotionPreset(mode: MotionMode): MotionPreset {
  return PRESETS[mode];
}

/** The preset for the current surface, already collapsed for reduced motion. */
export function useMotionPreset(): MotionPreset {
  return PRESETS[useMotionMode()];
}
