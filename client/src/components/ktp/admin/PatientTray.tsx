import type { ReactNode } from "react";
import { CalendarClock, FileClock, FlaskConical, MessageSquare, Pill, ScanLine, Syringe, TestTubes } from "lucide-react";
import { ClayAvatarPair, StatusChip, type ChipStatus } from "@/components/clay";
import { CountUp, MotionClayCell, StaggerTray } from "@/components/motion";
import {
  SERVICE_TYPE_LABEL,
  patientDisplayName,
  type Appointment,
  type AppointmentResponse,
  type ClaimStatus,
  type DueState,
  type Patient,
  type ServiceTracker,
  type ServiceType,
} from "@/pages/preview/mock";
import { fmtDate, fmtDayMonth, fmtTime, fmtWeekday } from "./format";

/*
 * The patient's Nine-Cell Tray (DESIGN.md Screens 4): the logo with this patient at its center.
 * The four tracked services fill the top, the recipient and donor link holds the center (people,
 * sage), and appointments, claims, lab flags, and messages close the grid. Every cell opens the
 * matching tab.
 */

const I = { strokeWidth: 1.75 } as const;

const SERVICE_ICON: Record<ServiceType, ReactNode> = {
  Meds: <Pill {...I} />,
  Laboratory: <TestTubes {...I} />,
  Tacro: <Syringe {...I} />,
  XrayUsd: <ScanLine {...I} />,
};

export const DUE_CHIP: Record<DueState, ChipStatus> = { Overdue: "overdue", DueSoon: "due-soon", Upcoming: "upcoming" };
export const DUE_LABEL: Record<DueState, string> = { Overdue: "Overdue", DueSoon: "Due soon", Upcoming: "Upcoming" };
export const CLAIM_CHIP: Record<ClaimStatus, ChipStatus> = {
  Filed: "filed",
  Overdue: "overdue",
  DueSoon: "due-soon",
  Open: "open",
  None: "planned",
};
export const CLAIM_LABEL: Record<ClaimStatus, string> = {
  Filed: "Filed",
  Overdue: "Overdue",
  DueSoon: "Due soon",
  Open: "Open",
  None: "No deadline",
};
export const RESPONSE_CHIP: Record<AppointmentResponse, { status: ChipStatus; label: string }> = {
  Pending: { status: "planned", label: "Awaiting reply" },
  Confirmed: { status: "done", label: "Confirmed" },
  RescheduleRequested: { status: "info", label: "Reschedule requested" },
};

export type TrayTarget =
  | { tab: "tracker"; service?: ServiceType }
  | { tab: "labs" | "appointments" | "messages" }
  | { linked: Patient };

export interface PatientTrayProps {
  patient: Patient;
  linked: Patient | null;
  trackers: ServiceTracker[];
  nextAppointment: Appointment | null;
  claims: { unfiled: number; overdue: number; dueSoon: number };
  labFlags: { flagged: number; total: number; latestDate: string | null };
  messages: { unread: number; acknowledged: number; total: number };
  onOpen: (target: TrayTarget) => void;
}

/** A small label over a data-lg line, set as the cell value so it sits on the cell's baseline. */
function Stacked({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <span className="block">
      <span className="type-label block text-ink-muted">{caption}</span>
      <span className="type-data-lg block">{children}</span>
    </span>
  );
}

