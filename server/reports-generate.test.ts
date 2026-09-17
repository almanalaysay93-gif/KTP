import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: vi.fn(async () => state.db) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

let client: PGlite;

const adminCtx = {
  user: { id: 1, openId: "admin", email: "almanalaysay93@gmail.com", name: "Admin", loginMethod: "google", role: "admin" },
  claimNurseId: null,
  req: { protocol: "https", headers: {} },
  res: { cookie: () => {}, clearCookie: () => {} },
} as unknown as TrpcContext;

const generate = (type: "trainingCompliance" | "areaExposure" | "trainingSummary" | "transferLog") =>
  appRouter.createCaller(adminCtx).reports.generate({ type }) as Promise<Record<string, unknown>[]>;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(`
    create schema nursetrack;
    set search_path to nursetrack;
    create table areas (id serial primary key, code varchar(64) not null, name varchar(128) not null, "sortOrder" integer not null default 99, active boolean not null default true);
    create table nurses (
      id serial primary key, "employeeId" varchar(64) not null, "firstName" varchar(128) not null, "middleName" varchar(128),
      "lastName" varchar(128) not null, suffix varchar(32), "employmentStatus" varchar(32) not null default 'Active',
      "currentAreaId" integer, "archivedAt" timestamp
    );
    create table "areaTrainingRequirements" (id serial primary key, "areaId" integer not null, "trainingId" integer not null, required boolean not null default true);
    create table "trainingCatalog" (id serial primary key, name varchar(128) not null, category varchar(64), "renewalRequired" boolean not null default false, "defaultValidityMonths" integer);
    create table "nurseTrainings" (
      id serial primary key, "nurseId" integer not null, "trainingId" integer not null, status varchar(16) not null,
      "scheduledDate" date, "completionDate" date, "expiryDate" date, "trainingHours" integer, "cpdUnits" integer, provider varchar(128)
    );
    create table "areaAssignments" (
      id serial primary key, "nurseId" integer not null, "areaId" integer not null, "startDate" date not null, "endDate" date,
      "assignmentType" varchar(64), remarks text
    );
    create table "nurseCredentials" (id serial primary key, "nurseId" integer not null, "licenseNumber" varchar(64), "expiryDate" date not null);

    insert into areas (id, code, name, "sortOrder", active) values
      (1, 'HD', 'Hemodialysis', 1, true), (2, 'TW', 'Transplant Ward', 2, true), (3, 'OLD', 'Closed Unit', 3, false);
    insert into nurses (id, "employeeId", "firstName", "lastName", "employmentStatus", "currentAreaId", "archivedAt") values
      (1, 'E-1', 'Ana', 'Cruz', 'Active', 1, null),
      (2, 'E-2', 'Ben', 'Diaz', 'Active', 1, null),
      (3, 'E-3', 'Cara', 'Reyes', 'Resigned', 1, null),
      (4, 'E-4', 'Dan', 'Uy', 'Active', 2, '2026-01-01'),
      (5, 'E-5', 'Eva', 'Lim', 'Active', 2, null);
    insert into "areaTrainingRequirements" ("areaId", "trainingId", required) values (1, 10, true), (1, 11, true), (1, 12, false), (2, 10, true);
    insert into "trainingCatalog" (id, name, category) values (10, 'BLS', 'Clinical'), (11, 'ACLS', 'Clinical');
    insert into "nurseTrainings" ("nurseId", "trainingId", status, "completionDate", "expiryDate") values
      (1, 10, 'Completed', '2026-01-01', null),
      (1, 11, 'Completed', '2026-01-01', '2020-01-01'),
      (2, 10, 'Completed', '2026-01-01', '2099-01-01'),
      (2, 11, 'Scheduled', null, null),
      (3, 10, 'Completed', '2026-01-01', null),
      (4, 10, 'Completed', '2026-01-01', null),
      (5, 10, 'Completed', '2026-01-01', null);
    insert into "areaAssignments" ("nurseId", "areaId", "startDate", "endDate", "assignmentType") values
      (1, 1, '2026-01-01', '2026-01-11', 'Regular'),
      (1, 1, '2026-02-01', '2026-02-06', 'Regular'),
      (1, 2, '2026-03-01', '2026-03-03', 'Rotation'),
      (4, 2, '2026-01-01', '2026-01-31', 'Regular');
    insert into "nurseCredentials" ("nurseId", "licenseNumber", "expiryDate") values (1, 'PRC-OLD', '2020-01-01'), (1, 'PRC-NEW', '2030-01-01');
  `);
  state.db = drizzle(client);
});

afterAll(async () => {
  await client.close();
});

describe("reports.generate on Postgres", () => {
  it("trainingCompliance returns one row per active area with active staff only", async () => {
    const rows = await generate("trainingCompliance");
    expect(rows).toEqual([
      // Ana: BLS current, ACLS expired. Ben: BLS current, ACLS only scheduled. Cara resigned -> excluded.
      { areaName: "Hemodialysis", requiredTrainings: 2, staffCount: 2, requiredChecks: 4, compliantChecks: 2, compliancePercent: 50 },
      // Dan archived -> excluded. Eva: BLS current.
      { areaName: "Transplant Ward", requiredTrainings: 1, staffCount: 1, requiredChecks: 1, compliantChecks: 1, compliancePercent: 100 },
    ]);
  });

  it("areaExposure groups assignments per nurse and area", async () => {
    const rows = await generate("areaExposure");
    expect(rows).toEqual([
      { nurseId: 1, nurse: "Ana Cruz", licenseNumber: "PRC-NEW", areaName: "Hemodialysis", firstStart: "2026-01-01", lastEnd: "2026-02-06", assignments: 2, totalDays: 15 },
      { nurseId: 1, nurse: "Ana Cruz", licenseNumber: "PRC-NEW", areaName: "Transplant Ward", firstStart: "2026-03-01", lastEnd: "2026-03-03", assignments: 1, totalDays: 2 },
    ]);
  });

  it("trainingSummary leaves out archived staff", async () => {
    const rows = await generate("trainingSummary");
    expect(rows).toHaveLength(6);
    expect(rows.some((r) => r.nurse === "Dan Uy")).toBe(false);
  });

  it("transferLog exposes the license number under licenseNumber", async () => {
    const rows = await generate("transferLog");
    expect(rows[0]).toMatchObject({ nurse: "Ana Cruz", licenseNumber: "PRC-NEW", areaName: "Hemodialysis" });
    expect(rows[0]).not.toHaveProperty("employeeId");
  });
});
