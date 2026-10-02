import { type ReactNode } from "react";
import { useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StatusPulseTone = "olive" | "amber" | "brick" | "blue" | "neutral";

export interface StatusPulseProps {
  active?: boolean;
  tone?: StatusPulseTone;
  children?: ReactNode;
  className?: string;
  dotOnly?: boolean;
}

const TONE_CLASSES: Record<StatusPulseTone, { dot: string; ring: string; text: string }> = {
  olive: {
    dot: "bg-olive",
    ring: "text-olive ring-olive/40",
    text: "text-olive",
  },
  amber: {
    dot: "bg-amber-600",
    ring: "text-amber-600 ring-amber-500/40",
    text: "text-amber-700",
  },
  brick: {
    dot: "bg-brick",
    ring: "text-brick ring-brick/40",
    text: "text-brick",
  },
  blue: {
    dot: "bg-sky-600",
    ring: "text-sky-600 ring-sky-500/40",
    text: "text-sky-700",
  },
  neutral: {
    dot: "bg-ink-muted",
    ring: "text-ink-muted ring-ink/20",
    text: "text-ink-muted",
  },
};

/**
 * Gentle pulsing indicator for active clinical workflows (in-flight email dispatch, OCR transcription).
 * Under prefers-reduced-motion, all animations halt and a static pill or dot renders.
 */
export function StatusPulse({
  active = true,
  tone = "olive",
  children,
  className,
  dotOnly = false,
}: StatusPulseProps) {
  const mode = useMotionMode();
  const isReduced = mode === "reduced";
  const colors = TONE_CLASSES[tone] ?? TONE_CLASSES.olive;

  if (!active || isReduced) {
    if (dotOnly) {
      return (
        <span
          className={cn("inline-block size-2 rounded-full", colors.dot, className)}
          aria-hidden="true"
        />
      );
    }
    return <span className={className}>{children}</span>;
  }

  if (dotOnly) {
    return (
      <span className={cn("relative flex size-2 items-center justify-center", className)} aria-hidden="true">
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-75 motion-status-pulse",
            colors.dot
          )}
        />
        <span className={cn("relative inline-block size-2 rounded-full", colors.dot)} />
      </span>
    );
  }

  return (
    <span className={cn("relative isolate inline-flex items-center", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "absolute -inset-0.5 rounded-full pointer-events-none opacity-60 motion-status-pill-pulse",
          colors.ring
        )}
      />
      {children}
    </span>
  );
}
