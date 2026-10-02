import { LAB_CATALOG, CHECKLIST_CATALOG } from "./clinicalCatalog";
import { TRPCError } from "@trpc/server";
import { getBatchClient, getDb } from "./db";
import { getSqliteDb } from "./localDb";
import type { Appointment, ChecklistCatalogItem, LabResult, LabTest, ServiceRecord } from "../drizzle/schema";
import { LAB_PHASE_LABEL, isValidStageForPatientType, type LabPhase } from "../shared/ktp";

type Row = Record<string, any>;
type Query = { sql: string; args: unknown[] };
type Program<T> = Generator<Query, T, Row[]>;
const query = (sql: string, ...args: unknown[]): Query => ({ sql, args });
const fail = (message: string, code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" = "BAD_REQUEST"): never => {
  throw new TRPCError({ code, message });
};

// One synchronous SQLite transaction or one PostgreSQL transaction runs the same
// operation. No await inside SQLite: unrelated requests cannot enter its transaction.
async function execute<T>(make: () => Program<T>): Promise<T> {
  if (!process.env.DATABASE_URL) {
    const db = getSqliteDb();
    return db.transaction(() => {
      const program = make();
      let step = program.next();
      while (!step.done) {
        const statement = db.prepare(step.value.sql);
        const rows = statement.reader
          ? statement.all(...step.value.args)
          : (statement.run(...step.value.args), []);
        step = program.next(rows as Row[]);
      }
      return step.value;
    }).immediate();
  }
  if (!await getDb()) throw new Error("Database unavailable");
  const client = getBatchClient()!;
  await ensureCatalog();
  return await client.begin(async (transaction) => {
    const program = make();
    let step = program.next();
    while (!step.done) {
      let parameter = 0;
      const sql = step.value.sql.replace(/\?/g, () => `$${++parameter}`);
      const rows = await transaction.unsafe(sql, step.value.args as any[]);
      step = program.next([...rows]);
    }
    return step.value;
  }) as T;
}

function* patient(patientId: number): Program<Row> {
  const rows = yield query('SELECT * FROM "patients" WHERE id = ?', patientId);
  return rows[0] ?? fail("Patient not found", "NOT_FOUND");
}

function* audit(actor: number, patientId: number, action: string, id: number, extra?: Record<string, unknown>): Program<void> {
  yield query('INSERT INTO "activityLog" ("actorUserId", "patientId", action, details) VALUES (?, ?, ?, ?)',
    actor, patientId, action, JSON.stringify({ id, ...extra }));
}

