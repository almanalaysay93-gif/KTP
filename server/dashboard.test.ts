vi.mock("./dbClinical", () => ({ listClinicalDashboard: vi.fn(async () => ({ services: [], appointments: [] })) }));
import { describe, expect, it, vi } from "vitest";
import type { Patient } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { dashboardRouter } from "./routers/dashboard";
import * as db from "./db";

const context = (email: string | null): TrpcContext => ({
  user: email
    ? {
        id: 1,
        email,
        name: "Test",
        openId: "test",
        role: "admin",
        loginMethod: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null,
  req: { headers: {}, protocol: "http" } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("dashboard snapshot and access", () => {
  it("returns one canonical patient snapshot and counts active records only", async () => {
    const patients = [
      { id: 21, patientType: "Recipient", stage: "PostKT", status: "Active" },
      { id: 22, patientType: "Recipient", stage: "Phase1", status: "Inactive" },
      { id: 23, patientType: "Donor", stage: "Phase1", status: "Active" },
    ] as Patient[];
    const read = vi.spyOn(db, "listPatients").mockResolvedValue(patients);
    try {
      const data = await dashboardRouter
        .createCaller(context("almanalaysay93@gmail.com"))
        .initial();
      expect(data.patients).toEqual(patients);
      expect(data.activeCount).toBe(2);
      expect(data.recipientStages).toEqual({ PostKT: 1 });
      expect(data.donorCount).toBe(1);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      read.mockRestore();
    }
  });
  it("rejects signed-out and patient callers before reading patients", async () => {
    const read = vi.spyOn(db, "listPatients");
    try {
      for (const email of [null, "synthetic-patient@example.invalid"]) {
        await expect(
          dashboardRouter.createCaller(context(email)).initial()
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });
});
