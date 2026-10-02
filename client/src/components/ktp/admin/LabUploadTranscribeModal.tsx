import { useState, useRef } from "react";
import { Check, FileSpreadsheet, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
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

export interface LabUploadTranscribeModalProps {
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

interface TranscribedRow {
  labTestId: number;
  testName: string;
  value: string;
  unit: string;
  rawText: string;
  selected: boolean;
}

export function LabUploadTranscribeModal({
  open,
  onClose,
  patientId,
  patientType,
  labTests,
}: LabUploadTranscribeModalProps) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stages: readonly string[] =
    patientType === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
  const applicablePhases = LAB_PHASES.filter(phase => stages.includes(phase));

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<LabPhase>(applicablePhases[0] ?? "Phase1");
  const [serviceDate, setServiceDate] = useState<string>(todayDate());
  const [transcribedRows, setTranscribedRows] = useState<TranscribedRow[]>([]);
  const [error, setError] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Nurse approval controls
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const [nurseApproved, setNurseApproved] = useState<boolean>(false);
  const [approvingNurse, setApprovingNurse] = useState<string>("");

  const parseMutation = trpc.clinical.parseLabDocument.useMutation({
    onSuccess: data => {
      if (!data.success) {
        setError(data.error || "Failed to parse document");
        return;
      }
      if (data.detectedDate) {
        setServiceDate(data.detectedDate);
      }
      const mapped = data.tests.map(t => ({
        labTestId: t.labTestId,
        testName: t.testName,
        value: t.value,
        unit: t.unit,
        rawText: t.rawText,
        selected: true,
      }));
      setTranscribedRows(mapped);
      if (mapped.length === 0) {
        setError("No matching laboratory tests were detected in the document. Please verify the file.");
      }
    },
    onError: err => {
      setError(err.message || "Failed to process document with Python");
    },
  });

  const addMutation = trpc.clinical.addLabResult.useMutation();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!open) return null;

  const handleClose = () => {
    setFile(null);
    setTranscribedRows([]);
    setError("");
    setIsSuccess(false);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError("");
    setTranscribedRows([]);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) {
        await parseMutation.mutateAsync({
          fileName: selected.name,
          base64,
        });
      }
    };
    reader.readAsDataURL(selected);
  };

  const handleSaveResults = async () => {
    const selectedRows = transcribedRows.filter(r => r.selected && r.value.trim());
    if (selectedRows.length === 0) {
      setError("Please select at least one laboratory test to save");
      return;
    }
    if (requireApproval && (!nurseApproved || !approvingNurse.trim())) {
      setError("Nurse verification signature is required before saving");
      return;
    }
    setError("");

    try {
      setIsSaving(true);
      for (const r of selectedRows) {
        await addMutation.mutateAsync({
          patientId,
          phase,
          serviceDate,
          labTestId: r.labTestId,
          value: r.value.trim(),
        });
      }
      utils.clinical.get.invalidate({ patientId });
      utils.dashboard.initial.invalidate();
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save transcribed results");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !requireApproval || (nurseApproved && approvingNurse.trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-transcribe-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-2xl">
        <ClayCard className="max-h-[90vh] overflow-y-auto p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-olive-tint text-olive">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 id="upload-transcribe-title" className="type-headline">
                  Auto-transcribe lab file
                </h2>
                <p className="type-body-sm text-ink-muted">
                  Upload PDF, Excel (.xlsx/.xls), or scanned image to transcribe using Python.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="clay-focus rounded-full p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {error && (
              <div className="rounded border border-brick/30 bg-brick/10 p-3 text-xs text-brick">
                {error}
              </div>
            )}

            {isSuccess && (
              <div className="flex items-center gap-2 rounded border border-olive/30 bg-olive-tint p-3 text-xs font-semibold text-olive">
                <Check className="size-4" /> Lab results transcribed and saved successfully
              </div>
            )}

            {/* File Dropzone */}
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong/40 bg-surface-1 p-8 text-center transition hover:border-olive hover:bg-surface-2"
              >
                <div className="flex gap-2 text-ink-muted">
                  <FileText className="size-8 text-olive" />
                  <FileSpreadsheet className="size-8 text-olive" />
                </div>
                <p className="mt-3 font-semibold text-sm text-ink">
                  Click to choose lab report or drag and drop
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Supports PDF documents, Excel spreadsheets (.xlsx, .xls, .csv), and scanned photos
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-line bg-surface-1 p-3.5">
                <div className="flex items-center gap-3">
                  {file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv") ? (
                    <FileSpreadsheet className="size-6 text-olive" />
                  ) : (
                    <FileText className="size-6 text-olive" />
                  )}
                  <div>
                    <p className="font-semibold text-xs text-ink">{file.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setTranscribedRows([]);
                  }}
                  className="clay-focus rounded px-2 py-1 text-xs text-ink-muted hover:text-brick"
                >
                  Change file
                </button>
              </div>
            )}

            {/* Parsing Spinner */}
            {parseMutation.isPending && (
              <div className="flex items-center justify-center gap-3 rounded-lg border border-line bg-surface-1 p-6 text-ink">
                <Loader2 className="size-5 animate-spin text-olive" />
                <span className="text-xs font-medium">
                  Transcribing document with Python OCR and table parser...
                </span>
              </div>
            )}

            {/* Transcribed Table */}
            {transcribedRows.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="type-label block text-xs font-bold text-ink">
                      Target phase
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
                      label="Service / Collection date"
                      name="serviceDate"
                      type="date"
                      value={serviceDate}
                      max={todayDate()}
                      onChange={e => setServiceDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-line">
                  <div className="bg-ground-elevated px-3 py-2 text-[11px] font-bold text-ink-muted uppercase">
                    Detected Laboratory Tests ({transcribedRows.length})
                  </div>
                  <div className="max-h-60 divide-y divide-line overflow-y-auto">
                    {transcribedRows.map((row, idx) => {
                      const normalRef = getNormalValue(row.testName);
                      return (
                        <div
                          key={row.labTestId}
                          className="flex flex-col gap-2 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={e => {
                                const copy = [...transcribedRows];
                                copy[idx].selected = e.target.checked;
                                setTranscribedRows(copy);
                              }}
                              className="size-4 rounded border-line-strong text-olive"
                            />
                            <div>
                              <span className="font-semibold text-ink">{row.testName}</span>
                              {normalRef && (
                                <p className="text-[10px] text-ink-muted">
                                  Ref: {normalRef}
                                </p>
                              )}
                            </div>
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={row.value}
                              onChange={e => {
                                const copy = [...transcribedRows];
                                copy[idx].value = e.target.value;
                                setTranscribedRows(copy);
                              }}
                              className="h-7 w-24 rounded border border-line-strong/30 bg-surface-1 px-2 text-right font-mono text-xs text-ink"
                            />
                            <span className="w-16 text-xs text-ink-muted">{row.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                    onClick={handleClose}
                    disabled={isSaving}
                  >
                    Cancel
                  </ClayButton>
                  <ClayButton
                    type="button"
                    onClick={handleSaveResults}
                    disabled={isSaving || !canSave}
                    className="inline-flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving records...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" /> Save transcribed results
                      </>
                    )}
                  </ClayButton>
                </div>
              </div>
            )}
          </div>
        </ClayCard>
      </div>
    </div>
  );
}