type DateFields = "dueDate" | "serviceDate" | "claimDeadline" | "claimFiledDate";
export type ClinicalService = Omit<ServiceRecord, DateFields> & Record<DateFields, string | null> & { dueDate: string };
export type ClinicalAppointment = Omit<Appointment, "startsAt" | "cancelledAt"> & { startsAt: string; cancelledAt: string | null };
export type ClinicalLabResult = LabResult & { testName: string; unit: string; serviceDate: string | null; phase: LabPhase | null };
export type ClinicalChecklist = ChecklistCatalogItem & { catalogId: number; status: "Pending" | "Done" | "NA"; doneDate: string | null; note: string | null };
function dateOnly(value: unknown): string | null {
  return value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : null;
}
function service(row: Row): ClinicalService {
  return { ...row, dueDate: dateOnly(row.dueDate), serviceDate: dateOnly(row.serviceDate),
    claimDeadline: dateOnly(row.claimDeadline), claimFiledDate: dateOnly(row.claimFiledDate) } as ClinicalService;
}
function appointment(row: Row): ClinicalAppointment {
  const iso = (value: string | Date) => value instanceof Date ? value.toISOString() :
    new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(" ", "T")}Z`).toISOString();
  return { ...row, startsAt: iso(row.startsAt), cancelledAt: row.cancelledAt ? iso(row.cancelledAt) : null } as ClinicalAppointment;
}

export async function getClinical(patientId: number) {
  return execute(function* () {
    const profile = yield* patient(patientId);
    const services = yield query('SELECT * FROM "serviceRecords" WHERE "patientId" = ? ORDER BY "dueDate" DESC, id DESC', patientId);
    const tests = yield query('SELECT * FROM "labTests" WHERE active = true ORDER BY "sortOrder", name');
    const labs = yield query(`SELECT r.*, t.name AS "testName", t.unit, s."serviceDate", s.phase
      FROM "labResults" r JOIN "labTests" t ON t.id = r."labTestId"
      JOIN "serviceRecords" s ON s.id = r."serviceRecordId"
      WHERE s."patientId" = ? AND s.status = 'Done' ORDER BY s."serviceDate" DESC, r.id DESC`, patientId);
    const checklist = yield query(`SELECT c.*, c.id AS "catalogId", COALESCE(p.status, 'Pending') AS status, p."doneDate", p.note
      FROM "checklistCatalog" c LEFT JOIN "patientChecklist" p ON p."catalogId" = c.id AND p."patientId" = ?
      WHERE c.active = true AND (c."appliesTo" = 'Both' OR c."appliesTo" = ?) ORDER BY c.phase, c."sortOrder", c.id`, patientId, profile.patientType);
    const visits = yield query('SELECT *, CAST("startsAt" AS TEXT) AS "startsAt", CAST("cancelledAt" AS TEXT) AS "cancelledAt" FROM appointments WHERE "patientId" = ? ORDER BY appointments."startsAt" DESC, id DESC', patientId);
    return {
      services: services.map(service), labTests: tests as LabTest[],
      labResults: labs.map(row => ({ ...row, serviceDate: dateOnly(row.serviceDate) })) as ClinicalLabResult[],
      checklist: checklist.map(row => ({ ...row, asIndicated: Boolean(row.asIndicated), doneDate: dateOnly(row.doneDate) })) as ClinicalChecklist[],
      appointments: visits.map(appointment),
    };
  });
}

export async function listClinicalDashboard() {
  return execute(function* () {
    const services = yield query('SELECT s.* FROM "serviceRecords" s JOIN patients p ON p.id = s."patientId" WHERE p.status = ?', "Active");
    const visits = yield query('SELECT a.*, CAST(a."startsAt" AS TEXT) AS "startsAt", CAST(a."cancelledAt" AS TEXT) AS "cancelledAt" FROM appointments a JOIN patients p ON p.id = a."patientId" WHERE p.status = ?', "Active");
    return { services: services.map(service), appointments: visits.map(appointment) };
  });
}

export type AddService = { patientId: number; serviceType: string; label: string; dueDate: string; note?: string };
export async function addService(input: AddService, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query('INSERT INTO "serviceRecords" ("patientId", "serviceType", label, "dueDate", note) VALUES (?, ?, ?, ?, ?) RETURNING id',
      input.patientId, input.serviceType, input.label, input.dueDate, input.note ?? null);
    yield* audit(actor, input.patientId, "clinical.service.add", row.id);
    return { id: row.id as number };
  });
}

function labFlag(value: string, lowRaw: unknown, highRaw: unknown): "Low" | "Normal" | "High" | null {
  const numeric = Number(value);
  const bound = (raw: unknown) => raw == null || String(raw).trim() === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
  const low = bound(lowRaw), high = bound(highRaw);
  return !Number.isFinite(numeric) || (low === null && high === null) ? null :
    low !== null && numeric < low ? "Low" : high !== null && numeric > high ? "High" : "Normal";
}

export type RecordResult = {
  patientId: number;
  serviceRecordId: number;
  serviceDate: string;
  claimDeadline?: string;
  note?: string;
  nurseApproved?: boolean;
  approvedByNurse?: string;
  results?: { labTestId: number; value: string }[];
};
export async function recordResult(input: RecordResult, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.serviceRecordId, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (current.status !== "Planned") fail("Only planned services can receive results", "CONFLICT");
    if (input.results?.length && !["Laboratory", "Tacro"].includes(current.serviceType)) fail("Lab values require a laboratory or tacrolimus service");
    const approvalTag = input.nurseApproved
      ? input.approvedByNurse
        ? `[Approved by Nurse: ${input.approvedByNurse}]`
        : "[Approved by Nurse]"
      : null;
    const finalNote = [input.note, approvalTag].filter(Boolean).join(" ") || null;
    const changed = yield query(`UPDATE "serviceRecords" SET status = 'Done', "serviceDate" = ?, "claimDeadline" = ?, note = COALESCE(?, note), "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ? AND "patientId" = ? AND status = 'Planned' RETURNING id`,
      input.serviceDate, input.claimDeadline ?? null, finalNote, input.serviceRecordId, input.patientId);
    if (!changed.length) fail("Service already changed; refresh and retry", "CONFLICT");
    for (const value of input.results ?? []) {
      const [test] = yield query('SELECT * FROM "labTests" WHERE id = ? AND active = true', value.labTestId);
      if (!test) fail("Lab test not found", "NOT_FOUND");
      const flag = labFlag(value.value, test.low, test.high);
      yield query('INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?)',
        input.serviceRecordId, value.labTestId, value.value, test.low, test.high, flag);
    }
    yield* audit(actor, input.patientId, "clinical.result.record", input.serviceRecordId, {
      nurseApproved: input.nurseApproved ?? false,
      approvedByNurse: input.approvedByNurse ?? null,
    });
    return { id: input.serviceRecordId };
  });
}

