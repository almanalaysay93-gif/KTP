import { StatusChip } from "@/components/clay";
import { DUE_CHIP, patientDate, relativeDay } from "./format";
import { FlatList, SectionCard } from "./SectionCard";
import type { DueItemView, SectionState } from "./types";

export interface DueListProps {
  /** Past due first, then by date (COPY.md me.due.heading). The caller sorts. */
  items: DueItemView[];
  today: string;
  state?: SectionState;
  onRetry?: () => void;
  id?: string;
  className?: string;
}

/** "What is due next": every planned item, with the calm Past due chip and its care-team pointer. */
export function DueList({ items, today, state, onRetry, id = "due-next", className }: DueListProps) {
  return (
    <SectionCard
      id={id}
      title="What is due next"
      state={state}
      onRetry={onRetry}
      className={className}
    >
      {items.length === 0 ? (
        <p className="type-body-lg text-ink">Nothing is due right now. New dates from the KT unit will show here.</p>
      ) : (
        <>
          <FlatList label="Due items">
            {items.map((item) => {
              const chip = DUE_CHIP[item.state];
              return (
                <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-1">
                  <p className="type-body-lg font-bold text-ink">{item.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="type-data text-ink">{patientDate(item.dueDate, today)}</span>
                      <span className="type-body-sm text-ink-muted">{relativeDay(item.dueDate, today)}</span>
                    </p>
                    <StatusChip status={chip.status} label={chip.label} size="patient" srContext={chip.context} />
                  </div>
                  {item.state === "Overdue" ? (
                    <p className="type-body-sm max-w-[60ch] text-ink-muted">
                      The due date has passed. Please ask the KT unit to set a new date. If you already had this done,
                      the KT unit may not have recorded it yet.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </FlatList>
          <p className="type-body-sm mt-2 text-ink-muted">
            You will get an email reminder 7 days before and on the due date.
          </p>
        </>
      )}
    </SectionCard>
  );
}
