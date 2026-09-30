import type { ReactNode } from "react";
import { ClayCard, ClayCardError, ClaySkeleton, ClaySkeletonGroup } from "@/components/clay";
import { cn } from "@/lib/utils";
import type { SectionState } from "./types";

export interface SectionCardProps {
  /** Anchor id (the strip cells link here). The heading gets `${id}-heading`. */
  id: string;
  title: string;
  /** Next to the heading, for example a "2 new" badge. */
  titleExtra?: ReactNode;
  /** Plain helper line under the heading. */
  helper?: ReactNode;
  /** Clay level: 1 for flat lists, 2 for the appointment card. */
  level?: 1 | 2;
  state?: SectionState;
  loadingLabel?: string;
  onRetry?: () => void;
  /** Rendered above the heading, inside the section (the emergency band on Messages). */
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const PATIENT_ERROR = "We could not load your updates. Check your internet, then try again.";

/**
 * A patient home section: clay card, heading in the title role, flat rows inside (Flat Data Rule).
 * Loading shows static sunken rows (no sheen on patient surfaces); error shows the Info bar with
 * Try again. Sections never animate in: the page keeps to three entrance types.
 */
export function SectionCard({
  id,
  title,
  titleExtra,
  helper,
  level = 1,
  state = "ready",
  loadingLabel = "Loading your updates...",
  onRetry,
  lead,
  children,
  className,
}: SectionCardProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex scroll-mt-4 flex-col gap-3", className)}>
      {lead}
      <ClayCard level={level} padding="none" className="flex flex-col gap-1 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={headingId} className="type-headline text-ink">
            {title}
          </h2>
          {titleExtra}
        </div>
        {helper ? <p className="type-body-sm max-w-[60ch] text-ink-muted">{helper}</p> : null}
        <div className="mt-2">
          {state === "loading" ? (
            <ClaySkeletonGroup label={loadingLabel} className="flex flex-col gap-3">
              <ClaySkeleton className="h-14 w-full" />
              <ClaySkeleton className="h-14 w-full" />
              <ClaySkeleton className="h-14 w-4/5" />
            </ClaySkeletonGroup>
          ) : state === "error" ? (
            <ClayCardError message={PATIENT_ERROR} retryLabel="Try again" onRetry={onRetry} />
          ) : (
            children
          )}
        </div>
      </ClayCard>
    </section>
  );
}

/** Flat row list with hairline dividers (decorative; rows are also separated by spacing). */
export function FlatList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn("flex flex-col divide-y divide-hairline", className)}>
      {children}
    </ul>
  );
}
