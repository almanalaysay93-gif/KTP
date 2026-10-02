import { useId, useState } from "react";
import { ChevronRight, Circle, CircleCheck, CircleMinus } from "lucide-react";
import { ClayInput, StatusChip } from "@/components/clay";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { dateKey, todayDate } from "@shared/ktp";
import type {
  ClinicalChecklist,
  ClinicalLabResult,
} from "../../../../../server/dbClinical";
import { ClinicalForm, ClinicalSelect, field } from "./ClinicalForm";
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
  const save = trpc.clinical.setChecklist.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.clinical.get.invalidate({ patientId }),
        utils.dashboard.initial.invalidate(),
        utils.patients.activityLogs.invalidate({ patientId }),
      ]),
    onError: cause => setError(cause.message || "Could not save the status."),
  });

  const done = item.status === "Done";
  const notApplicable = item.status === "NA";
  const normal = getNormalValue(item.name);
  const latest = results[0];
  const StatusIcon = done ? CircleCheck : notApplicable ? CircleMinus : Circle;

  return (
    <li className={cn("min-w-0", draft && "bg-peach-tint/50")}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4",
          LAB_ROW_GRID
        )}
      >
        <button
          type="button"
          aria-pressed={done}
          aria-label={`${done ? "Mark pending" : "Mark done today"}: ${item.name}`}
          disabled={save.isPending}
          onClick={() => {
            setError("");
            save.mutate({
              patientId,
              catalogId: item.catalogId,
              status: done ? "Pending" : "Done",
              doneDate: done ? undefined : todayDate(),
              note: item.note ?? undefined,
            });
          }}
          className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-(--dur-color) hover:bg-sunken/60 disabled:cursor-progress"
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

        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`Details: ${item.name}`}
          onClick={() => setOpen(value => !value)}
          className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink md:order-last"
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

        <div className="flex min-w-0 basis-full flex-wrap items-center gap-x-3 gap-y-1 pl-14 md:basis-auto md:pl-0">
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
          ) : notApplicable ? (
            <StatusChip
              status="superseded"
              label="Not applicable"
              srContext="Checklist status:"
            />
          ) : (
            <span className="type-body-sm text-ink-muted">
              {unit === undefined ? "Pending" : "No result"}
            </span>
          )}
        </div>

        <div className="basis-full pl-14 md:basis-auto md:pl-0">
          {onDraft && (
            <input
              value={draft}
              onChange={event => onDraft(event.target.value)}
              inputMode="decimal"
              maxLength={100}
              aria-label={`New result: ${item.name}${unit ? `, ${unit}` : ""}`}
              placeholder={unit || "Value"}
              className={LAB_FIELD}
            />
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 pl-17 type-body-sm text-overdue">
          {error}
        </p>
      )}

      {open && (
        <div
          id={detailsId}
          className="grid min-w-0 gap-6 border-t border-hairline bg-ground/60 px-4 py-4 sm:px-6 lg:grid-cols-2"
        >
          <section
            aria-label={`Checklist status: ${item.name}`}
            className="min-w-0"
          >
            <h4 className="mb-3 type-label text-ink-muted">Checklist status</h4>
            <ClinicalForm
              patientId={patientId}
              label="Save status"
              submit={form => {
                const status = field(
                  form,
                  "status"
                ) as ClinicalChecklist["status"];
                return save.mutateAsync({
                  patientId,
                  catalogId: item.catalogId,
                  status,
                  doneDate:
                    status === "Done"
                      ? field(form, "doneDate") || todayDate()
                      : undefined,
                  note: field(form, "note"),
                });
              }}
            >
              <div
                key={`${item.status}-${item.doneDate}-${item.note}`}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <ClinicalSelect
                  name="status"
                  label="Status"
                  defaultValue={item.status}
                >
                  <option value="Pending">Pending</option>
                  <option value="Done">Done</option>
                  <option value="NA">Not applicable</option>
                </ClinicalSelect>
                <ClayInput
                  name="doneDate"
                  label="Completion date"
                  hint="For a Done item. Empty means today."
                  type="date"
                  max={todayDate()}
                  defaultValue={dateKey(item.doneDate)}
                />
                <ClayInput
                  name="note"
                  label="Note (optional)"
                  maxLength={2000}
                  defaultValue={item.note ?? ""}
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