export function PatientTray({ patient, linked, trackers, nextAppointment, claims, labFlags, messages, onOpen }: PatientTrayProps) {
  const serviceCells = trackers.map((t) => {
    const label = SERVICE_TYPE_LABEL[t.serviceType];
    const next = t.nextPlanned;
    const last = t.lastDone;
    const aria = `${label}: last done ${last?.serviceDate ? fmtDate(last.serviceDate) : "Not set"}, next due ${next ? fmtDate(next.dueDate) : "Not set"}${t.nextDueState ? `, ${DUE_LABEL[t.nextDueState]}` : ""}, claim ${t.lastDoneClaim ? CLAIM_LABEL[t.lastDoneClaim] : "Not set"}. Open tracker.`;
    return (
      <MotionClayCell
        key={t.serviceType}
        label={label}
        icon={SERVICE_ICON[t.serviceType]}
        value={<Stacked caption="Next due">{next ? fmtDayMonth(next.dueDate) : "Not set"}</Stacked>}
        valueTone={t.nextDueState === "Overdue" ? "overdue" : "ink"}
        sub={last?.serviceDate ? `Last ${fmtDayMonth(last.serviceDate)}` : "Not done yet"}
        status={t.nextDueState ? <StatusChip status={DUE_CHIP[t.nextDueState]} label={DUE_LABEL[t.nextDueState]} /> : undefined}
        aria-label={aria}
        onClick={() => onOpen({ tab: "tracker", service: t.serviceType })}
      />
    );
  });

  const recipient = patient.patientType === "Recipient" ? patient : linked;
  const donor = patient.patientType === "Recipient" ? linked : patient;
  const center =
    linked && recipient && donor ? (
      <MotionClayCell
        key="center"
        center
        label={patient.patientType === "Recipient" ? "Linked donor" : "Linked recipient"}
        aria-label={`Open profile of ${linked.lastName}, ${linked.firstName}, ${linked.hrn}`}
        onClick={() => onOpen({ linked })}
      >
        <span className="mt-auto flex flex-col gap-2">
          <ClayAvatarPair size={40} recipient={{ name: patientDisplayName(recipient) }} donor={{ name: patientDisplayName(donor) }} aria-hidden role={undefined} aria-label={undefined} />
          <span className="flex flex-col">
            <span className="type-body font-bold text-sage-deep">{patientDisplayName(linked)}</span>
            <span className="type-data text-ink-muted">{linked.hrn}</span>
          </span>
        </span>
      </MotionClayCell>
    ) : (
      <MotionClayCell key="center" center as="div" label="Linked donor" sub="Not set" />
    );

  const response = nextAppointment ? RESPONSE_CHIP[nextAppointment.response] : null;
  const claimChip =
    claims.overdue > 0 ? (
      <StatusChip status="overdue" label={`${claims.overdue} overdue`} srContext="Claims:" />
    ) : claims.dueSoon > 0 ? (
      <StatusChip status="due-soon" label={`${claims.dueSoon} due soon`} srContext="Claims:" />
    ) : (
      <StatusChip status="done" label="Clear" />
    );

  return (
    <StaggerTray label="Patient summary" layout="3x3">
      {serviceCells.slice(0, 3)}
      {serviceCells[3]}
      {center}
      <MotionClayCell
        key="appt"
        label="Next appointment"
        icon={<CalendarClock {...I} />}
        value={nextAppointment ? <span className="type-data-lg block">{fmtWeekday(nextAppointment.startsAt)}</span> : undefined}
        sub={nextAppointment ? `${fmtTime(nextAppointment.startsAt)}, ${nextAppointment.location}` : "No upcoming appointments."}
        status={response ? <StatusChip status={response.status} label={response.label} /> : undefined}
        aria-label={
          nextAppointment
            ? `Next appointment: ${nextAppointment.title}, ${fmtWeekday(nextAppointment.startsAt)} at ${fmtTime(nextAppointment.startsAt)}, ${response?.label}. Open appointments.`
            : "Next appointment: none. Open appointments."
        }
        onClick={() => onOpen({ tab: "appointments" })}
      />
      <MotionClayCell
        key="claims"
        label="Claims"
        icon={<FileClock {...I} />}
        value={<CountUp value={claims.unfiled} />}
        unit="unfiled"
        valueTone={claims.unfiled === 0 ? "muted" : "ink"}
        status={claimChip}
        aria-label={`Claims: ${claims.unfiled} unfiled, ${claims.overdue} overdue. Open tracker.`}
        onClick={() => onOpen({ tab: "tracker" })}
      />
      <MotionClayCell
        key="flags"
        label="Lab flags"
        icon={<FlaskConical {...I} />}
        value={<CountUp value={labFlags.flagged} />}
        unit={`of ${labFlags.total} latest`}
        valueTone={labFlags.flagged === 0 ? "muted" : "ink"}
        sub={labFlags.latestDate ? `Latest ${fmtDayMonth(labFlags.latestDate)}` : undefined}
        status={labFlags.flagged === 0 ? <StatusChip status="lab-normal" /> : <StatusChip status="lab-high" label={`${labFlags.flagged} out of range`} />}
        aria-label={`Lab flags: ${labFlags.flagged} of ${labFlags.total} latest results out of range. Open labs.`}
        onClick={() => onOpen({ tab: "labs" })}
      />
      <MotionClayCell
        key="messages"
        label="Messages"
        icon={<MessageSquare {...I} />}
        value={<CountUp value={messages.unread} />}
        unit="unread"
        valueTone={messages.unread === 0 ? "muted" : "ink"}
        sub={`${messages.acknowledged} of ${messages.total} acknowledged`}
        aria-label={`Messages: ${messages.unread} unread, ${messages.acknowledged} of ${messages.total} acknowledged. Open messages.`}
        onClick={() => onOpen({ tab: "messages" })}
      />
    </StaggerTray>
  );
}
