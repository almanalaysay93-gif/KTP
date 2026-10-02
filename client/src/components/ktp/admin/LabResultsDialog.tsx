import { useRef, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { ClayButton, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import {
  DONOR_STAGES,
  LAB_PHASES,
  LAB_PHASE_LABEL,
  RECIPIENT_STAGES,
  todayDate,
  type LabPhase,
} from "@shared/ktp";
import { LAB_FIELD } from "./ChecklistItemRow";
import { ClayDialog } from "./ClayDialog";
import { ClinicalSelect } from "./ClinicalForm";
import { getNormalValue, groupEntries } from "./labCatalogMeta";
import { NurseApprovalCard } from "./NurseApprovalCard";
import type { ClinicalData } from "./PatientClinicalTabs";

/*
 * The one dialog that saves lab results (DESIGN.md Screens 5). It opens with the values typed in
 * the Labs table, with no values, or with the file control first. A lab file fills the values:
 * the user checks each value against the laboratory sheet before the save. All values save
 * together, or none.
 */

export type LabDraft = { labTestId: number; value: string };
export type LabDialogStart = {
  phase?: LabPhase;
  rows?: LabDraft[];
  /** Puts the file control first. */
  upload?: boolean;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function LabResultsDialog({
  start,
  onClose,
  onSaved,
  patientId,
  patientType,
  labTests,
}: {
  /** Null: the dialog is closed. */
  start: LabDialogStart | null;
  onClose: () => void;
  /** Receives the tests that were saved, so the table can clear their typed values. */
  onSaved: (labTestIds: number[]) => void;
  patientId: number;
  patientType?: string;
  labTests: ClinicalData["labTests"];
}) {
  return (
    <ClayDialog
      open={start !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Save lab results"
      description="Check each value against the laboratory sheet. All values save together."
      className="sm:max-w-[640px]"
    >
      {start && (
        <DialogBody
          start={start}
          onClose={onClose}
          onSaved={onSaved}
          patientId={patientId}
          patientType={patientType}
          labTests={labTests}
        />
      )}
    </ClayDialog>
  );
}

function DialogBody({
  start,
  onClose,
  onSaved,
  patientId,
  patientType,
  labTests,
}: {
  start: LabDialogStart;
  onClose: () => void;
  onSaved: (labTestIds: number[]) => void;
  patientId: number;
  patientType?: string;
  labTests: ClinicalData["labTests"];
}) {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const stages: readonly string[] =
    patientType === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
  const phases = LAB_PHASES.filter(phase => stages.includes(phase));

  const [phase, setPhase] = useState<LabPhase>(start.phase ?? phases[0]);
  const [serviceDate, setServiceDate] = useState(todayDate());
  const [rows, setRows] = useState<LabDraft[]>(start.rows ?? []);
  const [fileNote, setFileNote] = useState("");
  const [error, setError] = useState("");
  const [requireApproval, setRequireApproval] = useState(true);
  const [nurseApproved, setNurseApproved] = useState(false);
  const [approvingNurse, setApprovingNurse] = useState("");

  const parse = trpc.clinical.parseLabDocument.useMutation();
  const save = trpc.clinical.addLabResults.useMutation();

  const testById = new Map(labTests.map(test => [test.id, test]));
  const unused = labTests.filter(
    test => !rows.some(row => row.labTestId === test.id)
  );
  const filled = rows.filter(row => row.value.trim() !== "");
  const blocked = requireApproval && !nurseApproved;

  const readFile = async (file: File) => {
    setError("");
    setFileNote("");
    if (file.size > MAX_FILE_BYTES) {
      setError("File too large. The maximum size is 15 MB.");
      return;
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      const parsed = await parse.mutateAsync({ base64, fileName: file.name });
      if (!parsed.success || parsed.error) {
        setError(parsed.error || "Could not read lab values from the file.");
        return;
      }
      if (parsed.tests.length === 0) {
        setFileNote(`${file.name}: no lab test of the catalog was found.`);
        return;
      }
      setRows(current => {
        const next = current.filter(
          row => !parsed.tests.some(test => test.labTestId === row.labTestId)
        );
        return [
          ...next,
          ...parsed.tests.map(test => ({
            labTestId: test.labTestId,
            value: test.value,
          })),
        ];
      });
      if (parsed.detectedDate && parsed.detectedDate <= todayDate())
        setServiceDate(parsed.detectedDate);
      // Values that come from a file always need a new check.
      setRequireApproval(true);
      setNurseApproved(false);
      setFileNote(
        `${file.name}: ${parsed.tests.length} ${parsed.tests.length === 1 ? "value" : "values"} filled${parsed.detectedDate ? `, dated ${parsed.detectedDate}` : ""}. Check each value before you save.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read the file."
      );
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (filled.length === 0) {
      setError("Add at least one value.");
      return;
    }
    if (blocked) {
      setError("The nurse approval is necessary before the save.");
      return;
    }
    try {
      await save.mutateAsync({
        patientId,
        phase,
        serviceDate,
        nurseApproved: requireApproval ? nurseApproved : undefined,
        approvedByNurse:
          (requireApproval && approvingNurse.trim()) || undefined,
        results: filled.map(row => ({
          labTestId: row.labTestId,
          value: row.value.trim(),
        })),
      });
      await Promise.all([
        utils.clinical.get.invalidate({ patientId }),
        utils.dashboard.initial.invalidate(),
        utils.patients.activityLogs.invalidate({ patientId }),
      ]);
      onSaved(filled.map(row => row.labTestId));
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save. Try again."
      );
    }
  };

  const fileControl = (
    <div className="flex flex-wrap items-center gap-3">
      <ClayButton
        type="button"
        variant="secondary"
        size="sm"
        icon={<FileUp strokeWidth={1.75} />}
        loading={parse.isPending}
        onClick={() => fileInput.current?.click()}
      >
        {parse.isPending ? "Reading file" : "Fill from lab file"}
      </ClayButton>
      <span className="type-caption text-ink-muted">
        PDF, Excel, or photo. Maximum 15 MB.
      </span>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Lab file"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />
    </div>
  );

  return (
    <form
      onSubmit={submit}
      className="flex min-w-0 flex-col gap-5"
      aria-busy={save.isPending}
    >
      {start.upload && fileControl}
      {fileNote && (
        <p
          role="status"
          className="rounded-sm bg-info-bg px-3 py-2 type-body-sm text-info"
        >
          {fileNote}
        </p>
      )}

      <fieldset className="min-w-0">
        <legend className="mb-2 type-field-label">Values</legend>
        {rows.length === 0 ? (
          <p className="type-body-sm text-ink-muted">
            No values. Add a test below
            {start.upload ? ", or fill the values from a lab file" : ""}.
          </p>
        ) : (
          <ul className="divide-y divide-hairline border-y border-hairline">
            {rows.map(row => {
              const test = testById.get(row.labTestId);
              if (!test) return null;
              const normal = getNormalValue(test.name);
              return (
                <li
                  key={row.labTestId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="type-body-sm font-bold break-words">
                      {test.name}
                    </p>
                    {normal && (
                      <p className="type-caption text-ink-muted">
                        Normal: {normal}
                      </p>
                    )}
                  </div>
                  <span className="w-28 shrink-0">
                    <input
                      value={row.value}
                      onChange={event =>
                        setRows(current =>
                          current.map(item =>
                            item.labTestId === row.labTestId
                              ? { ...item, value: event.target.value }
                              : item
                          )
                        )
                      }
                      inputMode="decimal"
                      maxLength={100}
                      aria-label={`Value: ${test.name}${test.unit ? `, ${test.unit}` : ""}`}
                      className={`${LAB_FIELD} text-right`}
                    />
                  </span>
                  <span className="w-16 type-caption text-ink-muted">
                    {test.unit}
                  </span>
                  <ClayButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove from this save: ${test.name}`}
                    onClick={() =>
                      setRows(current =>
                        current.filter(item => item.labTestId !== row.labTestId)
                      )
                    }
                    className="w-11 px-0"
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} />
                  </ClayButton>
                </li>
              );
            })}
          </ul>
        )}
        {unused.length > 0 && (
          <div className="mt-3">
            <ClinicalSelect
              label="Add a test"
              value=""
              onChange={event => {
                const id = Number(event.target.value);
                if (id)
                  setRows(current => [
                    ...current,
                    { labTestId: id, value: "" },
                  ]);
              }}
            >
              <option value="">Choose a test</option>
              {groupEntries(unused).map(({ group, entries }) => (
                <optgroup key={group} label={group}>
                  {entries.map(test => (
                    <option key={test.id} value={test.id}>
                      {test.name}
                      {test.unit ? ` (${test.unit})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </ClinicalSelect>
          </div>
        )}
      </fieldset>

      {!start.upload && fileControl}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <ClinicalSelect
          label="Phase"
          value={phase}
          onChange={event => setPhase(event.target.value as LabPhase)}
        >
          {phases.map(option => (
            <option key={option} value={option}>
              {LAB_PHASE_LABEL[option]}
            </option>
          ))}
        </ClinicalSelect>
        <ClayInput
          label="Result date"
          type="date"
          value={serviceDate}
          max={todayDate()}
          onChange={event => setServiceDate(event.target.value)}
          required
        />
      </div>

      <NurseApprovalCard
        requireApproval={requireApproval}
        setRequireApproval={setRequireApproval}
        nurseApproved={nurseApproved}
        setNurseApproved={setNurseApproved}
        approvingNurse={approvingNurse}
        setApprovingNurse={setApprovingNurse}
        canEnterLabs
      />

      {error && (
        <p role="alert" className="type-body-sm text-overdue break-words">
          {error}
        </p>
      )}

      <div className="flex flex-wrap-reverse items-center justify-end gap-3">
        <ClayButton
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={save.isPending}
        >
          Cancel
        </ClayButton>
        <ClayButton
          type="submit"
          loading={save.isPending}
          disabled={filled.length === 0 || blocked}
        >
          {filled.length === 1
            ? "Save 1 result"
            : `Save ${filled.length} results`}
        </ClayButton>
      </div>
    </form>
  );
}
