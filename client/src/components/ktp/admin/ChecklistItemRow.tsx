import { useEffect, useId, useState } from "react";
import { ChevronRight, Circle, CircleCheck, CircleMinus } from "lucide-react";
import { ClayInput, StatusChip } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { dateKey, todayDate } from "@shared/ktp";
import type {
  ClinicalChecklist,
  ClinicalLabResult,
} from "../../../../../server/dbClinical";
import { ClinicalForm, ClinicalSelect } from "./ClinicalForm";
import { fmtDate } from "./format";
import { getNormalValue } from "./labCatalogMeta";
import { LabHistory, ResultValue } from "./LabResultLine";

/*
 * One row of the Labs table (DESIGN.md Screens 5): status toggle, name with its normal reference,
 * latest result of this phase, a field for a new value, and a control that opens the details.
 * The row is flat (Flat Data Rule). Every control has a 44 px target.
 */

/** Grid of a row at 768 px and wider. The column label row of a section uses the same grid. */
export const LAB_ROW_GRID =
  "md:grid md:grid-cols-[44px_minmax(0,1fr)_minmax(0,15rem)_9rem_44px] md:items-center md:gap-x-3";

export const LAB_FIELD =
  "clay-sunken clay-focus h-11 w-full min-w-0 rounded-sm border-[1.5px] border-line-strong px-3 type-data text-ink placeholder:text-ink-muted";

/** Keeps a focused control clear of the sticky bar of unsaved values. */
const CLEAR_OF_BAR = "scroll-mb-28";

type Status = ClinicalChecklist["status"];

