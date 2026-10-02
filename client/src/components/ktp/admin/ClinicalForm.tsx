import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ClayButton, type ClayButtonVariant } from "@/components/clay";
import { trpc } from "@/lib/trpc";

export function ClinicalSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-2 type-field-label"
    >
      {label}
      <select
        {...props}
        id={id}
        className="clay-sunken clay-focus h-12 w-full min-w-0 rounded-sm border border-line-strong px-3 type-body"
      >
        {children}
      </select>
    </label>
  );
}

export const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();

export function ClinicalForm({
  patientId,
  submit,
  children,
  label = "Save",
  reset = false,
  disabled = false,
  variant = "primary",
}: {
  patientId: number;
  submit: (data: FormData) => Promise<unknown>;
  children: ReactNode;
  label?: string;
  reset?: boolean;
  disabled?: boolean;
  /** Secondary where the region already has its one primary action. */
  variant?: ClayButtonVariant;
}) {
  const utils = trpc.useUtils();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      aria-busy={pending}
      onSubmit={async event => {
        event.preventDefault();
        if (lock.current || disabled) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        lock.current = true;
        setPending(true);
        setError("");
        setSaved(false);
        try {
          await submit(data);
          if (reset) form.reset();
          setSaved(true);
          await Promise.all([
            utils.clinical.get.invalidate({ patientId }),
            utils.dashboard.initial.invalidate(),
            utils.patients.activityLogs.invalidate({ patientId }),
          ]);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not save. Try again."
          );
        } finally {
          lock.current = false;
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="type-body-sm text-overdue break-words">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="type-body-sm">
          Saved.
        </p>
      )}
      <ClayButton
        type="submit"
        variant={variant}
        loading={pending}
        disabled={disabled || pending}
        className="self-start"
      >
        {label}
      </ClayButton>
    </form>
  );
}
