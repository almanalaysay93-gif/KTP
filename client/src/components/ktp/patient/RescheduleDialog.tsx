import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { Send, TriangleAlert } from "lucide-react";
import { AnimatePresence, MotionClayButton, V, useMotionPreset } from "@/components/motion";
import { cn } from "@/lib/utils";
import { patientDate, patientTime } from "./format";
import type { ActionResult, AppointmentView } from "./types";

export interface RescheduleDialogProps {
  /** Open while set. */
  appointment: AppointmentView | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSend: (note: string) => Promise<ActionResult>;
  /** Where focus goes on close. Default: back to the trigger (Radix). */
  onCloseAutoFocus?: (event: Event) => void;
}

const NOTE_MISSING = "Please write a short note so the KT unit can find a better time.";
const SEND_FAILED = "We could not send your request. Check your internet, then try again.";

/**
 * "Request a new time" (spec 6.6, COPY.md me.resched). The note is required: an empty send keeps
 * the dialog open, marks the field invalid, announces the message, and moves focus to the field.
 * Radix traps and restores focus; Escape and Cancel close. Scrim is opaque ink, no backdrop blur.
 */
export function RescheduleDialog({ appointment, today, onOpenChange, onSend, onCloseAutoFocus }: RescheduleDialogProps) {
  const preset = useMotionPreset();
  const open = appointment !== null;
  const fieldId = useId();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setError(null);
    setSending(false);
  }, [open, appointment?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setError(NOTE_MISSING);
      noteRef.current?.focus();
      return;
    }
    setError(null);
    setSending(true);
    const result = await onSend(trimmed);
    setSending(false);
    if (result.ok) onOpenChange(false);
    else setError(SEND_FAILED);
  };

  const summary = appointment
    ? `${appointment.title}. ${patientDate(appointment.startsAt, today)} at ${patientTime(appointment.startsAt)}.`
    : "";
  const errorId = `${fieldId}-error`;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: preset.reduced ? 0.15 : 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={`${fieldId}-body`} onCloseAutoFocus={onCloseAutoFocus}>
              <motion.div
                variants={preset.toast}
                initial={V.hidden}
                animate={V.show}
                exit={V.exit}
                className="clay-3 fixed inset-x-4 top-[8dvh] z-50 mx-auto flex max-h-[84dvh] max-w-[440px] flex-col gap-4 overflow-y-auto rounded-xl bg-surface-2 p-5 text-ink sm:p-6"
              >
                <Dialog.Title className="type-headline">Request a new time</Dialog.Title>
                <div id={`${fieldId}-body`} className="flex flex-col gap-1">
                  <p className="type-body-lg">Tell the KT unit which days or times work better for you.</p>
                  <p className="type-body-sm text-ink-muted">{summary}</p>
                </div>
                <form noValidate onSubmit={submit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor={fieldId} className="type-field-label">
                      Your note <span className="font-normal text-ink-muted">Required</span>
                    </label>
                    <textarea
                      ref={noteRef}
                      id={fieldId}
                      name="note"
                      rows={4}
                      required
                      value={note}
                      disabled={sending}
                      onChange={(e) => {
                        setNote(e.target.value);
                        if (error === NOTE_MISSING && e.target.value.trim()) setError(null);
                      }}
                      placeholder="Example: I can come on Monday or Tuesday morning."
                      aria-invalid={error === NOTE_MISSING || undefined}
                      aria-describedby={error ? errorId : undefined}
                      className={cn(
                        "clay-sunken clay-focus type-body-lg block min-h-32 w-full resize-y rounded-sm border-[1.5px] border-line-strong px-3.5 py-3 text-ink",
                        "transition-colors duration-(--dur-color) placeholder:text-ink-muted hover:border-ink focus-visible:border-ink",
                        "disabled:cursor-not-allowed disabled:border-hairline disabled:bg-ground disabled:text-line-strong",
                        "aria-invalid:border-2 aria-invalid:border-overdue",
                      )}
                    />
                    <p id={errorId} role="alert" className="type-body-sm flex min-h-0 items-start gap-1.5 text-overdue empty:hidden">
                      {error ? (
                        <>
                          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                          <span>{error}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Dialog.Close asChild>
                      <MotionClayButton variant="ghost" size="lg" disabled={sending} className="w-full sm:w-auto">
                        Cancel
                      </MotionClayButton>
                    </Dialog.Close>
                    <MotionClayButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={sending}
                      icon={<Send strokeWidth={1.75} />}
                      className="w-full sm:w-auto"
                    >
                      {sending ? "Sending..." : "Send request"}
                    </MotionClayButton>
                  </div>
                </form>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
