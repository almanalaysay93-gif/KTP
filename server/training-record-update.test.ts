import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  record: null as Record<string, unknown> | null,
  updates: [] as Array<{ id: number; data: Record<string, unknown> }>,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listNurseTrainings: vi.fn(async () => (state.record ? [state.record] : [])),
    updateNurseTraining: vi.fn(async (id: number, data: Record<string, unknown>) => {
      state.updates.push({ id, data });
    }),
    logActivity: vi.fn(async () => {}),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminCtx = {
  user: {
    id: 1,
    openId: "admin-don",
    email: "almanalaysay93@gmail.com",
    name: "Don Admin",
    loginMethod: "google",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  claimNurseId: null,
  req: { protocol: "https", headers: {} },
  res: { cookie: () => {}, clearCookie: () => {} },
} as unknown as TrpcContext;

beforeEach(() => {
  state.updates = [];
  state.record = {
    id: 42,
    nurseId: 7,
    trainingId: 3,
    status: "Completed",
    scheduledDate: new Date("2026-03-02T00:00:00.000Z"),
    completionDate: new Date("2026-03-04T00:00:00.000Z"),
    expiryDate: new Date("2028-03-04T00:00:00.000Z"),
    trainingHours: 16,
    cpdUnits: 12,
    scheduleVersion: 1,
  };
});

describe("trainings.updateRecord partial edits", () => {
  it("writes only the changed field and leaves status and dates untouched", async () => {
    await appRouter.createCaller(adminCtx).trainings.updateRecord({ id: 42, remarks: "Renewed early" });

    expect(state.updates).toEqual([{ id: 42, data: { remarks: "Renewed early" } }]);
  });

  it("accepts null to clear training hours and CPD units", async () => {
    await appRouter.createCaller(adminCtx).trainings.updateRecord({ id: 42, trainingHours: null, cpdUnits: null });

    expect(state.updates).toEqual([{ id: 42, data: { trainingHours: null, cpdUnits: null } }]);
  });
});
