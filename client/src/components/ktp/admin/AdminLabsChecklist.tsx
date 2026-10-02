import { useState } from "react";
import {
  FileSpreadsheet,
  FlaskConical,
  Plus,
  Sparkles,
} from "lucide-react";
import { ClayButton, ClayCard } from "@/components/clay";
import { LAB_PHASE_LABEL, type LabPhase } from "@shared/ktp";
import { getNormalValue, resultsForItem } from "./labCatalogMeta";
import { LabResultLine } from "./LabResultLine";
import type { ClinicalData } from "./PatientClinicalTabs";
import { ChecklistItemRow } from "./ChecklistItemRow";
import { LabManualEncodeModal } from "./LabManualEncodeModal";
import { LabUploadTranscribeModal } from "./LabUploadTranscribeModal";

/** "results" shows the lab results that no checklist row shows, for example the results after surgery. */
type PhaseFilter = "all" | "results" | number;
type CategoryFilter = "all" | "Lab" | "Imaging" | "Clearance" | "Milestone";

export function AdminLabsChecklist({
  patientId,
  data,
  patient,
}: {
  patientId: number;
  data: ClinicalData;
  patient?: { patientType?: string; surgeryDate?: string | Date | null };
}) {
  const [activePhase, setActivePhase] = useState<PhaseFilter>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  // The result form is open when this is set. An empty object opens it with no test chosen.
  const [encode, setEncode] = useState<{ labTestId?: number; phase?: LabPhase } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const checklist = data.checklist;
  const applicable = checklist.filter(item => item.status !== "NA");
  const doneCount = checklist.filter(item => item.status === "Done").length;
  const percent =
    applicable.length > 0
      ? Math.round((doneCount / applicable.length) * 100)
      : 0;

  const phases = Array.from(
    new Set(
      checklist
        .map(item => item.phase)
        .filter((p): p is number => p !== null)
    )
  ).sort((a, b) => a - b);

  const filtered = checklist.filter(item => {
    if (activePhase !== "all" && item.phase !== activePhase) return false;
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    return true;
  });

  // Each lab result has one line. A result that no checklist row shows gets its own row at the end.
  const testByName = new Map(data.labTests.map(test => [test.name, test]));
  const shownInChecklist = new Set(
    checklist.flatMap(item => resultsForItem(item, data.labResults).map(result => result.id))
  );
  const otherResults = data.labResults.filter(result => !shownInChecklist.has(result.id));
  const showOtherResults =
    (activePhase === "all" || activePhase === "results") &&
    (activeCategory === "all" || activeCategory === "Lab");
  const visibleItems = activePhase === "results" ? [] : filtered;
  const visibleResults = showOtherResults ? otherResults : [];

  return (
    <div className="min-w-0 space-y-4">
      {/* Header with Title, Actions, and Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-headline">Labs and Workup Checklist</h2>
          <p className="type-body-sm text-ink-muted">
            Evaluation requirements, normal reference values, and laboratory records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ClayButton
            type="button"
            variant="secondary"
            onClick={() => setEncode({})}
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Encode lab
          </ClayButton>

          <ClayButton
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Sparkles className="size-3.5 text-olive" />
            <FileSpreadsheet className="size-3.5" />
            Auto-transcribe (PDF / Excel)
          </ClayButton>

          {checklist.length > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface-1 px-3 py-1.5 shadow-xs">
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <span>
                    Done: <strong className="text-ink">{doneCount}</strong>/
                    {applicable.length}
                  </span>
                  <span className="font-mono font-bold text-ink">{percent}%</span>
                </div>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 sm:w-32">
                  <div
                    className="h-full rounded-full bg-olive transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      {checklist.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          {/* Phase Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActivePhase("all")}
              className={`clay-focus rounded-full px-2.5 py-1 text-xs font-medium transition ${
                activePhase === "all"
                  ? "bg-surface-2 text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              All phases ({checklist.length})
            </button>
            {phases.map(phase => {
              const phaseItems = checklist.filter(i => i.phase === phase);
              const phaseDone = phaseItems.filter(i => i.status === "Done").length;
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() => setActivePhase(phase)}
                  className={`clay-focus rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    activePhase === phase
                      ? "bg-surface-2 text-ink shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Phase {phase} ({phaseDone}/{phaseItems.length})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActivePhase("results")}
              className={`clay-focus rounded-full px-2.5 py-1 text-xs font-medium transition ${
                activePhase === "results"
                  ? "bg-surface-2 text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Other lab results ({otherResults.length})
            </button>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "Lab", "Imaging", "Clearance", "Milestone"] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`clay-focus rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                  activeCategory === cat
                    ? "bg-olive-tint text-olive font-semibold"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {cat === "all" ? "All types" : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Checklist Items Container */}
      {visibleItems.length + visibleResults.length === 0 ? (
        <ClayCard className="p-6 text-center text-ink-muted">
          <p className="type-body-sm">
            {activePhase === "results"
              ? "No other lab results. A result of a checklist test shows in the row of that test."
              : "No checklist items match the chosen filter."}
          </p>
        </ClayCard>
      ) : (
        <ClayCard className="divide-y divide-line overflow-hidden p-0">
          {/* Table Header (Desktop) */}
          <div className="hidden grid-cols-12 items-center gap-2 bg-ground-elevated px-3 py-2 text-[11px] font-bold text-ink-muted uppercase tracking-wider md:grid">
            <span className="col-span-1">Status</span>
            <span className="col-span-5">Requirement and Normal Reference</span>
            <span className="col-span-2">Completed</span>
            <span className="col-span-3">Note</span>
            <span className="col-span-1 text-right">Action</span>
          </div>

          {/* Rows */}
          {visibleItems.map(item => {
            const test = item.phase !== null && item.phase <= 3 ? testByName.get(item.name) : undefined;
            return (
              <ChecklistItemRow
                key={item.catalogId}
                patientId={patientId}
                item={item}
                labResults={data.labResults}
                onAddResult={
                  test
                    ? () => setEncode({ labTestId: test.id, phase: `Phase${item.phase}` as LabPhase })
                    : undefined
                }
              />
            );
          })}
          {visibleResults.map(result => (
            <div
              key={`result-${result.id}`}
              className="flex flex-col gap-2 bg-ground p-2.5 sm:p-3 md:grid md:grid-cols-12 md:items-center md:gap-2"
            >
              <div className="flex items-center md:col-span-1">
                <FlaskConical aria-hidden className="size-5 text-ink-muted/60" />
              </div>
              <div className="min-w-0 md:col-span-11">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                    Lab · {result.phase ? LAB_PHASE_LABEL[result.phase] : "Tracker"}
                  </span>
                  <span className="text-xs font-semibold text-ink sm:text-sm">{result.testName}</span>
                </div>
                {getNormalValue(result.testName) && (
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    <span className="font-semibold text-ink">Normal:</span> {getNormalValue(result.testName)}
                  </p>
                )}
                <LabResultLine patientId={patientId} result={result} />
              </div>
            </div>
          ))}
        </ClayCard>
      )}

      {/* Modals */}
      <LabManualEncodeModal
        key={JSON.stringify(encode)}
        open={encode !== null}
        onClose={() => setEncode(null)}
        initialTestId={encode?.labTestId}
        initialPhase={encode?.phase}
        patientId={patientId}
        patientType={patient?.patientType}
        labTests={data.labTests}
      />

      <LabUploadTranscribeModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        patientId={patientId}
        patientType={patient?.patientType}
        labTests={data.labTests}
      />
    </div>
  );
}
