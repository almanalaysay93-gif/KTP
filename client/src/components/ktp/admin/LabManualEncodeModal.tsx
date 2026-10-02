import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { ClayButton, ClayCard, ClayInput } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import {
  DONOR_STAGES,
  LAB_PHASES,
  LAB_PHASE_LABEL,
  RECIPIENT_STAGES,
  todayDate,
  type LabPhase,
} from "@shared/ktp";
import { getNormalValue } from "./labCatalogMeta";
import { NurseApprovalCard } from "./NurseApprovalCard";

export interface LabManualEncodeModalProps {
  open: boolean;
  onClose: () => void;
  patientId: number;
  patientType?: string;
  labTests: Array<{
    id: number;
    name: string;
    unit: string;
    low: string | null;
    high: string | null;
  }>;
}

export function LabManualEncodeModal({
  open,
  onClose,
  patientId,
  patientType,
  labTests,
}: LabManualEncodeModalProps) {
  const utils = trpc.useUtils();
  const stages: readonly string[] =
    patientType === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
  const applicablePhases = LAB_PHASES.filter(phase => stages.includes(phase));

  const [phase, setPhase] = useState<LabPhase>(applicablePhases[0] ?? "Phase1");
  const [serviceDate, setServiceDate] = useState<string>(todayDate());
  const [labTestId, setLabTestId] = useState<number>(labTests[0]?.id ?? 1);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Nurse approval controls
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const [nurseApproved, setNurseApproved] = useState<boolean>(false);
  const [approvingNurse, setApprovingNurse] = useState<string>("");

  const addMutation = trpc.clinical.addLabResult.useMutation({
    onSuccess: () => {
      utils.clinical.get.invalidate({ patientId });
      utils.dashboard.initial.invalidate();
      setIsSuccess(true);
      setValue("");
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    },
    onError: err => {
      setError(err.message || "Failed to save lab result");
    },
  });

  if (!open) return null;

  const selectedTest = labTests.find(t => t.id === labTestId) ?? labTests[0];
  const normalRef = selectedTest ? getNormalValue(selectedTest.name) : null;
  const canSave = !requireApproval || (nurseApproved && approvingNurse.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Please enter a result value");
      return;
    }
    if (requireApproval && (!nurseApproved || !approvingNurse.trim())) {
      setError("Nurse verification signature is required before saving");
      return;
    }
    setError("");

    await addMutation.mutateAsync({
      patientId,
      phase,
      serviceDate,
      labTestId,
      value: value.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-encode-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-xl">
        <ClayCard className="max-h-[90vh] overflow-y-auto p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 id="manual-encode-title" className="type-headline">
                Encode patient lab result
              </h2>
              <p className="type-body-sm text-ink-muted">
                Manually record a laboratory result into the clinical records.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="clay-focus rounded-full p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="rounded border border-brick/30 bg-brick/10 p-3 text-xs text-brick">
                {error}
              </div>
            )}

            {isSuccess && (
              <div className="flex items-center gap-2 rounded border border-olive/30 bg-olive-tint p-3 text-xs font-semibold text-olive">
                <Check className="size-4" /> Lab result saved successfully
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="type-label block text-xs font-bold text-ink">
                  Workup phase
                </label>
                <select
                  value={phase}
                  onChange={e => setPhase(e.target.value as LabPhase)}
                  className="mt-1 h-9 w-full rounded border border-line-strong/30 bg-surface-1 px-2.5 text-xs text-ink"
                >
                  {applicablePhases.map(p => (
                    <option key={p} value={p}>
                      {LAB_PHASE_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <ClayInput
                  label="Service date"
                  name="serviceDate"
                  type="date"
                  value={serviceDate}
                  max={todayDate()}
                  onChange={e => setServiceDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="type-label block text-xs font-bold text-ink">
                Laboratory test
              </label>
              <select
                value={labTestId}
                onChange={e => setLabTestId(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded border border-line-strong/30 bg-surface-1 px-2.5 text-xs text-ink"
              >
                {labTests.map(test => (
                  <option key={test.id} value={test.id}>
                    {test.name} ({test.unit})
                  </option>
                ))}
              </select>
              {normalRef && (
                <p className="mt-1 text-[11px] font-medium text-ink-muted">
                  Reference range: <span className="text-ink">{normalRef}</span>
                </p>
              )}
            </div>

            <div>
              <ClayInput
                label={`Result value (${selectedTest?.unit ?? ""})`}
                name="value"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 88.5"
                inputMode="decimal"
                maxLength={100}
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
              canEnterLabs={canSave}
            />

            <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
              <ClayButton
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={addMutation.isPending}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                disabled={addMutation.isPending || !canSave}
                className="inline-flex items-center gap-1.5"
              >
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" /> Save result
                  </>
                )}
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      </div>
    </div>
  );
}