export type AddLabResult = { patientId: number; phase: LabPhase; serviceDate: string; labTestId: number; value: string };
// A lab result entered from the Labs tab. Results of one phase and one date share one completed laboratory service.
export async function addLabResult(input: AddLabResult, actor: number) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    if (!isValidStageForPatientType(input.phase, profile.patientType)) fail("Phase does not apply to this patient type");
    const [test] = yield query('SELECT * FROM "labTests" WHERE id = ? AND active = true', input.labTestId);
    if (!test) fail("Lab test not found", "NOT_FOUND");
    let [record] = yield query(`SELECT id FROM "serviceRecords" WHERE "patientId" = ? AND phase = ? AND "serviceDate" = ? AND "serviceType" = 'Laboratory' AND status = 'Done' ORDER BY id LIMIT 1`,
      input.patientId, input.phase, input.serviceDate);
    if (!record) [record] = yield query(`INSERT INTO "serviceRecords" ("patientId", "serviceType", label, status, "dueDate", "serviceDate", phase) VALUES (?, 'Laboratory', ?, 'Done', ?, ?, ?) RETURNING id`,
      input.patientId, `${LAB_PHASE_LABEL[input.phase]} labs`, input.serviceDate, input.serviceDate, input.phase);
    const saved = yield query('SELECT id FROM "labResults" WHERE "serviceRecordId" = ? AND "labTestId" = ?', record.id, input.labTestId);
    if (saved.length) fail("This test already has a result for that phase and date. Remove it first, or correct it in Edit patient.", "CONFLICT");
    const [row] = yield query('INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      record.id, input.labTestId, input.value, test.low, test.high, labFlag(input.value, test.low, test.high));
    yield* audit(actor, input.patientId, "clinical.lab.add", row.id, { serviceRecordId: record.id, phase: input.phase });
    return { id: row.id as number, serviceRecordId: record.id as number };
  });
}

