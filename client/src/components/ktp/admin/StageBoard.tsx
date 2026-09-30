import { useId } from "react";
import { motion } from "framer-motion";
import { ClayCard, ClayCardEmpty, ClayCardError } from "@/components/clay";
import { CountUp, MotionClayButton, SheenSkeleton, SPRINGS, useMotionMode } from "@/components/motion";
import type { PatientStage, PatientType, StageCount } from "@/pages/preview/mock";
import { cn } from "@/lib/utils";
import type { TriageSelection } from "./triage";

/*
 * Patients by stage (DESIGN.md: ordinal, drawn as a rail, never a pie). One rail per patient type,
 * one column per stage in stage order. Bar fill steps darker along the rail (sequential lightness of
 * sage-deep); the count is always printed, so the bar is never the only signal. Each column filters
 * the triage panel. Bars rise from the baseline on the `pop` spring, 45 ms apart.
 */

const SHORT: Record<PatientStage, string> = {
  Orientation: "Orientation",
  Phase1: "Phase 1",
  Phase2: "Phase 2",
  Clearances: "Clearances",
  PhilHealthZ: "PhilHealth Z",
  Phase3: "Phase 3",
  PostKT: "Post-KT",
  PostDonation: "Post-donation",
};

const BAR_MAX = 72;
/** Shared column slots so the same stage lines up on both rails (PhilHealth Z is recipient only). */
const SLOTS: PatientStage[][] = [["Orientation"], ["Phase1"], ["Phase2"], ["Clearances"], ["PhilHealthZ"], ["Phase3"], ["PostKT", "PostDonation"]];

export interface StageBoardProps {
  recipients: StageCount[];
  donors: StageCount[];
  selection: TriageSelection;
  onSelectStage: (patientType: PatientType, stage: PatientStage) => void;
  panelId: string;
  state?: "ready" | "loading" | "error" | "empty";
  onRetry?: () => void;
  onEnroll?: () => void;
}

export function StageBoard({ recipients, donors, selection, onSelectStage, panelId, state = "ready", onRetry, onEnroll }: StageBoardProps) {
  const titleId = useId();
  const max = Math.max(1, ...recipients.map((s) => s.count), ...donors.map((s) => s.count));

  return (
    <ClayCard level={1} role="region" aria-labelledby={titleId} className="min-w-0">
      <div className="mb-4">
        <h2 id={titleId} className="type-title text-ink">Patients by stage</h2>
        <p className="type-body-sm mt-1 text-ink-muted">
          Active patients by current stage. Select a stage to open the filtered patient list.
        </p>
      </div>
      {state === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading...</span>
          <SheenSkeleton className="h-28" />
          <SheenSkeleton className="h-28" />
        </div>
      ) : state === "error" ? (
        <ClayCardError message="Could not load this list." onRetry={onRetry} />
      ) : state === "empty" ? (
        <ClayCardEmpty
          message="No active patients yet."
          action={<MotionClayButton size="sm" onClick={onEnroll}>Enroll patient</MotionClayButton>}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <Rail patientType="Recipient" label="Recipients" stages={recipients} max={max} selection={selection} onSelect={onSelectStage} panelId={panelId} />
          <Rail patientType="Donor" label="Donors" stages={donors} max={max} selection={selection} onSelect={onSelectStage} panelId={panelId} />
        </div>
      )}
    </ClayCard>
  );
}

function Rail({
  patientType,
  label,
  stages,
  max,
  selection,
  onSelect,
  panelId,
}: {
  patientType: PatientType;
  label: string;
  stages: StageCount[];
  max: number;
  selection: TriageSelection;
  onSelect: StageBoardProps["onSelectStage"];
  panelId: string;
}) {
  const mode = useMotionMode();
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const typeWord = (n: number) => (patientType === "Recipient" ? "recipient" : "donor") + (n === 1 ? "" : "s");
  const slots = SLOTS.map((ids) => stages.find((s) => ids.includes(s.stage)) ?? null);
  return (
    <section aria-label={`${label} by stage`} className="grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-end lg:gap-4">
      <p className="flex items-baseline gap-2 lg:flex-col lg:gap-0 lg:pb-8">
        <span className="type-body font-bold text-ink">{label}</span>
        <span className="type-data-lg text-ink">
          <CountUp value={total} />
        </span>
      </p>
      <div className="-mx-2 overflow-x-auto px-2 pb-1 pt-1">
        <ol className="grid min-w-[616px] grid-cols-7">
          {slots.map((s, i) => {
            if (!s) {
              return (
                <li key={`gap-${i}`} aria-hidden className="flex flex-col">
                  <span className="mx-0 mt-auto block border-b-[1.5px] border-line-strong" style={{ marginBottom: 32 }} />
                </li>
              );
            }
            const selected = selection.kind === "stage" && selection.patientType === patientType && selection.stage === s.stage;
            const height = s.count === 0 ? 0 : Math.max(8, Math.round((s.count / max) * BAR_MAX));
            // Sequential lightness of sage-deep: later stages read darker.
            const mix = Math.round(42 + (58 * i) / (SLOTS.length - 1));
            return (
              <li key={s.stage} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-controls={panelId}
                  aria-label={`${s.label}: ${s.count} ${typeWord(s.count)}. Open filtered list`}
                  onClick={() => onSelect(patientType, s.stage)}
                  className={cn(
                    "clay-focus clay-press group relative flex w-full cursor-pointer flex-col items-stretch rounded-md pt-1 transition-colors duration-(--dur-color)",
                    selected ? "clay-pressed bg-peach-tint" : "hover:bg-sunken/60",
                  )}
                >
                  <span aria-hidden className="flex flex-col items-center justify-end gap-1 border-b-[1.5px] border-line-strong" style={{ height: BAR_MAX + 30 }}>
                    <span className={cn("type-data font-semibold", s.count === 0 ? "text-ink-muted" : "text-ink")}>{s.count}</span>
                    {s.count === 0 ? null : (
                      <motion.span
                        className="block w-10 origin-bottom rounded-t-[8px]"
                        style={{
                          height,
                          backgroundColor: `color-mix(in oklab, var(--sage-deep) ${mix}%, var(--sage-tint))`,
                        }}
                        initial={mode === "reduced" ? false : { scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={mode === "reduced" ? { duration: 0 } : { ...SPRINGS.pop, delay: 0.1 + i * 0.045 }}
                      />
                    )}
                  </span>
                  <span aria-hidden className="type-label flex h-8 items-center justify-center px-1 text-center text-ink-muted group-aria-pressed:text-ink">
                    {SHORT[s.stage]}
                  </span>
                  {selected ? <span aria-hidden className="absolute bottom-0.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-brick" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
