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
import { addService, recordResult, getClinical, addAppointment, setChecklist } from "./dbClinical";
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
    expect(initial.labTests).toHaveLength(15);
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
    expect(saved.labTests).toHaveLength(15);
  });
  it("rolls back entire PostgreSQL result on invalid lab reference", async () => {
    const { id } = await addService({ patientId: 1, serviceType: "Laboratory", label: "Rollback", dueDate: "2026-09-01" }, 1);
    await expect(recordResult({ patientId: 1, serviceRecordId: id, serviceDate: "2026-09-02", results: [{ labTestId: 999999, value: "1" }] }, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getClinical(1)).services.find(r => r.id === id)?.status).toBe("Planned");
  });
});
