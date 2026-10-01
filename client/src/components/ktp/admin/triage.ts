import { STAGE_ADMIN_LABEL } from "@/lib/ktpLabels";
import { daysSinceSurgery, patientDisplayName } from "@/lib/ktpPatientView";
import { dateKey } from "@shared/ktp";
/*
 * Triage model for the admin dashboard: the nine tray cells, what each one filters, and the rows
 * behind it. Callers supply an explicit dataset and calendar date.
 */
import {
  type DashboardAggregates,
  type MockDataset,
  type Patient,
  type PatientStage,
  type PatientType,
  type ServiceRecord,
} from "@/lib/ktpViewTypes";

export type TriageCellId =
  | "overdue"
  | "claims"
  | "reschedule"
  | "superseded"
  | "active"
  | "dueSoon"
  | "workup"
  | "postkt"
  | "donors";

/** Row-major tray order. Index 4 is the center cell (people, never an alarm). */
export const TRIAGE_ORDER: readonly TriageCellId[] = [
  "overdue",
  "claims",
  "reschedule",
  "superseded",
  "active",
  "dueSoon",
  "workup",
  "postkt",
  "donors",
];

export type TriageSelection =
  | { kind: "cell"; id: TriageCellId }
  | { kind: "stage"; patientType: PatientType; stage: PatientStage };

export interface DueSoonRow {
  patient: Patient;
  record: ServiceRecord;
  daysLeft: number;
}

/** Planned services due from today to today + 7 (spec 6.7 admin digest). */
export function servicesDueSoon(
  data: MockDataset,
  today: string
): DueSoonRow[] {
  const active = new Map(
    data.patients.filter(p => p.status === "Active").map(p => [p.id, p])
  );
  return data.serviceRecords
    .flatMap(record => {
      const patient = active.get(record.patientId);
      if (
        !patient ||
        record.status !== "Planned" ||
        !dateKey(record.dueDate) ||
        !Number.isFinite(diffDays(record.dueDate, today)) ||
        diffDays(record.dueDate, today) < 0 ||
        diffDays(record.dueDate, today) > 7
      )
        return [];
      return [{ patient, record, daysLeft: diffDays(record.dueDate, today) }];
    })
    .sort(
      (a, b) => a.daysLeft - b.daysLeft || (a.record.id < b.record.id ? -1 : 1)
    );
}

function activePatients(data: MockDataset) {
  return data.patients.filter(p => p.status === "Active");
}

/** Patients behind a people cell or a stage rail segment, sorted by name. */
export function patientsFor(
  selection: TriageSelection,
  data: MockDataset
): Patient[] {
  const active = activePatients(data);
  let list: Patient[];
  if (selection.kind === "stage") {
    list = active.filter(
      p =>
        p.patientType === selection.patientType && p.stage === selection.stage
    );
  } else {
    switch (selection.id) {
      case "workup":
        list = active.filter(
          p => p.patientType === "Recipient" && p.stage !== "PostKT"
        );
        break;
      case "postkt":
        list = active.filter(
          p => p.patientType === "Recipient" && p.stage === "PostKT"
        );
        break;
      case "donors":
        list = active.filter(p => p.patientType === "Donor");
        break;
      default:
        list = active;
    }
  }
  return [...list].sort((a, b) =>
    patientDisplayName(a).localeCompare(patientDisplayName(b))
  );
}

export function isPeopleCell(id: TriageCellId) {
  return (
    id === "active" || id === "workup" || id === "postkt" || id === "donors"
  );
}

export interface TriageCounts {
  overdue: number;
  claims: number;
  reschedule: number;
  superseded: number;
  active: number;
  dueSoon: number;
  workup: number;
  postkt: number;
  donors: number;
  recipients: number;
  /** Oldest overdue, in days. */
  oldestOverdue: number | null;
  /** Earliest unfiled claim deadline within 7 days. */
  nextClaimDeadline: string | null;
  /** Days since the oldest open reschedule request. */
  oldestReschedule: number | null;
  nextSupersededDeadline: string | null;
  nextDueSoon: string | null;
  workupStages: number;
  /** Fewest days since transplant among Post-KT recipients. */
  newestPostKtDay: number | null;
  donorsWorkup: number;
  donorsPost: number;
}

export function triageCounts(
  agg: DashboardAggregates,
  data: MockDataset,
  today: string
): TriageCounts {
  const due = servicesDueSoon(data, today);
  const workup = patientsFor({ kind: "cell", id: "workup" }, data);
  const postkt = patientsFor({ kind: "cell", id: "postkt" }, data);
  const donors = patientsFor({ kind: "cell", id: "donors" }, data);
  const postDays = postkt
    .map(p => daysSinceSurgery(p, today))
    .filter((d): d is number => d !== null);
  const reschedDays = agg.rescheduleRequests
    .map(r =>
      r.appointment.respondedAt
        ? diffDays(today, r.appointment.respondedAt)
        : null
    )
    .filter((d): d is number => d !== null);

  return {
    overdue: agg.overdueServices.length,
    claims: agg.claimsDueSoon.length,
    reschedule: agg.rescheduleRequests.length,
    superseded: agg.supersededUnfiled.length,
    active: agg.activeCount,
    dueSoon: due.length,
    workup: workup.length,
    postkt: postkt.length,
    donors: donors.length,
    recipients: agg.recipientCount,
    oldestOverdue: agg.overdueServices[0]?.daysOverdue ?? null,
    nextClaimDeadline: agg.claimsDueSoon[0]?.record.claimDeadline ?? null,
    oldestReschedule: reschedDays.length ? Math.max(...reschedDays) : null,
    nextSupersededDeadline:
      agg.supersededUnfiled[0]?.record.claimDeadline ?? null,
    nextDueSoon: due[0]?.record.dueDate ?? null,
    workupStages: new Set(workup.map(p => p.stage)).size,
    newestPostKtDay: postDays.length ? Math.min(...postDays) : null,
    donorsWorkup: donors.filter(p => p.stage !== "PostDonation").length,
    donorsPost: donors.filter(p => p.stage === "PostDonation").length,
  };
}

/** Case-insensitive match on "Last, First M." and HRN. */
export function matchesQuery(patient: Patient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    patient.firstName.toLowerCase().includes(q) ||
    patient.lastName.toLowerCase().includes(q) ||
    patient.hrn.toLowerCase().includes(q)
  );
}

export function stageTitle(
  patientType: PatientType,
  stage: PatientStage
): string {
  return `${STAGE_ADMIN_LABEL[stage]}, ${patientType === "Recipient" ? "recipients" : "donors"}`;
}

function diffDays(a: string, b: string) {
  return (Date.parse(dateKey(a)) - Date.parse(dateKey(b))) / 86_400_000;
}
