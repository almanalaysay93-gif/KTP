import { StatusChip } from "@/components/clay";
import { CLAIM_CHIP, patientDate } from "./format";
import { FlatList, SectionCard } from "./SectionCard";
import type { ClaimItemView, SectionState } from "./types";

export interface ClaimDeadlinesProps {
  /** Unfiled claims and recent filed ones, sorted by deadline. */
  items: ClaimItemView[];
  today: string;
  state?: SectionState;
  onRetry?: () => void;
  id?: string;
  className?: string;
}

/**
 * Claim deadlines (spec 6.5, COPY.md me.claims). Flat rows: the service and its date, then the
 * deadline in Mono with the patient claim chip. Past deadline and repeated items carry their
 * plain helper line and point to the KT unit.
 */
export function ClaimDeadlines({ items, today, state, onRetry, id = "claims", className }: ClaimDeadlinesProps) {
  return (
    <SectionCard
      id={id}
      title="Claim deadlines"
      helper="Deadlines for claims on your services. Please ask the KT unit if you are not sure what to do."
      state={state}
      onRetry={onRetry}
      className={className}
    >
      {items.length === 0 ? (
        <p className="type-body-lg text-ink">No claim deadlines right now.</p>
      ) : (
        <FlatList label="Claims">
          {items.map((item) => {
            const chip = CLAIM_CHIP[item.status];
            const serviceDate = patientDate(item.serviceDate, today);
            const deadline = patientDate(item.deadline, today);
            return (
              <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-1">
                <p className="type-body-lg text-ink">
                  <span className="font-bold">{item.name}</span>
                  <span className="text-ink-muted"> on </span>
                  <span className="type-data">{serviceDate}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="type-body-sm text-ink-muted">
                    Deadline <span className="type-data text-ink">{deadline}</span>
                  </p>
                  <StatusChip status={chip.status} label={chip.label} size="patient" srContext={chip.context} />
                </div>
                {item.status === "Overdue" ? (
                  <p className="type-body-sm max-w-[60ch] text-ink-muted">
                    This deadline has passed and the claim is not marked filed. Please ask the KT unit what to do next.
                  </p>
                ) : null}
                {item.repeated ? (
                  <p className="type-body-sm max-w-[60ch] text-ink-muted">This test was repeated. Its claim is still tracked.</p>
                ) : null}
              </li>
            );
          })}
        </FlatList>
      )}
    </SectionCard>
  );
}
