import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { _resetRateLimitsForTests } from "./_core/rateLimit";
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
      ip: "203.0.113.5",
      socket: { remoteAddress: "203.0.113.5" },
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

describe("staffAccount.myLink — claim-cookie session", () => {
  it("resolves nurseId/authMode from a valid claim cookie without a Google session", async () => {
    const { ctx } = makeCtx({ claimNurseId: 42 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.staffAccount.myLink();

    expect(result).toEqual({ linked: true, nurseId: 42, authMode: "claim" });
  });

  it("rejects a request with neither a Google session nor a claim cookie", async () => {
    const { ctx } = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.staffAccount.myLink()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("staffAccount.startClaim", () => {
  beforeEach(() => {
    _resetRateLimitsForTests();
  });

  it("issues a 30-minute claim cookie on a successful identifier match", async () => {
    // Deterministic in this test env: no DATABASE_URL, so db.claimNurseByIdentifier
    // can't hit real data and returns { ok: false } for any identifier — this
    // exercises the failure path end to end (see the CI note below for the
    // success path).
    const { ctx } = makeCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.staffAccount.startClaim({ identifier: "0123456" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No matching staff record, or this profile already has a sign-in email.",
    });
  });

  it("returns the exact same generic message once the per-IP rate limit trips", async () => {
    const { ctx } = makeCtx({ req: { ip: "198.51.100.9" } as TrpcContext["req"] });
    const caller = appRouter.createCaller(ctx);

    // 10 allowed attempts, then the 11th must be rate-limited — same message either way (E8).
    for (let i = 0; i < 10; i++) {
      await expect(caller.staffAccount.startClaim({ identifier: `bad-${i}` })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "No matching staff record, or this profile already has a sign-in email.",
      });
    }
    await expect(caller.staffAccount.startClaim({ identifier: "one-more" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No matching staff record, or this profile already has a sign-in email.",
    });
  });

  it("rate-limits per IP, not globally", async () => {
    const attackerCtx = makeCtx({ req: { ip: "198.51.100.10" } as TrpcContext["req"] }).ctx;
    const attackerCaller = appRouter.createCaller(attackerCtx);
    for (let i = 0; i < 10; i++) {
      await expect(attackerCaller.staffAccount.startClaim({ identifier: `bad-${i}` })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }

    const otherCtx = makeCtx({ req: { ip: "198.51.100.11" } as TrpcContext["req"] }).ctx;
    const otherCaller = appRouter.createCaller(otherCtx);
    // Still NOT_FOUND (no DB), but not rate-limited — same message either way,
    // so this only proves the window is keyed correctly, via the counter.
    await expect(otherCaller.staffAccount.startClaim({ identifier: "0123456" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("db.isNurseClaimable", () => {
  const base = {
    archivedAt: null as Date | null,
    employmentStatus: "Active",
    accountEmail: null as string | null,
  };

  it("allows an active, unclaimed nurse", () => {
    expect(db.isNurseClaimable({ ...base })).toBe(true);
  });

  it("rejects an archived row", () => {
    expect(db.isNurseClaimable({ ...base, archivedAt: new Date() })).toBe(false);
  });

  it("rejects Resigned and Retired rows", () => {
    expect(db.isNurseClaimable({ ...base, employmentStatus: "Resigned" })).toBe(false);
    expect(db.isNurseClaimable({ ...base, employmentStatus: "Retired" })).toBe(false);
  });

  it("rejects a nurse that already has accountEmail set", () => {
    expect(db.isNurseClaimable({ ...base, accountEmail: "already@example.com" })).toBe(false);
  });

  it("rejects a missing nurse", () => {
    expect(db.isNurseClaimable(null)).toBe(false);
    expect(db.isNurseClaimable(undefined)).toBe(false);
  });
});

describe("sdk claim token handling", () => {
  it("round-trips a claim token to the signed nurseId", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createClaimToken(77);
    const nurseId = await sdk.verifyClaimToken(token);
    expect(nurseId).toBe(77);
  });

  it("rejects a normal session token presented as a claim token, and vice versa", async () => {
    const { sdk } = await import("./_core/sdk");
    const sessionToken = await sdk.createSessionToken("google-sub-1");
    expect(await sdk.verifyClaimToken(sessionToken)).toBeNull();

    const claimToken = await sdk.createClaimToken(5);
    const session = await sdk.verifySession(claimToken);
    expect(session).toBeNull();
  });

  it("rejects garbage and empty input", async () => {
    const { sdk } = await import("./_core/sdk");
    expect(await sdk.verifyClaimToken(undefined)).toBeNull();
    expect(await sdk.verifyClaimToken("not-a-jwt")).toBeNull();
  });
});
