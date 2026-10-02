import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { ClayButton, StatusChip, type ChipStatus } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { LAB_PHASE_LABEL } from "@shared/ktp";
import type { ClinicalLabResult } from "../../../../../server/dbClinical";
import { fmtDate } from "./format";

/*
 * Lab result pieces of the Labs table (DESIGN.md Screens 5). Numbers use the data face with the
 * unit in ink-muted. A flag is a status chip: an icon and a word, never a colour alone.
 */

const FLAG_CHIP: Record<string, ChipStatus> = {
  Low: "lab-low",
  High: "lab-high",
  Normal: "lab-normal",
};

/** Value, unit, and flag of one result. */
export function ResultValue({ result }: { result: ClinicalLabResult }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="type-data font-semibold text-ink">{result.value}</span>
      {result.unit && (
        <span className="type-caption text-ink-muted">{result.unit}</span>
      )}
      {result.flag && (
        <StatusChip status={FLAG_CHIP[result.flag]} srContext="Lab flag:" />
      )}
    </span>
  );
}

/** Line through the numeric results, oldest to newest. Hidden from screen readers: the list below has each value. */
function Sparkline({ results }: { results: ClinicalLabResult[] }) {
  const points = [...results]
    .reverse()
    .map(result => Number(result.value))
    .filter(Number.isFinite);
  if (points.length < 2) return null;
  const low = Math.min(...points);
  const span = Math.max(...points) - low || 1;
  const x = (index: number) => 6 + (index * 148) / (points.length - 1);
  const y = (value: number) => 34 - ((value - low) / span) * 28;
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 40"
      className="h-10 w-40 rounded-sm bg-surface-2"
    >
      <polyline
        fill="none"
        stroke="var(--series-2)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points
          .map((value, index) => `${x(index)},${y(value)}`)
          .join(" ")}
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1])}
        r="3"
        fill="var(--series-1)"
      />
    </svg>
  );
}

/** All results of one test, newest first, with a trend line and a control to remove each result. */
export function LabHistory({
  patientId,
  results,
}: {
  patientId: number;
  results: ClinicalLabResult[];
}) {
  // The list takes focus after a removal: the line that had focus is gone.
  const region = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={region}
      tabIndex={-1}
      className="clay-focus min-w-0 space-y-3 rounded-sm"
    >
      {results.length === 0 ? (
        <p className="type-body-sm text-ink-muted">No results saved.</p>
      ) : (
        <>
          <Sparkline results={results} />
          <ul className="divide-y divide-hairline">
            {results.map(result => (
              <HistoryLine
                key={result.id}
                patientId={patientId}
                result={result}
                onRemoved={() => region.current?.focus()}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function HistoryLine({
  patientId,
  result,
  onRemoved,
}: {
  patientId: number;
  result: ClinicalLabResult;
  onRemoved: () => void;
}) {
  const utils = trpc.useUtils();
  const removeButton = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const remove = trpc.clinical.updateService.useMutation({
    onSuccess: async () => {
      onRemoved();
      await Promise.all([
        utils.clinical.get.invalidate({ patientId }),
        utils.dashboard.initial.invalidate(),
        utils.patients.activityLogs.invalidate({ patientId }),
      ]);
    },
    onError: cause => setError(cause.message || "Could not remove the result."),
  });
  const label = `${result.testName}, ${fmtDate(result.serviceDate)}`;
  // Cancel gives focus back to the Remove control.
  useEffect(() => {
    if (!removing && cancelled.current) removeButton.current?.focus();
    cancelled.current = false;
  }, [removing]);

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="type-data text-ink-muted">
            {fmtDate(result.serviceDate)}
          </span>
          <ResultValue result={result} />
          <span className="type-caption text-ink-muted">
            {result.phase ? LAB_PHASE_LABEL[result.phase] : "Tracker"}
          </span>
        </div>
        {!removing && (
          <ClayButton
            ref={removeButton}
            variant="destructive"
            size="sm"
            icon={<Trash2 strokeWidth={1.75} />}
            aria-label={`Remove result: ${label}`}
            onClick={() => setRemoving(true)}
          >
            Remove
          </ClayButton>
        )}
      </div>
      {removing && (
        <form
          className="mt-2 flex flex-wrap items-end gap-3"
          onSubmit={event => {
            event.preventDefault();
            setError("");
            if (reason.trim().length < 3) {
              setError("Give a reason of 3 characters or more.");
              return;
            }
            remove.mutate({
              patientId,
              id: result.serviceRecordId,
              reason: reason.trim(),
              results: [{ labTestId: result.labTestId, value: "" }],
            });
          }}
        >
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 type-field-label">
            Reason for removal
            <input
              value={reason}
              onChange={event => setReason(event.target.value)}
              aria-label={`Reason for removal: ${label}`}
              minLength={3}
              maxLength={500}
              required
              autoFocus
              className="clay-sunken clay-focus h-11 w-full min-w-0 rounded-sm border-[1.5px] border-line-strong px-3 type-body font-normal"
            />
          </label>
          <ClayButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelled.current = true;
              setRemoving(false);
              setError("");
            }}
          >
            Cancel
          </ClayButton>
          <ClayButton
            type="submit"
            variant="destructive"
            size="sm"
            loading={remove.isPending}
          >
            Remove result
          </ClayButton>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-1 type-body-sm text-overdue">
          {error}
        </p>
      )}
    </li>
  );
}
