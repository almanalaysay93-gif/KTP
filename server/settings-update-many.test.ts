import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: vi.fn(async () => state.db) };
});

import { appRouter } from "./routers";
import { normalizeReminderThresholds } from "./routers/settings";
import type { TrpcContext } from "./_core/context";

let client: PGlite;

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

async function stored() {
  const rows = (await client.query<{ key: string; value: string | null }>(`select key, value from "appSettings" order by key`)).rows;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

beforeAll(async () => {
  client = new PGlite();
  await client.exec(`
    create schema nursetrack;
    set search_path to nursetrack;
    create table "appSettings" (id serial primary key, key varchar(64) not null unique, value text);
  `);
  state.db = drizzle(client);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec(`
    truncate "appSettings" restart identity;
    insert into "appSettings" (key, value) values
      ('appTitle', 'Old Title'), ('orgName', 'Old Org'), ('contactEmail', 'old@example.com'), ('reminderThresholdDays', '365,180');
  `);
});

describe("settings.updateMany", () => {
  it("saves all four values together", async () => {
    await appRouter.createCaller(adminCtx).settings.updateMany({
      appTitle: "SKTI NurseTrack",
      orgName: "SPMC SKTI",
      contactEmail: "nncluster@spmcdvo.net",
      reminderThresholdDays: " 365, 90 ",
    });

    expect(await stored()).toEqual({
      appTitle: "SKTI NurseTrack",
      contactEmail: "nncluster@spmcdvo.net",
      orgName: "SPMC SKTI",
      reminderThresholdDays: "365,90",
    });
  });

  it("saves no field when one value is invalid", async () => {
    const before = await stored();

    await expect(
      appRouter.createCaller(adminCtx).settings.updateMany({
        appTitle: "New Title",
        orgName: "New Org",
        contactEmail: "new@example.com",
        reminderThresholdDays: "365,abc",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await stored()).toEqual(before);
  });

  it("creates a missing setting row instead of skipping it", async () => {
    await client.exec(`delete from "appSettings" where key = 'orgName'`);

    await appRouter.createCaller(adminCtx).settings.updateMany({
      appTitle: "T",
      orgName: "Org Restored",
      contactEmail: "",
      reminderThresholdDays: "180",
    });

    expect(await stored()).toMatchObject({ orgName: "Org Restored", contactEmail: null });
  });

  it("rolls back earlier writes when a later write fails", async () => {
    // The check constraint fails the orgName write inside the transaction, after appTitle was written.
    await client.exec(`alter table "appSettings" add constraint org_short check (key <> 'orgName' or length(value) < 10)`);
    try {
      const before = await stored();
      await expect(
        appRouter.createCaller(adminCtx).settings.updateMany({
          appTitle: "Written first",
          orgName: "Too long for the check",
          contactEmail: "",
          reminderThresholdDays: "180",
        }),
      ).rejects.toThrow();
      expect(await stored()).toEqual(before);
    } finally {
      await client.exec(`alter table "appSettings" drop constraint org_short`);
    }
  });
});

describe("normalizeReminderThresholds", () => {
  it("accepts whole days from 1 to 365", () => {
    expect(normalizeReminderThresholds("365, 180,30")).toBe("365,180,30");
  });

  it("rejects empty, zero, fractional, and too-large values", () => {
    for (const bad of ["", " , ", "0", "30.5", "366", "365,abc"]) {
      expect(normalizeReminderThresholds(bad)).toBeNull();
    }
  });
});
