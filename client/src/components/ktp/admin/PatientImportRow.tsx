import { useId, useState } from "react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { ClayInput, StatusChip } from "@/components/clay";
import { STAGE_ADMIN_LABEL } from "@/lib/ktpLabels";
import { cn } from "@/lib/utils";
import { DONOR_STAGES, PATIENT_STATUSES, RECIPIENT_STAGES, todayDate } from "@shared/ktp";
import type { CheckedRow, ImportRow } from "../../../../../server/dbPatientImport";
import { ClinicalSelect } from "./ClinicalForm";

/*
 * One patient of an import list, in the review step: include control, summary, the problems that
 * stop the save, the notes of the file reader, and the fields to correct a value.
 */

export type ImportEntry = {
  /** Row or line of the file. */
  source: number;
  include: boolean;
  values: ImportRow;
  /** Guesses of the file reader, for example how it read a date. */
  notes: string[];
  /** Result of the last check. Undefined: a value changed after the last check. */
  checked?: CheckedRow;
};

type Doctor = { id: number; name: string; role: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function PatientImportRow({
  entry,
  doctors,
  onChange,
}: {
  entry: ImportEntry;
  doctors: Doctor[];
  onChange: (entry: ImportEntry) => void;
}) {
  const fieldsId = useId();
  const { values, checked } = entry;
  const errors = checked?.errors ?? [];
  const notes = [...entry.notes, ...(checked?.warnings ?? [])];
  const [open, setOpen] = useState(false);
  const text = (field: keyof ImportRow) => String(values[field] ?? "");
  const name = [text("lastName"), text("firstName")].filter(Boolean).join(", ") || "No name";
  // A changed value needs a new check.
  const set = (field: keyof ImportRow, value: string) =>
    onChange({ ...entry, values: { ...values, [field]: value }, checked: undefined });
  const input = (field: keyof ImportRow, label: string, props: React.ComponentProps<typeof ClayInput> | object = {}) => (
    <ClayInput label={label} value={text(field)} onChange={event => set(field, event.target.value)} {...props} />
  );
  const select = (field: keyof ImportRow, label: string, options: [value: string, label: string][], empty?: string) => (
    <ClinicalSelect label={label} value={text(field)} onChange={event => set(field, event.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {/* A value from the file that is not an option stays visible until the user corrects it. */}
      {text(field) && !options.some(([value]) => value === text(field)) && (
        <option value={text(field)}>{text(field)} (not valid)</option>
      )}
      {options.map(([value, optionLabel]) => (
        <option key={value} value={value}>
          {optionLabel}
        </option>
      ))}
    </ClinicalSelect>
  );
  const stages = text("patientType") === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
  // The server matches a doctor name with no title and no letter case, so a name from the file stays an option.
  const doctorOptions = (role: string, current: string): [string, string][] => {
    const names = doctors.filter(doctor => doctor.role === role).map(doctor => doctor.name);
    return (current && !names.includes(current) ? [current, ...names] : names).map(name => [name, name]);
  };

  return (
    <li className={cn("min-w-0", !entry.include && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={entry.include}
            onChange={event => onChange({ ...entry, include: event.target.checked })}
            aria-label={`Import ${name}`}
            className="clay-focus size-5 rounded-xs accent-(--sage-deep)"
          />
        </label>
        <div className="min-w-0 flex-1 basis-48">
          <p className="type-body-sm font-bold break-words">{name}</p>
          <p className="type-caption text-ink-muted">
            <span className="type-data">{text("hrn") || "No HRN"}</span>
            {text("patientType") ? `, ${text("patientType")}` : ""}
            {text("stage") ? `, ${STAGE_ADMIN_LABEL[text("stage") as keyof typeof STAGE_ADMIN_LABEL] ?? text("stage")}` : ""}
            , file row <span className="type-data">{entry.source}</span>
          </p>
        </div>
        {!entry.include ? (
          <StatusChip status="superseded" label="Not imported" />
        ) : !checked ? (
          <StatusChip status="planned" label="Check needed" />
        ) : errors.length > 0 ? (
          <StatusChip status="overdue" label={errors.length === 1 ? "1 problem" : `${errors.length} problems`} />
        ) : (
          <StatusChip status="done" label="Ready" />
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={fieldsId}
          aria-label={`Edit ${name}`}
          onClick={() => setOpen(value => !value)}
          className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
        >
          <ChevronRight
            aria-hidden
            strokeWidth={1.75}
            className={cn("size-5 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
          />
        </button>
      </div>

      {entry.include && errors.length > 0 && (
        <ul className="mb-2 ml-14 space-y-1">
          {errors.map(error => (
            <li key={error} className="flex items-start gap-2 type-body-sm text-overdue">
              <TriangleAlert aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
              {error}
            </li>
          ))}
        </ul>
      )}
      {entry.include && notes.length > 0 && (
        <ul className="mb-2 ml-14 space-y-1">
          {notes.map(note => (
            <li key={note} className="type-caption text-ink-muted">
              Note: {note}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div id={fieldsId} className="mb-3 grid min-w-0 gap-4 rounded-sm bg-ground p-3 sm:grid-cols-2 sm:p-4">
          {input("hrn", "HRN", { maxLength: 64 })}
          {select("patientType", "Type", [["Recipient", "Recipient"], ["Donor", "Donor"]], "Choose a type")}
          {input("lastName", "Last name", { maxLength: 128 })}
          {input("firstName", "First name", { maxLength: 128 })}
          {input("middleName", "Middle name", { maxLength: 128 })}
          {input("suffix", "Suffix", { maxLength: 32 })}
          {select("sex", "Sex", [["M", "Male"], ["F", "Female"]], "Not set")}
          {input("birthDate", "Birth date", { type: "date", max: todayDate(), value: DATE.test(text("birthDate")) ? text("birthDate") : "" })}
          {input("accountEmail", "Gmail account (optional)", { type: "email", maxLength: 320, hint: "The patient signs in with it." })}
          {input("contactNumber", "Contact number", { type: "tel", maxLength: 32 })}
          {select("stage", "Stage", stages.map(stage => [stage, STAGE_ADMIN_LABEL[stage]]), "Orientation (default)")}
          {input("surgeryDate", text("patientType") === "Donor" ? "Donation date" : "Transplant date", { type: "date", value: DATE.test(text("surgeryDate")) ? text("surgeryDate") : "" })}
          {text("patientType") === "Donor"
            ? input("linkedRecipientHrn", "HRN of the linked recipient", { maxLength: 64 })
            : select("riskCategory", "Risk category", [["StandardLow", "Standard or low"], ["High", "High"]], "Not evaluated")}
          {select("followupMonths", "Follow-up interval", [["1", "Every 1 month"], ["2", "Every 2 months"], ["3", "Every 3 months"]], "Every 1 month (default)")}
          {select("nephrologist", "Nephrologist", doctorOptions("Nephrologist", text("nephrologist")), "Not set")}
          {select("fellow", "Fellow in charge", doctorOptions("Fellow", text("fellow")), "Not set")}
          {select("status", "Status", PATIENT_STATUSES.map(status => [status, status]), "Active (default)")}
        </div>
      )}
    </li>
  );
}
