import { ArrowDown } from "lucide-react";
import { ClayCardEmpty, ClayCardError, ClaySkeleton, ClaySkeletonGroup, StatusChip } from "@/components/clay";
import { MotionClayCard } from "@/components/motion";
import { cn } from "@/lib/utils";
import { DUE_CHIP, patientDate, relativeDay } from "./format";
import type { DueItemView, SectionState } from "./types";

export interface NextUpCardProps {
  /** Items that share the next due date (today or later). Empty renders the empty state. */
  items: DueItemView[];
  today: string;
  state?: SectionState;
  onRetry?: () => void;
  /** Where "See all dates" points, usually the due list anchor. */
  allDatesHref?: string;
  className?: string;
}

const CARD = "flex flex-col gap-3 rounded-lg p-4 sm:p-5 lg:p-6";

/**
 * The patient hero: the next due date in numeral-xl Mono, its chip, and what is due that day.
 * The one entrance on the page (y 12 on `gentle`, opacity only under reduced motion). No count-up:
 * the date is readable on the first frame.
 */
export function NextUpCard({ items, today, state = "ready", onRetry, allDatesHref = "#due-next", className }: NextUpCardProps) {
  if (state === "loading") {
    return (
      <ClaySkeletonGroup label="Loading your updates..." className={cn(CARD, "clay-2 bg-surface-1", className)}>
        <ClaySkeleton shape="pill" className="h-8 w-28" />
        <ClaySkeleton className="h-10 w-48" />
        <ClaySkeleton className="h-6 w-24" />
        <ClaySkeleton className="h-12 w-full" />
      </ClaySkeletonGroup>
    );
  }

  if (state === "error") {
    return (
      <div className={cn(CARD, "clay-2 bg-surface-1", className)}>
        <h2 className="sr-only">Coming up next</h2>
        <ClayCardError
          message="We could not load your updates. Check your internet, then try again."
          retryLabel="Try again"
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn(CARD, "clay-2 bg-surface-1", className)}>
        <h2 className="sr-only">Coming up next</h2>
        <ClayCardEmpty
          message="Nothing is due right now. New dates from the KT unit will show here."
          action={<SeeAllDates href={allDatesHref} />}
        />
      </div>
    );
  }

  const first = items[0];
  const chip = DUE_CHIP[first.state];
  const date = patientDate(first.dueDate, today);
  const relative = relativeDay(first.dueDate, today);

  return (
    <MotionClayCard level={2} padding="none" className={cn(CARD, "lg:rounded-xl", className)}>
      <StatusChip status={chip.status} label={chip.label} size="patient" srContext={chip.context} className="self-start" />
      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="sr-only">Coming up next: </span>
        <span className="type-numeral-xl text-ink">{date}</span>
        <span className="type-body-lg text-ink-muted">{relative}</span>
      </h2>
      <ul className="flex flex-col gap-2.5" aria-label="Due that day">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col">
            <span className="type-title text-ink">{item.name}</span>
            {item.explain ? <span className="type-body-sm text-ink-muted">{item.explain}</span> : null}
          </li>
        ))}
      </ul>
      <div className="-mx-2 -mb-1 mt-1 flex">
        <SeeAllDates href={allDatesHref} />
      </div>
    </MotionClayCard>
  );
}

function SeeAllDates({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="clay-press clay-ghost clay-focus type-button inline-flex h-12 items-center gap-2 rounded-md px-3 text-brick no-underline transition-colors duration-(--dur-color) hover:bg-sunken/60 [&_svg]:size-5"
    >
      See all dates
      <ArrowDown aria-hidden strokeWidth={1.75} />
    </a>
  );
}
