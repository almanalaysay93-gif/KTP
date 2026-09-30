import * as React from "react";
import { cn } from "@/lib/utils";

export type ProgressRingSize = 44 | 64 | 72;

export interface ProgressRingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  value: number;
  max?: number;
  size?: ProgressRingSize;
  /** Accessible name, for example "Work-up checklist". */
  label: string;
  /** aria-valuetext, for example "38 of 42 done". */
  valueText?: string;
  /** Center text override. Defaults to the percentage. */
  display?: React.ReactNode;
  state?: "ready" | "loading" | "error";
}

const STROKE: Record<ProgressRingSize, number> = { 44: 6, 64: 8, 72: 8 };
const TEXT: Record<ProgressRingSize, string> = { 44: "text-[13px]", 64: "text-base", 72: "text-lg" };

export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  { value, max = 100, size = 64, label, valueText, display, state = "ready", className, style, ...rest },
  ref,
) {
  const stroke = STROKE[size];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), max);
  const ratio = max > 0 ? clamped / max : 0;
  const complete = ratio >= 1;
  const ready = state === "ready";
  const center = size / 2;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={ready ? clamped : undefined}
      aria-valuetext={ready ? valueText : state === "loading" ? "Loading" : "Could not load"}
      aria-busy={state === "loading" || undefined}
      data-state={state}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} className="stroke-sunken" />
        {ready && ratio > 0 ? (
          <circle
            data-slot="ring-fill"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${center} ${center})`}
            className={complete ? "stroke-done" : "stroke-sage-deep"}
          />
        ) : null}
      </svg>
      {state !== "loading" ? (
        <span aria-hidden className={cn("relative font-mono font-semibold tabular-nums text-ink", TEXT[size])}>
          {state === "error" ? "--" : (display ?? `${Math.round(ratio * 100)}%`)}
        </span>
      ) : null}
    </div>
  );
});
