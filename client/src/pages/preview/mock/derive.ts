// Pure derivations over the fictional dataset. All "today" math is relative to
// the `today` argument, which defaults to MOCK_TODAY (spec 6.5, 6.7).

import { datePart, diffDays } from "./dates";
import { MOCK_DATASET, MOCK_TODAY } from "./data";
import { DONOR_STAGES, RECIPIENT_STAGES, SERVICE_TYPES, STAGE_ADMIN_LABEL } from "./labels";
import type {
  ClaimStatus,
  DashboardAggregates,
  DueState,
  LabPoint,
  LabSeries,
  MockDataset,
  Patient,
  PatientStage,
  ServiceRecord,
  ServiceTracker,
  ServiceType,
  StageCount,
} from "./types";

const SOON_DAYS = 7;

/** Spec 6.5. Filed wins, then Overdue, DueSoon (today to today + 7), Open, None. */
export function claimStatus(
  record: Pick<ServiceRecord, "claimDeadline" | "claimFiledDate">,
  today: string = MOCK_TODAY,
): ClaimStatus {
  if (record.claimFiledDate) return "Filed";
  if (!record.claimDeadline) return "None";
  const daysLeft = diffDays(record.claimDeadline, today);
  if (daysLeft < 0) return "Overdue";
  if (daysLeft <= SOON_DAYS) return "DueSoon";
  return "Open";
}

/** Spec 6.1 and COPY 5.3. Only Planned records have a due state. */
export function dueState(
  record: Pick<ServiceRecord, "status" | "dueDate">,
  today: string = MOCK_TODAY,
): DueState | null {
  if (record.status !== "Planned") return null;
  const daysAway = diffDays(record.dueDate, today);
  if (daysAway < 0) return "Overdue";
  if (daysAway <= SOON_DAYS) return "DueSoon";
  return "Upcoming";
}

/** Whole days from surgery to today, or null when there is no surgery date. */
export function daysSinceSurgery(
  patient: Pick<Patient, "surgeryDate">,
  today: string = MOCK_TODAY,
): number | null {
  return patient.surgeryDate ? diffDays(today, patient.surgeryDate) : null;
}

/** "Villacorta, Analyn F." */
export function patientDisplayName(
  patient: Pick<Patient, "lastName" | "firstName" | "middleName">,
): string {
  const initial = patient.middleName ? ` ${patient.middleName.charAt(0)}.` : "";
  return `${patient.lastName}, ${patient.firstName}${initial}`;
}

export function patientById(id: string, data: MockDataset = MOCK_DATASET): Patient | undefined {
  return data.patients.find((p) => p.id === id);
}

