import { CalendarClock, ClipboardCheck, History, MailCheck, MailOpen, Mail } from "lucide-react";
import { ClayCardEmpty, StatusChip } from "@/components/clay";
import { MotionClayButton, StaggerItem, StaggerList } from "@/components/motion";
import { MOCK_TODAY, type Appointment, type Message, type Patient } from "@/pages/preview/mock";
import { fmtDate, fmtTime, fmtWeekday } from "./format";
import { RESPONSE_CHIP } from "./PatientTray";
import type { ServiceAction } from "./ServiceActionDialog";

/*
 * The quieter profile tabs: appointments, sent messages, checklist, and history. Flat rows inside
 * the tab card; a designed empty state where the sample has no records.
 */

const I = { strokeWidth: 1.75 } as const;

export function AppointmentsPanel({
  patient,
  appointments,
  onAction,
}: {
  patient: Patient;
  appointments: Appointment[];
  onAction: (a: ServiceAction) => void;
}) {
  if (appointments.length === 0) return <ClayCardEmpty message="No upcoming appointments." />;
  const sorted = [...appointments].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  return (
    <StaggerList as="ul" aria-label="Appointments" className="flex flex-col">
      {sorted.map((a) => {
        const startsAtStr = (a.startsAt as unknown) instanceof Date ? (a.startsAt as unknown as Date).toISOString() : String(a.startsAt);
        const past = startsAtStr.slice(0, 10) < MOCK_TODAY;
        const chip = RESPONSE_CHIP[a.response];
        return (
          <StaggerItem as="li" key={a.id} className="grid gap-x-6 gap-y-2 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center">
            <p className="flex items-center gap-3">
              <CalendarClock aria-hidden className="size-5 shrink-0 text-ink-muted" {...I} />
              <span className="flex flex-col">
                <span className="type-data font-semibold text-ink">{fmtWeekday(a.startsAt)}</span>
                <span className="type-data text-ink-muted">{fmtTime(a.startsAt)}</span>
              </span>
            </p>
            <div className="min-w-0 max-md:pl-8">
              <p className="type-body font-bold text-ink">{a.title}</p>
              <p className="type-body-sm text-ink-muted">{a.location}</p>
              {a.responseNote ? (
                <blockquote className="type-body-sm mt-2 rounded-sm bg-row-hover px-3 py-2 text-ink">
                  <span className="sr-only">Patient note: </span>
                  {a.responseNote}
                </blockquote>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 max-md:pl-8 md:justify-end">
              {past ? <StatusChip status="done" label="Past" /> : <StatusChip status={chip.status} label={chip.label} />}
              {a.response === "RescheduleRequested" && !past ? (
                <MotionClayButton
                  variant="secondary"
                  size="sm"
                  aria-label={`Set new time: ${a.title}, ${patient.lastName}, ${patient.firstName}`}
                  onClick={() => onAction({ kind: "reschedule", patient, appointment: a })}
                >
                  Set new time
                </MotionClayButton>
              ) : null}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}

export function MessagesPanel({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <ClayCardEmpty message="No new messages." />;
  const sorted = [...messages].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  return (
    <StaggerList as="ul" aria-label="Sent messages" className="flex flex-col">
      {sorted.map((m) => {
        const state = m.acknowledgedAt ? "ack" : m.readAt ? "read" : "unread";
        const Icon = state === "ack" ? MailCheck : state === "read" ? MailOpen : Mail;
        return (
          <StaggerItem as="li" key={m.id} className="grid gap-x-6 gap-y-2 border-b border-hairline py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="flex min-w-0 gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" {...I} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="type-body font-bold text-ink">{m.title}</span>
                  <span className="type-data text-ink-muted">
                    {fmtDate(m.sentAt)}, {fmtTime(m.sentAt)}
                  </span>
                </p>
                <p className="type-body-sm mt-1 max-w-[68ch] text-ink">{m.body}</p>
                <p className="type-caption mt-1 text-ink-muted">
                  {m.audience === "AllRecipients" ? "Sent to all recipients" : "Sent to this patient"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-md:pl-8 md:justify-end">
              {state === "ack" ? (
                <StatusChip status="done" label={`Acknowledged ${fmtDate(m.acknowledgedAt)}`} />
              ) : state === "read" ? (
                <StatusChip status="info" label={`Read ${fmtDate(m.readAt)}`} />
              ) : (
                <StatusChip status="planned" label="Not read yet" />
              )}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}

export function ChecklistPanel({ patient }: { patient: Patient }) {
  const post = patient.stage === "PostKT" || patient.stage === "PostDonation";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-ink-muted">
        <ClipboardCheck aria-hidden className="size-5" {...I} />
        <p className="type-body-sm">Pre-KT or pre-donation progress by phase.</p>
      </div>
      <ClayCardEmpty
        message={
          post
            ? "No checklist items in the sample data. This patient is past the work-up stages."
            : "No checklist items in the sample data."
        }
      />
    </div>
  );
}

export function HistoryPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div role="region" aria-label="History" tabIndex={0} className="clay-table-wrap clay-focus -mx-2">
        <table className="clay-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4}>
                <span className="flex items-center gap-2 text-ink-muted">
                  <History aria-hidden className="size-5" {...I} />
                  No changes yet.
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
