import type { CSSProperties } from "react";
import { DURATION, STAGGER, useMotionMode, type MotionMode } from "@/lib/motion";

export interface ChartLineMotion {
  isAnimationActive: boolean;
  animationBegin: number;
  animationDuration: number;
  animationEasing: "ease-out";
}

export interface ChartMotion {
  mode: MotionMode;
  /** Spread on a recharts <Line> (or <Area>). */
  line: ChartLineMotion;
  /** className for the reference band (<ReferenceArea className={...}>): fades in over 200 ms first. */
  bandClassName?: string;
  /**
   * Props for the <g> that wraps one custom point marker (recharts `dot` render prop).
   * Recharts mounts dots after the line finishes, so the delay is only the 40 ms stagger.
   */
  point: (index: number) => { className?: string; style?: CSSProperties; "data-calm"?: "true" };
}

const BAND_MS = DURATION.bandFade * 1000;

const OFF: ChartMotion = {
  mode: "reduced",
  line: { isAnimationActive: false, animationBegin: 0, animationDuration: 0, animationEasing: "ease-out" },
  point: () => ({}),
};

function build(mode: MotionMode): ChartMotion {
  if (mode === "reduced") return OFF;
  const full = mode === "full";
  return {
    mode,
    line: {
      isAnimationActive: true,
      animationBegin: BAND_MS,
      animationDuration: (full ? DURATION.chartLineFull : DURATION.chartLineLively) * 1000,
      animationEasing: "ease-out",
    },
    bandClassName: "motion-chart-band",
    point: (index) => ({
      className: "motion-chart-point",
      style: { animationDelay: `${Math.round(index * STAGGER.chartPoints * 1000)}ms` },
      // Patient points fade in without the pop overshoot.
      ...(full ? {} : { "data-calm": "true" as const }),
    }),
  };
}

const CHART: Record<MotionMode, ChartMotion> = { full: build("full"), lively: build("lively"), reduced: OFF };

/**
 * Recharts draw-in per surface. Admin: band fade 200 ms, then the line over 900 ms ease-out, then
 * points pop in 40 ms apart. Patient: 600 ms line, points fade. Reduced motion: charts render complete
 * (isAnimationActive false, no classes).
 */
export function useChartMotion(): ChartMotion {
  return CHART[useMotionMode()];
}
