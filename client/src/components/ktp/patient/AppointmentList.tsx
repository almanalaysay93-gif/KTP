import { useRef, useState } from "react";
import { CalendarCheck, MapPin } from "lucide-react";
import { StatusChip } from "@/components/clay";
import { MotionClayButton } from "@/components/motion";
import { APPOINTMENT_CHIP, APPOINTMENT_HINT, patientDate, patientTime, relativeDay } from "./format";
import { RescheduleDialog } from "./RescheduleDialog";
import { FlatList, SectionCard } from "./SectionCard";
import type { ActionResult, AppointmentView, SectionState } from "./types";

export interface AppointmentListProps {
  /** Upcoming, not cancelled, soonest first. */
  items: AppointmentView[];
  today: string;
  state?: SectionState;
  onRetry?: () => void;
  onConfirm: (id: string) => Promise<ActionResult>;
  /** Spec 6.6: a reschedule request always carries a note. */
  onRequestNewTime: (id: string, note: string) => Promise<ActionResult>;
  id?: string;
  className?: string;
}

/**
 * Appointments with Confirm and Request new time (spec 6.6). One primary per region: only the
 * first appointment waiting for a reply gets the brick Confirm; any later one gets a secondary.
 */
export function AppointmentList({
  items,
  today,
  state,
  onRetry,
  onConfirm,
  onRequestNewTime,
  id = "appointments",
  className,
}: AppointmentListProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  // A sent request removes its trigger button, so focus lands on that appointment's heading.
  const sentId = useRef<string | null>(null);
  const firstPending = items.find((a) => a.response === "Pending")?.id;
  const rescheduling = items.find((a) => a.id === rescheduleId) ?? null;

  const confirm = async (appointmentId: string) => {
    setConfirming(appointmentId);
    try {
      const result = await onConfirm(appointmentId);
      // Confirm unmounts once the reply is saved: keep focus on this appointment, not the page.
      if (result.ok) requestAnimationFrame(() => document.getElementById(`${id}-${appointmentId}-title`)?.focus());
    } finally {
      setConfirming(null);
    }
  };

  return (
    <SectionCard id={id} title="Appointments" level={2} state={state} onRetry={onRetry} className={className}>
      {items.length === 0 ? (
        <p className="type-body-lg text-ink">No upcoming appointments.</p>
      ) : (
        <>
          <FlatList label="Upcoming appointments">
            {items.map((appt) => {
              const date = patientDate(appt.startsAt, today);
              const time = patientTime(appt.startsAt);
              const chip = APPOINTMENT_CHIP[appt.response];
              const busy = confirming === appt.id;
              return (
                <li key={appt.id} className="flex flex-col gap-2 py-4 first:pt-1 last:pb-1">
                  <h3 id={`${id}-${appt.id}-title`} tabIndex={-1} className="type-title text-ink outline-none">
                    {appt.title}
                  </h3>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="type-data text-ink">
                      {date} at {time}
                    </span>
                    <span className="type-body-sm text-ink-muted">{relativeDay(appt.startsAt, today)}</span>
                  </p>
                  <p className="type-body-sm flex items-center gap-1.5 text-ink-muted">
                    <MapPin aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                    {appt.location}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <StatusChip status={chip.status} label={chip.label} size="patient" srContext={chip.context} />
                    <span className="type-body-sm text-ink-muted">{APPOINTMENT_HINT[appt.response]}</span>
                  </div>
                  {appt.response === "RescheduleRequested" && appt.responseNote ? (
                    <p className="type-body-sm rounded-md bg-row-hover px-3 py-2 text-ink">
                      <span className="font-bold">Your note: </span>
                      {appt.responseNote}
                    </p>
                  ) : null}
                  {appt.response !== "RescheduleRequested" ? (
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {appt.response === "Pending" ? (
                        <MotionClayButton
                          variant={appt.id === firstPending ? "primary" : "secondary"}
                          size="lg"
                          icon={<CalendarCheck strokeWidth={1.75} />}
                          loading={busy}
                          disabled={confirming !== null && !busy}
                          aria-label={`Confirm ${appt.title} on ${date} at ${time}`}
                          onClick={() => confirm(appt.id)}
                          className="w-full sm:w-auto"
                        >
                          Confirm
                        </MotionClayButton>
                      ) : null}
                      <MotionClayButton
                        variant="ghost"
                        size="lg"
                        disabled={busy}
                        aria-label={`Request new time for ${appt.title} on ${date}`}
                        aria-haspopup="dialog"
                        onClick={() => setRescheduleId(appt.id)}
                        className="w-full text-brick sm:w-auto sm:first:-ml-6"
                      >
                        Request new time
                      </MotionClayButton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </FlatList>
          <p className="type-body-sm mt-3 text-ink-muted">You will get a reminder 1 day before.</p>
        </>
      )}
      <RescheduleDialog
        appointment={rescheduling}
        today={today}
        onOpenChange={(open) => {
          if (!open) setRescheduleId(null);
        }}
        onSend={async (note) => {
          if (!rescheduling) return { ok: false };
          const result = await onRequestNewTime(rescheduling.id, note);
          if (result.ok) sentId.current = rescheduling.id;
          return result;
        }}
        onCloseAutoFocus={(event) => {
          if (!sentId.current) return;
          event.preventDefault();
          document.getElementById(`${id}-${sentId.current}-title`)?.focus();
          sentId.current = null;
        }}
      />
    </SectionCard>
  );
}
