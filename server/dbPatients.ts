import { and, eq, ilike, or, sql } from "drizzle-orm";
import {
  doctors,
  patients,
  type Doctor,
  type InsertDoctor,
  type InsertPatient,
  type Patient,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getSqliteDb } from "./localDb";

/* -------------------------------------------------------------------------- */
/*                                  PATIENTS                                  */
/* -------------------------------------------------------------------------- */

export async function getPatientById(id: number): Promise<Patient | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Patient | undefined;
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getPatientByHrn(hrn: string): Promise<Patient | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE hrn = ?").get(hrn) as Patient | undefined;
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.hrn, hrn)).limit(1);
  return result[0] ?? null;
}

export async function getPatientByLinkedUserId(userId: number): Promise<Patient | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE linkedUserId = ?").get(userId) as Patient | undefined;
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.linkedUserId, userId)).limit(1);
  return result[0] ?? null;
}

export async function getPatientByAccountEmail(email: string): Promise<Patient | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE lower(accountEmail) = ?").get(cleanEmail) as Patient | undefined;
    return row ?? null;
  }
  const result = await db
    .select()
    .from(patients)
    .where(sql`lower(${patients.accountEmail}) = ${cleanEmail}`)
    .limit(1);
  return result[0] ?? null;
}

export async function autoLinkPatientByEmail(userId: number, email: string | null | undefined): Promise<Patient | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const patient = sqlite
      .prepare("SELECT * FROM patients WHERE lower(accountEmail) = ? AND status = 'Active'")
      .get(cleanEmail) as Patient | undefined;
    if (!patient) return null;
    sqlite.prepare("UPDATE patients SET linkedUserId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(userId, patient.id);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(patient.id) as Patient;
  }

  const [match] = await db
    .select()
    .from(patients)
    .where(and(sql`lower(${patients.accountEmail}) = ${cleanEmail}`, eq(patients.status, "Active")))
    .limit(1);
  if (!match) return null;

  const [updated] = await db
    .update(patients)
    .set({ linkedUserId: userId, updatedAt: new Date() })
    .where(eq(patients.id, match.id))
    .returning();
  return updated ?? null;
}

export async function listPatients(opts: {
  type?: string;
  stage?: string;
  doctorId?: number;
  status?: string;
  search?: string;
} = {}): Promise<Patient[]> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    let query = "SELECT * FROM patients WHERE 1=1";
    const params: any[] = [];
    if (opts.type) {
      query += " AND patientType = ?";
      params.push(opts.type);
    }
    if (opts.stage) {
      query += " AND stage = ?";
      params.push(opts.stage);
    }
    if (opts.doctorId) {
      query += " AND (nephrologistId = ? OR fellowId = ?)";
      params.push(opts.doctorId, opts.doctorId);
    }
    if (opts.status) {
      query += " AND status = ?";
      params.push(opts.status);
    }
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      query += " AND (lower(firstName) LIKE ? OR lower(lastName) LIKE ? OR lower(hrn) LIKE ?)";
      params.push(term, term, term);
    }
    query += " ORDER BY lastName ASC, firstName ASC";
    return sqlite.prepare(query).all(...params) as Patient[];
  }

  const conditions = [];
  if (opts.type) conditions.push(eq(patients.patientType, opts.type as any));
  if (opts.stage) conditions.push(eq(patients.stage, opts.stage));
  if (opts.doctorId) {
    conditions.push(or(eq(patients.nephrologistId, opts.doctorId), eq(patients.fellowId, opts.doctorId)));
  }
  if (opts.status) conditions.push(eq(patients.status, opts.status as any));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(ilike(patients.firstName, term), ilike(patients.lastName, term), ilike(patients.hrn, term))
    );
  }

  return db
    .select()
    .from(patients)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(patients.lastName, patients.firstName);
}

