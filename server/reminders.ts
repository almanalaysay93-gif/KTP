/**
 * KTP reminder engine stub. Full implementation in Phase A3 (section 6.7).
 */
import { todayDate } from "@shared/ktp";

export interface ReminderRunResult {
  created: number;
  skippedExisting: number;
  expiredCredentials: number;
  archivedSkipped: number;
}

export async function runDailyReminders(
  dateKey = todayDate()
): Promise<ReminderRunResult> {
  return {
    created: 0,
    skippedExisting: 0,
    expiredCredentials: 0,
    archivedSkipped: 0,
  };
}
