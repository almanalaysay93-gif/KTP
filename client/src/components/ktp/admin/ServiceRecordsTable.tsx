import { useMemo, useState } from "react";
import { ClipboardPen, FileCheck2, Plus, RotateCcw, type LucideIcon } from "lucide-react";
import { StatusChip } from "@/components/clay";
import { MotionClayButton } from "@/components/motion";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABEL,
  claimStatus,
  dueState,
  type Patient,
  type ServiceRecord,
  type ServiceType,
} from "@/pages/preview/mock";
import { cn } from "@/lib/utils";
import { fmtDate } from "./format";
import { CLAIM_CHIP, CLAIM_LABEL, DUE_CHIP, DUE_LABEL } from "./PatientTray";
import type { ServiceAction } from "./ServiceActionDialog";
import { REPEAT_REASON_LABEL } from "./TriageLists";

/*
 * Every service record for one patient (COPY tracker.toolbar and tracker.columns). Filter by type,
 * show or hide Superseded rows, newest due first. Flat table in its own labelled scroll region with
 * a sticky first column.
 */

const PAGE = 8;

export interface ServiceRecordsTableProps {
  patient: Patient;
  records: ServiceRecord[];
  filter: ServiceType | "all";
  onFilterChange: (filter: ServiceType | "all") => void;
  onAction: (action: ServiceAction) => void;
  onAddService: () => void;
}

export function ServiceRecordsTable({ patient, records, filter, onFilterChange, onAction, onAddService }: ServiceRecordsTableProps) {
  const [showSuperseded, setShowSuperseded] = useState(true);
  const [all, setAll] = useState(false);
  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const rows = records
    .filter((r) => (filter === "all" || r.serviceType === filter) && (showSuperseded || r.status !== "Superseded"))
    .sort((a, b) => (a.dueDate === b.dueDate ? (a.id < b.id ? 1 : -1) : a.dueDate < b.dueDate ? 1 : -1));
  const visible = all ? rows : rows.slice(0, PAGE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by service" className="flex flex-wrap gap-2">
          {(["all", ...SERVICE_TYPES] as const).map((type) => {
            const pressed = filter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={pressed}
                onClick={() => onFilterChange(type)}
                className={cn(
                  "clay-focus clay-press inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 type-button transition-colors duration-(--dur-color)",
                  pressed ? "clay-pressed bg-peach-tint text-ink" : "clay-1 clay-hover bg-surface-2 text-ink-muted hover:text-ink",
                )}
              >
                {type === "all" ? "All services" : SERVICE_TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={showSuperseded}
            onClick={() => setShowSuperseded((v) => !v)}
            className="clay-focus inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-2 type-button text-ink hover:bg-sunken/60"
          >
            <span aria-hidden className={cn("clay-sunken relative inline-flex h-7 w-12 items-center rounded-full p-1", showSuperseded && "bg-sage-deep")}>
              <span
                className={cn(
                  "clay-1 size-5 rounded-full bg-surface-2 transition-transform duration-150 ease-out",
                  showSuperseded ? "translate-x-5" : "translate-x-0",
                )}
              />
            </span>
            Show superseded
          </button>
          <MotionClayButton variant="secondary" size="sm" icon={<Plus strokeWidth={1.75} />} onClick={onAddService}>
            Add service
          </MotionClayButton>
        </div>
      </div>

      <div role="region" aria-label="Service records" tabIndex={0} className="clay-table-wrap clay-focus -mx-2">
        <table className="clay-table [&_td]:px-2 [&_th]:px-2 [&_thead_th]:whitespace-normal">
          <thead>
            <tr>
              <th scope="col" data-sticky="true">Service</th>
              <th scope="col">Label</th>
              <th scope="col">Due date</th>
              <th scope="col">Done on</th>
              <th scope="col">Status</th>
              <th scope="col">Claim deadline</th>
              <th scope="col">Filed on</th>
              <th scope="col">Claim</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-ink-muted">No services yet. Add the first planned service.</td>
              </tr>
            ) : (
              visible.map((r) => <RecordRow key={r.id} patient={patient} record={r} byId={byId} onAction={onAction} />)
            )}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE ? (
        <div>
          <MotionClayButton variant="ghost" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `View all ${rows.length}`}
          </MotionClayButton>
        </div>
      ) : null}
    </div>
  );
}