export type UpdateService = {
  patientId: number;
  id: number;
  reason: string;
  label?: string;
  dueDate?: string;
  serviceDate?: string;
  claimDeadline?: string | null;
  claimFiledDate?: string | null;
  note?: string | null;
  /** A blank value removes the saved lab value. Omitted tests stay unchanged. */
  results?: { labTestId: number; value: string }[];
};
// Correction of a saved service record. Each call writes one recordRevisions row with the reason.
export async function updateService(input: UpdateService, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.id, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (current.status === "Superseded") fail("Superseded services cannot be edited", "CONFLICT");
    if (current.status === "Planned" && (input.serviceDate || input.claimFiledDate || input.results?.length)) fail("Record a result before editing result details");
    if (input.results?.length && !["Laboratory", "Tacro"].includes(current.serviceType)) fail("Lab values require a laboratory or tacrolimus service");
    const keep = <T,>(next: T | undefined, saved: T) => next === undefined ? saved : next;
    const before = { label: current.label as string, dueDate: dateOnly(current.dueDate), serviceDate: dateOnly(current.serviceDate),
      claimDeadline: dateOnly(current.claimDeadline), claimFiledDate: dateOnly(current.claimFiledDate), note: (current.note ?? null) as string | null };
    const after = {
      label: keep(input.label, before.label), dueDate: keep(input.dueDate, before.dueDate), serviceDate: keep(input.serviceDate, before.serviceDate),
      claimDeadline: keep(input.claimDeadline, before.claimDeadline), claimFiledDate: keep(input.claimFiledDate, before.claimFiledDate),
      note: input.note === undefined ? before.note : input.note || null,
    };
    if (after.serviceDate && after.claimDeadline && after.claimDeadline < after.serviceDate) fail("Claim deadline cannot precede service date");
    if (after.serviceDate && after.claimFiledDate && after.claimFiledDate < after.serviceDate) fail("Claim filing cannot precede service date");
    const labs = 'SELECT * FROM "labResults" WHERE "serviceRecordId" = ? ORDER BY "labTestId", id';
    const values = (rows: Row[]) => rows.map(row => ({ labTestId: Number(row.labTestId), value: String(row.value) }));
    const labsBefore = yield query(labs, input.id);
    yield query(`UPDATE "serviceRecords" SET label = ?, "dueDate" = ?, "serviceDate" = ?, "claimDeadline" = ?, "claimFiledDate" = ?, note = ?, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ? AND "patientId" = ?`,
      after.label, after.dueDate, after.serviceDate, after.claimDeadline, after.claimFiledDate, after.note, input.id, input.patientId);
    for (const value of input.results ?? []) {
      const saved = labsBefore.find(row => Number(row.labTestId) === value.labTestId);
      if (value.value === "") {
        if (saved) yield query('DELETE FROM "labResults" WHERE "serviceRecordId" = ? AND "labTestId" = ?', input.id, value.labTestId);
      } else if (saved) {
        // The reference range saved with the result stays. Only the value and its flag change.
        yield query('UPDATE "labResults" SET value = ?, flag = ? WHERE "serviceRecordId" = ? AND "labTestId" = ?',
          value.value, labFlag(value.value, saved.lowSnapshot, saved.highSnapshot), input.id, value.labTestId);
      } else {
        const [test] = yield query('SELECT * FROM "labTests" WHERE id = ? AND active = true', value.labTestId);
        if (!test) fail("Lab test not found", "NOT_FOUND");
        yield query('INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?)',
          input.id, value.labTestId, value.value, test.low, test.high, labFlag(value.value, test.low, test.high));
      }
    }
    const labsAfter = yield query(labs, input.id);
    const snapshot = { before: JSON.stringify({ ...before, labs: values(labsBefore) }), after: JSON.stringify({ ...after, labs: values(labsAfter) }) };
    if (snapshot.before === snapshot.after) fail("No change to save");
    yield query('INSERT INTO "recordRevisions" ("entityType", "entityId", "before", "after", reason, "userId") VALUES (?, ?, ?, ?, ?, ?)',
      "serviceRecord", input.id, snapshot.before, snapshot.after, input.reason, actor);
    yield* audit(actor, input.patientId, "clinical.service.update", input.id, { reason: input.reason });
    return { id: input.id };
  });
}

export type SetChecklist = { patientId: number; catalogId: number; status: "Pending" | "Done" | "NA"; doneDate?: string; note?: string };
function* checklistWrite(profile: Row, input: SetChecklist, actor: number): Program<number> {
  const [catalog] = yield query('SELECT * FROM "checklistCatalog" WHERE id = ? AND active = true', input.catalogId);
  if (!catalog || !["Both", profile.patientType].includes(catalog.appliesTo)) fail("Checklist item not found for this patient", "NOT_FOUND");
  const [row] = yield query(`INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate", note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT ("patientId", "catalogId") DO UPDATE SET status = excluded.status, "doneDate" = excluded."doneDate", note = excluded.note, "updatedAt" = CURRENT_TIMESTAMP RETURNING id`,
    input.patientId, input.catalogId, input.status, input.status === "Done" ? input.doneDate : null, input.note ?? null);
  yield* audit(actor, input.patientId, "clinical.checklist.update", row.id);
  return row.id as number;
}
export async function setChecklist(input: SetChecklist, actor: number) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    return { id: yield* checklistWrite(profile, input, actor) };
  });
}
/** Saves several checklist items in one transaction: all items save, or none. */
export async function setChecklistMany(input: { patientId: number; items: Omit<SetChecklist, "patientId">[] }, actor: number) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    for (const item of input.items) yield* checklistWrite(profile, { ...item, patientId: input.patientId }, actor);
    return { count: input.items.length };
  });
}