function byServiceDateDesc(a: ServiceRecord, b: ServiceRecord): number {
  const ad = a.serviceDate ?? "";
  const bd = b.serviceDate ?? "";
  if (ad !== bd) return ad < bd ? 1 : -1;
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/** Latest Done record (by service date) and earliest Planned record (by due date). */
export function serviceTracker(
  patientId: string,
  serviceType: ServiceType,
  data: MockDataset = MOCK_DATASET,
  today: string = MOCK_TODAY,
): ServiceTracker {
  const mine = data.serviceRecords.filter(
    (r) => r.patientId === patientId && r.serviceType === serviceType,
  );
  const lastDone = mine.filter((r) => r.status === "Done").sort(byServiceDateDesc)[0] ?? null;
  const nextPlanned =
    mine
      .filter((r) => r.status === "Planned")
      .sort((a, b) => (a.dueDate === b.dueDate ? (a.id < b.id ? -1 : 1) : a.dueDate < b.dueDate ? -1 : 1))[0] ??
    null;
  return {
    serviceType,
    lastDone,
    nextPlanned,
    nextDueState: nextPlanned ? dueState(nextPlanned, today) : null,
    lastDoneClaim: lastDone ? claimStatus(lastDone, today) : null,
  };
}

/** The four tracker cards in display order: Meds, Laboratory, Tacro, X-ray and USD. */
export function serviceTrackers(
  patientId: string,
  data: MockDataset = MOCK_DATASET,
  today: string = MOCK_TODAY,
): ServiceTracker[] {
  return SERVICE_TYPES.map((type) => serviceTracker(patientId, type, data, today));
}

function stageCounts(
  patients: Patient[],
  order: readonly PatientStage[],
): StageCount[] {
  return order.map((stage) => ({
    stage,
    label: STAGE_ADMIN_LABEL[stage],
    count: patients.filter((p) => p.stage === stage).length,
  }));
}

/** Everything the admin dashboard shows, computed from data (spec 7.1). */
export function dashboardAggregates(
  data: MockDataset = MOCK_DATASET,
  today: string = MOCK_TODAY,
): DashboardAggregates {
  const active = data.patients.filter((p) => p.status === "Active");
  const activeById = new Map(active.map((p) => [p.id, p]));
  const recipients = active.filter((p) => p.patientType === "Recipient");
  const donors = active.filter((p) => p.patientType === "Donor");

  const overdueServices = data.serviceRecords
    .flatMap((record) => {
      const patient = activeById.get(record.patientId);
      if (!patient || dueState(record, today) !== "Overdue") return [];
      return [{ patient, record, daysOverdue: diffDays(today, record.dueDate) }];
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || (a.record.id < b.record.id ? -1 : 1));

  const claimsDueSoon = data.serviceRecords
    .flatMap((record) => {
      const patient = activeById.get(record.patientId);
      if (!patient || record.status === "Planned" || claimStatus(record, today) !== "DueSoon") return [];
      return [{ patient, record, daysLeft: diffDays(record.claimDeadline as string, today) }];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft || (a.record.id < b.record.id ? -1 : 1));

  const rescheduleRequests = data.appointments
    .flatMap((appointment) => {
      const patient = activeById.get(appointment.patientId);
      if (!patient || appointment.cancelledAt || appointment.response !== "RescheduleRequested") return [];
      return [{ patient, appointment }];
    })
    .sort((a, b) =>
      (a.appointment.respondedAt ?? "") === (b.appointment.respondedAt ?? "")
        ? (a.appointment.id < b.appointment.id ? -1 : 1)
        : (a.appointment.respondedAt ?? "") < (b.appointment.respondedAt ?? "")
          ? -1
          : 1,
    );

  const supersededUnfiled = data.serviceRecords
    .flatMap((record) => {
      const patient = activeById.get(record.patientId);
      if (!patient || record.status !== "Superseded" || record.claimFiledDate) return [];
      return [{ patient, record }];
    })
    .sort((a, b) => ((a.record.claimDeadline ?? "9999") < (b.record.claimDeadline ?? "9999") ? -1 : 1));

  return {
    activeCount: active.length,
    recipientCount: recipients.length,
    donorCount: donors.length,
    recipientStages: stageCounts(recipients, RECIPIENT_STAGES),
    donorStages: stageCounts(donors, DONOR_STAGES),
    overdueServices,
    claimsDueSoon,
    rescheduleRequests,
    supersededUnfiled,
  };
}

/**
 * Result series for one patient and one lab test, oldest first.
 * Superseded records are left out (spec 6.4) unless `includeSuperseded` is set,
 * which table views use to show them greyed.
 */
export function labSeries(
  patientId: string,
  labTestId: string,
  data: MockDataset = MOCK_DATASET,
  options: { includeSuperseded?: boolean } = {},
): LabSeries | null {
  const test = data.labTests.find((t) => t.id === labTestId);
  if (!test) return null;
  const recordsById = new Map(data.serviceRecords.map((r) => [r.id, r]));
  const points: LabPoint[] = [];
  for (const result of data.labResults) {
    if (result.labTestId !== labTestId) continue;
    const record = recordsById.get(result.serviceRecordId);
    if (!record || record.patientId !== patientId || !record.serviceDate) continue;
    const superseded = record.status === "Superseded";
    if (superseded && !options.includeSuperseded) continue;
    points.push({
      recordId: record.id,
      resultId: result.id,
      date: datePart(record.serviceDate),
      value: result.value,
      flag: result.flag,
      superseded,
    });
  }
  points.sort((a, b) => (a.date === b.date ? (a.recordId < b.recordId ? -1 : 1) : a.date < b.date ? -1 : 1));
  return { test, points };
}

/** Days from `today` to a date. Negative when past. Handy for "{n} d left" cells. */
export function daysUntil(date: string, today: string = MOCK_TODAY): number {
  return diffDays(datePart(date), today);
}
