/**
 * Daily license renewal reminder engine.
 *
 * Rules (from spec):
 * - For every active (non-archived) nurse license, generate a reminder when
 *   today >= expiryDate - thresholdDays, once per threshold per renewal cycle.
 * - Never duplicate: unique constraint on (credentialId, thresholdDays, renewalCycleKey).
 * - Missed runs: if the threshold was crossed before, generate now (catchup).
 * - Archived nurses never generate routine reminders.
 * - Expired licenses are flagged (mark active reminder status expired + urgent notification).
 * - Renewed license (new credential record = new renewalCycleKey) starts a new cycle.
 */
import { eq, isNull, sql } from "drizzle-orm";
import { licenseReminders, nurseCredentials, nurses } from "../drizzle/schema";
import {
  acknowledgeReminder,
  createNotification,
  createNotificationsBatch,
  getDb,
  listAreas,
  listReminders,
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./db";
import { daysUntilExpiry, deriveLicenseStatus, dateKey } from "../shared/nursetrack";

export const DEFAULT_THRESHOLDS = [365, 180] as const;

interface CredentialRow {
  id: number;
  nurseId: number;
  credentialTypeId: number;
  expiryDate: Date | string;
  renewalCycleKey: string;
  nurse: {
    id: number;
    employeeId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    archivedAt: Date | null;
    currentAreaId: number | null;
  };
}

async function fetchActiveCredentials(): Promise<CredentialRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: nurseCredentials.id,
      nurseId: nurseCredentials.nurseId,
      credentialTypeId: nurseCredentials.credentialTypeId,
      expiryDate: nurseCredentials.expiryDate,
      renewalCycleKey: nurseCredentials.renewalCycleKey,
      employeeId: nurses.employeeId,
      firstName: nurses.firstName,
      middleName: nurses.middleName,
      lastName: nurses.lastName,
      suffix: nurses.suffix,
      archivedAt: nurses.archivedAt,
      currentAreaId: nurses.currentAreaId,
    })
    .from(nurseCredentials)
    .innerJoin(nurses, eq(nurses.id, nurseCredentials.nurseId))
    .where(isNull(nurses.archivedAt));
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    nurseId: Number(r.nurseId),
    credentialTypeId: Number(r.credentialTypeId),
    expiryDate: r.expiryDate as Date,
    renewalCycleKey: String(r.renewalCycleKey),
    nurse: {
      id: Number(r.nurseId),
      employeeId: String(r.employeeId),
      firstName: String(r.firstName),
      middleName: (r.middleName as string | null) ?? null,
      lastName: String(r.lastName),
      suffix: (r.suffix as string | null) ?? null,
      archivedAt: (r.archivedAt as Date | null) ?? null,
      currentAreaId: r.currentAreaId != null ? Number(r.currentAreaId) : null,
    },
  }));
}

