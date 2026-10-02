import { useEffect, useState } from "react";
import { useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface OrganGridBackdropProps {
  className?: string;
}

/** Decorative ambient motion. Keep outside page transitions, inside a relative isolate root. */
export function OrganGridBackdrop({ className }: OrganGridBackdropProps) {
  const mode = useMotionMode();
  const [paused, setPaused] = useState(() =>
    typeof document !== "undefined" ? document.hidden : false
  );

  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (mode !== "full") return null;

  return (
    <div
      aria-hidden="true"
      data-slot="organ-grid-backdrop"
      data-paused={paused}
      className={cn("ambient-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden", className)}
    >
      <span className="ambient-shape ambient-shape-sage" />
      <span className="ambient-shape ambient-shape-peach" />
      <span className="ambient-shape ambient-shape-lilac" />
    </div>
  );
}
