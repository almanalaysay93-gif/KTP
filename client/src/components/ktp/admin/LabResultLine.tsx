import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateKey } from "@shared/ktp";
import type { ClinicalLabResult } from "../../../../../server/dbClinical";

/**
 * One saved lab result: value, flag, date, and a control to remove it.
 * A removal needs a reason. The server keeps the removed value with that reason.
 */
export function LabResultLine({
  patientId,
  result,
}: {
  patientId: number;
  result: ClinicalLabResult;
}) {
  const utils = trpc.useUtils();
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const remove = trpc.clinical.updateService.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.clinical.get.invalidate({ patientId }),
        utils.dashboard.initial.invalidate(),
        utils.patients.activityLogs.invalidate({ patientId }),
      ]),
    onError: cause => setError(cause.message || "Could not remove the result"),
  });
  const label = `${result.testName}, ${dateKey(result.serviceDate)}`;

  return (
    <div className="mt-0.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-semibold text-olive">Result:</span>
        <span className="font-mono text-ink">
          {result.value} {result.unit}
        </span>
        {result.flag && (
          <span
            className={`rounded px-1 text-[10px] font-bold ${
              result.flag === "Normal"
                ? "bg-olive-tint text-olive"
                : "bg-brick/10 text-brick"
            }`}
          >
            {result.flag}
          </span>
        )}
        {result.serviceDate && (
          <span className="text-[10px] text-ink-muted">
            ({dateKey(result.serviceDate)})
          </span>
        )}
        {!removing && (
          <button
            type="button"
            onClick={() => setRemoving(true)}
            aria-label={`Remove result: ${label}`}
            className="clay-focus inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold text-brick hover:bg-brick/10"
          >
            <Trash2 className="size-3" /> Remove
          </button>
        )}
      </div>
      {removing && (
        <form
          className="mt-1 flex flex-wrap items-center gap-1.5"
          onSubmit={event => {
            event.preventDefault();
            setError("");
            remove.mutate({
              patientId,
              id: result.serviceRecordId,
              reason: reason.trim(),
              results: [{ labTestId: result.labTestId, value: "" }],
            });
          }}
        >
          <input
            value={reason}
            onChange={event => setReason(event.target.value)}
            aria-label={`Reason for removal: ${label}`}
            placeholder="Reason for removal"
            minLength={3}
            maxLength={500}
            required
            autoFocus
            className="h-7 min-w-0 flex-1 rounded border border-line-strong/30 bg-surface-1 px-2 text-xs text-ink placeholder:text-ink-muted/50"
          />
          <button
            type="submit"
            disabled={remove.isPending}
            className="clay-focus inline-flex h-7 items-center gap-1 rounded bg-brick px-2 text-xs font-semibold text-ground disabled:opacity-50"
          >
            {remove.isPending && <Loader2 className="size-3 animate-spin" />}
            Remove result
          </button>
          <button
            type="button"
            onClick={() => {
              setRemoving(false);
              setError("");
            }}
            className="clay-focus h-7 rounded border border-line px-2 text-xs text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-overdue">
          {error}
        </p>
      )}
    </div>
  );
}
