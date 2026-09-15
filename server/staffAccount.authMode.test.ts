import { describe, expect, it, vi } from "vitest";

// This file mocks server/db.ts (see below) so ctx.authMode can reach "google"
// without a real database connection — the plain vitest run has no
// DATABASE_URL, so the unmocked db.getNurseByLinkedUserId always returns
// undefined and the "google" branch of staffProcedure is unreachable from
// server/staffAccount.test.ts. Keep DB-independent staffAccount coverage in
// that file instead; this one is only for the two authMode enforcement
// branches below.
const mockNurse = {
  id: 9,
  employeeId: "EMP-9",
  firstName: "Juana",
  lastName: "Dela Cruz",
  staffType: "Registered Nurse",
  employmentStatus: "Active",
  archivedAt: null,
  accountEmail: "juana@example.com",
  linkedUserId: 501,
};

vi.mock("./db", () => ({
  getNurseByLinkedUserId: vi.fn(async (userId: number) => (userId === 501 ? mockNurse : undefined)),
  getNurseById: vi.fn(async (id: number) => (id === 9 ? mockNurse : undefined)),
  saveClaimEmail: vi.fn(async () => ({ ok: true as const })),
  changeNurseAccountEmail: vi.fn(async () => ({ ok: true as const })),
}));

describe("staffAccount authMode enforcement", () => {
  it("rejects saveClaimEmail from an already-linked Google session (must use changeEmail instead)", async () => {
    const { appRouter } = await import("./routers");
    const googleUser = { id: 501, openId: "sub", email: "juana@example.com", name: "Juana", loginMethod: "google", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

    const caller = appRouter.createCaller({
      user: googleUser,
      claimNurseId: null,
      req: { protocol: "https", headers: {}, ip: "203.0.113.1", socket: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });

    await expect(caller.staffAccount.saveClaimEmail({ email: "new@example.com" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  }, 15000);

  it("rejects changeEmail from a first-visit claim session (must finish claiming with saveClaimEmail)", async () => {
    const { appRouter } = await import("./routers");

    const caller = appRouter.createCaller({
      user: null,
      claimNurseId: 9,
      req: { protocol: "https", headers: {}, ip: "203.0.113.2", socket: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });

    await expect(caller.staffAccount.changeEmail({ email: "new@example.com" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows saveClaimEmail under a claim session and changeEmail under a Google session", async () => {
    const { appRouter } = await import("./routers");

    const claimCaller = appRouter.createCaller({
      user: null,
      claimNurseId: 9,
      req: { protocol: "https", headers: {}, ip: "203.0.113.3", socket: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });
    await expect(claimCaller.staffAccount.saveClaimEmail({ email: "new@example.com" })).resolves.toEqual({ ok: true });

    const googleUser = { id: 501, openId: "sub", email: "juana@example.com", name: "Juana", loginMethod: "google", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
    const googleCaller = appRouter.createCaller({
      user: googleUser,
      claimNurseId: null,
      req: { protocol: "https", headers: {}, ip: "203.0.113.4", socket: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });
    await expect(googleCaller.staffAccount.changeEmail({ email: "new2@example.com" })).resolves.toEqual({ ok: true });
  });
});
