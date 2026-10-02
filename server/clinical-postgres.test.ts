import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { BASELINE_SQL } from "./baselineSql";
const state = vi.hoisted(() => ({ pg: null as unknown as PGlite }));
vi.mock("./db", () => ({
  getDb: async () => ({}),
  getBatchClient: () => ({
    begin: async (callback: (tx: { unsafe: (sql: string, args?: unknown[]) => Promise<unknown[]> }) => Promise<unknown>) =>
      state.pg.transaction(tx => callback({ unsafe: async (sql, args = []) => (await tx.query(sql, args)).rows })),
  }),
}));
import { checkImportRows, commitImportRows } from "./dbPatientImport";
import { listZBenefit } from "./dbClinical";
import { saveZBenefit } from "./dbZBenefit";
import { addLabResult, addService, recordResult, getClinical, addAppointment, setChecklist, setChecklistMany, updateService } from "./dbClinical";
beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec('CREATE SCHEMA ktp');
  await state.pg.exec(BASELINE_SQL);
  await state.pg.exec('SET search_path TO ktp, public');
  await state.pg.exec(`INSERT INTO patients (hrn,"patientType","firstName","lastName","accountEmail",stage) VALUES ('PG-TEST','Recipient','Synthetic','Patient','pg@example.invalid','Phase1')`);
  process.env.DATABASE_URL = "postgres://unused-local-test";
});
afterAll(async () => { delete process.env.DATABASE_URL; await state.pg.close(); });
describe("clinical PostgreSQL transactions", () => {
  it("seeds catalogs once and saves results and checklist through real PostgreSQL syntax", async () => {
    const initial = await getClinical(1);
    expect(initial.labTests).toHaveLength(29);
    expect(initial.checklist.length).toBeGreaterThan(30);
    const { id } = await addService({ patientId: 1, serviceType: "Laboratory", label: "Fixture", dueDate: "2026-09-01" }, 1);
    await recordResult({ patientId: 1, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: initial.labTests[0].id, value: "5" }] }, 1);
    await setChecklist({ patientId: 1, catalogId: initial.checklist[0].catalogId, status: "Done", doneDate: "2026-09-02" }, 1);
    await addAppointment({ patientId: 1, title: "Visit", kind: "FollowUp", startsAt: "2026-10-05T09:00:00+08:00" }, 1);
    const saved = await getClinical(1);
    expect(saved.labResults[0].value).toBe("5");
    expect(saved.services[0].serviceDate).toBe("2026-09-02");
    expect(saved.checklist[0].status).toBe("Done");
    expect(saved.appointments[0].startsAt).toBe("2026-10-05T01:00:00.000Z");
    expect(saved.labTests).toHaveLength(29);
  });
  it("rolls back entire PostgreSQL result on invalid lab reference", async () => {
    const { id } = await addService({ patientId: 1, serviceType: "Laboratory", label: "Rollback", dueDate: "2026-09-01" }, 1);
    await expect(recordResult({ patientId: 1, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: 999999, value: "1" }] }, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getClinical(1)).services.find(r => r.id === id)?.status).toBe("Planned");
  });
  it("corrects a saved service and saves a checklist group through real PostgreSQL syntax", async () => {
    const initial = await getClinical(1);
    const [first, second] = initial.labTests;
    const { id } = await addService({ patientId: 1, serviceType: "Laboratory", label: "Correction", dueDate: "2026-09-01" }, 1);
    await recordResult({ patientId: 1, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: first.id, value: "5" }] }, 1);
    await updateService({ patientId: 1, id, reason: "Typing error", serviceDate: "2026-09-03", claimDeadline: "2026-10-01",
      results: [{ labTestId: first.id, value: "6" }, { labTestId: second.id, value: "2" }] }, 1);
    await expect(updateService({ patientId: 1, id, reason: "No change", serviceDate: "2026-09-03" }, 1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const saved = await getClinical(1);
    expect(saved.services.find(r => r.id === id)).toMatchObject({ serviceDate: "2026-09-03", claimDeadline: "2026-10-01", dueDate: "2026-09-01" });
    expect(saved.labResults.filter(r => r.serviceRecordId === id).map(r => r.value).sort()).toEqual(["2", "6"]);
    const revisions = (await state.pg.query<{ reason: string; after: string }>('SELECT * FROM "recordRevisions" WHERE "entityId" = $1', [id])).rows;
    expect(revisions).toHaveLength(1);
    expect(JSON.parse(revisions[0].after)).toMatchObject({ serviceDate: "2026-09-03", labs: [{ labTestId: first.id, value: "6" }, { labTestId: second.id, value: "2" }] });
    const added = await addLabResult({ patientId: 1, phase: "Phase2", serviceDate: "2026-09-04", labTestId: first.id, value: "8" }, 1);
    const again = await addLabResult({ patientId: 1, phase: "Phase2", serviceDate: "2026-09-04", labTestId: second.id, value: "3" }, 1);
    expect(again.serviceRecordId).toBe(added.serviceRecordId);
    await expect(addLabResult({ patientId: 1, phase: "Phase2", serviceDate: "2026-09-04", labTestId: first.id, value: "9" }, 1)).rejects.toMatchObject({ code: "CONFLICT" });
    const phased = (await getClinical(1)).labResults.filter(r => r.serviceRecordId === added.serviceRecordId);
    expect(phased.map(r => [r.phase, r.serviceDate, r.value]).sort()).toEqual([["Phase2", "2026-09-04", "3"], ["Phase2", "2026-09-04", "8"]]);
    const [a, b] = initial.checklist.slice(1, 3);
    await setChecklistMany({ patientId: 1, items: [{ catalogId: a.catalogId, status: "Done", doneDate: "2026-09-02" }, { catalogId: b.catalogId, status: "NA" }] }, 1);
    const checklist = (await getClinical(1)).checklist;
    expect(checklist.find(i => i.catalogId === a.catalogId)).toMatchObject({ status: "Done", doneDate: "2026-09-02" });
    expect(checklist.find(i => i.catalogId === b.catalogId)?.status).toBe("NA");
  });
  it("checks and saves an imported patient list through real PostgreSQL syntax", async () => {
    const recipient = { hrn: "PG-IMPORT-1", patientType: "Recipient", firstName: "Synthetic", lastName: "Recipient", accountEmail: "PG.Import1@example.invalid", stage: "PostKT", surgeryDate: "2026-08-01", birthDate: "1980-03-04", sex: "M" };
    const donor = { hrn: "PG-IMPORT-2", patientType: "Donor", firstName: "Synthetic", lastName: "Donor", accountEmail: "pg.import2@example.invalid", stage: "Phase2", linkedRecipientHrn: "PG-IMPORT-1" };
    expect(await checkImportRows([{ ...recipient, hrn: "PG-TEST", accountEmail: "PG@example.invalid" }])).toEqual([{ errors: ["HRN PG-TEST is already enrolled.", "Gmail account is already enrolled."], warnings: [] }]);
    await expect(commitImportRows([recipient, { ...donor, linkedRecipientHrn: "NONE" }], 1, "list.xlsx")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await state.pg.query(`SELECT count(*)::int AS n FROM patients WHERE hrn LIKE 'PG-IMPORT-%'`)).rows).toEqual([{ n: 0 }]);
    expect(await commitImportRows([donor, recipient], 1, "list.xlsx")).toMatchObject({ count: 2 });
    const rows = (await state.pg.query<Record<string, any>>(`SELECT hrn, "accountEmail", CAST("surgeryDate" AS TEXT) AS "surgeryDate", CAST("birthDate" AS TEXT) AS "birthDate", "linkedRecipientId", id, "followupMonths", status FROM patients WHERE hrn LIKE 'PG-IMPORT-%' ORDER BY hrn`)).rows;
    expect(rows[0]).toMatchObject({ hrn: "PG-IMPORT-1", accountEmail: "pg.import1@example.invalid", surgeryDate: "2026-08-01", birthDate: "1980-03-04", followupMonths: 1, status: "Active", linkedRecipientId: null });
    expect(rows[1]).toMatchObject({ hrn: "PG-IMPORT-2", linkedRecipientId: rows[0].id });
    expect((await state.pg.query(`SELECT count(*)::int AS n FROM "activityLog" WHERE action = 'IMPORT_PATIENT'`)).rows).toEqual([{ n: 2 }]);
    // The Z Benefit list reads recipients, doctors, and service dates through PostgreSQL.
    const zRows = await listZBenefit();
    expect(zRows.map(row => row.hrn)).toEqual(["PG-TEST", "PG-IMPORT-1"]);
    await saveZBenefit({ patientId: 1, entries: [{ serviceType: "XrayUsd", doneDate: "2026-09-10", nextDue: "2026-12-10", claimDue: "2026-11-09" }, { serviceType: "Tacro", nextDue: "2026-10-15" }] }, 1);
    await saveZBenefit({ patientId: 1, entries: [{ serviceType: "XrayUsd", doneDate: "2026-09-09", claimFiled: "2026-09-20" }] }, 1);
    const zAfter = (await listZBenefit())[0].services;
    expect(zAfter.XrayUsd).toEqual({ firstDate: "2026-09-09", lastDate: "2026-09-09", nextDue: "2026-12-10", claimDue: null });
    expect(zAfter.Tacro).toMatchObject({ nextDue: "2026-10-15" });
    expect(zRows[0].services.Laboratory).toEqual({ firstDate: "2026-09-02", lastDate: "2026-09-04", nextDue: "2026-09-01", claimDue: "2026-10-01" });
    // Two patients with no Gmail account do not collide on the unique e-mail index. An older database drops NOT NULL with this statement.
    await state.pg.exec(`ALTER TABLE patients ALTER COLUMN "accountEmail" SET NOT NULL`);
    await state.pg.exec(`ALTER TABLE patients ALTER COLUMN "accountEmail" DROP NOT NULL`);
    await state.pg.exec(`ALTER TABLE patients ALTER COLUMN "accountEmail" DROP NOT NULL`);
    expect(await commitImportRows([{ ...recipient, hrn: "PG-IMPORT-3", accountEmail: "" }, { ...recipient, hrn: "PG-IMPORT-4", accountEmail: null }], 1, "list.xlsx")).toMatchObject({ count: 2 });
    expect((await state.pg.query(`SELECT count(*)::int AS n FROM patients WHERE hrn LIKE 'PG-IMPORT-%' AND "accountEmail" IS NULL`)).rows).toEqual([{ n: 2 }]);
  });
});
