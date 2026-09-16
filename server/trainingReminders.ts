import { eq, and, lte, isNull, sql, inArray, or, desc } from "drizzle-orm";
import { getDb } from "./db";
import { getSqliteDb } from "./localDb";
import {
  nurseTrainings,
  trainingEvents,
  trainingCatalog,
  nurses,
  trainingOutbox,
  trainingActivity,
  type TrainingOutboxItem,
} from "../drizzle/schema";
import { dateKey, nurseFullName } from "../shared/nursetrack";
import { sendEmail } from "./email/service";
import { renderTrainingNoticeEmail, renderTrainingMilestoneEmail } from "./email/templates";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/** Formats today's date in Asia/Manila timezone (YYYY-MM-DD). */
export function getManilaTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** Parses YYYY-MM-DD to UTC midnight date object */
export function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Computes calendar day difference between dateStr2 and dateStr1 (dateStr2 - dateStr1) */
export function diffCalendarDays(dateStr2: string, dateStr1: string): number {
  const d1 = parseDateKey(dateStr1);
  const d2 = parseDateKey(dateStr2);
  const msPerDay = 86400000;
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}

/** Adds or subtracts calendar days from YYYY-MM-DD */
export function addCalendarDays(dateStr: string, days: number): string {
  const d = parseDateKey(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ResolvedTrainingSchedule {
  assignmentId: number;
  nurseId: number;
  scheduleVersion: number;
  status: string;
  trainingId: number;
  trainingName: string;
  startDateStr: string;
  endDateStr: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  remarks: string | null;
  evidenceRequired: boolean;
  evidenceStatus: string;
  staffResponse: string;
  staffResponseReason: string | null;
  attendanceOutcome: string;
}

async function loadTrainingSchedules(scope: { assignmentId: number } | { nurseId: number }): Promise<ResolvedTrainingSchedule[]> {
  const db = await getDb();
  if (db) {
    const rows = await db
      .select({
        assignment: nurseTrainings,
        event: trainingEvents,
        catalog: trainingCatalog,
      })
      .from(nurseTrainings)
      .leftJoin(trainingEvents, eq(trainingEvents.id, nurseTrainings.eventId))
      .leftJoin(trainingCatalog, eq(trainingCatalog.id, nurseTrainings.trainingId))
      .where("assignmentId" in scope ? eq(nurseTrainings.id, scope.assignmentId) : eq(nurseTrainings.nurseId, scope.nurseId))
      .orderBy(desc(nurseTrainings.scheduledDate));

    return rows.map(({ assignment, event, catalog }) => {

      let startDateStr = "";
      let endDateStr = "";
      let startTime: string | null = null;
      let endTime: string | null = null;
      let venue: string | null = null;

      if (event) {
        startDateStr = event.startDate ? dateKey(event.startDate) : "";
        endDateStr = event.endDate ? dateKey(event.endDate) : startDateStr;
        startTime = event.startTime || null;
        endTime = event.endTime || null;
        venue = event.venue || null;
      } else if (assignment.scheduledDate) {
        startDateStr = dateKey(assignment.scheduledDate);
        endDateStr = startDateStr;
      } else if (assignment.completionDate) {
        startDateStr = dateKey(assignment.completionDate);
        endDateStr = startDateStr;
      }

      const trainingName = catalog?.name || "Assigned Training";

      return {
        assignmentId: assignment.id,
        nurseId: assignment.nurseId,
        scheduleVersion: assignment.scheduleVersion ?? 1,
        status: assignment.status,
        trainingId: assignment.trainingId,
        trainingName,
        startDateStr,
        endDateStr,
        startTime,
        endTime,
        venue,
        remarks: assignment.remarks || event?.remarks || null,
        evidenceRequired: Boolean(assignment.evidenceRequired),
        evidenceStatus: assignment.evidenceStatus || "None",
        staffResponse: assignment.staffResponse || "Pending",
        staffResponseReason: assignment.staffResponseReason || null,
        attendanceOutcome: assignment.attendanceOutcome || "not_recorded",
      };
    });
  }

  const sqlite = getSqliteDb();
  const rows = sqlite
    .prepare(
      `SELECT t.*, e.startDate as evStart, e.endDate as evEnd, e.startTime as evStartTime,
              e.endTime as evEndTime, e.venue as evVenue, e.remarks as evRemarks,
              c.name as catalogName
       FROM nurseTrainings t
       LEFT JOIN trainingEvents e ON e.id = t.eventId
       LEFT JOIN trainingCatalog c ON c.id = t.trainingId
       WHERE ${"assignmentId" in scope ? "t.id" : "t.nurseId"} = ?
       ORDER BY date(t.scheduledDate) DESC`
    )
    .all("assignmentId" in scope ? scope.assignmentId : scope.nurseId) as any[];

  return rows.map((row) => {

    let startDateStr = "";
    let endDateStr = "";
    let startTime: string | null = null;
    let endTime: string | null = null;
    let venue: string | null = null;

    if (row.eventId) {
      startDateStr = row.evStart ? dateKey(row.evStart) : "";
      endDateStr = row.evEnd ? dateKey(row.evEnd) : startDateStr;
      startTime = row.evStartTime || null;
      endTime = row.evEndTime || null;
      venue = row.evVenue || null;
    } else if (row.scheduledDate) {
      startDateStr = dateKey(row.scheduledDate);
      endDateStr = startDateStr;
    } else if (row.completionDate) {
      startDateStr = dateKey(row.completionDate);
      endDateStr = startDateStr;
    }

    const trainingName = row.catalogName || "Assigned Training";

    return {
      assignmentId: row.id,
      nurseId: row.nurseId,
      scheduleVersion: row.scheduleVersion ?? 1,
      status: row.status,
      trainingId: row.trainingId,
      trainingName,
      startDateStr,
      endDateStr,
      startTime,
      endTime,
      venue,
      remarks: row.remarks || row.evRemarks || null,
      evidenceRequired: Boolean(row.evidenceRequired),
      evidenceStatus: row.evidenceStatus || "None",
      staffResponse: row.staffResponse || "Pending",
      staffResponseReason: row.staffResponseReason || null,
      attendanceOutcome: row.attendanceOutcome || "not_recorded",
    };
  });
}

export async function resolveTrainingSchedule(assignmentId: number): Promise<ResolvedTrainingSchedule | null> {
  return (await loadTrainingSchedules({ assignmentId }))[0] ?? null;
}

export async function listResolvedTrainingSchedules(nurseId: number): Promise<ResolvedTrainingSchedule[]> {
  return loadTrainingSchedules({ nurseId });
}

export interface TrainingConflictItem {
  id: number;
  trainingName: string;
  dateStr: string;
  timeStr: string;
  reason: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  warningOnly: boolean;
  conflicts: TrainingConflictItem[];
}

/**
 * Checks if a proposed training schedule conflicts with existing active scheduled trainings for the nurse.
 */
export async function checkTrainingConflicts(
  nurseId: number,
  startDateStr: string,
  endDateStr?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  excludeAssignmentId?: number | null
): Promise<ConflictCheckResult> {
  const normEnd = endDateStr || startDateStr;
  const db = await getDb();
  let existingAssignments: { id: number; eventId: number | null; scheduledDate: any; status: string }[] = [];

  if (db) {
    const rows = await db
      .select({
        id: nurseTrainings.id,
        eventId: nurseTrainings.eventId,
        scheduledDate: nurseTrainings.scheduledDate,
        status: nurseTrainings.status,
      })
      .from(nurseTrainings)
      .where(and(eq(nurseTrainings.nurseId, nurseId), eq(nurseTrainings.status, "Scheduled")));
    existingAssignments = rows;
  } else {
    const sqlite = getSqliteDb();
    existingAssignments = sqlite
      .prepare("SELECT id, eventId, scheduledDate, status FROM nurseTrainings WHERE nurseId = ? AND status = 'Scheduled'")
      .all(nurseId) as any[];
  }

  const conflicts: TrainingConflictItem[] = [];
  let warningOnly = false;

  for (const assign of existingAssignments) {
    if (excludeAssignmentId && assign.id === excludeAssignmentId) continue;
    const resolved = await resolveTrainingSchedule(assign.id);
    if (!resolved || !resolved.startDateStr) continue;

    const existingStart = resolved.startDateStr;
    const existingEnd = resolved.endDateStr || existingStart;

    // Check date interval overlap: [startDateStr, normEnd] overlaps [existingStart, existingEnd]
    const datesOverlap = startDateStr <= existingEnd && normEnd >= existingStart;
    if (!datesOverlap) continue;

    // Overlapping dates. Check times if both available.
    const hasTimes = Boolean(startTime && endTime && resolved.startTime && resolved.endTime);
    if (hasTimes) {
      const t1Start = startTime!;
      const t1End = endTime!;
      const t2Start = resolved.startTime!;
      const t2End = resolved.endTime!;

      // Adjacency is non-overlapping (e.g. 09:00-11:00 and 11:00-13:00)
      const timesOverlap = t1Start < t2End && t2Start < t1End;
      if (timesOverlap) {
        conflicts.push({
          id: resolved.assignmentId,
          trainingName: resolved.trainingName,
          dateStr: `${existingStart}${existingEnd !== existingStart ? ` to ${existingEnd}` : ""}`,
          timeStr: `${t2Start} - ${t2End}`,
          reason: `Exact time overlap with ${resolved.trainingName} (${t2Start} - ${t2End})`,
        });
      }
    } else {
      // Either event lacks exact time. Warn about same-day overlap.
      warningOnly = true;
      conflicts.push({
        id: resolved.assignmentId,
        trainingName: resolved.trainingName,
        dateStr: `${existingStart}${existingEnd !== existingStart ? ` to ${existingEnd}` : ""}`,
        timeStr: resolved.startTime ? `${resolved.startTime}${resolved.endTime ? ` - ${resolved.endTime}` : ""}` : "Unspecified time",
        reason: `Potential same-day overlap with ${resolved.trainingName}`,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    warningOnly: conflicts.length > 0 && warningOnly && !conflicts.some((c) => c.reason.includes("Exact time overlap")),
    conflicts,
  };
}

/** Enqueue an immediate notice (assigned, rescheduled, cancelled) into the outbox and log activity */
export async function enqueueTrainingNotice(opts: {
  assignmentId: number;
  scheduleVersion: number;
  noticeKind: "assigned" | "rescheduled" | "cancelled";
  recipientNurseId: number;
  actorUserId?: number | null;
  previousSnapshot?: any;
  currentSnapshot?: any;
}) {
  const db = await getDb();
  const today = getManilaTodayKey();

  if (db) {
    const [item] = await db
      .insert(trainingOutbox)
      .values({
        assignmentId: opts.assignmentId,
        scheduleVersion: opts.scheduleVersion,
        noticeKind: opts.noticeKind,
        thresholdDays: null,
        dueDate: null,
        recipientNurseId: opts.recipientNurseId,
        status: "pending",
        attempts: 0,
      })
      .onConflictDoNothing()
      .returning();

    // In-app activity log
    const resolved = await resolveTrainingSchedule(opts.assignmentId);
    const title =
      opts.noticeKind === "rescheduled"
        ? `Schedule Change: ${resolved?.trainingName || "Training"}`
        : opts.noticeKind === "cancelled"
        ? `Training Cancelled: ${resolved?.trainingName || "Training"}`
        : `New Training Assignment: ${resolved?.trainingName || "Training"}`;

    const message =
      opts.noticeKind === "cancelled"
        ? `The training assignment for ${resolved?.trainingName} has been cancelled. Attendance is no longer required.`
        : opts.noticeKind === "rescheduled"
        ? `The schedule for ${resolved?.trainingName} was updated to ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}. Please confirm your attendance.`
        : `You have been assigned to ${resolved?.trainingName} on ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}.`;

    await db.insert(trainingActivity).values({
      nurseId: opts.recipientNurseId,
      assignmentId: opts.assignmentId,
      activityType: opts.noticeKind,
      title,
      message,
    });

    return item;
  }

  const sqlite = getSqliteDb();
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO trainingOutbox
       (assignmentId, scheduleVersion, noticeKind, thresholdDays, dueDate, recipientNurseId, status, attempts)
       VALUES (?, ?, ?, NULL, NULL, ?, 'pending', 0)`
    )
    .run(opts.assignmentId, opts.scheduleVersion, opts.noticeKind, opts.recipientNurseId);

  const resolved = await resolveTrainingSchedule(opts.assignmentId);
  const title =
    opts.noticeKind === "rescheduled"
      ? `Schedule Change: ${resolved?.trainingName || "Training"}`
      : opts.noticeKind === "cancelled"
      ? `Training Cancelled: ${resolved?.trainingName || "Training"}`
      : `New Training Assignment: ${resolved?.trainingName || "Training"}`;

  const message =
    opts.noticeKind === "cancelled"
      ? `The training assignment for ${resolved?.trainingName} has been cancelled. Attendance is no longer required.`
      : opts.noticeKind === "rescheduled"
      ? `The schedule for ${resolved?.trainingName} was updated to ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}. Please confirm your attendance.`
      : `You have been assigned to ${resolved?.trainingName} on ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}.`;

  sqlite
    .prepare(
      `INSERT INTO trainingActivity (nurseId, assignmentId, activityType, title, message)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(opts.recipientNurseId, opts.assignmentId, opts.noticeKind, title, message);

  return sqlite
    .prepare("SELECT * FROM trainingOutbox WHERE assignmentId = ? AND scheduleVersion = ? AND noticeKind = ?")
    .get(opts.assignmentId, opts.scheduleVersion, opts.noticeKind) as any;
}

/**
 * Creates milestone reminder jobs (14d, 7d, 1d) for a newly assigned or rescheduled training.
 * Ignores milestones that are already in the past.
 * If assignment occurs on the due date of a milestone, creates combined notice or due milestone as per G7.
 */
export async function createMilestonesForAssignment(opts: {
  assignmentId: number;
  scheduleVersion: number;
  startDateStr: string;
  recipientNurseId: number;
}) {
  const today = getManilaTodayKey();
  const thresholds = [14, 7, 1];
  const db = await getDb();
  const sqlite = db ? null : getSqliteDb();

  for (const t of thresholds) {
    const dueDate = addCalendarDays(opts.startDateStr, -t);
    // If dueDate is in the past, do not create retroactive milestone
    if (dueDate < today) {
      continue;
    }

    const noticeKind = `reminder_${t}d`;
    if (db) {
      await db
        .insert(trainingOutbox)
        .values({
          assignmentId: opts.assignmentId,
          scheduleVersion: opts.scheduleVersion,
          noticeKind,
          thresholdDays: t,
          dueDate: parseDateKey(dueDate),
          recipientNurseId: opts.recipientNurseId,
          status: "pending",
          attempts: 0,
        })
        .onConflictDoNothing();
    } else if (sqlite) {
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO trainingOutbox
           (assignmentId, scheduleVersion, noticeKind, thresholdDays, dueDate, recipientNurseId, status, attempts)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`
        )
        .run(opts.assignmentId, opts.scheduleVersion, noticeKind, t, dueDate, opts.recipientNurseId);
    }
  }
}

/** Supersedes older pending outbox jobs when an assignment is rescheduled or cancelled */
export async function invalidatePendingOutboxJobs(assignmentId: number, currentScheduleVersion?: number) {
  const db = await getDb();
  if (db) {
    if (currentScheduleVersion != null) {
      await db
        .update(trainingOutbox)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(
          and(
            eq(trainingOutbox.assignmentId, assignmentId),
            sql`${trainingOutbox.scheduleVersion} < ${currentScheduleVersion}`,
            eq(trainingOutbox.status, "pending")
          )
        );
    } else {
      // Cancelled: supersede all pending jobs
      await db
        .update(trainingOutbox)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(and(eq(trainingOutbox.assignmentId, assignmentId), eq(trainingOutbox.status, "pending")));
    }
    return;
  }

  const sqlite = getSqliteDb();
  if (currentScheduleVersion != null) {
    sqlite
      .prepare("UPDATE trainingOutbox SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP WHERE assignmentId = ? AND scheduleVersion < ? AND status = 'pending'")
      .run(assignmentId, currentScheduleVersion);
  } else {
    sqlite
      .prepare("UPDATE trainingOutbox SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP WHERE assignmentId = ? AND status = 'pending'")
      .run(assignmentId);
  }
}

/**
 * Attempts immediate bounded dispatch of an outbox item (e.g. right after an assignment/reschedule/cancellation).
 */
export async function dispatchSingleOutboxItem(itemId: number): Promise<{ ok: boolean; status: string; error?: string }> {
  const db = await getDb();
  let item: TrainingOutboxItem | null = null;

  if (db) {
    const rows = await db.select().from(trainingOutbox).where(eq(trainingOutbox.id, itemId)).limit(1);
    if (rows.length > 0) item = rows[0];
  } else {
    const sqlite = getSqliteDb();
    item = sqlite.prepare("SELECT * FROM trainingOutbox WHERE id = ?").get(itemId) as any;
  }

  if (!item || item.status !== "pending") {
    return { ok: false, status: item?.status || "not_found" };
  }

  return processOutboxItem(item);
}

/**
 * Worker drain function for trainingOutbox.
 * Claims and processes up to `limit` pending outbox items due on or before today.
 */
export async function drainTrainingOutbox(limit = 25): Promise<{
  processed: number;
  sent: number;
  mockSent: number;
  failed: number;
  skipped: number;
  superseded: number;
}> {
  const today = getManilaTodayKey();
  const db = await getDb();
  let itemsToProcess: TrainingOutboxItem[] = [];

  if (db) {
    // Select due or immediate pending items
    const rows = await db
      .select()
      .from(trainingOutbox)
      .where(
        and(
          eq(trainingOutbox.status, "pending"),
          or(isNull(trainingOutbox.dueDate), lte(trainingOutbox.dueDate, parseDateKey(today)))
        )
      )
      .limit(limit);

    if (rows.length === 0) {
      return { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0, superseded: 0 };
    }

    // Atomically mark as claimed
    const itemIds = rows.map((r) => r.id);
    await db
      .update(trainingOutbox)
      .set({ status: "claimed", claimedAt: new Date(), updatedAt: new Date() })
      .where(inArray(trainingOutbox.id, itemIds));

    itemsToProcess = rows;
  } else {
    const sqlite = getSqliteDb();
    const rows = sqlite
      .prepare(
        `SELECT * FROM trainingOutbox
         WHERE status = 'pending' AND (dueDate IS NULL OR dueDate <= ?)
         LIMIT ?`
      )
      .all(today, limit) as any[];

    if (rows.length === 0) {
      return { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0, superseded: 0 };
    }

    const claimStmt = sqlite.prepare("UPDATE trainingOutbox SET status = 'claimed', claimedAt = CURRENT_TIMESTAMP WHERE id = ?");
    for (const r of rows) {
      claimStmt.run(r.id);
    }
    itemsToProcess = rows;
  }

  let processed = 0;
  let sent = 0;
  let mockSent = 0;
  let failed = 0;
  let skipped = 0;
  let superseded = 0;

  for (const item of itemsToProcess) {
    processed++;
    const res = await processOutboxItem(item);
    if (res.status === "sent") sent++;
    else if (res.status === "mock_sent") mockSent++;
    else if (res.status === "failed") failed++;
    else if (res.status === "skipped") skipped++;
    else if (res.status === "superseded") superseded++;
  }

  return { processed, sent, mockSent, failed, skipped, superseded };
}

/** Processes a single claimed or pending item, updating status in DB */
async function processOutboxItem(item: TrainingOutboxItem): Promise<{ ok: boolean; status: string; error?: string }> {
  const db = await getDb();
  const sqlite = db ? null : getSqliteDb();

  const updateOutbox = async (status: string, providerMsgId?: string | null, errorDetail?: string | null) => {
    if (db) {
      await db
        .update(trainingOutbox)
        .set({
          status,
          providerMessageId: providerMsgId ?? null,
          errorDetail: errorDetail ?? null,
          lastAttemptAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trainingOutbox.id, item.id));
    } else if (sqlite) {
      sqlite
        .prepare(
          `UPDATE trainingOutbox
           SET status = ?, providerMessageId = ?, errorDetail = ?, lastAttemptAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(status, providerMsgId ?? null, errorDetail ?? null, item.id);
    }
  };

  const resolved = await resolveTrainingSchedule(item.assignmentId);
  if (!resolved) {
    await updateOutbox("superseded", null, "Assignment no longer exists");
    return { ok: false, status: "superseded" };
  }

  // Check schedule version validity
  if (resolved.scheduleVersion !== item.scheduleVersion) {
    await updateOutbox("superseded", null, `Assignment moved to version ${resolved.scheduleVersion}`);
    return { ok: false, status: "superseded" };
  }

  // If training was cancelled or completed and this is a routine reminder, supersede
  if (resolved.status !== "Scheduled" && item.noticeKind.startsWith("reminder_")) {
    await updateOutbox("superseded", null, `Training status is ${resolved.status}`);
    return { ok: false, status: "superseded" };
  }

  // Fetch recipient nurse
  let nurseRow: any = null;
  if (db) {
    const rows = await db.select().from(nurses).where(eq(nurses.id, item.recipientNurseId)).limit(1);
    if (rows.length > 0) nurseRow = rows[0];
  } else if (sqlite) {
    nurseRow = sqlite.prepare("SELECT * FROM nurses WHERE id = ?").get(item.recipientNurseId);
  }

  if (!nurseRow || nurseRow.archivedAt) {
    await updateOutbox("skipped", null, "Nurse profile not found or archived");
    return { ok: false, status: "skipped", error: "Nurse archived" };
  }

  const recipientEmail = nurseRow.accountEmail;
  if (!recipientEmail) {
    await updateOutbox("skipped", null, "Missing saved account email");
    return { ok: false, status: "skipped", error: "Missing email" };
  }

  const fullName = nurseFullName(nurseRow);
  const actionUrl = `${APP_URL}/me/calendar`;
  const dateRangeStr =
    resolved.startDateStr === resolved.endDateStr || !resolved.endDateStr
      ? resolved.startDateStr
      : `${resolved.startDateStr} to ${resolved.endDateStr}`;

  let subject = "";
  let html = "";

  if (item.noticeKind === "assigned" || item.noticeKind === "rescheduled" || item.noticeKind === "cancelled") {
    const kind = item.noticeKind as "assigned" | "rescheduled" | "cancelled";
    subject =
      kind === "rescheduled"
        ? `Schedule Change: ${resolved.trainingName}`
        : kind === "cancelled"
        ? `Training Cancelled: ${resolved.trainingName}`
        : `Training Assignment: ${resolved.trainingName}`;

    html = renderTrainingNoticeEmail({
      nurseName: fullName,
      noticeKind: kind,
      trainingTitle: resolved.trainingName,
      dateRangeStr,
      timeStr: resolved.startTime ? `${resolved.startTime}${resolved.endTime ? ` - ${resolved.endTime}` : ""}` : null,
      venue: resolved.venue,
      instructions: resolved.remarks,
      actionUrl,
    });
  } else {
    // Milestone reminder
    const today = getManilaTodayKey();
    const daysRemaining = diffCalendarDays(resolved.startDateStr, today);
    const isTodayOrTomorrow = daysRemaining <= 0 ? "today" : daysRemaining === 1 ? "tomorrow" : null;

    subject = `Reminder: ${resolved.trainingName} (${daysRemaining <= 0 ? "Today" : daysRemaining === 1 ? "Tomorrow" : `in ${daysRemaining} days`})`;
    html = renderTrainingMilestoneEmail({
      nurseName: fullName,
      trainingTitle: resolved.trainingName,
      dateRangeStr,
      timeStr: resolved.startTime ? `${resolved.startTime}${resolved.endTime ? ` - ${resolved.endTime}` : ""}` : null,
      venue: resolved.venue,
      instructions: resolved.remarks,
      daysRemaining,
      isTodayOrTomorrow,
      actionUrl,
    });

    // Ensure in-app activity for milestone (G6)
    const actTitle = `Upcoming Training: ${resolved.trainingName}`;
    const actMessage = `Reminder: ${resolved.trainingName} is scheduled on ${dateRangeStr}${resolved.startTime ? ` at ${resolved.startTime}` : ""}.`;

    if (db) {
      await db.insert(trainingActivity).values({
        nurseId: item.recipientNurseId,
        assignmentId: item.assignmentId,
        activityType: item.noticeKind,
        title: actTitle,
        message: actMessage,
      });
    } else if (sqlite) {
      sqlite
        .prepare("INSERT INTO trainingActivity (nurseId, assignmentId, activityType, title, message) VALUES (?, ?, ?, ?, ?)")
        .run(item.recipientNurseId, item.assignmentId, item.noticeKind, actTitle, actMessage);
    }
  }

  // Dispatch email
  const sendRes = await sendEmail({
    to: recipientEmail,
    subject,
    html,
    nurseId: item.recipientNurseId,
    emailType: "training_reminder",
    referenceId: item.assignmentId,
    thresholdKey: item.noticeKind,
  });

  if (sendRes.status === "sent" || sendRes.status === "mock_sent") {
    await updateOutbox(sendRes.status, sendRes.messageId || null, null);
    return { ok: true, status: sendRes.status };
  } else {
    const newAttempts = (item.attempts ?? 0) + 1;
    const finalStatus = newAttempts >= 3 ? "failed" : "pending";
    if (db) {
      await db
        .update(trainingOutbox)
        .set({
          status: finalStatus,
          attempts: newAttempts,
          lastAttemptAt: new Date(),
          errorDetail: sendRes.error || "Email delivery failed",
          updatedAt: new Date(),
        })
        .where(eq(trainingOutbox.id, item.id));
    } else if (sqlite) {
      sqlite
        .prepare(
          `UPDATE trainingOutbox
           SET status = ?, attempts = ?, lastAttemptAt = CURRENT_TIMESTAMP, errorDetail = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(finalStatus, newAttempts, sendRes.error || "Email delivery failed", item.id);
    }
    return { ok: false, status: finalStatus, error: sendRes.error };
  }
}

/** Supervisor action to retry an eligible failed outbox item */
export async function retryFailedOutboxItem(itemId: number): Promise<{ ok: boolean; status: string; error?: string }> {
  const db = await getDb();
  let item: TrainingOutboxItem | null = null;

  if (db) {
    const rows = await db.select().from(trainingOutbox).where(eq(trainingOutbox.id, itemId)).limit(1);
    if (rows.length > 0) item = rows[0];
  } else {
    const sqlite = getSqliteDb();
    item = sqlite.prepare("SELECT * FROM trainingOutbox WHERE id = ?").get(itemId) as any;
  }

  if (!item) throw new Error("Outbox item not found");
  if (item.status !== "failed" && item.status !== "skipped") {
    throw new Error(`Cannot retry item with status ${item.status}`);
  }

  // Reset to pending and attempts to 0
  if (db) {
    await db
      .update(trainingOutbox)
      .set({ status: "pending", attempts: 0, errorDetail: null, updatedAt: new Date() })
      .where(eq(trainingOutbox.id, itemId));
  } else {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE trainingOutbox SET status = 'pending', attempts = 0, errorDetail = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(itemId);
  }

  // Attempt immediate processing
  return dispatchSingleOutboxItem(itemId);
}
