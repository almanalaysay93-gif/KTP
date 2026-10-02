import { beforeEach, describe, expect, it } from "vitest";
import { clinicalRouter } from "./routers/clinical";
import { getSqliteDb } from "./localDb";
import type { TrpcContext } from "./_core/context";

const ctx = (email: string | null): TrpcContext => ({
  user: email ? { id: 9991, email, name: "Fixture", openId: "clinical-fixture", role: "admin", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
  req: { headers: {}, protocol: "http" } as TrpcContext["req"], res: {} as TrpcContext["res"],
});
const admin = clinicalRouter.createCaller(ctx("almanalaysay93@gmail.com"));
let patientId: number;
let otherId: number;
beforeEach(() => {
  const db = getSqliteDb();
  for (const table of ["labResults", "serviceRecords", "patientChecklist", "appointments", "activityLog"]) db.exec(`DELETE FROM ${table}`);
  db.prepare("DELETE FROM patients WHERE hrn LIKE 'CLINICAL-TEST-%'").run();
  patientId = Number(db.prepare("INSERT INTO patients (hrn,patientType,firstName,lastName,stage,accountEmail) VALUES ('CLINICAL-TEST-1','Recipient','Synthetic','Patient','Phase1','clinical1@example.invalid')").run().lastInsertRowid);
  otherId = Number(db.prepare("INSERT INTO patients (hrn,patientType,firstName,lastName,stage,accountEmail) VALUES ('CLINICAL-TEST-2','Donor','Synthetic','Donor','Phase1','clinical2@example.invalid')").run().lastInsertRowid);
});
const service = () => admin.addService({ patientId, serviceType: "Laboratory", label: "Fixture lab", dueDate: "2026-09-01" });

describe("clinical persisted workflows", () => {
  it("rejects patient and anonymous access to reads and writes", async () => {
    for (const email of [null, "patient@example.invalid"]) {
      const caller = clinicalRouter.createCaller(ctx(email));
      await expect(caller.get({ patientId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.addService({ patientId, serviceType: "Meds", label: "Denied", dueDate: "2026-09-01" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("saves results, preserves reference snapshots, files claims, audits changes", async () => {
    const { id } = await service();
    const initial = await admin.get({ patientId });
    const test = initial.labTests[0];
    getSqliteDb().prepare('UPDATE labTests SET low=?, high=? WHERE id=?').run('3', '8', test.id);
    await admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02", claimDeadline: "2026-10-09", results: [{ labTestId: test.id, value: "9" }] });
    await admin.fileClaim({ patientId, id, claimFiledDate: "2026-09-03" });
    const saved = await admin.get({ patientId });
    expect(saved.services[0]).toMatchObject({ status: "Done", serviceDate: "2026-09-02", claimFiledDate: "2026-09-03" });
    expect(saved.labResults[0]).toMatchObject({ value: "9", flag: "High", lowSnapshot: "3", highSnapshot: "8" });
    expect(getSqliteDb().prepare('SELECT count(*) AS n FROM activityLog WHERE patientId=?').get(patientId)).toMatchObject({ n: 3 });
    await expect(admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(admin.fileClaim({ patientId, id, claimFiledDate: "2026-09-04" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("records nurse approval and tag in service note and activity log", async () => {
    const { id } = await service();
    const initial = await admin.get({ patientId });
    const test = initial.labTests[0];
    await admin.recordResult({
      patientId,
      serviceRecordId: id,
      serviceDate: "2026-09-02",
      nurseApproved: true,
      approvedByNurse: "RN Dela Cruz",
      note: "Routine follow-up",
      results: [{ labTestId: test.id, value: "5.5" }],
    });
    const saved = await admin.get({ patientId });
    expect(saved.services[0].note).toBe("Routine follow-up [Approved by Nurse: RN Dela Cruz]");
    const auditRow = getSqliteDb().prepare("SELECT details FROM activityLog WHERE patientId=? AND action='clinical.result.record'").get(patientId) as { details: string };
    const details = JSON.parse(auditRow.details);
    expect(details).toMatchObject({
      id,
      nurseApproved: true,
      approvedByNurse: "RN Dela Cruz",
    });
  });
  it("rolls back completion when a lab test is invalid; rejects cross-patient results", async () => {
    const { id } = await service();
    await expect(admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: 999999, value: "1" }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await admin.get({ patientId })).services[0].status).toBe("Planned");
    await expect(admin.recordResult({ patientId: otherId, serviceRecordId: id, serviceDate: "2026-09-02" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("validates calendar dates, duplicate results and missing patients", async () => {
    await expect(admin.addService({ patientId, serviceType: "Meds", label: "Invalid", dueDate: "2026-02-30" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.get({ patientId: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { id } = await service();
    await expect(admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: 1, value: "1" }, { labTestId: 1, value: "2" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("persists checklist completion and resets completion date", async () => {
    const item = (await admin.get({ patientId })).checklist[0];
    await admin.setChecklist({ patientId, catalogId: item.catalogId, status: "Done", doneDate: "2026-09-02", note: "Verified fixture" });
    expect((await admin.get({ patientId })).checklist.find(i => i.catalogId === item.catalogId)).toMatchObject({ status: "Done", doneDate: "2026-09-02" });
    await admin.setChecklist({ patientId, catalogId: item.catalogId, status: "Pending" });
    expect((await admin.get({ patientId })).checklist.find(i => i.catalogId === item.catalogId)).toMatchObject({ status: "Pending", doneDate: null });
  });
  it("saves several checklist items together and saves none when one item is invalid", async () => {
    const [first, second] = (await admin.get({ patientId })).checklist;
    await expect(admin.setChecklistMany({ patientId, items: [
      { catalogId: first.catalogId, status: "Done", doneDate: "2026-09-02" },
      { catalogId: 999999, status: "NA" },
    ] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await admin.get({ patientId })).checklist.find(i => i.catalogId === first.catalogId)).toMatchObject({ status: "Pending" });
    await expect(admin.setChecklistMany({ patientId, items: [{ catalogId: first.catalogId, status: "Done" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await admin.setChecklistMany({ patientId, items: [
      { catalogId: first.catalogId, status: "Done", doneDate: "2026-09-02", note: "Verified fixture" },
      { catalogId: second.catalogId, status: "NA" },
    ] });
    const saved = (await admin.get({ patientId })).checklist;
    expect(saved.find(i => i.catalogId === first.catalogId)).toMatchObject({ status: "Done", doneDate: "2026-09-02", note: "Verified fixture" });
    expect(saved.find(i => i.catalogId === second.catalogId)).toMatchObject({ status: "NA", doneDate: null });
  });
  it("corrects a saved service and its lab values, and keeps a revision with the reason", async () => {
    const { id } = await service();
    const [first, second, third] = (await admin.get({ patientId })).labTests;
    getSqliteDb().prepare('UPDATE labTests SET low=?, high=? WHERE id=?').run('3', '8', first.id);
    await expect(admin.updateService({ patientId, id, reason: "Typing error", results: [{ labTestId: first.id, value: "5" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: first.id, value: "9" }, { labTestId: second.id, value: "4" }] });
    getSqliteDb().prepare('UPDATE labTests SET low=?, high=? WHERE id=?').run('1', '2', first.id);
    await admin.updateService({ patientId, id, reason: "Typing error", label: "Corrected lab", serviceDate: "2026-09-03", claimDeadline: "2026-10-01",
      results: [{ labTestId: first.id, value: "5" }, { labTestId: second.id, value: "" }, { labTestId: third.id, value: "7" }] });
    const saved = await admin.get({ patientId });
    expect(saved.services[0]).toMatchObject({ label: "Corrected lab", status: "Done", dueDate: "2026-09-01", serviceDate: "2026-09-03", claimDeadline: "2026-10-01" });
    expect(saved.labResults.map(r => [r.labTestId, r.value]).sort()).toEqual([[first.id, "5"], [third.id, "7"]].sort());
    expect(saved.labResults.find(r => r.labTestId === first.id)).toMatchObject({ flag: "Normal", lowSnapshot: "3", highSnapshot: "8" });
    const revision = getSqliteDb().prepare("SELECT * FROM recordRevisions WHERE entityType='serviceRecord' AND entityId=?").all(id) as { before: string; after: string; reason: string; userId: number }[];
    expect(revision).toHaveLength(1);
    expect(revision[0]).toMatchObject({ reason: "Typing error", userId: 9991 });
    expect(JSON.parse(revision[0].before)).toMatchObject({ label: "Fixture lab", serviceDate: "2026-09-02", labs: [{ labTestId: first.id, value: "9" }, { labTestId: second.id, value: "4" }] });
    expect(JSON.parse(revision[0].after)).toMatchObject({ label: "Corrected lab", serviceDate: "2026-09-03", labs: [{ labTestId: first.id, value: "5" }, { labTestId: third.id, value: "7" }] });
    expect(getSqliteDb().prepare("SELECT count(*) AS n FROM activityLog WHERE patientId=? AND action='clinical.service.update'").get(patientId)).toMatchObject({ n: 1 });
  });
  it("rejects service corrections that are empty, unexplained, out of order, or for another patient", async () => {
    const { id } = await service();
    await admin.recordResult({ patientId, serviceRecordId: id, serviceDate: "2026-09-02" });
    await expect(admin.updateService({ patientId, id, reason: "No change", label: "Fixture lab" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.updateService({ patientId, id, reason: "", label: "Renamed" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.updateService({ patientId, id, reason: "Wrong date", claimDeadline: "2026-09-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.updateService({ patientId, id, reason: "Wrong date", claimFiledDate: "2026-09-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.updateService({ patientId, id, reason: "Bad test", results: [{ labTestId: 999999, value: "1" }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(admin.updateService({ patientId: otherId, id, reason: "Wrong patient", label: "Renamed" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await admin.get({ patientId })).services[0]).toMatchObject({ label: "Fixture lab", serviceDate: "2026-09-02", claimDeadline: null });
    expect(getSqliteDb().prepare("SELECT count(*) AS n FROM recordRevisions WHERE entityId=?").get(id)).toMatchObject({ n: 0 });
  });
  it("adds lab results to a phase and removes one with a reason", async () => {
    const [first, second] = (await admin.get({ patientId })).labTests;
    getSqliteDb().prepare('UPDATE labTests SET low=?, high=? WHERE id=?').run('3', '8', first.id);
    const a = await admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2026-09-02", labTestId: first.id, value: "9" });
    const b = await admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2026-09-02", labTestId: second.id, value: "4" });
    const c = await admin.addLabResult({ patientId, phase: "Phase2", serviceDate: "2026-09-02", labTestId: first.id, value: "5" });
    expect(b.serviceRecordId).toBe(a.serviceRecordId);
    expect(c.serviceRecordId).not.toBe(a.serviceRecordId);
    await expect(admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2026-09-02", labTestId: first.id, value: "7" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(admin.addLabResult({ patientId, phase: "PostDonation", serviceDate: "2026-09-02", labTestId: first.id, value: "7" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.addLabResult({ patientId: otherId, phase: "PostKT", serviceDate: "2026-09-02", labTestId: first.id, value: "7" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2999-01-01", labTestId: first.id, value: "7" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2026-09-03", labTestId: 999999, value: "7" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    let saved = await admin.get({ patientId });
    // A result completes the checklist item of the same test and phase. It leaves a completed item unchanged.
    const item = (name: string) => saved.checklist.filter(i => i.name === name && i.phase === 1);
    expect(item(first.name)).toMatchObject([{ status: "Done", doneDate: "2026-09-02" }]);
    expect(item(second.name)).toMatchObject([{ status: "Done", doneDate: "2026-09-02" }]);
    expect(saved.checklist.filter(i => i.status === "Done")).toHaveLength(2);
    await admin.addLabResult({ patientId, phase: "Phase1", serviceDate: "2026-09-05", labTestId: first.id, value: "6" });
    await admin.updateService({ patientId, id: (await admin.get({ patientId })).services.find(s => s.serviceDate === "2026-09-05")!.id, reason: "Test entry", results: [{ labTestId: first.id, value: "" }] });
    saved = await admin.get({ patientId });
    expect(item(first.name)).toMatchObject([{ status: "Done", doneDate: "2026-09-02" }]);
    saved.services = saved.services.filter(s => s.serviceDate !== "2026-09-05");
    expect(saved.services).toHaveLength(2);
    expect(saved.services.find(s => s.id === a.serviceRecordId)).toMatchObject({ label: "Phase 1 labs", status: "Done", serviceType: "Laboratory", serviceDate: "2026-09-02", phase: "Phase1" });
    expect(saved.labResults.map(r => [r.phase, r.labTestId, r.value, r.flag]).sort()).toEqual([["Phase1", first.id, "9", "High"], ["Phase1", second.id, "4", null], ["Phase2", first.id, "5", "Normal"]].sort());
    await admin.updateService({ patientId, id: a.serviceRecordId, reason: "Entered for the wrong patient", results: [{ labTestId: first.id, value: "" }] });
    saved = await admin.get({ patientId });
    expect(saved.labResults.map(r => [r.phase, r.labTestId]).sort()).toEqual([["Phase1", second.id], ["Phase2", first.id]].sort());
    expect(getSqliteDb().prepare("SELECT count(*) AS n FROM activityLog WHERE patientId=? AND action='clinical.lab.add'").get(patientId)).toMatchObject({ n: 4 });
  });
  it("saves several lab results together with the nurse approval, and saves none when one is invalid", async () => {
    const [first, second, third] = (await admin.get({ patientId })).labTests;
    await expect(admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", results: [{ labTestId: first.id, value: "9" }, { labTestId: 999999, value: "1" }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", results: [{ labTestId: first.id, value: "9" }, { labTestId: first.id, value: "8" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", results: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    let saved = await admin.get({ patientId });
    expect(saved.labResults).toHaveLength(0);
    expect(saved.services).toHaveLength(0);
    expect(saved.checklist.filter(i => i.status === "Done")).toHaveLength(0);
    const batch = await admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", nurseApproved: true, approvedByNurse: "RN Dela Cruz",
      results: [{ labTestId: first.id, value: "9" }, { labTestId: second.id, value: "4" }] });
    expect(batch.ids).toHaveLength(2);
    await admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", nurseApproved: true, approvedByNurse: "RN Dela Cruz", results: [{ labTestId: third.id, value: "250" }] });
    await expect(admin.addLabResults({ patientId, phase: "Phase1", serviceDate: "2026-09-02", results: [{ labTestId: second.id, value: "5" }] })).rejects.toThrow(`${second.name} already has a result`);
    saved = await admin.get({ patientId });
    expect(saved.services).toHaveLength(1);
    expect(saved.services[0]).toMatchObject({ id: batch.serviceRecordId, phase: "Phase1", note: "[Approved by Nurse: RN Dela Cruz]" });
    expect(saved.labResults.map(r => r.value).sort()).toEqual(["250", "4", "9"]);
    expect(saved.checklist.filter(i => i.status === "Done").map(i => i.name).sort()).toEqual([first.name, second.name, third.name].sort());
    const logs = getSqliteDb().prepare("SELECT details FROM activityLog WHERE patientId=? AND action='clinical.lab.add'").all(patientId) as { details: string }[];
    expect(logs).toHaveLength(3);
    expect(JSON.parse(logs[0].details)).toMatchObject({ nurseApproved: true, approvedByNurse: "RN Dela Cruz", phase: "Phase1" });
  });
  it("persists appointment timezone and scopes cancellation to patient", async () => {
    const { id } = await admin.addAppointment({ patientId, title: "Fixture visit", kind: "FollowUp", startsAt: "2026-10-05T09:00:00+08:00" });
    expect((await admin.get({ patientId })).appointments[0].startsAt).toBe("2026-10-05T01:00:00.000Z");
    await expect(admin.cancelAppointment({ patientId: otherId, id })).rejects.toMatchObject({ code: "CONFLICT" });
    await admin.cancelAppointment({ patientId, id });
    expect((await admin.get({ patientId })).appointments[0].cancelledAt).toBeTruthy();
  });
});
