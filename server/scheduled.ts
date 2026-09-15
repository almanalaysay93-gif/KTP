import { runDailyReminders } from "./reminders";
import { runLicenseExpiryEmailPass, runUpcomingSeminarEmailPass, type EmailPassResult } from "./email/dispatcher";
import { acquireReminderLock, releaseReminderLock } from "./db";

/** Computes current date string in Asia/Manila timezone (YYYY-MM-DD). */
export function getManilaDateKey(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
  return formatter.format(new Date());
}

export interface DailyReminderJobResult {
  ok: boolean;
  dateKey: string;
  notifications: { created: number; skippedExisting: number; expiredCredentials: number; archivedSkipped: number };
  expiryEmails: EmailPassResult;
  seminarEmails: EmailPassResult;
  locked?: boolean;
  message?: string;
}

/**
 * Shared awaited runner for daily reminders.
 * Acquires DB-backed concurrency lock to prevent overlapping runs.
 * Evaluates in-app notifications, license expiry emails, and seminar reminders.
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
      expiryEmails: { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0 },
      seminarEmails: { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0 },
    };
  }

  try {
    const notifications = await runDailyReminders(dateKey);
    const expiryEmails = await runLicenseExpiryEmailPass(dateKey);
    const seminarEmails = await runUpcomingSeminarEmailPass();
    return {
      ok: true,
      dateKey,
      notifications,
      expiryEmails,
      seminarEmails,
    };
  } finally {
    await releaseReminderLock();
  }
}

const DAILY_RUN_HOUR = 8; // 08:00 server local time

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_RUN_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * Standalone scheduler for non-serverless hosting.
 */
export function startDailyReminderScheduler() {
  const scheduleNext = () => {
    setTimeout(async () => {
      await runDailyReminderJob();
      scheduleNext();
    }, msUntilNextRun());
  };
  scheduleNext();
}
