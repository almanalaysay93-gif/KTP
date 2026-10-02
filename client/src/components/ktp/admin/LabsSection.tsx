import { useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FlaskConical } from "lucide-react";
import { ClayCard } from "@/components/clay";
import { cn } from "@/lib/utils";
import { LAB_PHASE_LABEL } from "@shared/ktp";
import type { ClinicalData } from "./PatientClinicalTabs";
import { LAB_ROW_GRID } from "./ChecklistItemRow";
import { fmtDate } from "./format";
import { getNormalValue } from "./labCatalogMeta";
import { LabHistory, ResultValue } from "./LabResultLine";

/*
 * Parts of the Labs tab (DESIGN.md Screens 5): the progress read-out, the collapsible section
 * card, and the row of a lab test that has results but no checklist item.
 */

type Result = ClinicalData["labResults"][number];

export function Progress({
  done,
  total,
  label,
  wide = false,
}: {
  done: number;
  total: number;
  label?: string;
  wide?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="type-data whitespace-nowrap text-ink-muted">
        {label ? `${label}: ` : ""}
        <span className="font-semibold text-ink">{done}</span> of {total} done
      </span>
      <span
        aria-hidden
        className={cn(
          "clay-sunken h-2 overflow-hidden rounded-full max-sm:hidden",
          wide ? "w-40" : "w-24"
        )}
      >
        <span
          className={cn(
            "block h-full origin-left rounded-full transition-transform duration-500 ease-(--ease-out-soft) motion-reduce:transition-none",
            total > 0 && done === total ? "bg-done" : "bg-sage-deep"
          )}
          style={{ transform: `scaleX(${total > 0 ? done / total : 0})` }}
        />
      </span>
    </span>
  );
}

export function Section({
  title,
  open,
  onToggle,
  summary,
  columns = false,
  footer,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  summary: ReactNode;
  /** Shows the column labels of the result rows. */
  columns?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <ClayCard padding="none" className="min-w-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="clay-focus-inset flex min-h-14 w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[inherit] px-4 py-3 text-left sm:px-5"
        >
          <span className="flex items-center gap-2">
            <ChevronRight
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "size-5 text-ink-muted transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-90"
              )}
            />
            <span className="type-title text-ink">{title}</span>
          </span>
          {summary}
        </button>
      </h3>
      {open && (
        <motion.div
          id={bodyId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {columns && (
            <div
              aria-hidden
              className={cn(
                "hidden border-t-[1.5px] border-line-strong px-4 py-2 type-label text-ink-muted",
                LAB_ROW_GRID
              )}
            >
              <span />
              <span>Test</span>
              <span>Latest result</span>
              <span>New result</span>
              <span />
            </div>
          )}
          {children}
          {footer}
        </motion.div>
      )}
    </ClayCard>
  );
}

export function OtherResultRow({
  patientId,
  name,
  results,
}: {
  patientId: number;
  name: string;
  results: Result[];
}) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const latest = results[0];
  const normal = getNormalValue(name);
  return (
    <li className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center text-line-strong">
          <FlaskConical aria-hidden strokeWidth={1.75} className="size-6" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="type-body-sm font-bold break-words text-ink">{name}</p>
          {normal && (
            <p className="type-caption text-ink-muted">Normal: {normal}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 max-md:order-last max-md:basis-full max-md:pl-14">
          <ResultValue result={latest} />
          <span className="type-data text-ink-muted">
            {fmtDate(latest.serviceDate)}
          </span>
          <span className="type-caption text-ink-muted">
            {latest.phase ? LAB_PHASE_LABEL[latest.phase] : "Tracker"}
          </span>
          {results.length > 1 && (
            <span className="type-data text-ink-muted">
              {results.length} results
            </span>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`All results: ${name}`}
          onClick={() => setOpen(value => !value)}
          className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
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
      {open && (
        <div
          id={detailsId}
          className="border-t border-hairline bg-ground px-4 py-4 sm:px-6"
        >
          <LabHistory patientId={patientId} results={results} />
        </div>
      )}
    </li>
  );
}