function RecordRow({
  patient,
  record: r,
  byId,
  onAction,
}: {
  patient: Patient;
  record: ServiceRecord;
  byId: Map<string, ServiceRecord>;
  onAction: (a: ServiceAction) => void;
}) {
  const superseded = r.status === "Superseded";
  const due = dueState(r);
  const claim = r.status === "Planned" ? null : claimStatus(r);
  const claimOpen = claim === "Overdue" || claim === "DueSoon" || claim === "Open";
  const repeatOf = r.repeatOfId ? byId.get(r.repeatOfId) : undefined;
  const label = SERVICE_TYPE_LABEL[r.serviceType];
  const strike = superseded ? "clay-struck" : undefined;

  return (
    <tr data-superseded={superseded || undefined}>
      <th scope="row" data-sticky="true" className="font-bold">{label}</th>
      <td className="whitespace-normal! min-w-28 py-2">
        <span className="block">{r.label}</span>
        <span className="type-caption block text-ink-muted">
          <span className="sr-only">Source: </span>
          {r.source === "Guide" ? (
            <span title="Created from the monitoring guide schedule. You can change the date.">Guide</span>
          ) : (
            "Manual"
          )}
        </span>
        {repeatOf && r.repeatReason ? (
          <span className="type-caption block text-ink-muted">
            Repeat of {fmtDate(repeatOf.serviceDate)}. Reason: {REPEAT_REASON_LABEL[r.repeatReason]}.
          </span>
        ) : null}
      </td>
      <td data-num="true"><span className={strike}>{fmtDate(r.dueDate)}</span></td>
      <td data-num={r.serviceDate ? "true" : undefined}>
        {r.serviceDate ? <span className={strike}>{fmtDate(r.serviceDate)}</span> : <NotSet />}
      </td>
      <td>
        {superseded ? (
          <StatusChip status="superseded" />
        ) : due ? (
          <StatusChip status={DUE_CHIP[due]} label={DUE_LABEL[due]} />
        ) : (
          <StatusChip status="done" />
        )}
      </td>
      <td data-num={r.claimDeadline ? "true" : undefined}>{r.claimDeadline ? fmtDate(r.claimDeadline) : <NotSet />}</td>
      <td data-num={r.claimFiledDate ? "true" : undefined}>{r.claimFiledDate ? fmtDate(r.claimFiledDate) : <NotSet />}</td>
      <td>{claim && claim !== "None" ? <StatusChip status={CLAIM_CHIP[claim]} label={CLAIM_LABEL[claim]} srContext="Claim status:" /> : <NotSet />}</td>
      <td className="py-1">
        <span className="flex gap-1">
          {r.status === "Planned" ? (
            <RowButton Icon={ClipboardPen} label="Record result" aria={`Record result: ${r.label}, due ${fmtDate(r.dueDate)}`} onClick={() => onAction({ kind: "result", patient, record: r })} />
          ) : null}
          {r.status === "Done" ? (
            <RowButton Icon={RotateCcw} label="Repeat test" aria={`Repeat test: ${r.label}, due ${fmtDate(r.dueDate)}`} onClick={() => onAction({ kind: "repeat", patient, record: r })} />
          ) : null}
          {claimOpen ? (
            <RowButton Icon={FileCheck2} label="Mark claim filed" aria={`Mark claim filed: ${r.label}, ${patient.lastName}, ${patient.firstName}`} onClick={() => onAction({ kind: "claim", patient, record: r })} />
          ) : null}
        </span>
      </td>
    </tr>
  );
}

function NotSet() {
  return <span className="text-ink-muted">Not set</span>;
}

/** Icon-only row action: 44 px target, verb-first aria-label, ink tooltip on hover and focus. */
function RowButton({ Icon, label, aria, onClick }: { Icon: LucideIcon; label: string; aria: string; onClick: () => void }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={aria}
        onClick={onClick}
        className="clay-focus-inset clay-press inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-brick transition-colors duration-(--dur-color) hover:bg-sunken/60"
      >
        <Icon aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
      <span
        aria-hidden
        className="type-label pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden whitespace-nowrap rounded-xs bg-ink px-2.5 py-1.5 text-on-brick group-focus-within:block group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}
