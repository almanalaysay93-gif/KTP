import type { ReactNode } from "react";
import { ClayCardError, ClayTray } from "@/components/clay";
import { MotionClayCell, StaggerTray } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { SectionState } from "./types";

export interface StripCell {
  id: string;
  label: string;
  value: number;
  /** One short line under the count, for example "next Thu, 1 Oct". */
  sub: ReactNode;
  /** Plain-text version of `sub` for the accessible name. */
  subText: string;
  /** In-page anchor or route. Every strip cell navigates (Actionable Cell Rule). */
  href: string;
}

export interface StripTrayProps {
  cells: [StripCell, StripCell, StripCell];
  state?: SectionState;
  onRetry?: () => void;
  className?: string;
}

/*
 * Labels drop to the label role and cells tighten under 375 px so "Messages" never overflows a
 * 58 px wide cell at 320. From 375 up the label keeps the title role.
 */
const CELL = "min-h-24 px-2 min-[375px]:px-3 lg:min-h-28 lg:px-4";
const LABEL = "block truncate font-sans text-sm font-bold leading-[1.125rem] min-[375px]:font-display min-[375px]:text-lg min-[375px]:leading-6";

/**
 * The patient strip: one row of the logo grid (DESIGN.md Screen 3). A sunken 1x3 well, 3 columns
 * at every width, cells stagger in 60 ms apart on `gentle` with no overshoot. Counts are static
 * numerals (no count-up), and zero reads in ink-muted.
 */
export function StripTray({ cells, state = "ready", onRetry, className }: StripTrayProps) {
  if (state === "loading") {
    return <ClayTray layout="1x3" label="Your summary" loading loadingLabel="Loading your updates..." className={className} />;
  }
  if (state === "error") {
    return (
      <div role="group" aria-label="Your summary" className={cn("clay-sunken rounded-xl p-(--tray-gutter) lg:rounded-2xl", className)}>
        <ClayCardError
          message="We could not load your updates. Check your internet, then try again."
          retryLabel="Try again"
          onRetry={onRetry}
        />
      </div>
    );
  }
  return (
    <StaggerTray layout="1x3" label="Your summary" className={className}>
      {cells.map((cell) => (
        <MotionClayCell
          key={cell.id}
          href={cell.href}
          tilt={false}
          aria-label={`${cell.label}: ${cell.value}, ${cell.subText}. Show list.`}
          className={cn(CELL, "gap-0.5")}
          label={<span className={LABEL}>{cell.label}</span>}
          value={cell.value}
          sub={<span className="block leading-5">{cell.sub}</span>}
        />
      ))}
    </StaggerTray>
  );
}