export type AddAppointment = { patientId: number; title: string; kind: string; startsAt: string; location?: string; note?: string };
export async function addAppointment(input: AddAppointment, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query('INSERT INTO appointments ("patientId", title, kind, "startsAt", location, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      input.patientId, input.title, input.kind, new Date(input.startsAt).toISOString(), input.location ?? null, input.note ?? null);
    yield* audit(actor, input.patientId, "clinical.appointment.add", row.id);
    return { id: row.id as number };
  });
}

export async function cancelAppointment(input: { patientId: number; id: number }, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query('UPDATE appointments SET "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "cancelledAt" IS NULL RETURNING id, title', input.id, input.patientId);
    if (!row) fail("Appointment missing or already cancelled", "CONFLICT");
    yield* audit(actor, input.patientId, "clinical.appointment.cancel", row.id);
    return { id: input.id };
  });
}

export async function fileClaim(input: { patientId: number; id: number; claimFiledDate: string }, actor: number) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.id, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (!current.serviceDate || current.status === "Planned") fail("Record a result before filing a claim");
    if (input.claimFiledDate < dateOnly(current.serviceDate)!) fail("Claim filing cannot precede service date");
    const changed = yield query('UPDATE "serviceRecords" SET "claimFiledDate" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "claimFiledDate" IS NULL RETURNING id', input.claimFiledDate, input.id, input.patientId);
    if (!changed.length) fail("Claim already filed", "CONFLICT");
    yield* audit(actor, input.patientId, "clinical.claim.file", input.id);
    return { id: input.id };
  });
}

export async function respondToAppointment(input: {
  patientId: number;
  id: number;
  response: "Confirmed" | "RescheduleRequested";
  responseNote?: string;
}) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query(
      'UPDATE appointments SET response = ?, "responseNote" = ?, "respondedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "cancelledAt" IS NULL RETURNING id, title',
      input.response,
      input.responseNote ?? null,
      input.id,
      input.patientId
    );
    if (!row) fail("Appointment missing or cancelled", "CONFLICT");
    yield* audit(input.patientId, input.patientId, `clinical.appointment.respond.${input.response}`, row.id);
    return { id: input.id, response: input.response };
  });
}

export async function listAllAppointments() {
  return execute(function* () {
    const rows = yield query(`
      SELECT a.*,
        CAST(a."startsAt" AS TEXT) AS "startsAt",
        CAST(a."cancelledAt" AS TEXT) AS "cancelledAt",
        CAST(a."respondedAt" AS TEXT) AS "respondedAt",
        p.hrn, p."firstName", p."lastName", p."patientType", p.stage, p."contactNumber"
      FROM appointments a
      JOIN patients p ON p.id = a."patientId"
      WHERE p.status = 'Active'
      ORDER BY a."startsAt" ASC, a.id DESC
    `);
    return rows.map((r: any) => ({
      ...appointment(r),
      patientName: `${r.lastName}, ${r.firstName}`,
      hrn: String(r.hrn),
      patientType: String(r.patientType),
      stage: String(r.stage),
      contactNumber: r.contactNumber ? String(r.contactNumber) : null,
    }));
  });
}

let catalogReady: Promise<void> | undefined;
function ensureCatalog(): Promise<void> {
  return catalogReady ??= getBatchClient()!.begin(async tx => {
    await tx.unsafe('LOCK TABLE "labTests", "checklistCatalog" IN SHARE ROW EXCLUSIVE MODE');
    const [labs] = await tx.unsafe('SELECT COUNT(*) AS count FROM "labTests"');
    if (Number(labs.count) === 0) for (const [name, unit, sort] of LAB_CATALOG) {
      await tx.unsafe('INSERT INTO "labTests" (name, unit, "sortOrder", active) VALUES ($1,$2,$3,true)', [name, unit, sort]);
    }
    const [items] = await tx.unsafe('SELECT COUNT(*) AS count FROM "checklistCatalog"');
    if (Number(items.count) === 0) for (const [name, category, phase, appliesTo, asIndicated, sort] of CHECKLIST_CATALOG) {
      await tx.unsafe('INSERT INTO "checklistCatalog" (name, category, phase, "appliesTo", "asIndicated", "sortOrder", active) VALUES ($1,$2,$3,$4,$5,$6,true)', [name, category, phase, appliesTo, Boolean(asIndicated), sort]);
    }
  }).then(() => undefined).catch(error => { catalogReady = undefined; throw error; });
}
