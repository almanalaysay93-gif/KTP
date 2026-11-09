/** Real PostgreSQL + Node JWT + Rust HTTP + existing tRPC callers.
 * Creates and drops only a randomly named database on RUST_TEST_DATABASE_URL.
 * Build Rust first. Run: npx tsx scripts/test-rust-backend.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import postgres from "postgres";
import { SignJWT } from "jose";
import { summarizeMetrics, type MetricsPatient } from "../shared/metrics";
import { analyzeMetrics } from "../shared/metricsAnalysis";
import {
  todayDate,
  addDays,
  PATIENT_STATUSES,
  type PatientStatus,
} from "../shared/ktp";
import type { Request } from "express";
import type { TrpcContext } from "../server/_core/context";
import { testPortal } from "./rust-tests/portal";
import { testClinicalWrites } from "./rust-tests/clinical";
import { testAdminWrites } from "./rust-tests/admin";
import { testPatientImports } from "./rust-tests/imports";
import { testAutomations } from "./rust-tests/automations";
import { testOAuth } from "./rust-tests/oauth";
import { testAutomationFailures } from "./rust-tests/automation-failures";
import { testPatientLabs } from "./rust-tests/patient-labs";

const testUrl = process.env.RUST_TEST_DATABASE_URL;
// Test delivery must remain local even in a configured development workspace.
process.env.RESEND_API_KEY = "";
process.env.NODE_ENV = "test";
assert.ok(
  testUrl,
  "RUST_TEST_DATABASE_URL must point to a disposable local PostgreSQL server"
);
const admin = postgres(testUrl, { max: 1 });
const databaseName = `ktp_rust_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(testUrl);
databaseUrl.pathname = `/${databaseName}`;
const secret = randomUUID() + randomUUID();
let pg: ReturnType<typeof postgres> | undefined;
let service: ReturnType<typeof spawn> | undefined;
let closeNodePools: (() => Promise<void>) | undefined;
let created = false;
const key = new TextEncoder().encode(secret);
const today = todayDate();
const yesterday = addDays(today, -1);

try {
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  pg = postgres(databaseUrl.toString(), {
    max: 2,
    connection: { search_path: "ktp, public" },
  });
  await pg.unsafe(
    await readFile(
      new URL("../drizzle/0000_ktp_baseline.sql", import.meta.url),
      "utf8"
    )
  );
  await pg`ALTER TABLE ktp.patients ALTER COLUMN "accountEmail" DROP NOT NULL`;
  await pg`INSERT INTO ktp.users ("openId", name, email, role) VALUES
    ('admin', 'Synthetic Admin', '  ALMANALAYSAY93@GMAIL.COM ', 'user'),
    ('patient', 'Synthetic Patient', 'fixture@example.invalid', 'admin')`;
  const patients = [
    {
      hrn: "R1",
      patientType: "Recipient",
      firstName: "Alex",
      lastName: "Able",
      stage: "Phase3",
      status: "Active",
      nephrologistId: 10,
      fellowId: 20,
      birthDate: "1980-02-03",
      surgeryDate: null,
      linkedRecipientId: null,
    },
    {
      hrn: "D1",
      patientType: "Donor",
      firstName: "Casey",
      lastName: "Baker",
      stage: "Phase3",
      status: "Active",
      nephrologistId: null,
      fellowId: 10,
      birthDate: null,
      surgeryDate: null,
      linkedRecipientId: 1,
    },
    {
      hrn: "R2",
      patientType: "Recipient",
      firstName: "Blair",
      lastName: "Able",
      stage: "Clearances",
      status: "Active",
      nephrologistId: null,
      fellowId: null,
      birthDate: null,
      surgeryDate: null,
      linkedRecipientId: null,
    },
    {
      hrn: "R3",
      patientType: "Recipient",
      firstName: "Drew",
      lastName: "Cross",
      stage: "PostKT",
      status: "Active",
      nephrologistId: null,
      fellowId: null,
      birthDate: null,
      surgeryDate: addDays(today, -10),
      linkedRecipientId: null,
    },
    {
      hrn: "D2",
      patientType: "Donor",
      firstName: "Eli",
      lastName: "Delta",
      stage: "PostDonation",
      status: "Inactive",
      nephrologistId: null,
      fellowId: null,
      birthDate: null,
      surgeryDate: addDays(today, -10),
      linkedRecipientId: 4,
    },
    {
      hrn: "R4",
      patientType: "Recipient",
      firstName: "Fran",
      lastName: "Echo",
      stage: "Phase1",
      status: "Transferred",
      nephrologistId: null,
      fellowId: null,
      birthDate: null,
      surgeryDate: null,
      linkedRecipientId: null,
    },
    {
      hrn: "D3",
      patientType: "Donor",
      firstName: "Gray",
      lastName: "Fox",
      stage: "Clearances",
      status: "Deceased",
      nephrologistId: null,
      fellowId: null,
      birthDate: null,
      surgeryDate: null,
      linkedRecipientId: 6,
    },
  ];
  for (const patient of patients) {
    await pg`INSERT INTO ktp.patients ${pg(patient)} `;
  }
  await pg`UPDATE ktp.patients SET "createdAt" = ${addDays(today, -40)}::timestamp`;
  await pg`INSERT INTO ktp."checklistCatalog" (name, category, "appliesTo", "asIndicated") VALUES
    ('Ethics committee','Clearance','Both',false), ('HTEC evaluation and approval','Milestone','Both',false),
    ('CBC','Lab','Both',false), ('Optional lab','Lab','Both',true),
    ('CBC with differential','Lab','Both',false)`;
  await pg`UPDATE ktp."checklistCatalog" SET phase=1 WHERE name='CBC with differential'`;
  await pg`INSERT INTO ktp."patientChecklist" ("patientId", "catalogId", status)
    SELECT p.id, c.id, 'Done' FROM ktp.patients p CROSS JOIN ktp."checklistCatalog" c WHERE p.id IN (1,2) AND (c.id <= 3 OR c.id = 5)`;
  for (const [status, deadline, filed] of [
    ["Done", yesterday, null],
    ["Done", today, null],
    ["Done", addDays(today, 7), null],
    ["Done", addDays(today, 8), null],
    ["Superseded", null, null],
    ["Superseded", yesterday, yesterday],
    ["Planned", null, null],
  ]) {
    await pg`INSERT INTO ktp."serviceRecords" ("patientId", "serviceType", label, status, "dueDate", "claimDeadline", "claimFiledDate")
      VALUES (1,'Laboratory','Synthetic fixture',${status!},${yesterday}::date,${deadline}::date,${filed}::date)`;
  }
  await pg`INSERT INTO ktp.appointments ("patientId", title, kind, "startsAt", "cancelledAt", response) VALUES
    (1,'Synthetic visit','FollowUp',${yesterday}::timestamp,NULL,'Confirmed'),
    (4,'Synthetic visit','FollowUp',${yesterday}::timestamp,NULL,'RescheduleRequested'),
    (4,'Synthetic cancelled','FollowUp',${yesterday}::timestamp,${yesterday}::timestamp,'RescheduleRequested')`;
  await pg`INSERT INTO ktp."activityLog" ("patientId", action, details, "createdAt") VALUES
    (1,'ENROLL_PATIENT','{"stage":"Clearances"}',${addDays(today, -40)}::timestamp),
    (1,'UPDATE_PATIENT','{"fromStage":"Clearances","toStage":"Phase3"}',${addDays(today, -13)}::timestamp),
    (1,'UPDATE_PATIENT','{"fromStage":"Phase3","toStage":"Phase3"}',${yesterday}::timestamp),
    (2,'ENROLL_PATIENT','{"stage":"Phase3"}',${addDays(today, -20)}::timestamp),
    (3,'UPDATE_PATIENT','{"changes":["stage"]}',${yesterday}::timestamp),
    (4,'UPDATE_PATIENT','malformed history',${yesterday}::timestamp)`;

  const portProbe = createServer().listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const address = portProbe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => portProbe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  let serviceLog = "";
  service = spawn(
    new URL("../src/rust-backend/target/debug/ktp-backend", import.meta.url)
      .pathname,
    [],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl.toString(),
        JWT_SECRET: secret,
        RUST_BIND_ADDR: `127.0.0.1:${port}`,
        RESEND_API_KEY: "",
        NODE_ENV: "test",
        APP_URL: origin,
        GOOGLE_CLIENT_ID: "synthetic-client",
        GOOGLE_CLIENT_SECRET: "synthetic-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  service.on("error", error => {
    serviceLog += error.message;
  });
  service.stdout?.on("data", chunk => {
    serviceLog += chunk;
  });
  service.stderr?.on("data", chunk => {
    serviceLog += chunk;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${origin}/health/ready`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    if (service.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, `Rust service did not start: ${serviceLog}`);
  const token = await new SignJWT({
    openId: "admin",
    appId: "fixture",
    name: "Synthetic Admin",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("5m")
    .sign(key);
  const headers = {
    cookie: `app_session_id=${token}`,
    "user-agent": "KTP integration fixture",
    "x-ktp-client-ip": "192.0.2.10",
  };
  const read = async (
    path: string,
    customHeaders: Record<string, string> = headers
  ) => fetch(`${origin}${path}`, { headers: customHeaders });
  for (const path of [
    "/api/rust/session",
    "/api/rust/patients",
    "/api/rust/patients/1",
    "/api/rust/metrics",
  ]) {
    assert.equal((await read(path, {})).status, 401);
  }
  const staleAdminToken = await new SignJWT({
    openId: "patient",
    role: "admin",
    email: "almanalaysay93@gmail.com",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(key);
  assert.equal(
    (
      await read("/api/rust/patients", {
        cookie: `app_session_id=${staleAdminToken}`,
      })
    ).status,
    403
  );
  assert.equal(
    (await pg`SELECT role FROM ktp.users WHERE "openId" = 'patient'`)[0].role,
    "user"
  );
  assert.equal((await read("/api/rust/patients?status=invalid")).status, 400);
  assert.equal((await read("/api/rust/patients?type=invalid")).status, 400);
  assert.equal((await read("/api/rust/patients/0")).status, 400);
  assert.equal((await read("/api/rust/patients/999999")).status, 404);
  assert.deepEqual(
    await (await read("/api/rust/patients/999999?allowMissing=true")).json(),
    { patient: null, linkedRecipient: null, linkedDonors: [] }
  );

  // Compare Rust reads with PostgreSQL's JSON representation and existing tRPC callers.
  process.env.DATABASE_URL = databaseUrl.toString();
  process.env.RUST_BACKEND_URL = origin;
  process.env.JWT_SECRET = secret;
  const { patientsRouter } = await import("../server/routers/patients");
  const { dashboardRouter } = await import("../server/routers/dashboard");
  const { rustBackendEnabled } = await import("../server/rustBackend");
  const context = {
    req: { headers, ip: "192.0.2.10" } as Request,
    res: {},
    user: { id: 1, email: "almanalaysay93@gmail.com", role: "admin" },
  } as TrpcContext;
  const caller = patientsRouter.createCaller(context);
  for (const filters of [
    {},
    { status: "Active" },
    { doctorId: 10 },
    { search: "aLeX" },
    { search: "%' OR 1=1 --" },
    {
      type: "Donor" as const,
      status: "Active" as const,
      stage: "Phase3",
      doctorId: 10,
      search: "BAK",
    },
  ]) {
    const params = new URLSearchParams(
      Object.entries(filters).map(([key, value]) => [key, String(value)])
    );
    const response = await read(`/api/rust/patients?${params}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const all = await pg`SELECT to_jsonb(p) AS row FROM ktp.patients p
      WHERE (${filters.type ?? null}::text IS NULL OR p."patientType" = ${filters.type ?? null})
        AND (${filters.stage ?? null}::text IS NULL OR stage = ${filters.stage ?? null})
        AND (${filters.status ?? null}::text IS NULL OR status = ${filters.status ?? null})
        AND (${filters.doctorId ?? null}::integer IS NULL OR "nephrologistId" = ${filters.doctorId ?? null} OR "fellowId" = ${filters.doctorId ?? null})
        AND (${filters.search ?? null}::text IS NULL OR "firstName" ILIKE ${`%${filters.search ?? ""}%`} OR "lastName" ILIKE ${`%${filters.search ?? ""}%`} OR hrn ILIKE ${`%${filters.search ?? ""}%`})
      ORDER BY "lastName", "firstName"`;
    assert.deepEqual(
      await response.json(),
      all.map(r => r.row)
    );
    const bridged = await caller.list(filters);
    assert.deepEqual(
      bridged.map(p => p.hrn),
      all.map(r => r.row.hrn)
    );
    assert.ok(bridged.every(p => p.createdAt instanceof Date));
  }
  const profile = await caller.getById({ id: 1 });
  assert.equal(profile.patient?.hrn, "R1");
  assert.equal(profile.linkedDonors[0].hrn, "D1");
  assert.equal(
    profile.patient?.birthDate?.toISOString(),
    "1980-02-03T00:00:00.000Z"
  );
  const donor = await caller.getById({ id: 2 });
  assert.equal(donor.linkedRecipient?.hrn, "R1");
  const logs =
    await pg`SELECT * FROM ktp."activityLog" WHERE action='VIEW_PATIENT_PROFILE' ORDER BY id`;
  assert.equal(logs.length, 2);
  assert.equal(logs[0].actorUserId, 1);
  assert.equal(logs[0].patientId, 1);
  assert.equal(logs[0].ipAddress, "192.0.2.10");
  assert.equal(logs[0].userAgent, "KTP integration fixture");
  assert.deepEqual(JSON.parse(logs[0].details), {
    hrn: "R1",
    name: "Able, Alex",
  });
  await assert.rejects(
    () => patientsRouter.createCaller({ ...context, user: null }).list(),
    error => (error as { code: string }).code === "FORBIDDEN"
  );

  // The migrated route must still synchronize a stale catalog on first access.
  const { getDb, getBatchClient } = await import("../server/db");
  const nodeDb = await getDb();
  closeNodePools = async () => {
    await getBatchClient()?.end();
    await nodeDb?.$client.end();
  };
  await dashboardRouter.createCaller(context).metrics({});
  assert.ok(
    (await pg`SELECT id FROM ktp."checklistCatalog" WHERE name='Hemoglobin'`)
      .length > 0
  );
  assert.equal(
    (
      await pg`SELECT active FROM ktp."checklistCatalog" WHERE name='CBC with differential'`
    )[0].active,
    false
  );
  assert.equal(
    (await dashboardRouter.createCaller(context).metrics({ status: "Active" }))
      .analysis.ready,
    1
  );
  const allPatients = (
    await pg`SELECT to_jsonb(p) AS row FROM ktp.patients p`
  ).map(r => r.row);
  const checklist =
    await pg`SELECT p.id AS "patientId", c.name,c.category,COALESCE(pc.status,'Pending') AS status,
    c."asIndicated", pc.id IS NOT NULL AS recorded FROM ktp.patients p JOIN ktp."checklistCatalog" c
    ON c.active AND (c."appliesTo"='Both' OR c."appliesTo"=p."patientType")
    LEFT JOIN ktp."patientChecklist" pc ON pc."patientId"=p.id AND pc."catalogId"=c.id`;
  const services = (
    await pg`SELECT to_jsonb(s) AS row FROM ktp."serviceRecords" s`
  ).map(r => r.row);
  const appointments = (
    await pg`SELECT to_jsonb(a) AS row FROM ktp.appointments a`
  ).map(r => r.row);
  const events = (
    await pg`SELECT to_jsonb(a) AS row FROM ktp."activityLog" a WHERE action IN ('UPDATE_PATIENT','ENROLL_PATIENT') ORDER BY "createdAt",id`
  ).map(r => r.row);
  for (const status of [undefined, ...PATIENT_STATUSES] as (
    | PatientStatus
    | undefined
  )[]) {
    const summaryRows = allPatients
      .filter(p => !status || p.status === status)
      .map(p => ({
        ...p,
        ethicsStatus: checklist.some(
          c =>
            c.patientId === p.id &&
            c.name === "Ethics committee" &&
            c.status === "Pending"
        )
          ? "Pending"
          : null,
      }));
    const expected = {
      ...summarizeMetrics(summaryRows as MetricsPatient[]),
      analysis: analyzeMetrics({
        patients: allPatients,
        checklist: [...checklist] as Parameters<
          typeof analyzeMetrics
        >[0]["checklist"],
        services,
        appointments,
        stageEvents: events,
        today,
        status,
      }),
    };
    const actual = await dashboardRouter
      .createCaller(context)
      .metrics(status ? { status } : {});
    assert.deepEqual(
      actual,
      expected,
      `Full metrics parity for status=${status ?? "All"}`
    );
  }
  // A recorded optional requirement blocks readiness in both implementations.
  await pg`INSERT INTO ktp."patientChecklist" ("patientId","catalogId",status) VALUES (1,4,'Pending')`;
  assert.equal(
    (await dashboardRouter.createCaller(context).metrics({ status: "Active" }))
      .analysis.ready,
    0
  );
  await testPortal(pg, origin, headers);
  await testClinicalWrites(pg, origin, headers);
  await testAdminWrites(pg, origin, headers);
  await testPatientImports(pg, origin, headers);
  await testAutomations(pg, origin, headers);
  await testAutomationFailures(pg, origin, headers);
  await testPatientLabs(pg, origin, headers);
  await testOAuth(origin);
  await pg`DELETE FROM ktp.users WHERE "openId"='admin'`;
  assert.equal((await read("/api/rust/session")).status, 401);
  process.env.RUST_BACKEND_URL = "";
  assert.equal(rustBackendEnabled(), false);
  console.log(
    "PASS: PostgreSQL reads, Node JWT compatibility, access revocation, profile audits, tRPC adapters, dates, all status filters, and full metrics parity"
  );
} finally {
  if (service && service.exitCode === null) {
    const exited = once(service, "exit");
    service.kill("SIGTERM");
    await exited;
  }
  await pg?.end();
  await closeNodePools?.();
  if (created)
    await admin.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
