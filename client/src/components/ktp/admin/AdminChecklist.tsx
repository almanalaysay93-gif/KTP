import { useEffect, useState } from "react";
import { Check, CheckCircle2, Circle, Loader2, MinusCircle, Save } from "lucide-react";
import { ClayCard } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate } from "@shared/ktp";
import type { ClinicalChecklist } from "../../../../../server/dbClinical";

type PhaseFilter = "all" | number;
type CategoryFilter = "all" | "Lab" | "Imaging" | "Clearance" | "Milestone";

export function AdminChecklist({
  patientId,
  checklist,
}: {
  patientId: number;
  checklist: ClinicalChecklist[];
}) {
  const [activePhase, setActivePhase] = useState<PhaseFilter>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const applicable = checklist.filter(item => item.status !== "NA");
  const doneCount = checklist.filter(item => item.status === "Done").length;
  const percent = applicable.length > 0 ? Math.round((doneCount / applicable.length) * 100) : 0;

  const phases = Array.from(
    new Set(checklist.map(item => item.phase).filter((p): p is number => p !== null))
  ).sort((a, b) => a - b);

  const filtered = checklist.filter(item => {
    if (activePhase !== "all" && item.phase !== activePhase) return false;
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="min-w-0 space-y-4">
      {/* Header with Progress */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-headline">Workup checklist</h2>
          <p className="type-body-sm text-ink-muted">
            Evaluation requirements, lab workups, and pre-transplant clearances.
          </p>
        </div>
        {checklist.length > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-1 px-3 py-1.5 shadow-xs">
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span>
                  Done: <strong className="text-ink">{doneCount}</strong>/{applicable.length}
                </span>
                <span className="font-mono font-bold text-ink">{percent}%</span>
              </div>
              <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-2 sm:w-36">
                <div
                  className="h-full rounded-full bg-olive transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        )}
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
      {filtered.length === 0 ? (
        <ClayCard className="p-6 text-center text-ink-muted">
          <p className="type-body-sm">No checklist items match the chosen filter.</p>
        </ClayCard>
      ) : (
        <ClayCard className="divide-y divide-line overflow-hidden p-0">
          {/* Table Header (Desktop) */}
          <div className="hidden grid-cols-12 items-center gap-2 bg-ground-elevated px-3 py-2 text-[11px] font-bold text-ink-muted uppercase tracking-wider md:grid">
            <span className="col-span-1">Status</span>
            <span className="col-span-5">Requirement</span>
            <span className="col-span-2">Completed</span>
            <span className="col-span-3">Note</span>
            <span className="col-span-1 text-right">Action</span>
          </div>

          {/* Rows */}
          {filtered.map(item => (
            <ChecklistItemRow key={item.catalogId} patientId={patientId} item={item} />
          ))}
        </ClayCard>
      )}
    </div>
  );
}

function ChecklistItemRow({
  patientId,
  item,
}: {
  patientId: number;
  item: ClinicalChecklist;
}) {
  const utils = trpc.useUtils();
  const mutation = trpc.clinical.setChecklist.useMutation({
    onSuccess: () => {
      utils.clinical.get.invalidate({ patientId });
      utils.dashboard.initial.invalidate();
    },
  });

  const [status, setStatus] = useState<"Pending" | "Done" | "NA">(item.status);
  const [doneDate, setDoneDate] = useState<string>(dateKey(item.doneDate) ?? "");
  const [note, setNote] = useState<string>(item.note ?? "");
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(item.status);
    setDoneDate(dateKey(item.doneDate) ?? "");
    setNote(item.note ?? "");
  }, [item.status, item.doneDate, item.note]);

  const isDirty =
    status !== item.status ||
    (doneDate || "") !== (dateKey(item.doneDate) || "") ||
    (note || "") !== (item.note || "");

  const handleQuickToggle = async () => {
    const nextStatus = item.status === "Done" ? "Pending" : "Done";
    const nextDate = nextStatus === "Done" ? todayDate() : undefined;
    setStatus(nextStatus);
    if (nextDate) setDoneDate(nextDate);
    setError("");

    try {
      await mutation.mutateAsync({
        patientId,
        catalogId: item.catalogId,
        status: nextStatus,
        doneDate: nextDate,
        note: note || undefined,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: unknown) {
      setStatus(item.status);
      setDoneDate(dateKey(item.doneDate) ?? "");
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  };

  const handleSave = async () => {
    if (status === "Done" && !doneDate) {
      setError("Completion date required");
      return;
    }
    setError("");

    try {
      await mutation.mutateAsync({
        patientId,
        catalogId: item.catalogId,
        status,
        doneDate: status === "Done" ? doneDate : undefined,
        note: note || undefined,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const isDone = status === "Done";
  const isNA = status === "NA";

  return (
    <div
      className={`flex flex-col gap-2 p-2.5 transition sm:p-3 md:grid md:grid-cols-12 md:items-center md:gap-2 ${
        isDone ? "bg-olive-tint/10" : isNA ? "bg-ground opacity-60" : "bg-ground"
      }`}
    >
      {/* Col 1: Quick Checkbox Toggle & Status Icon */}
      <div className="flex items-center gap-2 md:col-span-1">
        <button
          type="button"
          onClick={handleQuickToggle}
          disabled={mutation.isPending}
          className="clay-focus rounded-full p-0.5 text-ink-muted transition hover:text-ink disabled:opacity-50"
          title={isDone ? "Click to mark Pending" : "Click to mark Done today"}
        >
          {isDone ? (
            <CheckCircle2 className="size-5 text-olive" />
          ) : isNA ? (
            <MinusCircle className="size-5 text-ink-muted/50" />
          ) : (
            <Circle className="size-5 text-ink-muted/60 hover:text-olive" />
          )}
        </button>

        {/* Status Dropdown */}
        <select
          value={status}
          onChange={e => {
            const val = e.target.value as "Pending" | "Done" | "NA";
            setStatus(val);
            if (val === "Done" && !doneDate) setDoneDate(todayDate());
          }}
          className="h-7 rounded border border-line-strong/30 bg-surface-1 px-1.5 text-xs text-ink md:hidden"
        >
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
          <option value="NA">NA</option>
        </select>
      </div>

      {/* Col 2: Requirement Name and Badges */}
      <div className="min-w-0 md:col-span-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            {item.category}
            {item.phase ? ` · P${item.phase}` : ""}
          </span>
          {item.asIndicated && (
            <span className="text-[10px] italic text-ink-muted">As indicated</span>
          )}
          <span
            className={`font-semibold text-xs text-ink sm:text-sm ${
              isDone ? "text-ink" : isNA ? "line-through text-ink-muted" : "text-ink"
            }`}
            title={item.name}
          >
            {item.name}
          </span>
        </div>
        {error && <p className="text-[11px] text-overdue">{error}</p>}
      </div>

      {/* Col 3: Status and Completion Date */}
      <div className="flex items-center gap-2 md:col-span-2">
        <select
          value={status}
          onChange={e => {
            const val = e.target.value as "Pending" | "Done" | "NA";
            setStatus(val);
            if (val === "Done" && !doneDate) setDoneDate(todayDate());
          }}
          className="hidden h-7 rounded border border-line-strong/30 bg-surface-1 px-1.5 text-xs text-ink md:block"
        >
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
          <option value="NA">NA</option>
        </select>
        {isDone ? (
          <input
            type="date"
            value={doneDate}
            max={todayDate()}
            onChange={e => setDoneDate(e.target.value)}
            className="h-7 w-28 rounded border border-line-strong/30 bg-surface-1 px-1.5 text-xs text-ink"
            title="Completion date"
          />
        ) : (
          <span className="hidden text-xs text-ink-muted/50 md:inline">-</span>
        )}
      </div>

      {/* Col 4: Note Input */}
      <div className="md:col-span-3">
        <input
          type="text"
          value={note}
          placeholder="Note (optional)"
          maxLength={2000}
          onChange={e => setNote(e.target.value)}
          className="h-7 w-full rounded border border-line-strong/30 bg-surface-1 px-2 text-xs text-ink placeholder:text-ink-muted/50"
        />
      </div>

      {/* Col 5: Action Button */}
      <div className="flex items-center justify-end gap-1.5 md:col-span-1">
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin text-ink-muted" />
        ) : isSaved ? (
          <span className="flex items-center gap-1 rounded bg-olive-tint px-1.5 py-0.5 text-[10px] font-semibold text-olive">
            <Check className="size-3" /> Saved
          </span>
        ) : isDirty ? (
          <button
            type="button"
            onClick={handleSave}
            className="clay-focus inline-flex h-7 items-center gap-1 rounded bg-olive px-2 text-xs font-semibold text-ground transition hover:bg-olive-hover"
            title="Save changes"
          >
            <Save className="size-3" /> Save
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="clay-focus inline-flex h-7 items-center gap-1 rounded border border-line px-2 text-xs text-ink-muted transition hover:text-ink"
            title="Re-save item"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
