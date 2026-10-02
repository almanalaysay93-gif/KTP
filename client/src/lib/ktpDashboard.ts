import { dateKey, todayDate } from "@shared/ktp";
import type { ServiceRecord as DbService, Appointment as DbAppointment } from "../../../drizzle/schema";
import type {
  DashboardAggregates,
  MockDataset,
  Patient,
  PatientStage,
  StageCount,
} from "./ktpViewTypes";
import { RECIPIENT_STAGES, DONOR_STAGES, STAGE_ADMIN_LABEL } from "./ktpLabels";

function stages(
  patients: Patient[],
  order: readonly PatientStage[]
): StageCount[] {
  return order.map(stage => ({
    stage,
    label: STAGE_ADMIN_LABEL[stage],
    count: patients.filter(p => p.stage === stage).length,
  }));
}

type ClinicalSnapshot = {
  services: (Omit<DbService, "dueDate" | "serviceDate" | "claimDeadline" | "claimFiledDate"> & { dueDate: string | Date; serviceDate: string | Date | null; claimDeadline: string | Date | null; claimFiledDate: string | Date | null })[];
  appointments: (Omit<DbAppointment, "startsAt" | "respondedAt" | "cancelledAt"> & { startsAt: string | Date; respondedAt: string | Date | null; cancelledAt: string | Date | null })[];
};
export function liveDashboardData(patients: Patient[], clinical?: ClinicalSnapshot): MockDataset {
  return {
    patients,
    doctors: [],
    serviceRecords: (clinical?.services ?? []).map(r => ({
      ...r, id: String(r.id), patientId: r.patientId,
      dueDate: dateKey(r.dueDate) ?? "", serviceDate: dateKey(r.serviceDate),
      claimDeadline: dateKey(r.claimDeadline), claimFiledDate: dateKey(r.claimFiledDate),
      repeatOfId: r.repeatOfId === null ? null : String(r.repeatOfId),
    })),
    appointments: (clinical?.appointments ?? []).map(a => ({
      ...a, id: String(a.id), patientId: a.patientId,
      startsAt: new Date(a.startsAt).toISOString(), location: a.location ?? "",
      respondedAt: a.respondedAt ? new Date(a.respondedAt).toISOString() : null,
      cancelledAt: a.cancelledAt ? new Date(a.cancelledAt).toISOString() : null,
    })),
    messages: [],
    labTests: [],
    labResults: [],
  };
}

export function liveDashboardAggregates(
  data: MockDataset, today = todayDate()
): DashboardAggregates {
  const active = data.patients.filter(p => p.status === "Active");
  const recipients = active.filter(p => p.patientType === "Recipient");
  const donors = active.filter(p => p.patientType === "Donor");
  const byId = new Map(active.map(p => [String(p.id), p]));
  const rows = data.serviceRecords.flatMap(record => {
    const patient = byId.get(String(record.patientId));
    return patient ? [{ patient, record }] : [];
  });
  return {
    activeCount: active.length,
    recipientCount: recipients.length,
    donorCount: donors.length,
    recipientStages: stages(recipients, RECIPIENT_STAGES),
    donorStages: stages(donors, DONOR_STAGES),
    overdueServices: rows.filter(r => r.record.status === "Planned" && r.record.dueDate < today)
      .map(r => ({ ...r, daysOverdue: diffDays(today, r.record.dueDate) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
    claimsDueSoon: rows.filter(r => r.record.status !== "Planned" && !r.record.claimFiledDate && r.record.claimDeadline && diffDays(r.record.claimDeadline, today) <= 7)
      .map(r => ({ ...r, daysLeft: diffDays(r.record.claimDeadline!, today) }))
      .sort((a, b) => a.daysLeft - b.daysLeft),
    rescheduleRequests: data.appointments.flatMap(appointment => {
      const patient = byId.get(String(appointment.patientId));
      return patient && !appointment.cancelledAt && appointment.response === "RescheduleRequested" ? [{ patient, appointment }] : [];
    }),
    supersededUnfiled: rows.filter(r => r.record.status === "Superseded" && !!r.record.claimDeadline && !r.record.claimFiledDate),
  };
}

function diffDays(a: string, b: string) {
  return Math.floor((Date.parse(a.slice(0, 10) + "T00:00:00Z") - Date.parse(b.slice(0, 10) + "T00:00:00Z")) / 86400000);
}
