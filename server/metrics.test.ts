import { describe, expect, it } from "vitest";
import { summarizeMetrics, type MetricsPatient } from "../shared/metrics";
import { listMetrics } from "./dbMetrics";
import { getSqliteDb } from "./localDb";
import { dashboardRouter } from "./routers/dashboard";
import type { TrpcContext } from "./_core/context";

describe("patient metrics", () => {
  it("counts recipient-only transplant stages and pending ethics without counting completed or NA reviews", () => {
    const rows: MetricsPatient[] = [
      { patientType: "Recipient", stage: "Phase3", status: "Active", ethicsStatus: "Pending" },
      { patientType: "Donor", stage: "Phase3", status: "Active", ethicsStatus: "Pending" },
      { patientType: "Recipient", stage: "PostKT", status: "Active", ethicsStatus: "Pending" },
      { patientType: "Donor", stage: "PostDonation", status: "Active", ethicsStatus: "Pending" },
      ...(["Pending", "Done", "NA", null] as const).map(ethicsStatus => ({ patientType: "Recipient" as const, stage: "Clearances", status: "Active" as const, ethicsStatus })),
      { patientType: "Donor", stage: "Clearances", status: "Active", ethicsStatus: "Pending" },
    ];
    expect(summarizeMetrics(rows)).toMatchObject({ total: 9, recipients: 6, donors: 3, forEthics: 2, ethicsRecipients: 1, ethicsDonors: 1, forTransplant: 1, postTransplant: 1, postDonation: 1 });
    expect(summarizeMetrics([]).total).toBe(0);
  });

  it("uses persisted checklist progress, defaults missing entries to pending, and filters status", async () => {
    const db = getSqliteDb();
    const baseline = await listMetrics("Inactive");
    const catalog = db.prepare("SELECT id FROM checklistCatalog WHERE name = 'Ethics committee' AND active = true").get() as { id: number };
    const ids: number[] = [];
    try {
      for (let n = 0; n < 3; n++) {
        ids.push(Number(db.prepare("INSERT INTO patients (hrn,patientType,firstName,lastName,stage,status) VALUES (?,'Recipient','Metrics','Fixture','Clearances',?)").run(`METRICS-FIXTURE-${n}`, n === 2 ? "Active" : "Inactive").lastInsertRowid));
      }
      db.prepare("INSERT INTO patientChecklist (patientId,catalogId,status) VALUES (?,?,'Done')").run(ids[1], catalog.id);
      const result = await listMetrics("Inactive");
      expect(result.total).toBe(baseline.total + 2);
      expect(result.forEthics).toBe(baseline.forEthics + 1);
      db.prepare("INSERT INTO patientChecklist (patientId,catalogId,status) VALUES (?,?,'NA')").run(ids[0], catalog.id);
      expect((await listMetrics("Inactive")).forEthics).toBe(baseline.forEthics);
    } finally {
      for (const id of ids) {
        db.prepare("DELETE FROM patientChecklist WHERE patientId = ?").run(id);
        db.prepare("DELETE FROM patients WHERE id = ?").run(id);
      }
    }
  });

  it("rejects anonymous metrics access", async () => {
    const caller = dashboardRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as TrpcContext);
    await expect(caller.metrics({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
