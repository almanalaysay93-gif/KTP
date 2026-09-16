import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function makeCtx(overrides: Partial<TrpcContext> & { req?: Partial<TrpcContext["req"]> } = {}): {
  ctx: TrpcContext;
  cookies: CookieCall[];
} {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    claimNurseId: null,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
      ...overrides.req,
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
  return { ctx, cookies };
}

const adminUser = {
  id: 1,
  openId: "admin-don",
  email: "almanalaysay93@gmail.com",
  name: "Don Admin",
  loginMethod: "google" as const,
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("PRC License Number editing - Supervisor and Nurse", () => {
  it("allows supervisor to create a nurse with PRC license number", async () => {
    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    const empId = `TEST-PRC-${Date.now()}`;
    const prcNumber = `PRC-${Date.now()}`;

    const created = await caller.nurses.create({
      employeeId: empId,
      firstName: "Maria",
      lastName: "Santos",
      position: "Staff Nurse II",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-01-15").toISOString(),
      licenseNumber: prcNumber,
    });

    expect(created.id).toBeDefined();

    const fetched = await caller.nurses.get({ id: created.id });
    expect(fetched.licenseNumber).toBe(prcNumber);
  });

  it("allows supervisor to update nurse's PRC license number", async () => {
    const { ctx } = makeCtx({ user: adminUser });
    const caller = appRouter.createCaller(ctx);

    const empId = `TEST-PRC-UPD-${Date.now()}`;
    const initialPrc = `PRC-INIT-${Date.now()}`;
    const updatedPrc = `PRC-NEW-${Date.now()}`;

    const created = await caller.nurses.create({
      employeeId: empId,
      firstName: "Jose",
      lastName: "Rizal",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-02-01").toISOString(),
      licenseNumber: initialPrc,
    });

    const fetched1 = await caller.nurses.get({ id: created.id });
    expect(fetched1.licenseNumber).toBe(initialPrc);

    await caller.nurses.update({
      id: created.id,
      licenseNumber: updatedPrc,
    });

    const fetched2 = await caller.nurses.get({ id: created.id });
    expect(fetched2.licenseNumber).toBe(updatedPrc);
  });

  it("allows nurse to edit their own PRC license number via staffAccount", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const empId = `TEST-NURSE-SELF-${Date.now()}`;
    const initialPrc = `PRC-SELF-1-${Date.now()}`;
    const updatedPrc = `PRC-SELF-2-${Date.now()}`;

    const created = await adminCaller.nurses.create({
      employeeId: empId,
      firstName: "Clara",
      lastName: "Batumbakal",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-03-01").toISOString(),
      licenseNumber: initialPrc,
    });

    // Nurse self-service session with claimNurseId
    const { ctx: nurseCtx } = makeCtx({ claimNurseId: created.id });
    const nurseCaller = appRouter.createCaller(nurseCtx);

    const selfProfile1 = await nurseCaller.staffAccount.myProfile();
    expect(selfProfile1.licenseNumber).toBe(initialPrc);

    const updateRes = await nurseCaller.staffAccount.updateMyPrcLicense({
      licenseNumber: updatedPrc,
    });
    expect(updateRes.ok).toBe(true);

    const selfProfile2 = await nurseCaller.staffAccount.myProfile();
    expect(selfProfile2.licenseNumber).toBe(updatedPrc);

    // Supervisor view should also reflect the updated license
    const supervisorView = await adminCaller.nurses.get({ id: created.id });
    expect(supervisorView.licenseNumber).toBe(updatedPrc);
  });

  it("rejects duplicate PRC license numbers between two different nurses", async () => {
    const { ctx: adminCtx } = makeCtx({ user: adminUser });
    const adminCaller = appRouter.createCaller(adminCtx);

    const sharedPrc = `PRC-DUP-${Date.now()}`;

    const nurse1 = await adminCaller.nurses.create({
      employeeId: `TEST-DUP-1-${Date.now()}`,
      firstName: "Nurse",
      lastName: "One",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-01-01").toISOString(),
      licenseNumber: sharedPrc,
    });

    // Another nurse trying to use the same PRC license on creation
    await expect(
      adminCaller.nurses.create({
        employeeId: `TEST-DUP-2-${Date.now()}`,
        firstName: "Nurse",
        lastName: "Two",
        staffType: "Registered Nurse",
        employmentStatus: "Active",
        dateHired: new Date("2026-01-01").toISOString(),
        licenseNumber: sharedPrc,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nurse is already registered with this PRC License Number.",
    });

    // Nurse 2 created without license, then trying to take nurse 1's license
    const nurse2 = await adminCaller.nurses.create({
      employeeId: `TEST-DUP-2B-${Date.now()}`,
      firstName: "Nurse",
      lastName: "TwoB",
      staffType: "Registered Nurse",
      employmentStatus: "Active",
      dateHired: new Date("2026-01-01").toISOString(),
    });

    const { ctx: nurse2Ctx } = makeCtx({ claimNurseId: nurse2.id });
    const nurse2Caller = appRouter.createCaller(nurse2Ctx);

    await expect(
      nurse2Caller.staffAccount.updateMyPrcLicense({ licenseNumber: sharedPrc }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nurse is already registered with this PRC License Number.",
    });
  });
});
