import { type ReactNode } from "react";
import { useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StatusPulseTone = "done" | "due" | "brick" | "info" | "neutral";

export interface StatusPulseProps {
  active?: boolean;
  tone?: StatusPulseTone;
  children?: ReactNode;
  className?: string;
  dotOnly?: boolean;
}

const TONE_CLASSES: Record<StatusPulseTone, { dot: string; ring: string; text: string }> = {
  done: {
    dot: "bg-done",
    ring: "text-done ring-done/40",
    text: "text-done",
  },
  due: {
    dot: "bg-due-soon",
    ring: "text-due-soon ring-due-soon/40",
    text: "text-due-soon",
  },
  brick: {
    dot: "bg-brick",
    ring: "text-brick-text ring-brick/40",
    text: "text-brick-text",
  },
  info: {
    dot: "bg-info",
    ring: "text-info ring-info/40",
    text: "text-info",
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
  tone = "done",
  children,
  className,
  dotOnly = false,
}: StatusPulseProps) {
  const mode = useMotionMode();
  const isReduced = mode === "reduced";
  const colors = TONE_CLASSES[tone] ?? TONE_CLASSES.done;

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
