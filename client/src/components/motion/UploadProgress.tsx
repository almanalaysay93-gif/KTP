import { forwardRef } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useMotionMode } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type UploadPhase = "idle" | "uploading" | "transcribing" | "complete" | "error";

export interface UploadProgressProps {
  progress: number;
  phase: UploadPhase;
  errorText?: string;
  fileName?: string;
  className?: string;
}

/**
 * Calm, accessible upload progress bar with clinical state transitions.
 * Features smooth width interpolation, indeterminate document scanning shimmer,
 * and immediate static rendering under prefers-reduced-motion.
 */
export const UploadProgress = forwardRef<HTMLDivElement, UploadProgressProps>(function UploadProgress(
  { progress, phase, errorText, fileName, className },
  ref
) {
  const mode = useMotionMode();
  const isReduced = mode === "reduced";

  const isIndeterminate = phase === "transcribing";
  const isComplete = phase === "complete";
  const isError = phase === "error";

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div ref={ref} className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span className="font-medium text-ink truncate max-w-[220px]">
          {fileName ?? "Document"}
        </span>
        <span className="font-mono">
          {isIndeterminate
            ? "Extracting..."
            : isComplete
              ? "Completed"
              : isError
                ? "Failed"
                : `${clampedProgress}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={fileName ? `Upload progress for ${fileName}` : "Upload progress"}
        className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-hairline"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isComplete
              ? "bg-olive"
              : isError
                ? "bg-brick"
                : "bg-peach",
            !isReduced && !isIndeterminate && "duration-300 ease-out",
            isReduced && "duration-0",
            isIndeterminate && "w-full",
            !isReduced && isIndeterminate && "motion-scan-shimmer bg-gradient-to-r from-peach/30 via-peach to-peach/30"
          )}
          style={
            isIndeterminate
              ? undefined
              : { width: `${clampedProgress}%` }
          }
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs min-h-[1.25rem]">
        {phase === "uploading" && (
          <span className="text-ink-muted flex items-center gap-1">
            <Loader2 className={cn("size-3 shrink-0", !isReduced && "animate-spin")} />
            Uploading file payload to secure clinical store...
          </span>
        )}
        {phase === "transcribing" && (
          <span className="text-olive flex items-center gap-1 font-medium">
            <Sparkles className="size-3 shrink-0" />
            Analyzing lab report structure and extracting clinical values...
          </span>
        )}
        {phase === "complete" && (
          <span className="text-olive flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-3.5 shrink-0" />
            Document verified and parsed successfully
          </span>
        )}
        {phase === "error" && (
          <span className="text-brick font-medium">
            {errorText || "Upload processing error"}
          </span>
        )}
      </div>
    </div>
  );
});
