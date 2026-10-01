import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({ sqlite: null as Database.Database | null }));
vi.mock("./localDb", () => ({ getSqliteDb: () => state.sqlite }));
import { upsertUser, touchUserSession } from "./db";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";


beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
  state.sqlite = new Database(":memory:");
  state.sqlite.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY, openId TEXT UNIQUE, name TEXT, email TEXT,
    loginMethod TEXT, role TEXT DEFAULT 'user', createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP, lastSignedIn TEXT
  )`);
});
beforeEach(() => state.sqlite!.exec("DELETE FROM users"));
afterAll(() => { state.sqlite!.close(); vi.unstubAllEnvs(); });

it.each(["nncluster@spmcdvo.net", "share@spmcdvo.net", "almanalaysay93@gmail.com", " NNCLUSTER@SPMCDVO.NET "])("grants full access to %s", async email => {
  await upsertUser({ openId: "approved", email, role: "user" });
  expect(await touchUserSession("approved")).toMatchObject({ role: "admin" });
});

it.each(["other@example.com", null, "nncluster@spmcdvo.net.evil.test"])("rejects first-login and explicit admin grants for %s", async email => {
  await upsertUser({ openId: "outsider", email, role: "admin" });
  expect(state.sqlite!.prepare("SELECT role FROM users").get()).toEqual({ role: "user" });
  state.sqlite!.exec("UPDATE users SET role = 'admin'");
  expect(await touchUserSession("outsider")).toMatchObject({ role: "user" });
});

it.each(["other@example.com", null])("demotes an existing account when its email changes to %s", async email => {
  await upsertUser({ openId: "changed", email: "nncluster@spmcdvo.net" });
  await upsertUser({ openId: "changed", email });
  expect(state.sqlite!.prepare("SELECT role FROM users").get()).toEqual({ role: "user" });
  expect(await touchUserSession("changed")).toMatchObject({ role: "user", email });
  expect(await touchUserSession("deleted")).toBeNull();
});

it("blocks stale admin roles at the API boundary while preserving staff access", async () => {
  const handler = vi.fn(() => "allowed");
  const api = router({ full: adminProcedure.query(handler), staff: protectedProcedure.query(() => "staff") });
  const ctx = { user: { email: "other@example.com", role: "admin" } } as TrpcContext;
  await expect(api.createCaller(ctx).full()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(handler).not.toHaveBeenCalled();
  expect(await api.createCaller(ctx).staff()).toBe("staff");
  for (const email of ["nncluster@spmcdvo.net", "share@spmcdvo.net", "almanalaysay93@gmail.com"]) {
    expect(await api.createCaller({ user: { email, role: "user" } } as TrpcContext).full()).toBe("allowed");
  }
});

it("does not grant anonymous development access", async () => {
  const spy = vi.spyOn(sdk, "authenticateRequest").mockRejectedValueOnce(new Error("No session"));
  try {
    const ctx = await createContext({ req: { headers: {}, socket: { remoteAddress: "127.0.0.1" } }, res: {} } as any);
    expect(ctx.user).toBeNull();
  } finally { spy.mockRestore(); }
});

it("demotes a previously signed-in admin through the real session path", async () => {
  await upsertUser({ openId: "old-admin", email: "other@example.com" });
  state.sqlite!.exec("UPDATE users SET role = 'admin'");
  const token = await sdk.createSessionToken("old-admin");
  const user = await sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${token}` } } as any);
  expect(user.role).toBe("user");
});

it.each([false, undefined])("rejects Google identity with email_verified=%s", async email_verified => {
  const spy = vi.spyOn((sdk as any).client, "get").mockResolvedValueOnce({
    data: { sub: "google-user", email: "nncluster@spmcdvo.net", email_verified },
  });
  try {
    await expect(sdk.getUserInfo("test-token")).rejects.toThrow("Google email is not verified");
  } finally { spy.mockRestore(); }
});

it("accepts a verified Google identity", async () => {
  const spy = vi.spyOn((sdk as any).client, "get").mockResolvedValueOnce({
    data: { sub: "google-user", email: "nncluster@spmcdvo.net", email_verified: true },
  });
  try {
    await expect(sdk.getUserInfo("test-token")).resolves.toMatchObject({ email: "nncluster@spmcdvo.net" });
  } finally { spy.mockRestore(); }
});

it("ignores owner and admin environment overrides", async () => {
  const previous = { ownerOpenId: ENV.ownerOpenId, ownerEmail: ENV.ownerEmail, adminEmails: ENV.adminEmails };
  Object.assign(ENV, { ownerOpenId: "env-owner", ownerEmail: "other@example.com", adminEmails: ["other@example.com"] });
  try {
    await upsertUser({ openId: "env-owner", email: "other@example.com" });
    expect(await touchUserSession("env-owner")).toMatchObject({ role: "user" });
  } finally { Object.assign(ENV, previous); }
});


