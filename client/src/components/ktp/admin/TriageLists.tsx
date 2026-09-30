import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ClayAvatar, StatusChip } from "@/components/clay";
import { MotionClayButton, StaggerItem, StaggerList } from "@/components/motion";
import {
  SERVICE_TYPE_LABEL,
  STAGE_ADMIN_LABEL,
  daysSinceSurgery,
  patientDisplayName,
  type ClaimDueRow,
  type OverdueServiceRow,
  type Patient,
  type RescheduleRow,
  type ServiceRecord,
  type SupersededUnfiledRow,
} from "@/pages/preview/mock";
import { fmtDate, fmtTime, fmtWeekday, overdueBy, timeLeft } from "./format";
import type { DueSoonRow } from "./triage";

/*
 * Triage lists (COPY.md "Action lists"). Flat rows on the panel card (Flat Data Rule): hairline
 * dividers, 2 to 3 lines, avatar, then one action with a full 44 px hit area.
 */

export const REPEAT_REASON_LABEL = {
  Hemolyzed: "Hemolyzed",
  Clotted: "Clotted",
  WrongTroughTiming: "Wrong trough timing",
  LabError: "Lab error",
  DoctorRequest: "Doctor request",
  Other: "Other",
} as const;

/** "Tacro test" or "Laboratory, Monthly panel (repeat)". */
export function serviceLabel(record: ServiceRecord): string {
  const type = SERVICE_TYPE_LABEL[record.serviceType];
  // "Tacro trough" under "Tacro test" adds nothing; "Monthly panel" under "Laboratory" does.
  const redundant = record.label.toLowerCase().startsWith(type.split(" ")[0].toLowerCase());
  const base = redundant ? type : `${type}, ${record.label}`;
  return record.repeatOfId ? `${base} (repeat)` : base;
}

export interface RowActions {
  onOpenPatient: (patient: Patient) => void;
  onMarkFiled: (patient: Patient, record: ServiceRecord) => void;
  onSetNewTime: (row: RescheduleRow) => void;
}

function Row({
  patient,
  line2,
  line3,
  quote,
  action,
}: {
  patient: Patient;
  line2: ReactNode;
  line3?: ReactNode;
  quote?: string | null;
  action: ReactNode;
}) {
  return (
    <StaggerItem as="li" className="border-b border-hairline last:border-b-0">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 py-3">
        <ClayAvatar
          decorative
          name={patientDisplayName(patient)}
          kind={patient.patientType === "Recipient" ? "recipient" : "donor"}
          size={40}
          className="self-start"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="type-body font-bold text-ink">{patientDisplayName(patient)}</span>
            <span className="type-data text-ink-muted">{patient.hrn}</span>
          </p>
          <p className="type-body-sm text-ink">{line2}</p>
          {line3 ? <div className="type-body-sm flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">{line3}</div> : null}
          {quote ? (
            <blockquote className="type-body-sm mt-1 rounded-sm bg-row-hover px-3 py-2 text-ink">
              <span className="sr-only">Patient note: </span>
              {quote}
            </blockquote>
          ) : null}
        </div>
        <div className="self-center">{action}</div>
      </div>
    </StaggerItem>
  );
}

function OpenButton({ patient, onOpen, profile = false }: { patient: Patient; onOpen: (p: Patient) => void; profile?: boolean }) {
  return (
    <MotionClayButton
      variant="icon"
      size="sm"
      aria-label={
        profile
          ? `Open profile of ${patient.lastName}, ${patient.firstName}, ${patient.hrn}`
          : `Open tracker for ${patient.lastName}, ${patient.firstName}`
      }
      onClick={() => onOpen(patient)}
    >
      <ChevronRight strokeWidth={1.75} />
    </MotionClayButton>
  );
}

function List({ label, children }: { label: string; children: ReactNode }) {
  return (
    <StaggerList as="ul" aria-label={label} className="flex flex-col">
      {children}
    </StaggerList>
  );
}

export function OverdueList({ rows, actions }: { rows: OverdueServiceRow[]; actions: RowActions }) {
  return (
    <List label="Overdue services">
      {rows.map(({ patient, record, daysOverdue }) => (
        <Row
          key={record.id}
          patient={patient}
          line2={serviceLabel(record)}
          line3={
            <>
              <span className="type-data">Due {fmtDate(record.dueDate)}</span>
              <StatusChip status="overdue" label={overdueBy(daysOverdue)} srContext="Overdue by" />
            </>
          }
          action={<OpenButton patient={patient} onOpen={actions.onOpenPatient} />}
        />
      ))}
    </List>
  );
}

