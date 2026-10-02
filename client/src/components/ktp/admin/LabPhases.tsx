import { ClayCard, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import {
  DONOR_STAGES,
  LAB_PHASES,
  LAB_PHASE_LABEL,
  RECIPIENT_STAGES,
  dateKey,
  todayDate,
  type LabPhase,
} from "@shared/ktp";
import type { ClinicalData } from "./PatientClinicalTabs";
import { ClinicalForm, ClinicalSelect, field } from "./ClinicalForm";

/*
 * Labs tab of the patient profile. Lab results are grouped by phase. Each phase has a form to add
 * a result, and each result has a form to remove it. A removal needs a reason: the server keeps
 * the removed value with that reason.
 */

type Result = ClinicalData["labResults"][number];

export function LabPhases({
  patientId,
  data,
  patient,
}: {
  patientId: number;
  data: ClinicalData;
  patient?: { patientType?: string; surgeryDate?: string | Date | null };
}) {
  const stages: readonly string[] =
    patient?.patientType === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
  const phases = LAB_PHASES.filter(phase => stages.includes(phase));
  const afterSurgery = phases[phases.length - 1];
  const surgery = dateKey(patient?.surgeryDate);
  // A result recorded in Tracker has no saved phase. On or after the surgery date it belongs to the last phase.
  const phaseOf = (result: Result): LabPhase | null =>
    result.phase ??
    (surgery && result.serviceDate && result.serviceDate >= surgery
      ? afterSurgery
      : null);
  const other = data.labResults.filter(result => phaseOf(result) === null);
  return (
    <div className="space-y-5">
      <ClayCard className="min-w-0 p-5">
        <h2 className="type-headline">Lab results</h2>
        <p className="mt-2 type-body-sm text-ink-muted">
          Add or remove a result in its phase. Reference ranges use the saved
          laboratory range. To correct a value, use Edit patient.
        </p>
      </ClayCard>
      {phases.map(phase => (
        <PhaseCard
          key={phase}
          patientId={patientId}
          title={LAB_PHASE_LABEL[phase]}
          phase={phase}
          tests={data.labTests}
          results={data.labResults.filter(result => phaseOf(result) === phase)}
        />
      ))}
      {other.length > 0 && (
        <PhaseCard
          patientId={patientId}
          title="No phase set"
          tests={data.labTests}
          results={other}
        />
      )}
    </div>
  );
}

function PhaseCard({
  patientId,
  title,
  phase,
  tests,
  results,
}: {
  patientId: number;
  title: string;
  /** Without a phase the card lists results only. */
  phase?: LabPhase;
  tests: ClinicalData["labTests"];
  results: Result[];
}) {
  const add = trpc.clinical.addLabResult.useMutation();
  return (
    <ClayCard className="min-w-0 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-headline">{title}</h3>
        <p className="type-body-sm text-ink-muted">
          {results.length} {results.length === 1 ? "result" : "results"}
        </p>
      </div>
      {!phase && (
        <p className="mt-2 type-body-sm text-ink-muted">
          Recorded in Tracker before the surgery date.
        </p>
      )}
      {results.length === 0 ? (
        <p className="mt-4">No lab results recorded.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {results.map(result => (
            <ResultRow key={result.id} patientId={patientId} result={result} />
          ))}
        </ul>
      )}
      {phase && (
        <details className="pt-2">
          <summary className="clay-focus cursor-pointer py-2 font-bold">
            Add lab result
          </summary>
          <ClinicalForm
            patientId={patientId}
            label={`Add to ${title}`}
            reset
            submit={form =>
              add.mutateAsync({
                patientId,
                phase,
                serviceDate: field(form, "serviceDate"),
                labTestId: Number(field(form, "labTestId")),
                value: field(form, "value"),
              })
            }
          >
            {tests.length === 0 && <p>No active lab tests configured.</p>}
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              <ClinicalSelect name="labTestId" label="Lab test" required>
                {tests.map(test => (
                  <option key={test.id} value={test.id}>
                    {test.name} ({test.unit})
                  </option>
                ))}
              </ClinicalSelect>
              <ClayInput
                name="value"
                label="Value"
                inputMode="decimal"
                maxLength={100}
                required
              />
              <ClayInput
                name="serviceDate"
                label="Result date"
                type="date"
                defaultValue={todayDate()}
                max={todayDate()}
                required
              />
            </div>
          </ClinicalForm>
        </details>
      )}
    </ClayCard>
  );
}

function ResultRow({
  patientId,
  result,
}: {
  patientId: number;
  result: Result;
}) {
  const update = trpc.clinical.updateService.useMutation();
  return (
    <li className="min-w-0 py-4 first:pt-0">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0 break-words">
          <strong>{result.testName}</strong>
          <p className="type-body-sm">
            {dateKey(result.serviceDate) || "Date not recorded"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono">
            {result.value} {result.unit}
          </p>
          <p className="type-body-sm">{result.flag ?? "Range not set"}</p>
          {(result.lowSnapshot !== null || result.highSnapshot !== null) && (
            <p className="type-caption">
              Range: {result.lowSnapshot ?? "-"} to {result.highSnapshot ?? "-"}
            </p>
          )}
        </div>
      </div>
      <details>
        <summary
          aria-label={`Remove result: ${result.testName}, ${result.serviceDate}`}
          className="clay-focus cursor-pointer py-2 type-body-sm font-bold text-brick"
        >
          Remove
        </summary>
        <ClinicalForm
          patientId={patientId}
          label="Remove result"
          submit={form =>
            update.mutateAsync({
              patientId,
              id: result.serviceRecordId,
              reason: field(form, "reason"),
              results: [{ labTestId: result.labTestId, value: "" }],
            })
          }
        >
          <ClayInput
            name="reason"
            label="Reason for removal"
            hint="Saved in the patient history with the removed value."
            minLength={3}
            maxLength={500}
            required
          />
        </ClinicalForm>
      </details>
    </li>
  );
}
