import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, ToastMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

export type ToastTone = "done" | "info" | "error";

export interface ToastData {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const TONE = {
  done: { Icon: CircleCheck, className: "text-done" },
  info: { Icon: Info, className: "text-info" },
  error: { Icon: TriangleAlert, className: "text-overdue" },
} as const;

const DURATION_MS = 5000;

/** One toast at a time: a new one replaces the old. */
export function usePatientToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const seq = useRef(0);
  const show = useCallback((next: Omit<ToastData, "id">) => {
    seq.current += 1;
    setToast({ ...next, id: seq.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

export interface PatientToastRegionProps {
  toast: ToastData | null;
  onDismiss: () => void;
  className?: string;
}

/**
 * Toast host (DESIGN.md Components: Toast). Surface-2 clay-3, status icon, title, body, close 44.
 * Sits above the floating tab bar on phones. Two persistent live regions: status (polite) for
 * confirmations, alert for errors, so announcements never depend on mount timing.
 * Auto-dismiss after 5 s, paused while hovered or focused. Never steals focus.
 */
export function PatientToastRegion({ toast, onDismiss, className }: PatientToastRegionProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(onDismiss, DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  useEffect(() => setPaused(false), [toast?.id]);

  const render = (tone: "polite" | "alert") => {
    const mine = toast && (tone === "alert" ? toast.tone === "error" : toast.tone !== "error") ? toast : null;
    return (
      <div role={tone === "alert" ? "alert" : "status"} className="flex flex-col">
        <AnimatePresence>
          {mine ? (
            <ToastMotion
              key={mine.id}
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
              className="clay-3 pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-surface-2 py-3 pl-4 pr-1.5 text-ink lg:w-[360px]"
            >
              <ToneIcon tone={mine.tone} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
                <p className="type-body font-bold">{mine.title}</p>
                {mine.body ? <p className="type-body-sm text-ink-muted">{mine.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close"
                className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
              >
                <X aria-hidden className="size-5" strokeWidth={1.75} />
              </button>
            </ToastMotion>
          ) : null}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-4 z-50 mx-auto flex max-w-[480px] flex-col items-stretch gap-2",
        "bottom-[calc(64px+12px+12px+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:max-w-none",
        className,
      )}
    >
      {render("polite")}
      {render("alert")}
    </div>
  );
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  const { Icon, className } = TONE[tone];
  return <Icon aria-hidden className={cn("mt-1.5 size-5 shrink-0", className)} strokeWidth={1.75} />;
}