export function ChecklistItemRow({
  patientId,
  item,
  unit,
  results,
  history,
  draft,
  onDraft,
}: {
  patientId: number;
  item: ClinicalChecklist;
  /** Unit of the lab test with the same name. Undefined: the item takes no value. */
  unit?: string;
  /** Results of this test in the phase of this item, newest first. */
  results: ClinicalLabResult[];
  /** All results of this test, newest first. */
  history: ClinicalLabResult[];
  /** New value that is typed and not saved. */
  draft: string;
  onDraft?: (value: string) => void;
}) {
  const utils = trpc.useUtils();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = () =>
    Promise.all([
      utils.clinical.get.invalidate({ patientId }),
      utils.dashboard.initial.invalidate(),
      utils.patients.activityLogs.invalidate({ patientId }),
    ]);
  // The toggle shows its error in the row. The details form shows its own error.
  const toggle = trpc.clinical.setChecklist.useMutation({
    onSuccess: refresh,
    onError: cause => setError(cause.message || "Could not save the status."),
  });
  const save = trpc.clinical.setChecklist.useMutation();

  // Details form fields. A server change of the status or date replaces them. A typed note stays.
  const [status, setStatus] = useState<Status>(item.status);
  const [doneDate, setDoneDate] = useState(dateKey(item.doneDate));
  const [note, setNote] = useState(item.note ?? "");
  useEffect(() => {
    setStatus(item.status);
    setDoneDate(dateKey(item.doneDate));
  }, [item.status, item.doneDate]);
  useEffect(() => setNote(item.note ?? ""), [item.note]);

  const done = item.status === "Done";
  const notApplicable = item.status === "NA";
  const normal = getNormalValue(item.name);
  const latest = results[0];
  const StatusIcon = done ? CircleCheck : notApplicable ? CircleMinus : Circle;

  return (
    <li className={cn("min-w-0", draft && "bg-peach-tint")}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4",
          LAB_ROW_GRID
        )}
      >
        <button
          type="button"
          aria-pressed={done}
          aria-label={`Done: ${item.name}`}
          aria-disabled={toggle.isPending}
          onClick={() => {
            if (toggle.isPending) return;
            setError("");
            toggle.mutate({
              patientId,
              catalogId: item.catalogId,
              status: done ? "Pending" : "Done",
              doneDate: done ? undefined : todayDate(),
              note: item.note ?? undefined,
            });
          }}
          className={cn(
            "clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-(--dur-color) hover:bg-sunken/60 aria-disabled:cursor-progress",
            CLEAR_OF_BAR
          )}
        >
          <StatusIcon
            aria-hidden
            strokeWidth={1.75}
            className={cn("size-6", done ? "text-done" : "text-line-strong")}
          />
        </button>

        <div className="min-w-0 flex-1 basis-48">
          <p
            className={cn(
              "type-body-sm font-bold break-words text-ink",
              notApplicable && "clay-struck text-ink-muted"
            )}
          >
            {item.name}
          </p>
          {(normal || item.asIndicated) && (
            <p className="type-caption text-ink-muted">
              {item.asIndicated ? "As indicated. " : ""}
              {normal ? `Normal: ${normal}` : ""}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 max-md:order-2 max-md:basis-full max-md:pl-14">
          {notApplicable && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-superseded-bg px-2.5 type-label text-superseded">
              <CircleMinus
                aria-hidden
                strokeWidth={1.75}
                className="size-3.5"
              />
              <span className="sr-only">Checklist status: </span>
              Not applicable
            </span>
          )}
          {latest ? (
            <>
              <ResultValue result={latest} />
              <span className="type-data text-ink-muted">
                {fmtDate(latest.serviceDate)}
              </span>
            </>
          ) : done ? (
            <>
              <StatusChip status="done" srContext="Checklist status:" />
              <span className="type-data text-ink-muted">
                {fmtDate(item.doneDate)}
              </span>
            </>
          ) : notApplicable ? null : unit === undefined ? (
            <StatusChip
              status="planned"
              label="Pending"
              srContext="Checklist status:"
            />
          ) : (
            <span className="type-body-sm text-ink-muted">No result</span>
          )}
        </div>

        <div className="max-md:order-3 max-md:basis-full max-md:pl-14">
          {onDraft && (
            <input
              value={draft}
              onChange={event => onDraft(event.target.value)}
              inputMode="decimal"
              maxLength={100}
              aria-label={`New result: ${item.name}${unit ? `, ${unit}` : ""}`}
              placeholder={unit || "Value"}
              className={cn(LAB_FIELD, CLEAR_OF_BAR)}
            />
          )}
        </div>

        {/* Last in the DOM so the tab order at 768 px and wider follows the columns. Under 768 it sits beside the name. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`Details: ${item.name}`}
          onClick={() => setOpen(value => !value)}
          className={cn(
            "clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink max-md:order-1",
            CLEAR_OF_BAR
          )}
        >
          <ChevronRight
            aria-hidden
            strokeWidth={1.75}
            className={cn(
              "size-5 transition-transform duration-150 motion-reduce:transition-none",
              open && "rotate-90"
            )}
          />
        </button>
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 pl-17 type-body-sm text-overdue">
          {error}
        </p>
      )}

      {open && (
        <div
          id={detailsId}
          className="grid min-w-0 gap-6 border-t border-hairline bg-ground px-4 py-4 sm:px-6 lg:grid-cols-2"
        >
          <section
            aria-label={`Checklist status: ${item.name}`}
            className="min-w-0"
          >
            <h4 className="mb-3 type-label text-ink-muted">Checklist status</h4>
            <ClinicalForm
              patientId={patientId}
              label="Save status"
              variant="secondary"
              submit={() => {
                setError("");
                return save.mutateAsync({
                  patientId,
                  catalogId: item.catalogId,
                  status,
                  doneDate:
                    status === "Done" ? doneDate || todayDate() : undefined,
                  note: note.trim(),
                });
              }}
            >
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <ClinicalSelect
                  label="Status"
                  value={status}
                  onChange={event => setStatus(event.target.value as Status)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Done">Done</option>
                  <option value="NA">Not applicable</option>
                </ClinicalSelect>
                <ClayInput
                  label="Completion date"
                  hint="For a Done item. Empty means today."
                  type="date"
                  max={todayDate()}
                  value={doneDate}
                  onChange={event => setDoneDate(event.target.value)}
                />
                <ClayInput
                  label="Note (optional)"
                  maxLength={2000}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  containerClassName="sm:col-span-2"
                />
              </div>
            </ClinicalForm>
          </section>
          {unit !== undefined && (
            <section aria-label={`Results: ${item.name}`} className="min-w-0">
              <h4 className="mb-3 type-label text-ink-muted">
                All results of this test
              </h4>
              <LabHistory patientId={patientId} results={history} />
            </section>
          )}
        </div>
      )}
    </li>
  );
}
