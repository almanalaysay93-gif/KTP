import { forwardRef } from "react";
import { motion, type HTMLMotionProps, type TargetAndTransition, type Transition } from "framer-motion";
import { useMotionPreset } from "@/lib/motion";

export type SquishKind = "button" | "cell";

export interface SquishProps {
  whileTap?: TargetAndTransition;
  whileHover?: TargetAndTransition;
  transition: Transition;
}

/**
 * Press squish and hover lift as motion props, for any motion element.
 * Admin: buttons stretch (scaleX 1.03, scaleY 0.94), cells press to 0.97, release on `press`.
 * Patient: 0.97 only, `gentle`. Reduced motion: nothing.
 * Hover lift (y -2) fires for fine pointers only; framer ignores touch hover.
 */
export function useSquish(kind: SquishKind = "button", options: { lift?: boolean; disabled?: boolean } = {}): SquishProps {
  const preset = useMotionPreset();
  const { lift = true, disabled = false } = options;
  if (disabled) return { transition: preset.pressTransition };
  return {
    whileTap: kind === "button" ? preset.pressButton : preset.pressCell,
    whileHover: lift ? preset.hoverLift : undefined,
    transition: preset.pressTransition,
  };
}

export interface SquishWrapperProps extends HTMLMotionProps<"div"> {
  kind?: SquishKind;
  lift?: boolean;
  disabled?: boolean;
}

/** Wrapper that squishes its content on press. Prefer MotionClayButton / MotionClayCell for clay controls. */
export const Squish = forwardRef<HTMLDivElement, SquishWrapperProps>(function Squish(
  { kind = "button", lift = false, disabled = false, style, ...rest },
  ref,
) {
  const squish = useSquish(kind, { lift, disabled });
  return <motion.div ref={ref} {...squish} style={{ display: "inline-flex", ...style }} {...rest} />;
});
