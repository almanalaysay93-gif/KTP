import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "../../../../../server/routers";
import { ClayButton, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { todayDate, type ServiceType } from "@shared/ktp";
import { ClayDialog } from "./ClayDialog";
import { ClinicalSelect } from "./ClinicalForm";

/*
 * Form of the Z Benefit page: the nurse transcribes the Z Benefit dates of one recipient.
 * The save writes the changed dates to the service records of the Tracker (server/dbZBenefit.ts).
 */

export type ZBenefitRow = inferRouterOutputs<AppRouter>["clinical"]["zBenefit"][number];

export const Z_TYPES: { type: ServiceType; group: string; done: string; next: string; claim: string }[] = [
  { type: "Meds", group: "Medicines", done: "Date of first claim (meds)", next: "Due date of next meds claim", claim: "Meds" },
  { type: "Laboratory", group: "Laboratory", done: "Date of laboratory taken", next: "Due date of next laboratory", claim: "Laboratory" },
  { type: "Tacro", group: "Tacrolimus test", done: "Date of tacro test", next: "Due date of next tacro test", claim: "Tacro test" },
  { type: "XrayUsd", group: "X-ray and USD", done: "Date of X-ray and USD", next: "Due date of next X-ray and USD", claim: "X-ray and USD" },
];

type Dates = { done: string; next: string; claim: string; filed: string };
const saved = (row: ZBenefitRow, type: ServiceType): Dates => ({
  done: (type === "Meds" ? row.services[type].firstDate : row.services[type].lastDate) ?? "",
  next: row.services[type].nextDue ?? "",
  claim: row.services[type].claimDue ?? "",
  filed: "",
});

export function ZBenefitDialog({ row, onClose }: { row: ZBenefitRow | null; onClose: () => void }) {
  return (
    <ClayDialog
      open={row !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Record Z Benefit dates"
      description={row ? `${row.lastName}, ${row.firstName}${row.suffix ? ` ${row.suffix}` : ""}, HRN ${row.hrn}` : undefined}
      className="sm:max-w-[760px]"
    >
      {row && <Body key={row.patientId} row={row} onClose={onClose} />}
    </ClayDialog>
  );
}

function Body({ row, onClose }: { row: ZBenefitRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const doctors = trpc.doctors.list.useQuery();
  const saveDates = trpc.clinical.saveZBenefit.useMutation();
  const saveDoctors = trpc.patients.update.useMutation();
  const [dates, setDates] = useState(() =>
    Object.fromEntries(Z_TYPES.map(({ type }) => [type, saved(row, type)])) as Record<ServiceType, Dates>
  );
  const [nephrologistId, setNephrologistId] = useState(String(row.nephrologistId ?? ""));
  const [fellowId, setFellowId] = useState(String(row.fellowId ?? ""));
  const [error, setError] = useState("");
  const pending = saveDates.isPending || saveDoctors.isPending;
  const today = todayDate();

  const set = (type: ServiceType, field: keyof Dates, value: string) =>
    setDates(current => ({ ...current, [type]: { ...current[type], [field]: value } }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    // Only a changed value goes to the server. An empty date or next due date means no change.
    const entries = Z_TYPES.flatMap(({ type }) => {
      const now = dates[type];
      const before = saved(row, type);
      const entry = {
        serviceType: type,
        doneDate: now.done && now.done !== before.done ? now.done : undefined,
        nextDue: now.next && now.next !== before.next ? now.next : undefined,
        claimDue: now.claim !== before.claim ? now.claim || null : undefined,
        claimFiled: now.filed || undefined,
      };
      return entry.doneDate || entry.nextDue || entry.claimDue !== undefined || entry.claimFiled ? [entry] : [];
    });
    const doctorsChanged =
      nephrologistId !== String(row.nephrologistId ?? "") || fellowId !== String(row.fellowId ?? "");
    if (entries.length === 0 && !doctorsChanged) {
      setError("No change to save.");
      return;
    }
    try {
      if (entries.length > 0) await saveDates.mutateAsync({ patientId: row.patientId, entries });
      if (doctorsChanged)
        await saveDoctors.mutateAsync({
          id: row.patientId,
          data: { nephrologistId: Number(nephrologistId) || null, fellowId: Number(fellowId) || null },
        });
      await Promise.all([
        utils.clinical.zBenefit.invalidate(),
        utils.clinical.get.invalidate({ patientId: row.patientId }),
        utils.dashboard.initial.invalidate(),
        utils.patients.invalidate(),
      ]);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
    }
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-6" aria-busy={pending}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(
          [
            ["Nephrologist", "Nephrologist", nephrologistId, setNephrologistId],
            ["Fellow in charge", "Fellow", fellowId, setFellowId],
          ] as const
        ).map(([label, role, value, change]) => (
          <ClinicalSelect key={role} label={label} value={value} onChange={event => change(event.target.value)}>
            <option value="">Not set</option>
            {(doctors.data ?? [])
              .filter(doctor => doctor.role === role)
              .map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
          </ClinicalSelect>
        ))}
      </div>

      {Z_TYPES.map(({ type, group, done, next, claim }) => (
        <fieldset key={type} className="min-w-0 border-t border-hairline pt-4">
          <legend className="pr-3 type-title text-ink">{group}</legend>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ClayInput
              label={done}
              type="date"
              max={today}
              value={dates[type].done}
              onChange={event => set(type, "done", event.target.value)}
              hint={
                type === "Meds"
                  ? undefined
                  : "A later date records a new result. An earlier date corrects the saved date."
              }
            />
            <ClayInput
              label={next}
              type="date"
              value={dates[type].next}
              onChange={event => set(type, "next", event.target.value)}
            />
            <ClayInput
              label={`Due date of claim (${claim})`}
              type="date"
              value={dates[type].claim}
              onChange={event => set(type, "claim", event.target.value)}
            />
            <ClayInput
              label="Date the claim was filed (optional)"
              type="date"
              max={today}
              value={dates[type].filed}
              onChange={event => set(type, "filed", event.target.value)}
              hint="A filed claim leaves the list of due claims."
            />
          </div>
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="type-body-sm break-words text-overdue">
          {error}
        </p>
      )}
      <div className="flex flex-wrap-reverse items-center justify-end gap-3">
        <ClayButton type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </ClayButton>
        <ClayButton type="submit" loading={pending}>
          Save dates
        </ClayButton>
      </div>
    </form>
  );
}