function MarkFiledButton({ patient, record, onMarkFiled }: { patient: Patient; record: ServiceRecord; onMarkFiled: RowActions["onMarkFiled"] }) {
  return (
    <MotionClayButton
      variant="secondary"
      size="sm"
      aria-label={`Mark claim filed: ${serviceLabel(record)}, ${patient.lastName}, ${patient.firstName}`}
      onClick={() => onMarkFiled(patient, record)}
    >
      Mark filed
    </MotionClayButton>
  );
}

export function ClaimsDueList({ rows, actions }: { rows: ClaimDueRow[]; actions: RowActions }) {
  return (
    <List label="Claims due within 7 days">
      {rows.map(({ patient, record, daysLeft }) => (
        <Row
          key={record.id}
          patient={patient}
          line2={serviceLabel(record)}
          line3={
            <>
              <span className="type-data">Deadline {fmtDate(record.claimDeadline)}</span>
              <StatusChip status="due-soon" label={timeLeft(daysLeft)} srContext="Time left:" />
            </>
          }
          action={<MarkFiledButton patient={patient} record={record} onMarkFiled={actions.onMarkFiled} />}
        />
      ))}
    </List>
  );
}

export function RescheduleList({ rows, actions }: { rows: RescheduleRow[]; actions: RowActions }) {
  return (
    <List label="Reschedule requests">
      {rows.map((row) => {
        const { patient, appointment } = row;
        return (
          <Row
            key={appointment.id}
            patient={patient}
            line2={appointment.title}
            line3={
              <>
                <span className="type-data">
                  {fmtWeekday(appointment.startsAt)}, {fmtTime(appointment.startsAt)}
                </span>
                {appointment.respondedAt ? (
                  <span className="type-data">requested {fmtDate(appointment.respondedAt)}</span>
                ) : null}
              </>
            }
            quote={appointment.responseNote}
            action={
              <MotionClayButton
                variant="secondary"
                size="sm"
                aria-label={`Set new time: ${appointment.title}, ${patient.lastName}, ${patient.firstName}`}
                onClick={() => actions.onSetNewTime(row)}
              >
                Set new time
              </MotionClayButton>
            }
          />
        );
      })}
    </List>
  );
}

export function SupersededClaimsList({ rows, actions }: { rows: SupersededUnfiledRow[]; actions: RowActions }) {
  return (
    <List label="Superseded, claim not filed">
      {rows.map(({ patient, record }) => (
        <Row
          key={record.id}
          patient={patient}
          line2={serviceLabel(record)}
          line3={
            <>
              <StatusChip status="superseded" />
              <span className="type-data">{fmtDate(record.serviceDate)}</span>
              <span>{record.repeatReason ? REPEAT_REASON_LABEL[record.repeatReason] : null}</span>
              <span className="type-data">deadline {fmtDate(record.claimDeadline)}</span>
            </>
          }
          action={<MarkFiledButton patient={patient} record={record} onMarkFiled={actions.onMarkFiled} />}
        />
      ))}
    </List>
  );
}

export function DueSoonList({ rows, actions }: { rows: DueSoonRow[]; actions: RowActions }) {
  return (
    <List label="Services due in 7 days">
      {rows.map(({ patient, record, daysLeft }) => (
        <Row
          key={record.id}
          patient={patient}
          line2={serviceLabel(record)}
          line3={
            <>
              <span className="type-data">Due {fmtDate(record.dueDate)}</span>
              <StatusChip status="due-soon" label={timeLeft(daysLeft)} srContext="Due soon:" />
            </>
          }
          action={<OpenButton patient={patient} onOpen={actions.onOpenPatient} />}
        />
      ))}
    </List>
  );
}

export function PatientList({ patients, label, actions }: { patients: Patient[]; label: string; actions: RowActions }) {
  return (
    <List label={label}>
      {patients.map((patient) => {
        const day = daysSinceSurgery(patient);
        return (
          <Row
            key={patient.id}
            patient={patient}
            line2={`${patient.patientType}, ${STAGE_ADMIN_LABEL[patient.stage]}`}
            line3={
              day !== null ? (
                <span className="type-data">
                  {patient.patientType === "Recipient" ? "Post-KT" : "Post-donation"} day {day}
                </span>
              ) : (
                <span className="type-data">
                  {patient.age} y, {patient.sex}
                </span>
              )
            }
            action={<OpenButton profile patient={patient} onOpen={actions.onOpenPatient} />}
          />
        );
      })}
    </List>
  );
}
