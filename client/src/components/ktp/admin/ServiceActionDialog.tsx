import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ClayInput, StatusChip } from "@/components/clay";
import { MotionClayButton } from "@/components/motion";
import {
  MOCK_TODAY,
  addDays,
  type Appointment,
  type LabFlag,
  type Patient,
  type RepeatReason,
  type ServiceRecord,
} from "@/pages/preview/mock";
import { PREVIEW_NOTE, useAdminToast } from "./AdminToaster";
import { ClayDialog } from "./ClayDialog";
import { fmtDate, fmtTime, fmtWeekday } from "./format";
import { flagOf, rangeText, suggestNextDue, testsFor } from "./serviceRules";
import { REPEAT_REASON_LABEL, serviceLabel } from "./TriageLists";

/*
 * One dialog for every record action (COPY.md section 4 and "Action lists"). In preview the form is
 * fully interactive: fields prefill, validate, and Save shows the loading state, then closes with a
 * toast that says nothing was saved.
 */

export type ServiceAction =
  | { kind: "result"; patient: Patient; record: ServiceRecord }
  | { kind: "repeat"; patient: Patient; record: ServiceRecord }
  | { kind: "claim"; patient: Patient; record: ServiceRecord }
  | { kind: "reschedule"; patient: Patient; appointment: Appointment };

const FLAG_CHIP: Record<LabFlag, "lab-low" | "lab-normal" | "lab-high"> = {
  Low: "lab-low",
  Normal: "lab-normal",
  High: "lab-high",
};

const SAVE_MS = 700;

