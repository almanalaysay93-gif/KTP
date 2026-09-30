import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClaySpinner } from "./ClayButton";

export interface ClayInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label above the input (700, 15/20). Required: inputs are never unlabeled. */
  label: React.ReactNode;
  /** Helper line below (caption). */
  hint?: React.ReactNode;
  /** Error message below: 2 px Overdue border, icon + message, aria-invalid. */
  error?: React.ReactNode;
  /** Trailing indeterminate ring, for example while checking a value. */
  loading?: boolean;
  /** admin h48, patient h52 */
  size?: "admin" | "patient";
  /** Leading icon inside the well. */
  leading?: React.ReactNode;
  containerClassName?: string;
}

export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(function ClayInput(
  { label, hint, error, loading = false, size = "admin", leading, id, className, containerClassName, ...rest },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? `clay-input-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [rest["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      <label htmlFor={inputId} className="type-field-label text-ink">
        {label}
      </label>
      <div className="relative">
        {leading ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted [&_svg]:size-5"
          >
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-busy={loading || undefined}
          {...rest}
          aria-describedby={describedBy}
          className={cn(
            "clay-sunken clay-focus type-body block w-full min-w-0 rounded-sm border-[1.5px] border-line-strong px-3.5 text-ink",
            "transition-colors duration-(--dur-color) placeholder:text-ink-muted hover:border-ink focus-visible:border-ink [&.is-focus]:border-ink",
            "disabled:cursor-not-allowed disabled:border-hairline disabled:bg-ground disabled:text-line-strong disabled:shadow-none",
            "aria-invalid:border-2 aria-invalid:border-overdue aria-invalid:hover:border-overdue",
            size === "patient" ? "h-13" : "h-12",
            leading ? "pl-11" : null,
            loading ? "pr-11" : null,
            className,
          )}
        />
        {loading ? (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-ink-muted">
            <ClaySpinner />
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="type-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="type-body-sm flex items-start gap-1.5 text-overdue">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
});
