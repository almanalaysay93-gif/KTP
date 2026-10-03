import { describe, expect, it } from "vitest";
import { analyzeMetrics, type AnalysisPatient, type AnalysisChecklist } from "../shared/metricsAnalysis";

const patient = (id: number, overrides: Partial<AnalysisPatient> = {}): AnalysisPatient => ({ id, patientType: "Recipient", stage: "Phase3", status: "Active", linkedRecipientId: null, createdAt: "2026-09-01", surgeryDate: null, ...overrides });
const checklist = (patientId: number): AnalysisChecklist[] => ["Ethics committee", "HTEC evaluation and approval", "CBC"].map(name => ({ patientId, name, category: name === "CBC" ? "Lab" : "Clearance", status: "Done", asIndicated: false, recorded: true }));
const analyze = (overrides: Partial<Parameters<typeof analyzeMetrics>[0]> = {}) => analyzeMetrics({ patients: [], checklist: [], services: [], appointments: [], stageEvents: [], today: "2026-10-03", ...overrides });

describe("expanded metrics analysis", () => {
  it("requires complete recipient and active linked donor checklists for readiness, counts unique recipients in matching", () => {
    const patients = [patient(1), patient(2, { patientType: "Donor", linkedRecipientId: 1 }), patient(3, { patientType: "Donor", linkedRecipientId: 1 }), patient(4), patient(5), patient(6, { patientType: "Donor", linkedRecipientId: 5, status: "Inactive" })];
    const result = analyze({ patients, checklist: [...checklist(1), ...checklist(2), ...checklist(3)] });
    expect(result.ready).toBe(1);
    expect(result.matching).toEqual({ qualifiedDonor: 1, underEvaluation: 0, withoutDonor: 2 });
    expect(result.blocked).toBe(2);
    const missingLab = [...checklist(1), ...checklist(2)].map(item => item.patientId === 2 && item.name === "CBC" ? { ...item, status: "Pending" } : item);
    expect(analyze({ patients: patients.slice(0, 2), checklist: missingLab }).ready).toBe(0);
    expect(analyze({ patients: patients.slice(0, 2), checklist: [...checklist(1), ...checklist(2)].map(item => item.name === "Ethics committee" ? { ...item, status: "NA" } : item) }).ready).toBe(0);
  });

  it("includes recorded optional requirements and excludes unrecorded optional requirements", () => {
    const patients = [patient(1), patient(2, { patientType: "Donor", linkedRecipientId: 1 })];
    const items = [...checklist(1), ...checklist(2), { patientId: 1, name: "Optional lab", category: "Lab", status: "Pending", asIndicated: true, recorded: false }];
    expect(analyze({ patients, checklist: items }).ready).toBe(1);
    items[items.length - 1].recorded = true;
    expect(analyze({ patients, checklist: items }).blockers).toContainEqual({ reason: "Laboratory requirements", count: 1 });
  });

  it("keeps historical stage dates unknown, preserves same-stage saves, and ignores unrelated updates", () => {
    const patients = [patient(1), patient(2)];
    expect(analyze({ patients }).waiting.stageUnknown).toBe(2);
    const result = analyze({ patients, stageEvents: [
      { patientId: 1, createdAt: "2026-09-20", details: '{"changes":["stage"],"fromStage":"Clearances","toStage":"Phase3"}' },
      { patientId: 1, createdAt: "2026-10-01", details: '{"changes":["stage"],"fromStage":"Phase3","toStage":"Phase3"}' },
      { patientId: 1, createdAt: "2026-10-02", details: '{"changes":["firstName"]}' },
    ] });
    expect(result.waiting.stages).toContainEqual({ stage: "Phase3", averageDays: 13, samples: 1 });
    expect(result.waiting.stageUnknown).toBe(1);
    expect(analyze({ patients, stageEvents: [{ patientId: 1, createdAt: "2026-09-01", details: '{"stage":"Phase3"}' }, { patientId: 1, createdAt: "2026-09-20", details: '{"changes":["stage"]}' }] }).waiting.stageUnknown).toBe(2);
  });

  it("uses completed surgery dates for monthly activity and excludes enrollment after surgery from duration averages", () => {
    const patients = [patient(1, { stage: "PostKT", surgeryDate: "2026-09-21" }), patient(2, { stage: "PostKT", createdAt: "2026-10-01", surgeryDate: "2026-09-20" }), patient(3, { stage: "Phase3", surgeryDate: "2026-10-02" }), patient(4, { patientType: "Donor", stage: "PostDonation", surgeryDate: "2026-09-21" })];
    const result = analyze({ patients });
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly.find(row => row.month === "2026-09")).toMatchObject({ transplants: 2, donations: 1 });
    expect(result.monthly.find(row => row.month === "2026-10")?.transplants).toBe(0);
    expect(result.waiting.transplantAverageDays).toBe(20);
    expect(result.waiting.transplantSamples).toBe(1);
  });

  it("filters service counts by current patient status, handles claims deadlines and excludes cancelled visits", () => {
    const result = analyze({ status: "Active", patients: [patient(1), patient(2, { status: "Inactive" })], services: [
      ...["2026-10-02", "2026-10-03", "2026-10-10", "2026-10-11", null].map(claimDeadline => ({ patientId: 1, serviceType: "Laboratory", status: "Done", dueDate: null, claimDeadline, claimFiledDate: null })),
      { patientId: 1, serviceType: "Meds", status: "Superseded", dueDate: null, claimDeadline: "2026-10-01", claimFiledDate: "2026-09-30" },
      { patientId: 1, serviceType: "Laboratory", status: "Planned", dueDate: "2026-10-02", claimDeadline: null, claimFiledDate: null },
      { patientId: 2, serviceType: "Laboratory", status: "Planned", dueDate: "2026-10-02", claimDeadline: null, claimFiledDate: null },
    ], appointments: [
      { patientId: 1, kind: "FollowUp", startsAt: "2026-10-01", cancelledAt: null, response: "Confirmed" },
      { patientId: 1, kind: "FollowUp", startsAt: "2026-10-01", cancelledAt: "2026-09-30", response: "Confirmed" },
    ] });
    expect(result.claims).toEqual({ pending: 5, overdue: 1, dueSoon: 2, filed: 1, missingDeadline: 1 });
    expect(result.followup).toMatchObject({ overdueLabs: 1, patientsWithOverdueLabs: 1, pastFollowups: 1 });
  });

  it("reports empty datasets without inventing waiting averages", () => {
    const result = analyze();
    expect(result.ready).toBe(0);
    expect(result.waiting.enrollmentAverageDays).toBeNull();
    expect(result.waiting.transplantAverageDays).toBeNull();
  });

  it("handles SQLite timestamp strings and PostgreSQL Date values identically", () => {
    for (const createdAt of ["2026-09-01 12:30:00", new Date("2026-09-01T12:30:00Z")]) {
      const result = analyze({ patients: [patient(1, { createdAt })], stageEvents: [{ patientId: 1, createdAt, details: { stage: "Phase3" } }] });
      expect(result.waiting.enrollmentAverageDays).toBe(32);
      expect(result.waiting.stages).toContainEqual({ stage: "Phase3", averageDays: 32, samples: 1 });
      expect(result.monthly.find(row => row.month === "2026-09")?.recipients).toBe(1);
    }
  });
});
