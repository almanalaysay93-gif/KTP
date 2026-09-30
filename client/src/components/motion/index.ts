/*
 * KTP motion primitives (U4). Contract: docs/buildme/DESIGN.md, "Motion".
 * Set intensity once per surface: <MotionRoot intensity="full"> (admin) or "lively" (patient).
 */
export { MotionRoot } from "./MotionRoot";
export type { MotionRootProps } from "./MotionRoot";
export { PageTransition } from "./PageTransition";
export type { PageTransitionProps } from "./PageTransition";
export { StaggerTray, StaggerList, StaggerItem, Entrance } from "./Stagger";
export type { StaggerTrayProps, StaggerListProps, StaggerItemProps, EntranceProps } from "./Stagger";
export { Squish, useSquish } from "./Squish";
export type { SquishKind, SquishProps, SquishWrapperProps } from "./Squish";
export { Tilt3D, useTilt } from "./Tilt3D";
export type { Tilt3DProps, UseTiltResult } from "./Tilt3D";
export { CountUp } from "./CountUp";
export type { CountUpProps } from "./CountUp";
export { OrganGridBackdrop } from "./OrganGridBackdrop";
export type { OrganGridBackdropProps } from "./OrganGridBackdrop";
export { SharedPill, SharedCellBar, PILL_IDS, SHARED_PILL_HOST } from "./SharedPill";
export type { SharedPillProps, SharedCellBarProps, PillId } from "./SharedPill";
export { BreathingRing, MotionStepper, SheenSkeleton, MotionProgressRing } from "./Ambient";
export { useChartMotion } from "./chartMotion";
export type { ChartMotion, ChartLineMotion } from "./chartMotion";
export {
  MotionClayButton, MotionClayCell, MotionClayCard, StaggerCell, ToastMotion,
  MotionClayButtonBase, MotionClayCellBase, MotionClayCardBase,
} from "./MotionClay";
export type { MotionClayButtonProps, MotionClayCellProps, MotionClayCardProps, ToastMotionProps } from "./MotionClay";
export {
  SPRINGS, DURATION, STAGGER, EASE, EASE_CSS, V,
  useMotionIntensity, useMotionMode, useMotionPreset, getMotionPreset, pickSpring, useFinePointer,
} from "@/lib/motion";
export type { MotionIntensity, MotionMode, MotionPreset, SpringName } from "@/lib/motion";
export { AnimatePresence, LayoutGroup } from "framer-motion";
