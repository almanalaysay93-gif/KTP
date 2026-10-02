import { useEffect, useState } from "react";
import { Check, CheckCircle2, Circle, Loader2, MinusCircle, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateKey, todayDate } from "@shared/ktp";
import type {
  ClinicalChecklist,
  ClinicalLabResult,
} from "../../../../../server/dbClinical";
import { findLatestMatchingResult, getNormalValue } from "./labCatalogMeta";

export function ChecklistItemRow({
  patientId,
  item,
  labResults,
}: {
  patientId: number;
  item: ClinicalChecklist;
  labResults: ClinicalLabResult[];
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

  const normalRef = getNormalValue(item.name);
  const latestResult = findLatestMatchingResult(item.name, labResults);

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
      {/* Col 1: Quick Checkbox Toggle and Status Icon */}
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

        {/* Status Dropdown (Mobile) */}
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

      {/* Col 2: Requirement Name, Badges, Normal Range, and Latest Result */}
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

        {/* Normal Values Display */}
        {normalRef && (
          <p className="mt-0.5 text-[11px] text-ink-muted">
            <span className="font-semibold text-ink">Normal:</span> {normalRef}
          </p>
        )}

        {/* Latest Patient Lab Result Display */}
        {latestResult && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
            <span className="font-semibold text-olive">Latest:</span>
            <span className="font-mono text-ink">
              {latestResult.value} {latestResult.unit}
            </span>
            {latestResult.flag && (
              <span
                className={`rounded px-1 py-0.2 text-[10px] font-bold ${
                  latestResult.flag === "Normal"
                    ? "bg-olive-tint text-olive"
                    : "bg-brick/10 text-brick"
                }`}
              >
                {latestResult.flag}
              </span>
            )}
            {latestResult.serviceDate && (
              <span className="text-[10px] text-ink-muted">
                ({dateKey(latestResult.serviceDate)})
              </span>
            )}
          </div>
        )}

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
