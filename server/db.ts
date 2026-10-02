import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import {
  activityLog,
  appSettings,
  emailLogs,
  notifications,
  storedFiles,
  users,
  type ActivityLog,
  type AppSetting,
  type Doctor,
  type EmailLog,
  type InsertActivityLog,
  type InsertDoctor,
  type InsertEmailLog,
  type InsertNotification,
  type InsertPatient,
  type InsertStoredFile,
  type InsertUser,
  type Notification,
  type Patient,
  type StoredFile,
  type User,
} from "../drizzle/schema";
import { FULL_ACCESS_EMAILS, roleForEmail } from "./adminAccess";
import { BASELINE_SQL } from "./baselineSql";
import { getSqliteDb } from "./localDb";
import { SEED_DOCTORS, SEED_PATIENTS } from "./seedPatients";
import { seedClinicalDataPg } from "./seedClinicalData";

let _db: ReturnType<typeof drizzle> | null = null;
export type PgDb = PgDatabase<PgQueryResultHKT, any>;
let _batchPg: ReturnType<typeof postgres> | null = null;
let _schemaEnsured = false;

async function ensureSchema(client: ReturnType<typeof postgres>) {
  if (_schemaEnsured) return;
  _schemaEnsured = true;
  try {
    const res = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'ktp' AND table_name = 'users'
      );
    `;
    if (!res[0]?.exists) {
      console.log("[Database] Initializing ktp schema and tables...");
      await client.unsafe(BASELINE_SQL);
      console.log("[Database] ktp schema initialized successfully.");
    }
    // Databases made before lab phases have no phase column on serviceRecords.
    await client`ALTER TABLE "ktp"."serviceRecords" ADD COLUMN IF NOT EXISTS "phase" varchar(16)`;
    // A patient with no Gmail account is allowed: that patient has no portal access.
    await client`ALTER TABLE "ktp"."patients" ALTER COLUMN "accountEmail" DROP NOT NULL`;
    // Seed default doctors if missing
    for (const doc of SEED_DOCTORS) {
      await client`
        INSERT INTO "ktp"."doctors" ("name", "role", "active")
        SELECT ${doc.name}, ${doc.role}, true
        WHERE NOT EXISTS (SELECT 1 FROM "ktp"."doctors" WHERE "name" = ${doc.name});
      `;
    }

    // Seed default patients (one per phase and post-KT)
    for (const p of SEED_PATIENTS) {
      await client`
        INSERT INTO "ktp"."patients" (
          "hrn", "patientType", "firstName", "lastName", "sex", "birthDate", "contactNumber",
          "accountEmail", "stage", "status", "riskCategory", "surgeryDate", "nephrologistId", "fellowId",
          "consentVersion", "consentAcceptedAt"
        ) VALUES (
          ${p.hrn}, ${p.patientType}, ${p.firstName}, ${p.lastName}, ${p.sex}, CAST(${p.birthDate} AS date), ${p.contactNumber},
          ${p.accountEmail}, ${p.stage}, ${p.status}, ${p.riskCategory}, CAST(${p.surgeryDate} AS date),
          (SELECT "id" FROM "ktp"."doctors" WHERE "name" = ${p.nephrologistName} LIMIT 1),
          (SELECT "id" FROM "ktp"."doctors" WHERE "name" = ${p.fellowName} LIMIT 1),
          1, now()
        ) ON CONFLICT ("hrn") DO UPDATE SET
          "accountEmail" = EXCLUDED."accountEmail",
          "stage" = EXCLUDED."stage",
          "status" = EXCLUDED."status";
      `;
    }
    await seedClinicalDataPg(client);
  } catch (error) {
    console.error("[Database] Auto-migration check failed:", error);
    _schemaEnsured = false;
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, {
        max: 3,
        prepare: false,
        idle_timeout: 20,
        connect_timeout: 15,
        connection: {
          search_path: "ktp, public",
        },
      });
      await ensureSchema(client);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect PostgreSQL:", error);
      _db = null;
    }
  }
  return _db;
}

export function getBatchClient() {
  if (!_batchPg && process.env.DATABASE_URL) {
    _batchPg = postgres(process.env.DATABASE_URL, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
      connection: {
        search_path: "ktp, public",
      },
    });
  }
  return _batchPg;
}

/* -------------------------------------------------------------------------- */
/*                               USERS & AUTH                                 */
/* -------------------------------------------------------------------------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  const effectiveRole = roleForEmail(user.email);
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite
      .prepare(
        `INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(openId) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           loginMethod = excluded.loginMethod,
           role = ?,
           lastSignedIn = CURRENT_TIMESTAMP,
           updatedAt = CURRENT_TIMESTAMP`
      )
      .run(user.openId, user.name, user.email, user.loginMethod, effectiveRole, effectiveRole);
    return;
  }

  await db
    .insert(users)
    .values({ ...user, role: effectiveRole, lastSignedIn: new Date() })
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        role: effectiveRole,
        lastSignedIn: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function touchUserSession(openId: string): Promise<User | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId) as User | undefined;
    if (!existing) return null;
    const effectiveRole = roleForEmail(existing.email);
    sqlite
      .prepare("UPDATE users SET lastSignedIn = CURRENT_TIMESTAMP, role = ?, updatedAt = CURRENT_TIMESTAMP WHERE openId = ?")
      .run(effectiveRole, openId);
    return sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId) as User;
  }

  const existing = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (existing.length === 0) return null;
  const effectiveRole = roleForEmail(existing[0].email);
  const [updated] = await db
    .update(users)
    .set({ lastSignedIn: new Date(), role: effectiveRole, updatedAt: new Date() })
    .where(eq(users.openId, openId))
    .returning();
  return updated ?? null;
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId) as User | undefined;
    return row ?? null;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
    return row ?? null;
  }
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*                            PATIENTS & DOCTORS                              */
/* -------------------------------------------------------------------------- */

export * from "./dbPatients";



/* -------------------------------------------------------------------------- */
/*                                  SETTINGS                                  */
/* -------------------------------------------------------------------------- */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
  const [match] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return match?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite
      .prepare(
        `INSERT INTO appSettings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`
      )
      .run(key, value);
    return;
  }
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const rows = sqlite.prepare("SELECT key, value FROM appSettings").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* -------------------------------------------------------------------------- */
/*                                ACTIVITY LOG                                */
/* -------------------------------------------------------------------------- */

export async function logActivity(
  actorUserId: number | null,
  patientId: number | null,
  action: string,
  details?: unknown,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  const detailsStr = details ? (typeof details === "string" ? details : JSON.stringify(details)) : null;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite
      .prepare("INSERT INTO activityLog (actorUserId, patientId, action, details, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?, ?)")
      .run(actorUserId, patientId, action, detailsStr, ipAddress ?? null, userAgent ?? null);
    return;
  }
  await db.insert(activityLog).values({
    actorUserId,
    patientId,
    action,
    details: detailsStr,
    ipAddress,
    userAgent,
  });
}

export async function listActivityLogs(patientId?: number, limit = 50): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    if (patientId) {
      return sqlite.prepare("SELECT * FROM activityLog WHERE patientId = ? ORDER BY id DESC LIMIT ?").all(patientId, limit) as ActivityLog[];
    }
    return sqlite.prepare("SELECT * FROM activityLog ORDER BY id DESC LIMIT ?").all(limit) as ActivityLog[];
  }
  if (patientId) {
    return db.select().from(activityLog).where(eq(activityLog.patientId, patientId)).orderBy(desc(activityLog.id)).limit(limit);
  }
  return db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(limit);
}

/* -------------------------------------------------------------------------- */
/*                               NOTIFICATIONS                                */
/* -------------------------------------------------------------------------- */

export async function createNotification(data: InsertNotification): Promise<Notification> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite
      .prepare("INSERT INTO notifications (patientId, title, message, type, read, linkUrl) VALUES (?, ?, ?, ?, 0, ?)")
      .run(data.patientId ?? null, data.title, data.message, data.type ?? "info", data.linkUrl ?? null);
    return sqlite.prepare("SELECT * FROM notifications WHERE id = ?").get(Number(info.lastInsertRowid)) as Notification;
  }
  const [row] = await db.insert(notifications).values(data).returning();
  return row;
}

export async function listNotifications(patientId: number): Promise<Notification[]> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    return sqlite.prepare("SELECT * FROM notifications WHERE patientId = ? ORDER BY id DESC").all(patientId) as Notification[];
  }
  return db.select().from(notifications).where(eq(notifications.patientId, patientId)).orderBy(desc(notifications.id));
}

export async function countUnreadNotifications(patientId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT count(*) as count FROM notifications WHERE patientId = ? AND read = 0").get(patientId) as { count: number };
    return row.count;
  }
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.patientId, patientId), eq(notifications.read, false)));
  return Number(result[0]?.count ?? 0);
}

export async function markNotificationRead(id: number, patientId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND patientId = ?").run(id, patientId);
    return;
  }
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.patientId, patientId)));
}

export async function markAllNotificationsRead(patientId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE notifications SET read = 1 WHERE patientId = ?").run(patientId);
    return;
  }
  await db.update(notifications).set({ read: true }).where(eq(notifications.patientId, patientId));
}

/* -------------------------------------------------------------------------- */
/*                                STORED FILES                                */
/* -------------------------------------------------------------------------- */

export async function saveStoredFile(data: InsertStoredFile): Promise<StoredFile> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite
      .prepare("INSERT INTO storedFiles (fileName, fileType, fileSize, storageKey) VALUES (?, ?, ?, ?)")
      .run(data.fileName, data.fileType, data.fileSize, data.storageKey);
    return sqlite.prepare("SELECT * FROM storedFiles WHERE id = ?").get(Number(info.lastInsertRowid)) as StoredFile;
  }
  const [file] = await db.insert(storedFiles).values(data).returning();
  return file;
}

export async function getStoredFile(id: number): Promise<StoredFile | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM storedFiles WHERE id = ?").get(id) as StoredFile | undefined;
    return row ?? null;
  }
  const [file] = await db.select().from(storedFiles).where(eq(storedFiles.id, id)).limit(1);
  return file ?? null;
}

export async function getStoredFileByStorageKey(storageKey: string): Promise<StoredFile | null> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM storedFiles WHERE storageKey = ?").get(storageKey) as StoredFile | undefined;
    return row ?? null;
  }
  const [file] = await db.select().from(storedFiles).where(eq(storedFiles.storageKey, storageKey)).limit(1);
  return file ?? null;
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("DELETE FROM storedFiles WHERE storageKey = ?").run(storageKey);
    return;
  }
  await db.delete(storedFiles).where(eq(storedFiles.storageKey, storageKey));
}

export async function purgeOrphanStoredFiles(olderThanDays = 2): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite.prepare("DELETE FROM storedFiles WHERE createdAt < ?").run(cutoff.toISOString());
    return info.changes;
  }
  const deleted = await db.delete(storedFiles).where(sql`${storedFiles.createdAt} < ${cutoff}`).returning();
  return deleted.length;
}

/* -------------------------------------------------------------------------- */
/*                                 EMAIL LOGS                                 */
/* -------------------------------------------------------------------------- */

export async function logEmail(data: InsertEmailLog): Promise<EmailLog> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite
      .prepare("INSERT INTO emailLogs (recipientEmail, subject, templateName, status, errorMessage, patientId) VALUES (?, ?, ?, ?, ?, ?)")
      .run(data.recipientEmail, data.subject, data.templateName, data.status, data.errorMessage ?? null, data.patientId ?? null);
    return sqlite.prepare("SELECT * FROM emailLogs WHERE id = ?").get(Number(info.lastInsertRowid)) as EmailLog;
  }
  const [row] = await db.insert(emailLogs).values(data).returning();
  return row;
}

export async function listEmailLogs(limit = 100): Promise<EmailLog[]> {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    return sqlite.prepare("SELECT * FROM emailLogs ORDER BY id DESC LIMIT ?").all(limit) as EmailLog[];
  }
  return db.select().from(emailLogs).orderBy(desc(emailLogs.id)).limit(limit);
}

/* -------------------------------------------------------------------------- */
/*                         REMINDER CONCURRENCY LOCK                          */
/* -------------------------------------------------------------------------- */

let _reminderLockHeld = false;

export async function acquireReminderLock(): Promise<boolean> {
  if (_reminderLockHeld) return false;
  _reminderLockHeld = true;
  return true;
}

export async function releaseReminderLock(): Promise<void> {
  _reminderLockHeld = false;
}
