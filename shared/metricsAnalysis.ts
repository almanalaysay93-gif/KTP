import { computeClaimStatus, dateKey, type PatientStatus, type PatientType } from "./ktp";

export interface AnalysisPatient {
  id: number; patientType: PatientType; status: PatientStatus; stage: string;
  linkedRecipientId: number | null; createdAt: string | Date; surgeryDate: string | Date | null;
}
export interface AnalysisChecklist {
  patientId: number; name: string; category: string; status: string;
  asIndicated: boolean | number; recorded: boolean | number;
}
export interface AnalysisService {
  patientId: number; serviceType: string; status: string; dueDate: string | Date | null;
  claimDeadline: string | Date | null; claimFiledDate: string | Date | null;
}
export interface AnalysisAppointment {
  patientId: number; kind: string; startsAt: string | Date;
  cancelledAt: string | Date | null; response: string;
}
export interface StageEvent {
  patientId: number; createdAt: string | Date; details: string | Record<string, unknown> | null;
}
const preop = (p: AnalysisPatient) => p.stage !== "PostKT" && p.stage !== "PostDonation";
const days = (a: string, b: string) => Math.floor((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : null;
const ETHICS = new Set(["Ethics committee", "HTEC evaluation and approval"]);
// SQLite timestamps use a space; PostgreSQL returns Date objects.
const timestamp = (value: string | Date) => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)
  ? `${value.replace(" ", "T")}Z` : value;
const metricDate = (value: string | Date | null) => dateKey(value === null ? null : timestamp(value));

export function analyzeMetrics(input: {
  patients: AnalysisPatient[]; checklist: AnalysisChecklist[]; services: AnalysisService[];
  appointments: AnalysisAppointment[]; stageEvents: StageEvent[]; today: string; status?: PatientStatus;
}) {
  const { today } = input;
  const selected = input.patients.filter(p => !input.status || p.status === input.status);
  const ids = new Set(selected.map(p => p.id));
  const checklist = new Map<number, AnalysisChecklist[]>();
  for (const item of input.checklist) checklist.set(item.patientId, [...(checklist.get(item.patientId) ?? []), item]);
  const required = (id: number) => (checklist.get(id) ?? []).filter(c => !c.asIndicated || c.recorded);
  const pending = (id: number) => required(id).filter(c => c.status !== "Done" && c.status !== "NA");
  const ethicsApproved = (id: number) => {
    const items = (checklist.get(id) ?? []).filter(c => ETHICS.has(c.name));
    return items.some(c => c.name === "Ethics committee") && items.some(c => c.name === "HTEC evaluation and approval") && items.every(c => c.status === "Done");
  };
  const complete = (p: AnalysisPatient) => p.stage === "Phase3" && required(p.id).length > 0 && pending(p.id).length === 0 && ethicsApproved(p.id);
  const candidates = selected.filter(p => p.patientType === "Recipient" && preop(p));
  const linked = (id: number) => input.patients.filter(p => p.patientType === "Donor" && p.linkedRecipientId === id && p.status === "Active" && preop(p));
  const matching = { withoutDonor: 0, underEvaluation: 0, qualifiedDonor: 0 };
  const blockers = new Map<string, number>();
  const blocked = new Set<number>();
  let ready = 0;
  for (const p of candidates) {
    const donors = linked(p.id);
    const qualified = donors.some(complete);
    if (!donors.length) matching.withoutDonor++;
    else if (qualified) matching.qualifiedDonor++;
    else matching.underEvaluation++;
    if (p.status === "Active" && complete(p) && qualified) ready++;
    const reasons = new Set<string>(pending(p.id).map(c => ETHICS.has(c.name) ? "Ethics approval" : c.category === "Lab" ? "Laboratory requirements" : c.category === "Clearance" ? "Clearances" : c.category === "Imaging" ? "Imaging requirements" : "Other milestones"));
    if (!ethicsApproved(p.id)) reasons.add("Ethics approval");
    if (!donors.length) reasons.add("No active linked donor");
    else if (!qualified) reasons.add("Donor requirements incomplete");
    if (p.stage !== "Phase3") reasons.add("Not in Phase 3");
    if (reasons.size) blocked.add(p.id);
    for (const reason of reasons) blockers.set(reason, (blockers.get(reason) ?? 0) + 1);
  }
  const preoperative = selected.filter(preop);
  const ethics = { awaiting: 0, approved: 0, notApplicable: 0, unknown: 0 };
  for (const p of preoperative) {
    const items = (checklist.get(p.id) ?? []).filter(c => ETHICS.has(c.name));
    if (!items.length) ethics.unknown++;
    else if (ethicsApproved(p.id)) ethics.approved++;
    else if (items.every(c => c.status === "NA")) ethics.notApplicable++;
    else ethics.awaiting++;
  }
  const entered = new Map<number, { stage: string; day: string }>();
  for (const event of [...input.stageEvents].sort((a, b) => new Date(timestamp(a.createdAt)).getTime() - new Date(timestamp(b.createdAt)).getTime())) {
    try {
      const details = typeof event.details === "string" ? JSON.parse(event.details.replace(/^```(?:json)?\s*|\s*```$/g, "")) : event.details;
      const day = metricDate(event.createdAt);
      if (details && typeof details.toStage === "string") {
        if (details.fromStage !== details.toStage && day && day <= today) entered.set(event.patientId, { stage: details.toStage, day });
      } else if (details?.changes?.includes("stage")) entered.delete(event.patientId);
      else if (typeof details?.stage === "string" && day && day <= today) entered.set(event.patientId, { stage: details.stage, day });
    } catch { entered.delete(event.patientId); }
  }
  const currentWait = selected.map(p => {
    const event = entered.get(p.id);
    return event?.stage === p.stage ? { stage: p.stage, days: days(today, event.day) } : null;
  }).filter((p): p is { stage: string; days: number } => !!p);
  const enrollmentWait = preoperative.map(p => metricDate(p.createdAt)).filter(day => day && day <= today).map(day => days(today, day));
  const completedWait = selected.filter(p => p.patientType === "Recipient" && p.stage === "PostKT").flatMap(p => {
    const start = metricDate(p.createdAt), end = metricDate(p.surgeryDate);
    return start && end && end >= start && end <= today ? [days(end, start)] : [];
  });
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 12 + index, 1)).toISOString().slice(0, 7);
    const created = selected.filter(p => metricDate(p.createdAt).slice(0, 7) === month && metricDate(p.createdAt) <= today);
    const surgeries = selected.filter(p => dateKey(p.surgeryDate).slice(0, 7) === month && dateKey(p.surgeryDate) <= today);
    return { month, recipients: created.filter(p => p.patientType === "Recipient").length, donors: created.filter(p => p.patientType === "Donor").length,
      transplants: surgeries.filter(p => p.patientType === "Recipient" && p.stage === "PostKT").length, donations: surgeries.filter(p => p.patientType === "Donor" && p.stage === "PostDonation").length };
  });
  const services = input.services.filter(s => ids.has(s.patientId));
  const overdue = services.filter(s => s.status === "Planned" && dateKey(s.dueDate) && dateKey(s.dueDate) < today);
  const pastFollowups = input.appointments.filter(a => ids.has(a.patientId) && a.kind === "FollowUp" && !a.cancelledAt && metricDate(a.startsAt) && metricDate(a.startsAt) < today);
  const postTransplantIds = new Set(selected.filter(p => p.patientType === "Recipient" && p.stage === "PostKT").map(p => p.id));
  const followup = { overdueLabs: overdue.filter(s => s.serviceType === "Laboratory" || s.serviceType === "Tacro").length,
    patientsWithOverdueLabs: new Set(overdue.filter(s => s.serviceType === "Laboratory" || s.serviceType === "Tacro").map(s => s.patientId)).size,
    pastFollowups: pastFollowups.length,
    pastPostTransplantFollowups: pastFollowups.filter(a => postTransplantIds.has(a.patientId)).length,
    rescheduleRequests: input.appointments.filter(a => ids.has(a.patientId) && !a.cancelledAt && a.response === "RescheduleRequested").length };
  const recipientIds = new Set(selected.filter(p => p.patientType === "Recipient").map(p => p.id));
  const claims = { pending: 0, dueSoon: 0, overdue: 0, filed: 0, missingDeadline: 0 };
  for (const service of services.filter(s => recipientIds.has(s.patientId) && (s.status === "Done" || s.status === "Superseded"))) {
    const state = computeClaimStatus(service.claimFiledDate, service.claimDeadline, today);
    if (state === "Filed") claims.filed++;
    else {
      claims.pending++;
      if (state === "Overdue") claims.overdue++;
      if (state === "DueSoon") claims.dueSoon++;
      if (state === "None") claims.missingDeadline++;
    }
  }
  return { ready, candidates: candidates.length, blocked: blocked.size,
    blockers: [...blockers].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count), matching, ethics,
    waiting: { enrollmentAverageDays: mean(enrollmentWait), enrollmentSamples: enrollmentWait.length, transplantAverageDays: mean(completedWait), transplantSamples: completedWait.length,
      stageUnknown: selected.length - currentWait.length,
      stages: [...new Set(selected.map(p => p.stage))].map(stage => { const values = currentWait.filter(p => p.stage === stage).map(p => p.days); return { stage, averageDays: mean(values), samples: values.length }; }) },
    monthly, followup, claims };
}
