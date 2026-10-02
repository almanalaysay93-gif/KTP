import { useRef, type ReactNode, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, type Variants } from "framer-motion";
import { X } from "lucide-react";
import { AnimatePresence, SPRINGS, useMotionMode } from "@/components/motion";
import { cn } from "@/lib/utils";

/*
 * Clay dialog (level 3, r-xl, surface-2) on a 50% ink scrim. Radix traps and restores focus and
 * closes on Escape. Admin: rises from scale 0.96 and y 12 on `pop`, exits in 120 ms. Reduced: fades.
 * Modals stay centered (not origin-aware). On phones the dialog becomes a bottom sheet.
 */

export interface ClayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row. The first focusable field gets focus on open (Radix default). */
  footer?: ReactNode;
  className?: string;
  /** Gets focus on close when the control that opened the dialog is gone. */
  fallbackFocus?: RefObject<HTMLElement | null>;
}

const FULL: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: { ...SPRINGS.pop, opacity: { duration: 0.2 } } },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] } },
};
const FADE: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15, ease: "linear" } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: "linear" } },
};
const SCRIM_FULL: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export function ClayDialog({ open, onOpenChange, title, description, children, footer, className, fallbackFocus }: ClayDialogProps) {
  // The dialog has no Radix trigger, so it keeps the control that had focus when it opened.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  const mode = useMotionMode();
  const panel = mode === "reduced" ? FADE : FULL;
  const scrim = mode === "reduced" ? FADE : SCRIM_FULL;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                variants={scrim}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-40 bg-ink/50"
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
              <DialogPrimitive.Content
                asChild
                forceMount
                onCloseAutoFocus={event => {
                  event.preventDefault();
                  const target = opener.current?.isConnected ? opener.current : fallbackFocus?.current;
                  target?.focus();
                }}
              >
                <motion.div
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className={cn(
                    "clay-3 pointer-events-auto flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-t-xl bg-surface-2 text-ink sm:max-h-[calc(100dvh-48px)] sm:max-w-[560px] sm:rounded-xl",
                    className,
                  )}
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="type-headline text-ink">{title}</DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="type-body mt-1.5 text-ink-muted">
                          {description}
                        </DialogPrimitive.Description>
                      ) : (
                        <DialogPrimitive.Description className="sr-only">Preview form</DialogPrimitive.Description>
                      )}
                    </div>
                    <DialogPrimitive.Close
                      aria-label="Close dialog"
                      className="clay-focus -mr-2 -mt-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-(--dur-color) hover:bg-sunken/60 hover:text-ink"
                    >
                      <X aria-hidden className="size-5" strokeWidth={1.75} />
                    </DialogPrimitive.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
                  {footer ? (
                    <div className="flex flex-wrap-reverse items-center justify-end gap-3 border-t border-hairline px-5 py-4 sm:px-6">
                      {footer}
                    </div>
                  ) : null}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
