import { MotionClayCell, StaggerTray } from "@/components/motion";
import { cn } from "@/lib/utils";

const CELLS = Array.from({ length: 9 }, (_, i) => `/branding/cells/cell-${i + 1}.png`);

export interface LogoTrayProps {
  className?: string;
}

/**
 * The sign-in brand moment (DESIGN.md Screen 1): the OTS mark sliced into its nine cells, set as
 * raised clay in a sunken tray, so the logo assembles itself. Row-major stagger with the center
 * cell (the two people passing a kidney, sage tint) last. Sign-in is shared with patients, so the
 * parent always runs the calmer patient set (rise on `gentle`, no overshoot, no zoom).
 * Decorative: the wordmark beside it carries the name, so the tray is hidden from screen readers.
 */
export function LogoTray({ className }: LogoTrayProps) {
  return (
    <StaggerTray
      aria-hidden
      label="Organ Transplant Services mark"
      reflow={false}
      roving={false}
      className={cn("aspect-square w-full", className)}
    >
      {CELLS.map((src, i) => (
        <MotionClayCell key={src} as="div" center={i === 4} image={src} tilt={false} squish={false} />
      ))}
    </StaggerTray>
  );
}
