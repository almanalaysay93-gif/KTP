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
  it("persists appointment timezone and scopes cancellation to patient", async () => {
    const { id } = await admin.addAppointment({ patientId, title: "Fixture visit", kind: "FollowUp", startsAt: "2026-10-05T09:00:00+08:00" });
    expect((await admin.get({ patientId })).appointments[0].startsAt).toBe("2026-10-05T01:00:00.000Z");
    await expect(admin.cancelAppointment({ patientId: otherId, id })).rejects.toMatchObject({ code: "CONFLICT" });
    await admin.cancelAppointment({ patientId, id });
    expect((await admin.get({ patientId })).appointments[0].cancelledAt).toBeTruthy();
  });
});
