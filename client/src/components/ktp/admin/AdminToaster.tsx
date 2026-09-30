import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, ToastMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

/*
 * Admin toasts (DESIGN.md Components, Toast): surface-2, clay-3, r-xl, 360 wide (full width minus 32 on
 * phones), status icon + title + body + close 44. 5 s, paused while hovered or focused. One persistent
 * polite live region carries every toast so screen readers hear each one once.
 */

export type ToastTone = "done" | "info";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: number;
}

type Push = (toast: ToastInput) => void;

const ToastContext = createContext<Push | null>(null);

const LIFETIME_MS = 5000;
const MAX_TOASTS = 3;

/** Push a toast. Outside a provider it is a no-op, so parts render standalone in tests and style guides. */
export function useAdminToast(): Push {
  return useContext(ToastContext) ?? noop;
}
function noop() {}

/** The line every preview save toast carries: nothing is written anywhere. */
export const PREVIEW_NOTE = "Preview only. Nothing was saved.";

export function AdminToaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>((toast) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...toast, id }].slice(-MAX_TOASTS));
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(LIFETIME_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, onDismiss, toast.id]);

  const Icon = toast.tone === "done" ? CircleCheck : Info;

  return (
    <ToastMotion
      layout="position"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="clay-3 pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-surface-2 py-3 pl-4 pr-2 text-ink sm:w-[360px]"
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn("mt-0.5 size-5 shrink-0", toast.tone === "done" ? "text-done" : "text-info")}
      />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="type-body font-bold">{toast.title}</p>
        {toast.body ? <p className="type-body-sm mt-0.5 text-ink-muted">{toast.body}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Close notification"
        onClick={() => onDismiss(toast.id)}
        className="clay-focus inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
      >
        <X aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    </ToastMotion>
  );
}