export function ServiceActionDialog({ action, onClose }: { action: ServiceAction | null; onClose: () => void }) {
  // Keep the last action while the dialog animates out.
  const last = useRef(action);
  if (action) last.current = action;
  const shown = action ?? last.current;
  return (
    <ClayDialog
      open={action !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={shown ? titleOf(shown) : ""}
      description={shown ? descriptionOf(shown) : undefined}
    >
      {shown ? <ActionForm key={keyOf(shown)} action={shown} onDone={onClose} /> : null}
    </ClayDialog>
  );
}

function keyOf(a: ServiceAction) {
  return `${a.kind}-${a.kind === "reschedule" ? a.appointment.id : a.record.id}`;
}

function titleOf(a: ServiceAction): string {
  switch (a.kind) {
    case "result":
      return `Record result: ${serviceLabel(a.record)}`;
    case "repeat":
      return "Repeat test";
    case "claim":
      return "Mark claim filed";
    case "reschedule":
      return "Set new time";
  }
}

function descriptionOf(a: ServiceAction): ReactNode {
  const who = `${a.patient.lastName}, ${a.patient.firstName}`;
  switch (a.kind) {
    case "result":
      return `${who}. Due ${fmtDate(a.record.dueDate)}.`;
    case "repeat":
      return `Creates a new record for the same due date (${fmtDate(a.record.dueDate)}). The current record becomes Superseded and is left out of trends and flags.`;
    case "claim":
      return `${serviceLabel(a.record)} for ${who}. Service date ${fmtDate(a.record.serviceDate)}.`;
    case "reschedule":
      return "Setting a new time resets the reply to Pending and notifies the patient.";
  }
}

function ActionForm({ action, onDone }: { action: ServiceAction; onDone: () => void }) {
  const toast = useAdminToast();
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tests = action.kind === "result" ? testsFor(action.record) : [];
  const suggestion = action.kind === "result" ? suggestNextDue(action.patient, action.record) : null;
  const [nextDue, setNextDue] = useState(suggestion?.date ?? "");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    for (const test of tests) {
      const raw = values[test.id]?.trim() ?? "";
      if (raw !== "" && (Number.isNaN(Number(raw)) || Number(raw) < 0)) found[test.id] = "Enter a number of 0 or more.";
    }
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(`${formId}-${firstInvalid}`)?.focus();
      return;
    }
    setSaving(true);
    timer.current = window.setTimeout(() => {
      toast({ title: toastTitle(action, nextDue), body: PREVIEW_NOTE, tone: "done" });
      onDone();
    }, SAVE_MS);
  };

  return (
    <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-5" aria-busy={saving || undefined}>
      {action.kind === "result" ? (
        <>
          <ClayInput label="Service date" type="date" defaultValue={MOCK_TODAY} />
          {tests.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="type-field-label mb-2 text-ink">Lab values</legend>
              <div className="clay-table-wrap -mx-2">
                <table className="clay-table">
                  <thead>
                    <tr>
                      <th scope="col">Test</th>
                      <th scope="col">Value</th>
                      <th scope="col">Usual range</th>
                      <th scope="col">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((test) => {
                      const raw = values[test.id] ?? "";
                      const num = raw.trim() === "" ? null : Number(raw);
                      const flag = num !== null && !Number.isNaN(num) && num >= 0 ? flagOf(num, test) : null;
                      return (
                        <tr key={test.id}>
                          <th scope="row" className="font-bold">{test.name}</th>
                          <td className="py-2">
                            <label className="sr-only" htmlFor={`${formId}-${test.id}`}>{`${test.name}, ${test.unit}`}</label>
                            <span className="flex items-center gap-2">
                              <input
                                id={`${formId}-${test.id}`}
                                inputMode="decimal"
                                placeholder="Enter value"
                                value={raw}
                                aria-invalid={errors[test.id] ? true : undefined}
                                aria-describedby={errors[test.id] ? `${formId}-${test.id}-err` : undefined}
                                onChange={(e) => setValues((v) => ({ ...v, [test.id]: e.target.value }))}
                                className="clay-sunken clay-focus type-data h-11 w-28 rounded-sm border-[1.5px] border-line-strong px-3 text-ink placeholder:font-sans placeholder:text-ink-muted aria-invalid:border-2 aria-invalid:border-overdue"
                              />
                              <span className="type-body-sm text-ink-muted">{test.unit}</span>
                            </span>
                            {errors[test.id] ? (
                              <span id={`${formId}-${test.id}-err`} role="alert" className="type-caption mt-1 block whitespace-normal text-overdue">
                                {errors[test.id]}
                              </span>
                            ) : null}
                          </td>
                          <td data-num="true">{rangeText(test)}</td>
                          <td>{flag ? <StatusChip status={FLAG_CHIP[flag]} /> : <span className="text-ink-muted">Not set</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="type-caption text-ink-muted">Out-of-range values are saved and flagged.</p>
            </fieldset>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <ClayInput label="Claim deadline" type="date" defaultValue={addDays(MOCK_TODAY, 30)} />
            <ClayInput label="Claim filed on" type="date" />
          </div>
          <ClayInput label="Next due date" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} hint={suggestion?.hint} />
        </>
      ) : null}

      {action.kind === "repeat" ? (
        <>
          <ClaySelect label="Reason" options={Object.entries(REPEAT_REASON_LABEL) as [RepeatReason, string][]} />
          <ClayInput label="Note (optional)" />
          <ClayInput
            label="Claim deadline for the repeat"
            type="date"
            defaultValue={addDays(MOCK_TODAY, 30)}
            hint="The repeat has its own claim deadline and filed tick."
          />
        </>
      ) : null}

      {action.kind === "claim" ? <ClayInput label="Date filed" type="date" defaultValue={MOCK_TODAY} /> : null}

      {action.kind === "reschedule" ? (
        <>
          <div className="rounded-md bg-row-hover p-4">
            <p className="type-body font-bold text-ink">{action.appointment.title}</p>
            <p className="type-data text-ink-muted">
              {fmtWeekday(action.appointment.startsAt)}, {fmtTime(action.appointment.startsAt)}, {action.appointment.location}
            </p>
            {action.appointment.responseNote ? (
              <blockquote className="type-body-sm mt-2 text-ink">
                <span className="sr-only">Patient note: </span>
                {action.appointment.responseNote}
              </blockquote>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ClayInput label="New date" type="date" defaultValue={addDays(action.appointment.startsAt.slice(0, 10), 3)} />
            <ClayInput label="New time" type="time" defaultValue={action.appointment.startsAt.slice(11, 16)} />
          </div>
        </>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-1 flex flex-wrap-reverse items-center justify-end gap-3 border-t border-hairline bg-surface-2 px-5 py-4 sm:-mx-6 sm:px-6">
        <MotionClayButton variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          Cancel
        </MotionClayButton>
        <MotionClayButton type="submit" size="sm" loading={saving}>
          {saving ? "Saving..." : submitLabel(action)}
        </MotionClayButton>
      </div>
    </form>
  );
}

function submitLabel(a: ServiceAction) {
  return { result: "Save result", repeat: "Create repeat", claim: "Mark filed", reschedule: "Set new time" }[a.kind];
}

function toastTitle(a: ServiceAction, nextDue: string) {
  switch (a.kind) {
    case "result":
      return nextDue ? `Result saved. Next due ${fmtDate(nextDue)} added.` : "Result saved.";
    case "repeat":
      return "Repeat created. Original marked Superseded.";
    case "claim":
      return `Claim marked filed: ${a.patient.lastName}, ${a.patient.firstName}, ${serviceLabel(a.record)}.`;
    case "reschedule":
      return "New time set. The reply is back to Pending.";
  }
}

function ClaySelect({ label, options }: { label: string; options: [string, string][] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-field-label text-ink">{label}</label>
      <select
        id={id}
        defaultValue={options[0]?.[0]}
        className="clay-sunken clay-focus type-body h-12 w-full cursor-pointer rounded-sm border-[1.5px] border-line-strong px-3 text-ink hover:border-ink"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </div>
  );
}