export async function createPatient(data: InsertPatient): Promise<Patient> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare(`
      INSERT INTO patients (
        hrn, patientType, firstName, middleName, lastName, suffix,
        sex, birthDate, contactNumber, accountEmail, linkedUserId,
        nephrologistId, fellowId, stage, riskCategory, surgeryDate,
        linkedRecipientId, followupMonths, status, photoFileId,
        consentAcceptedAt, consentVersion
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);
    const info = stmt.run(
      data.hrn,
      data.patientType,
      data.firstName,
      data.middleName ?? null,
      data.lastName,
      data.suffix ?? null,
      data.sex ?? null,
      data.birthDate ? String(data.birthDate).slice(0, 10) : null,
      data.contactNumber ?? null,
      data.accountEmail,
      data.linkedUserId ?? null,
      data.nephrologistId ?? null,
      data.fellowId ?? null,
      data.stage,
      data.riskCategory ?? null,
      data.surgeryDate ? String(data.surgeryDate).slice(0, 10) : null,
      data.linkedRecipientId ?? null,
      data.followupMonths ?? 1,
      data.status ?? "Active",
      data.photoFileId ?? null,
      data.consentAcceptedAt ? new Date(data.consentAcceptedAt).toISOString() : null,
      data.consentVersion ?? null
    );
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(Number(info.lastInsertRowid)) as Patient;
  }

  const [row] = await db.insert(patients).values(data).returning();
  return row;
}

export async function updatePatient(id: number, data: Partial<InsertPatient>): Promise<Patient | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Patient | undefined;
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = (data as any)[k];
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v ?? null;
    });
    sqlite.prepare(`UPDATE patients SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Patient;
  }

  const [updated] = await db
    .update(patients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(patients.id, id))
    .returning();
  return updated ?? null;
}

export async function updatePatientConsent(patientId: number, version: number): Promise<Patient | null> {
  return updatePatient(patientId, {
    consentVersion: version,
    consentAcceptedAt: new Date(),
  });
}

/* -------------------------------------------------------------------------- */
/*                                  DOCTORS                                   */
/* -------------------------------------------------------------------------- */

export async function listDoctors(opts: { role?: string; activeOnly?: boolean } = {}): Promise<Doctor[]> {
  const activeOnly = opts.activeOnly !== false;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    let query = "SELECT * FROM doctors WHERE 1=1";
    const params: any[] = [];
    if (activeOnly) query += " AND active = 1";
    if (opts.role) {
      query += " AND role = ?";
      params.push(opts.role);
    }
    query += " ORDER BY name ASC";
    return sqlite.prepare(query).all(...params) as Doctor[];
  }

  const conditions = [];
  if (activeOnly) conditions.push(eq(doctors.active, true));
  if (opts.role) conditions.push(eq(doctors.role, opts.role as any));

  return db
    .select()
    .from(doctors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(doctors.name);
}

export async function getDoctorById(id: number): Promise<Doctor | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id) as Doctor | undefined;
    return row ?? null;
  }
  const [doc] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  return doc ?? null;
}

export async function createDoctor(data: InsertDoctor): Promise<Doctor> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite
      .prepare("INSERT INTO doctors (name, role, active) VALUES (?, ?, ?)")
      .run(data.name, data.role, data.active === false ? 0 : 1);
    return sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(Number(info.lastInsertRowid)) as Doctor;
  }
  const [doc] = await db.insert(doctors).values(data).returning();
  return doc;
}

export async function updateDoctor(id: number, data: Partial<InsertDoctor>): Promise<Doctor | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id) as Doctor | undefined;
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = (data as any)[k];
      return typeof v === "boolean" ? (v ? 1 : 0) : v ?? null;
    });
    sqlite.prepare(`UPDATE doctors SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id);
    return sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id) as Doctor;
  }
  const [updated] = await db.update(doctors).set({ ...data, updatedAt: new Date() }).where(eq(doctors.id, id)).returning();
  return updated ?? null;
}
