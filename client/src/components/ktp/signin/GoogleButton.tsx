import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ClaySpinner } from "@/components/clay";
import { useSquish } from "@/components/motion";
import { cn } from "@/lib/utils";

/*
 * Google identity branding (DESIGN.md Components): white fill, 1 px #747775 stroke, the unaltered
 * four-color G, label in #1f1f1f. These brand values are required by Google and are the only raw
 * colors in KTP; they live here, once, as local custom properties. KTP adds only clay-1, r-md,
 * h 52, and the press squish.
 */
const GOOGLE_BRAND = {
  "--g-fill": "#ffffff",
  "--g-stroke": "#747775",
  "--g-ink": "#1f1f1f",
} as CSSProperties;

export interface GoogleButtonProps {
  onClick: () => void;
  /** Replaces the G with a ring, sets aria-busy, blocks clicks. */
  loading?: boolean;
  /** Visible label. Defaults to "Sign in with Google". */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function GoogleButton({ onClick, loading = false, label = "Sign in with Google", disabled, className }: GoogleButtonProps) {
  const squish = useSquish("button", { lift: true, disabled: loading || disabled });
  return (
    <motion.button
      type="button"
      {...squish}
      onClick={() => {
        if (!loading) onClick();
      }}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      style={GOOGLE_BRAND}
      className={cn(
        "clay-1 clay-hover clay-press clay-focus relative inline-flex h-13 w-full cursor-pointer select-none items-center justify-center gap-3 rounded-md px-6",
        "border border-(--g-stroke) bg-(--g-fill) text-(--g-ink)",
        "text-base font-medium leading-5 [font-family:Roboto,'Atkinson_Hyperlegible_Next',sans-serif]",
        "aria-busy:cursor-progress disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center">
        {loading ? <ClaySpinner className="text-(--g-ink)" /> : <GoogleG />}
      </span>
      <span>{label}</span>
    </motion.button>
  );
}

/** The standard Google "G" mark, unaltered. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