/** Run the daily reminder pass. Idempotent — safe to call any time. */
export async function runDailyReminders(today: string, thresholds: readonly number[] = DEFAULT_THRESHOLDS) {
  const db = await getDb();
  const results = { created: 0, skippedExisting: 0, expiredCredentials: 0, archivedSkipped: 0 };
  const credentials = await fetchActiveCredentials();
  if (!db) return results;

  const areaRows = await listAreas(false);
  const areaById = new Map(areaRows.map((a) => [a.id, a.name]));

  // Load existing reminders to enforce true idempotency and prevent duplicate notifications.
  const existingReminders = await listReminders();
  const existingSet = new Set(
    existingReminders.map((r) => `${r.credentialId}:${r.thresholdDays}:${r.renewalCycleKey}`)
  );

  // Phase 1 — classify credentials in memory: expired vs. due renewal reminders.
  const duePairs: Array<{ cred: CredentialRow; threshold: number; days: number; areaName: string }> = [];
  const expiredIds: number[] = [];
  const expiredNotes: Array<{ cred: CredentialRow }> = [];
  for (const cred of credentials) {
    if (cred.nurse.archivedAt) {
      results.archivedSkipped++;
      continue;
    }
    const days = daysUntilExpiry(dateKey(cred.expiryDate), today);
    const status = deriveLicenseStatus(dateKey(cred.expiryDate), today);

    // Expired license — mark any active reminders for it expired.
    if (status === "Expired") {
      expiredIds.push(cred.id);
      expiredNotes.push({ cred });
      continue;
    }

    for (const threshold of thresholds) {
      if (days > threshold) continue; // not yet due
      const cycleKey = `${cred.id}:${threshold}:${cred.renewalCycleKey}`;
      if (existingSet.has(cycleKey)) {
        results.skippedExisting++;
        continue;
      }
      const areaName = cred.nurse.currentAreaId ? areaById.get(cred.nurse.currentAreaId) ?? "Unknown area" : "Unassigned";
      duePairs.push({ cred, threshold, days, areaName });
    }
  }

  // Phase 2 — bulk-insert only newly due reminders.
  if (duePairs.length > 0) {
    const rows = duePairs.map(({ cred, threshold }) => ({
      credentialId: cred.id,
      thresholdDays: threshold,
      renewalCycleKey: cred.renewalCycleKey,
      triggerDate: new Date(new Date(`${today}T00:00:00`).getTime() + threshold * 86400000),
    }));
    await db.insert(licenseReminders).values(rows).onConflictDoNothing();
    results.created = duePairs.length;
  }

  // Phase 3 — expired credentials: bulk-mark active reminders expired and notify.
  if (expiredIds.length > 0) {
    const db2 = await getDb();
    if (db2) {
      await db2.update(licenseReminders).set({ status: "expired" }).where(sql`${licenseReminders.credentialId} IN (${sql.join(expiredIds.map((i) => sql`${i}`), sql`, `)})`);
    }
  }

  // Load existing notifications to prevent duplicate notification generation
  const existingNotifications = await listNotifications(500);
  const existingExpiredNotifKeys = new Set(
    existingNotifications
      .filter((n) => n.type === "license.expired")
      .map((n) => `${n.nurseId}:${n.relatedEntityType}:${n.relatedEntityId}`)
  );
  const existingRenewalNotifKeys = new Set(
    existingNotifications
      .filter((n) => n.type === "license.renewalReminder")
      .map((n) => `${n.nurseId}:${n.relatedEntityType}:${n.relatedEntityId}:${(n.title ?? "").split(" — ")[0].trim()}`)
  );

  const expiredNotifs = expiredNotes
    .filter(({ cred }) => !existingExpiredNotifKeys.has(`${cred.nurseId}:credential:${cred.id}`))
    .map(({ cred }) => ({
      type: "license.expired",
      severity: "urgent_or_expired",
      title: `License expired — ${cred.nurse.firstName} ${cred.nurse.lastName}`,
      message: `The license (${cred.renewalCycleKey}) for ${cred.nurse.firstName} ${cred.nurse.lastName} expired. Mark renewal as complete to start a new cycle.`,
      nurseId: cred.nurseId,
      relatedEntityType: "credential",
      relatedEntityId: cred.id,
    }));
  if (expiredNotifs.length > 0) {
    await createNotificationsBatch(expiredNotifs);
  }
  results.expiredCredentials = expiredIds.length;

  // Phase 4 — bulk notification insert for newly due renewal reminders only.
  // Group by credential so each nurse receives at most one reminder notification per cycle pass.
  const notifsByCred = new Map<number, { cred: CredentialRow; threshold: number; days: number }>();
  for (const pair of duePairs) {
    const prev = notifsByCred.get(pair.cred.id);
    if (!prev || pair.threshold < prev.threshold) {
      notifsByCred.set(pair.cred.id, pair);
    }
  }

  const notifPayloads = Array.from(notifsByCred.values())
    .filter(({ cred, threshold }) => {
      const thresholdLabel = threshold === 365 ? "1-year renewal reminder" : `${threshold}-day renewal reminder`;
      return !existingRenewalNotifKeys.has(`${cred.nurseId}:credential:${cred.id}:${thresholdLabel}`);
    })
    .map(({ cred, threshold, days }) => ({
      type: "license.renewalReminder",
      severity: threshold >= 365 ? "attention" : "upcoming_renewal",
      title: `${threshold === 365 ? "1-year" : `${threshold}-day`} renewal reminder — ${cred.nurse.firstName} ${cred.nurse.lastName}`,
      message: `${cred.nurse.firstName} ${cred.nurse.lastName} has a license expiring in ${days <= 0 ? "about " + (Math.abs(days) + 1) + " day(s) (due " + dateKey(cred.expiryDate) + ")" : days + " days"}. Review the license and begin renewal.`,
      nurseId: cred.nurseId,
      relatedEntityType: "credential",
      relatedEntityId: cred.id,
    }));
  if (notifPayloads.length > 0) {
    await createNotificationsBatch(notifPayloads);
  }
  return results;
}

export {
  acknowledgeReminder,
  listReminders,
  createNotification,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
