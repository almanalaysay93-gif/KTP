import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import {
  ClaySkeleton, ClayStepper, ProgressRing,
  type ClaySkeletonProps, type ClayStepperProps, type ProgressRingProps,
} from "@/components/clay";
import { DURATION, EASE_CSS, useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Perpetual breathing ring (admin only): scale 1 to 1.15, opacity 0.6 to 0, every 2.4 s, in CSS so it
 * runs off the main thread. Place inside a relatively positioned round element. Renders nothing on
 * patient surfaces and under reduced motion.
 */
export function BreathingRing({ className }: { className?: string }) {
  const mode = useMotionMode();
  if (mode !== "full") return null;
  return <span aria-hidden className={cn("motion-breathe", className)} />;
}

/**
 * ClayStepper with admin motion: done connectors fill left to right (scaleX 0 to 1, 600 ms) on mount
 * and the current node breathes. Patient and reduced motion: the plain stepper.
 */
export const MotionStepper = forwardRef<HTMLDivElement, ClayStepperProps>(function MotionStepper(props, ref) {
  const mode = useMotionMode();
  return <ClayStepper ref={ref} data-motion-stepper={mode} {...props} />;
});

/** Skeleton well with the peach sheen sweep on admin surfaces; static for patient and reduced motion. */
export const SheenSkeleton = forwardRef<HTMLDivElement, Omit<ClaySkeletonProps, "sheen">>(function SheenSkeleton(
  props,
  ref,
) {
  const mode = useMotionMode();
  return <ClaySkeleton ref={ref} sheen={mode === "full"} {...props} />;
});

/**
 * ProgressRing whose fill sweeps to its value in 600 ms (admin and patient), and from the previous
 * value when it changes. Reduced motion: drawn complete. The sweep is a WAAPI stroke-dashoffset
 * animation on one small SVG circle, the only non-transform animation in the kit (DESIGN.md lists it).
 */
export const MotionProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function MotionProgressRing(
  props,
  ref,
) {
  const mode = useMotionMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastOffset = useRef<number | null>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  useLayoutEffect(() => {
    const circle = rootRef.current?.querySelector<SVGCircleElement>('[data-slot="ring-fill"]');
    if (!circle) {
      lastOffset.current = null;
      return;
    }
    const circumference = Number(circle.getAttribute("stroke-dasharray"));
    const target = Number(circle.getAttribute("stroke-dashoffset"));
    if (mode === "reduced" || typeof circle.animate !== "function") {
      lastOffset.current = target;
      return;
    }
    const from = lastOffset.current ?? circumference;
    if (from === target) return;
    const animation = circle.animate([{ strokeDashoffset: from }, { strokeDashoffset: target }], {
      duration: DURATION.ringFill * 1000,
      easing: EASE_CSS.out,
    });
    animation.onfinish = () => {
      lastOffset.current = target;
    };
    return () => animation.cancel();
  }, [mode, props.value, props.max, props.size, props.state]);

  return <ProgressRing ref={rootRef} {...props} />;
});
