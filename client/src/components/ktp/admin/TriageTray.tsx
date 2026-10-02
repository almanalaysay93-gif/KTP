import type { ReactNode } from "react";
import {
  ArrowLeftRight, CalendarClock, CalendarDays, FileClock, HandHeart, History, TriangleAlert, UserRoundCheck,
  UserRoundSearch, Users,
} from "lucide-react";
import { ClayCell, ClayTray, StatusChip, type ClayCellTone } from "@/components/clay";
import { CountUp, MotionClayCell, SharedCellBar, StaggerTray } from "@/components/motion";
import { fmtWeekday, plural } from "./format";
import { TRIAGE_ORDER, type TriageCellId, type TriageCounts, type TriageSelection } from "./triage";

/*
 * Eight dashboard options in two columns. Active patients keeps its sage styling.
 * Every cell filters the triage panel. One tab stop. Arrows move between cells.
 */

const I = { strokeWidth: 1.75 } as const;

export const TRIAGE_LABEL: Record<TriageCellId, string> = {
  overdue: "Overdue services",
  claims: "Claims due in 7 days",
  reschedule: "Reschedule requests",
  superseded: "Superseded, claim not filed",
  active: "Active patients",
  dueSoon: "Services due in 7 days",
  workup: "Recipients, work-up",
  postkt: "Recipients, Post-KT",
  donors: "Donors",
};

interface CellSpec {
  count: number;
  tone?: ClayCellTone;
  icon: ReactNode;
  sub?: ReactNode;
  chip?: ReactNode;
}

function cellSpec(id: TriageCellId, c: TriageCounts): CellSpec {
  switch (id) {
    case "overdue":
      return {
        count: c.overdue,
        tone: "overdue",
        icon: <TriangleAlert {...I} />,
        sub: c.oldestOverdue !== null ? `oldest ${c.oldestOverdue} d` : undefined,
        chip: <StatusChip status="overdue" />,
      };
    case "claims":
      return {
        count: c.claims,
        tone: "due-soon",
        icon: <FileClock {...I} />,
        sub: c.nextClaimDeadline ? `next ${fmtWeekday(c.nextClaimDeadline)}` : undefined,
        chip: <StatusChip status="due-soon" />,
      };
    case "reschedule":
      return {
        count: c.reschedule,
        icon: <CalendarClock {...I} />,
        sub: c.oldestReschedule !== null ? `oldest ${c.oldestReschedule} d` : undefined,
      };
    case "superseded":
      return {
        count: c.superseded,
        icon: <History {...I} />,
        sub: c.nextSupersededDeadline ? `deadline ${fmtWeekday(c.nextSupersededDeadline)}` : undefined,
      };
    case "active":
      return {
        count: c.active,
        tone: "sage",
        icon: <Users {...I} className="text-sage" />,
        sub: (
          <span className="flex items-center gap-2 text-sage-deep">
            <ArrowLeftRight aria-hidden className="size-4 shrink-0 rotate-90 text-sage" strokeWidth={2} />
            <span className="flex flex-col">
              <span>{plural(c.recipients, "recipient")}</span>
              <span>{plural(c.donors, "donor")}</span>
            </span>
          </span>
        ),
      };
    case "dueSoon":
      return {
        count: c.dueSoon,
        icon: <CalendarDays {...I} />,
        sub: c.nextDueSoon ? `next ${fmtWeekday(c.nextDueSoon)}` : undefined,
        chip: <StatusChip status="planned" />,
      };
    case "workup":
      return { count: c.workup, icon: <UserRoundSearch {...I} />, sub: plural(c.workupStages, "stage") };
    case "postkt":
      return {
        count: c.postkt,
        icon: <UserRoundCheck {...I} />,
        sub: c.newestPostKtDay !== null ? `newest day ${c.newestPostKtDay}` : undefined,
      };
    case "donors":
      return {
        count: c.donors,
        icon: <HandHeart {...I} />,
        sub: `${c.donorsWorkup} work-up, ${c.donorsPost} post-donation`,
      };
  }
}

export interface TriageTrayProps {
  counts: TriageCounts;
  selection: TriageSelection;
  onSelect: (id: TriageCellId) => void;
  /** id of the triage panel the cells control. */
  panelId: string;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
}

export function TriageTray({ counts, selection, onSelect, panelId, state = "ready", onRetry }: TriageTrayProps) {
  if (state === "loading") {
    return (
      <ClayTray label="Triage counts" reflow={false} aria-busy="true" roving={false} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <span className="sr-only">Loading dashboard...</span>
        {TRIAGE_ORDER.map(id => <ClayCell key={id} state="loading" center={id === "active"} />)}
      </ClayTray>
    );
  }

  return (
    <StaggerTray label="Triage counts" reflow={false} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      {TRIAGE_ORDER.map((id) => {
        const spec = cellSpec(id, counts);
        const center = id === "active";
        if (state === "error") {
          return (
            <MotionClayCell
              key={id}
              center={center}
              label={TRIAGE_LABEL[id]}
              icon={spec.icon}
              state="error"
              errorText="Could not load"
              onRetry={onRetry}
              retryLabel={`Retry ${TRIAGE_LABEL[id]}`}
            />
          );
        }
        const selected = selection.kind === "cell" && selection.id === id;
        const zero = spec.count === 0;
        return (
          <MotionClayCell
            key={id}
            center={center}
            label={TRIAGE_LABEL[id]}
            icon={spec.icon}
            value={<CountUp value={spec.count} />}
            valueTone={zero && !center ? "muted" : spec.tone}
            sub={spec.sub}
            status={zero && !center ? <StatusChip status="done" label="Clear" /> : spec.chip}
            selected={selected}
            aria-label={`${TRIAGE_LABEL[id]}, ${spec.count}. Show list.`}
            aria-controls={panelId}
            onClick={() => onSelect(id)}
          >
            {selected ? <SharedCellBar /> : null}
          </MotionClayCell>
        );
      })}
    </StaggerTray>
  );
}
