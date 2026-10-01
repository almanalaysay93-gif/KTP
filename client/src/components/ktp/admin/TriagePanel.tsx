import { useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ClayCard, ClayCardEmpty, ClayCardError } from "@/components/clay";
import {
  MotionClayButton,
  SharedCellBar,
  SheenSkeleton,
  useMotionPreset,
  V,
} from "@/components/motion";
import type {
  DashboardAggregates,
  Patient,
  MockDataset,
} from "@/lib/ktpViewTypes";
import {
  ClaimsDueList,
  DueSoonList,
  OverdueList,
  PatientList,
  RescheduleList,
  SupersededClaimsList,
  type RowActions,
} from "./TriageLists";
import { TRIAGE_LABEL } from "./TriageTray";
import {
  isPeopleCell,
  matchesQuery,
  patientsFor,
  servicesDueSoon,
  stageTitle,
  type TriageSelection,
} from "./triage";

/*
 * Triage panel: the list behind the selected tray cell or stage. The cell's brick bar morphs into this
 * header when a stage is picked (layoutId "triage"); the list itself swaps with a short entrance and
 * its rows stagger in. Flat rows inside one level-2 card.
 */

const PAGE = 6;

interface ListMeta {
  title: string;
  description?: string;
  empty: string;
  count: number;
  body: (actions: RowActions) => ReactNode;
}

function selectionKey(s: TriageSelection) {
  return s.kind === "cell" ? s.id : `${s.patientType}-${s.stage}`;
}

function metaFor(
  selection: TriageSelection,
  agg: DashboardAggregates,
  query: string,
  limit: number,
  data: MockDataset,
  today: string
): ListMeta {
  const byQuery = <T extends { patient: Patient }>(rows: T[]) =>
    rows.filter(r => matchesQuery(r.patient, query));
  if (query.trim()) {
    const patients = data.patients.filter(p => matchesQuery(p, query));
    return {
      title: "Patient search",
      description: "Enrolled patients across all statuses.",
      empty: "No matching patients.",
      count: patients.length,
      body: a => (
        <PatientList
          label="Patient search"
          patients={patients.slice(0, limit)}
          actions={a}
          today={today}
        />
      ),
    };
  }

  if (selection.kind === "stage" || isPeopleCell(selection.id)) {
    const patients = patientsFor(selection, data).filter(p =>
      matchesQuery(p, query)
    );
    const title =
      selection.kind === "stage"
        ? stageTitle(selection.patientType, selection.stage)
        : TRIAGE_LABEL[selection.id];
    return {
      title,
      description:
        selection.kind === "stage"
          ? "Active patients at this stage."
          : undefined,
      empty: "No active patients yet.",
      count: patients.length,
      body: a => (
        <PatientList
          label={title}
          patients={patients.slice(0, limit)}
          actions={a}
          today={today}
        />
      ),
    };
  }

  switch (selection.id) {
    case "overdue": {
      const rows = byQuery(agg.overdueServices);
      return {
        title: "Overdue services",
        description:
          "Planned services past their due date. Counted in Asia/Manila time.",
        empty: "No overdue services.",
        count: rows.length,
        body: a => <OverdueList rows={rows.slice(0, limit)} actions={a} />,
      };
    }
    case "claims": {
      const rows = byQuery(agg.claimsDueSoon);
      return {
        title: "Claims due within 7 days",
        description: "Unfiled claims with a deadline from today to 7 days out.",
        empty: "No claims due in the next 7 days.",
        count: rows.length,
        body: a => <ClaimsDueList rows={rows.slice(0, limit)} actions={a} />,
      };
    }
    case "reschedule": {
      const rows = byQuery(agg.rescheduleRequests);
      return {
        title: "Reschedule requests",
        description:
          "Setting a new time resets the reply to Pending and notifies the patient.",
        empty: "No reschedule requests.",
        count: rows.length,
        body: a => <RescheduleList rows={rows.slice(0, limit)} actions={a} />,
      };
    }
    case "superseded": {
      const rows = byQuery(agg.supersededUnfiled);
      return {
        title: "Superseded, claim not filed",
        description:
          "A repeat test replaced this record. Its own claim is still unfiled.",
        empty: "No superseded records with unfiled claims.",
        count: rows.length,
        body: a => (
          <SupersededClaimsList rows={rows.slice(0, limit)} actions={a} />
        ),
      };
    }
    default: {
      const rows = byQuery(servicesDueSoon(data, today));
      return {
        title: "Services due in 7 days",
        description:
          "Planned services due from today to 7 days out. Counted in Asia/Manila time.",
        empty: "No services due in the next 7 days.",
        count: rows.length,
        body: a => <DueSoonList rows={rows.slice(0, limit)} actions={a} />,
      };
    }
  }
}

export interface TriagePanelProps {
  id: string;
  selection: TriageSelection;
  aggregates: DashboardAggregates;
  data: MockDataset;
  today: string;
  query: string;
  actions: RowActions;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
}

export function TriagePanel({
  id,
  selection,
  aggregates,
  data,
  today,
  query,
  actions,
  state = "ready",
  onRetry,
}: TriagePanelProps) {
  const titleId = useId();
  const preset = useMotionPreset();
  const key = selectionKey(selection);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const expanded = expandedKey === key;
  const meta = metaFor(
    selection,
    aggregates,
    query,
    expanded ? Number.POSITIVE_INFINITY : PAGE,
    data,
    today
  );
  const q = query.trim();

  return (
    <ClayCard
      id={id}
      role="region"
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col"
    >
      <div className="relative mb-2 flex items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="type-title flex flex-wrap items-baseline gap-x-2 text-ink"
          >
            <span>{meta.title}</span>
            {state === "ready" ? (
              <span className="type-data-lg text-ink-muted">{meta.count}</span>
            ) : null}
          </h2>
          {meta.description ? (
            <p className="type-body-sm mt-1 max-w-[52ch] text-ink-muted">
              {meta.description}
            </p>
          ) : null}
        </div>
        {selection.kind === "stage" ? (
          <SharedCellBar className="bottom-0 left-0" />
        ) : null}
      </div>

      {state === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading...</span>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="grid grid-cols-[40px_1fr] items-center gap-3"
            >
              <SheenSkeleton shape="circle" className="size-10" />
              <SheenSkeleton className="h-12" />
            </div>
          ))}
        </div>
      ) : state === "error" ? (
        <ClayCardError message="Could not load this list." onRetry={onRetry} />
      ) : (
        <motion.div
          key={key}
          variants={preset.entrance}
          initial={V.hidden}
          animate={V.show}
        >
          {meta.count === 0 ? (
            <ClayCardEmpty
              message={q ? `No patients match "${q}".` : meta.empty}
            />
          ) : (
            <>
              {meta.body(actions)}
              {meta.count > PAGE ? (
                <div className="mt-2 border-t border-hairline pt-3">
                  <MotionClayButton
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded}
                    onClick={() => setExpandedKey(expanded ? null : key)}
                  >
                    {expanded ? "Show fewer" : `View all ${meta.count}`}
                  </MotionClayButton>
                </div>
              ) : null}
            </>
          )}
        </motion.div>
      )}
    </ClayCard>
  );
}
