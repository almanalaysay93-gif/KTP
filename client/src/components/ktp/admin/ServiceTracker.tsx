import type { ReactNode } from "react";
import { ClipboardPen, FileCheck2, Pill, RotateCcw, ScanLine, Syringe, TestTubes } from "lucide-react";
import { StatusChip } from "@/components/clay";
import { MotionClayButton, StaggerItem, StaggerList } from "@/components/motion";
import { SERVICE_TYPE_LABEL, type Patient, type ServiceTracker as Tracker, type ServiceType } from "@/pages/preview/mock";
import { cn } from "@/lib/utils";
import { fmtDate } from "./format";
import { CLAIM_CHIP, CLAIM_LABEL, DUE_CHIP, DUE_LABEL } from "./PatientTray";
import type { ServiceAction } from "./ServiceActionDialog";

/*
 * The 4-item tracker (spec D8, COPY tracker.card): Meds claim, Laboratory, Tacro test, X-ray and USD.
 * One flat row each: last done, next due with its due state, the claim on the last done record, and
 * the three record actions. An action that does not apply stays visible but disabled.
 */

const I = { strokeWidth: 1.75 } as const;
const ICON: Record<ServiceType, ReactNode> = {
  Meds: <Pill {...I} />,
  Laboratory: <TestTubes {...I} />,
  Tacro: <Syringe {...I} />,
  XrayUsd: <ScanLine {...I} />,
};

export interface ServiceTrackerProps {
  patient: Patient;
  trackers: Tracker[];
  /** Service picked from the tray: its row is highlighted. */
  focus?: ServiceType | null;
  onAction: (action: ServiceAction) => void;
}

export function ServiceTracker({ patient, trackers, focus, onAction }: ServiceTrackerProps) {
  return (
    <StaggerList as="ul" aria-label="Tracked services" className="flex flex-col">
      {trackers.map((t) => {
        const label = SERVICE_TYPE_LABEL[t.serviceType];
        const last = t.lastDone;
        const next = t.nextPlanned;
        const claim = t.lastDoneClaim;
        const claimOpen = claim === "Overdue" || claim === "DueSoon" || claim === "Open";
        return (
          <StaggerItem
            as="li"
            key={t.serviceType}
            data-focus={focus === t.serviceType || undefined}
            className={cn(
              "relative grid gap-x-6 gap-y-3 border-b border-hairline px-1 py-4 last:border-b-0 lg:px-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] lg:items-center",
              "rounded-md transition-colors duration-(--dur-color)",
              focus === t.serviceType && "bg-peach-tint",
            )}
          >
            <div className="flex items-center gap-3">
              <span aria-hidden className="clay-sunken inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink [&_svg]:size-5">
                {ICON[t.serviceType]}
              </span>
              <h3 className="type-title text-ink">{label}</h3>
            </div>
            <Field term="Last done">
              <span className="type-data text-ink">{last?.serviceDate ? fmtDate(last.serviceDate) : "Not set"}</span>
            </Field>
            <Field term="Next due">
              <span className={cn("type-data", t.nextDueState === "Overdue" ? "text-overdue" : "text-ink")}>
                {next ? fmtDate(next.dueDate) : "Not set"}
              </span>
              {t.nextDueState ? <StatusChip status={DUE_CHIP[t.nextDueState]} label={DUE_LABEL[t.nextDueState]} /> : null}
            </Field>
            <Field term="Claim">
              {claim ? (
                <StatusChip status={CLAIM_CHIP[claim]} label={CLAIM_LABEL[claim]} srContext="Claim status:" />
              ) : (
                <span className="text-ink-muted">Not set</span>
              )}
              {last && claim === "Filed" && last.claimFiledDate ? (
                <span className="type-data text-ink-muted">filed {fmtDate(last.claimFiledDate)}</span>
              ) : last?.claimDeadline && claim !== "None" ? (
                <span className="type-data text-ink-muted">deadline {fmtDate(last.claimDeadline)}</span>
              ) : null}
            </Field>
            <div className="flex flex-wrap gap-2 lg:col-span-4 lg:justify-end">
              <MotionClayButton
                variant="secondary"
                size="sm"
                icon={<ClipboardPen {...I} />}
                disabled={!next}
                aria-label={next ? `Record result: ${label}, due ${fmtDate(next.dueDate)}` : undefined}
                onClick={() => next && onAction({ kind: "result", patient, record: next })}
              >
                Record result
              </MotionClayButton>
              <MotionClayButton
                variant="ghost"
                size="sm"
                icon={<RotateCcw {...I} />}
                disabled={!last}
                aria-label={last?.serviceDate ? `Repeat test: ${label}, done ${fmtDate(last.serviceDate)}` : undefined}
                onClick={() => last && onAction({ kind: "repeat", patient, record: last })}
              >
                Repeat test
              </MotionClayButton>
              <MotionClayButton
                variant="ghost"
                size="sm"
                icon={<FileCheck2 {...I} />}
                disabled={!last || !claimOpen}
                aria-label={last && claimOpen ? `Mark claim filed: ${label}, ${patient.lastName}, ${patient.firstName}` : undefined}
                onClick={() => last && claimOpen && onAction({ kind: "claim", patient, record: last })}
              >
                Mark claim filed
              </MotionClayButton>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 max-lg:pl-14">
      <span className="type-label text-ink-muted">{term}</span>
      <span className="flex flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}
