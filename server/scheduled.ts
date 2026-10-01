import { runDailyReminders } from "./reminders";
import { acquireReminderLock, purgeOrphanStoredFiles, releaseReminderLock } from "./db";

/** Computes current date string in Asia/Manila timezone (YYYY-MM-DD). */
export function getManilaDateKey(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
  return formatter.format(new Date());
}

export interface DailyReminderJobResult {
  ok: boolean;
  dateKey: string;
  notifications: { created: number; skippedExisting: number; expiredCredentials: number; archivedSkipped: number };
  purgedOrphanFiles?: number;
  locked?: boolean;
  message?: string;
}

/**
 * Shared awaited runner for KTP daily reminders.
 * Acquires DB-backed concurrency lock to prevent overlapping runs.
 */
export async function runDailyReminderJob(dateKey = getManilaDateKey()): Promise<DailyReminderJobResult> {
  const acquired = await acquireReminderLock();
  if (!acquired) {
    return {
      ok: false,
      dateKey,
      locked: true,
      message: "Reminder job is already running or locked",
      notifications: { created: 0, skippedExisting: 0, expiredCredentials: 0, archivedSkipped: 0 },
    };
  }

  try {
    const notifications = await runDailyReminders(dateKey);
    const purgedOrphanFiles = await purgeOrphanStoredFiles(2);
    return {
      ok: true,
      dateKey,
      notifications,
      purgedOrphanFiles,
    };
  } finally {
    await releaseReminderLock();
  }
}
