import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { countUnreadNotificationsPg, getLatestLicenseInfoPerNurse, getNotificationLogicalKey, type PgDb } from "./db";

let client: PGlite;
let db: PgDb;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(`
    create schema nursetrack;
    set search_path to nursetrack;
    create table notifications (
      id serial primary key,
      type varchar(64) not null,
      severity varchar(32) not null default 'info',
      title varchar(256) not null,
      message text,
      "nurseId" integer,
      "relatedEntityType" varchar(64),
      "relatedEntityId" integer,
      "readAt" timestamp,
      "createdAt" timestamp not null default now(),
      "dayKey" date
    );
    create table "nurseCredentials" (
      id serial primary key,
      "nurseId" integer not null,
      "credentialTypeId" integer not null default 1,
      "licenseNumber" varchar(64),
      "expiryDate" date not null,
      "renewalStatus" varchar(32) not null default 'Not Started'
    );
  `);
  db = drizzle(client) as unknown as PgDb;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec(`truncate notifications restart identity; truncate "nurseCredentials" restart identity;`);
});

type Row = { type: string; title: string; nurseId: number | null; relatedEntityType: string | null; relatedEntityId: number | null; readAt: string | null };

async function insert(rows: Row[]) {
  for (const r of rows) {
    await client.query(
      `insert into notifications (type, title, "nurseId", "relatedEntityType", "relatedEntityId", "readAt") values ($1, $2, $3, $4, $5, $6)`,
      [r.type, r.title, r.nurseId, r.relatedEntityType, r.relatedEntityId, r.readAt],
    );
  }
}

describe("countUnreadNotificationsPg", () => {
  it("matches the JavaScript logical-key count", async () => {
    const unread = null;
    await insert([
      // same expired license twice -> one
      { type: "license.expired", title: "Expired A", nurseId: 1, relatedEntityType: "credential", relatedEntityId: 10, readAt: unread },
      { type: "license.expired", title: "Expired A again", nurseId: 1, relatedEntityType: "credential", relatedEntityId: 10, readAt: unread },
      // expired with no related entity still keys on nurse -> one more
      { type: "license.expired", title: "Expired B", nurseId: 2, relatedEntityType: null, relatedEntityId: null, readAt: unread },
      // renewal reminders: same prefix collapses, different prefix does not
      { type: "license.renewalReminder", title: "180 days — Ana", nurseId: 3, relatedEntityType: "credential", relatedEntityId: 30, readAt: unread },
      { type: "license.renewalReminder", title: "180 days — Ana (again)", nurseId: 3, relatedEntityType: "credential", relatedEntityId: 30, readAt: unread },
      { type: "license.renewalReminder", title: "365 days — Ana", nurseId: 3, relatedEntityType: "credential", relatedEntityId: 30, readAt: unread },
      // generic with entity collapses
      { type: "training.scheduled", title: "T1", nurseId: 4, relatedEntityType: "nurseTraining", relatedEntityId: 40, readAt: unread },
      { type: "training.scheduled", title: "T1 dup", nurseId: 4, relatedEntityType: "nurseTraining", relatedEntityId: 40, readAt: unread },
      // generic without entity, or with empty/zero entity -> each row counts
      { type: "system", title: "S1", nurseId: null, relatedEntityType: null, relatedEntityId: null, readAt: unread },
      { type: "system", title: "S2", nurseId: null, relatedEntityType: null, relatedEntityId: null, readAt: unread },
      { type: "system", title: "S3", nurseId: 5, relatedEntityType: "", relatedEntityId: 50, readAt: unread },
      { type: "system", title: "S4", nurseId: 5, relatedEntityType: "x", relatedEntityId: 0, readAt: unread },
      // read rows never count
      { type: "system", title: "read", nurseId: null, relatedEntityType: null, relatedEntityId: null, readAt: "2026-09-01 00:00:00" },
    ]);

    const rows = (await client.query<any>(`select * from notifications where "readAt" is null`)).rows;
    const expected = new Set(rows.map((r) => getNotificationLogicalKey(r))).size;

    expect(expected).toBe(9);
    expect(await countUnreadNotificationsPg(db)).toBe(expected);
  });

  it("returns 0 when nothing is unread", async () => {
    expect(await countUnreadNotificationsPg(db)).toBe(0);
  });
});

describe("getLatestLicenseInfoPerNurse", () => {
  it("keeps only the latest-expiring credential per nurse", async () => {
    await client.exec(`
      insert into "nurseCredentials" ("nurseId", "licenseNumber", "expiryDate", "renewalStatus") values
        (1, 'OLD-1', '2020-01-01', 'Not Started'),
        (1, 'NEW-1', '2099-01-01', 'Not Started'),
        (2, 'ONLY-2', '2000-06-30', 'Not Started'),
        (3, 'REN-3', '2000-06-30', 'Renewed');
    `);

    const map = await getLatestLicenseInfoPerNurse(db);

    expect(map.size).toBe(3);
    expect(map.get(1)).toMatchObject({ licenseNumber: "NEW-1", expiryDate: "2099-01-01", status: "Valid" });
    expect(map.get(2)).toMatchObject({ licenseNumber: "ONLY-2", expiryDate: "2000-06-30", status: "Expired" });
    expect(map.get(3)).toMatchObject({ licenseNumber: "REN-3", status: "Valid" });
  });
});
