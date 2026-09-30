import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClaySkeleton } from "./ClaySkeleton";

export interface ClayStep {
  id: string;
  /** Stepper short label from COPY.md 5.1, for example "Phase 1". */
  label: string;
}

export type ClayStepState = "complete" | "current" | "upcoming";

export interface ClayStepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: ClayStep[];
  /** Index of the current step. */
  current: number;
  /** Accessible name of the list. */
  label?: string;
  /** auto: dots plus a summary line under 1024, full labels from 1024. */
  compact?: "auto" | "always" | "never";
  /** Optional trailing meta, for example "Post-KT day 154". */
  trailing?: React.ReactNode;
  loading?: boolean;
}

const SR_WORD: Record<ClayStepState, string> = {
  complete: "completed",
  current: "current stage",
  upcoming: "upcoming",
};

const NODE: Record<ClayStepState, string> = {
  complete: "clay-1 bg-sage-deep text-on-brick",
  current: "clay-1 bg-ink",
  upcoming: "clay-sunken border-[1.5px] border-line-strong",
};

export const ClayStepper = React.forwardRef<HTMLDivElement, ClayStepperProps>(function ClayStepper(
  { steps, current, label = "Stage progress", compact = "auto", trailing, loading = false, className, ...rest },
  ref,
) {
  const total = steps.length;
  const safeCurrent = Math.min(Math.max(current, 0), Math.max(total - 1, 0));
  const hideLabels = compact === "always" ? "sr-only" : compact === "auto" ? "max-lg:sr-only" : "";
  const showSummary = compact === "always" ? "" : compact === "auto" ? "lg:hidden" : "hidden";

  if (loading) {
    return (
      <div ref={ref} aria-busy="true" className={cn("w-full", className)} {...rest}>
        <span className="sr-only">Loading</span>
        <ClaySkeleton shape="pill" className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("flex w-full flex-col gap-2", className)} {...rest}>
      <div className="clay-sunken flex w-full items-center gap-3 rounded-full px-3 py-2">
        <ol aria-label={label} className="flex min-w-0 flex-1 items-center">
          {steps.map((step, i) => {
            const state: ClayStepState = i < safeCurrent ? "complete" : i === safeCurrent ? "current" : "upcoming";
            const isLast = i === total - 1;
            return (
              <li
                key={step.id}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className={cn("flex min-w-0 items-center gap-2", !isLast && "flex-1")}
              >
                <span
                  aria-hidden
                  className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", NODE[state])}
                >
                  {state === "complete" ? <Check className="size-4" strokeWidth={2.25} /> : null}
                  {state === "current" ? <span className="size-2.5 rounded-full bg-peach" /> : null}
                </span>
                <span
                  className={cn(
                    "type-body-sm whitespace-nowrap",
                    state === "current" ? "font-bold text-ink" : "text-ink-muted",
                    hideLabels,
                  )}
                >
                  {step.label}
                  <span className="sr-only">
                    , step {i + 1} of {total}, {SR_WORD[state]}
                  </span>
                </span>
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-1 min-w-3 flex-1",
                      i < safeCurrent ? "h-1 rounded-full bg-sage-deep" : "border-t-2 border-dashed border-line-strong",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {total > 0 && (compact !== "never" || trailing) ? (
        <p className="type-body-sm flex flex-wrap items-baseline gap-x-3 px-3 text-ink-muted">
          <span aria-hidden className={showSummary}>
            <span className="font-bold text-ink">{steps[safeCurrent].label}</span>, stage {safeCurrent + 1} of {total}
          </span>
          {trailing ? <span className="type-data">{trailing}</span> : null}
        </p>
      ) : null}
    </div>
  );
});
