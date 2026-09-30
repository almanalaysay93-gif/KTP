import { useContext, useMemo, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { MotionSettingsContext, type MotionIntensity } from "@/lib/motion";
import "./motion.css";

export interface MotionRootProps {
  /** "full" for admin surfaces (full blast), "lively" for patient surfaces (calmer). */
  intensity: MotionIntensity;
  /**
   * "user" (default) follows the OS setting. "always" forces reduced motion, for an in-app
   * preference or a preview toggle. There is no way to switch reduced motion off.
   */
  reducedMotion?: "user" | "always";
  children: ReactNode;
}

/**
 * Motion boundary for a surface. Wrap the admin layout in intensity="full" and the patient
 * layout in intensity="lively". Nesting is allowed; a forced reduced parent stays forced.
 */
export function MotionRoot({ intensity, reducedMotion = "user", children }: MotionRootProps) {
  const parent = useContext(MotionSettingsContext);
  const forceReduced = reducedMotion === "always" || parent.forceReduced;
  const value = useMemo(() => ({ intensity, forceReduced }), [intensity, forceReduced]);
  return (
    <MotionConfig reducedMotion={forceReduced ? "always" : "user"}>
      <MotionSettingsContext.Provider value={value}>{children}</MotionSettingsContext.Provider>
    </MotionConfig>
  );
}
