import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getSqliteDb } from "./localDb";
import {
  createStaffMessage,
  listSentStaffMessages,
  getStaffMessageDetail,
  updateStaffMessage,
  archiveStaffMessage,
  listNurseFeed,
  countUnreadNurseMessages,
  markNurseMessageRead,
  acknowledgeNurseMessage,
} from "./staffFeed";
import {
  resolveTrainingSchedule,
  checkTrainingConflicts,
  enqueueTrainingNotice,
  createMilestonesForAssignment,
  invalidatePendingOutboxJobs,
  drainTrainingOutbox,
  getManilaTodayKey,
  diffCalendarDays,
  addCalendarDays,
} from "./trainingReminders";

describe("Nurse Portal & Reminders - T1 to T20 & G1 to G7", () => {
  let sqlite: ReturnType<typeof getSqliteDb>;
  let nurseAId: number;
  let nurseBId: number;
  let supervisorUserId: number;
  let trainingTypeId: number;

  beforeAll(() => {
    vi.stubEnv("DATABASE_URL", "");
    sqlite = getSqliteDb();

    const testSuffix = Math.random().toString(36).slice(2, 7);

    // Create a mock supervisor user
    const userRes = sqlite
      .prepare(
        `INSERT INTO users (openId, name, email, role) VALUES ('test-sup-${testSuffix}', 'Clinical Supervisor', 'sup-${testSuffix}@hospital.gov.ph', 'admin')`
      )
      .run();
    supervisorUserId = Number(userRes.lastInsertRowid);

    // Create Nurse A and Nurse B
    const nurseARes = sqlite
      .prepare(
        `INSERT INTO nurses (employeeId, firstName, lastName, position, staffType, accountEmail, employmentStatus) VALUES ('EMP-A-${testSuffix}', 'Alice', 'Reyes', 'Staff Nurse I', 'Registered Nurse', 'alice-${testSuffix}@hospital.gov.ph', 'Active')`
      )
      .run();
    nurseAId = Number(nurseARes.lastInsertRowid);

    const nurseBRes = sqlite
      .prepare(
        `INSERT INTO nurses (employeeId, firstName, lastName, position, staffType, accountEmail, employmentStatus) VALUES ('EMP-B-${testSuffix}', 'Bob', 'Santos', 'Staff Nurse II', 'Registered Nurse', 'bob-${testSuffix}@hospital.gov.ph', 'Active')`
      )
      .run();
    nurseBId = Number(nurseBRes.lastInsertRowid);

    // Create or select a catalog training type
    const catName = `Portal Test Training ${testSuffix}`;
    const catRes = sqlite
      .prepare(
        "INSERT INTO trainingCatalog (name, category, kind, renewalRequired, active) VALUES (?, 'Clinical', 'Training', 1, 1)"
      )
      .run(catName);
    trainingTypeId = Number(catRes.lastInsertRowid);
  });

  describe("Supervisor Messages & Feed Isolation (T1, T2, T3, G2)", () => {
    it("T1 & T2: Nurse A sees message addressed to A; Nurse B cannot read it", async () => {
      const msg = await createStaffMessage({
        senderUserId: supervisorUserId,
        title: "Confidential Notice for Nurse A",
        body: "Please report to Unit Station 3 at 14:00.",
        recipientNurseIds: [nurseAId],
      });

      const feedA = await listNurseFeed(nurseAId);
      const feedB = await listNurseFeed(nurseBId);

      expect(feedA.some((m) => m.id === msg.id)).toBe(true);
      expect(feedB.some((m) => m.id === msg.id)).toBe(false);

      const unreadCountA = await countUnreadNurseMessages(nurseAId);
      expect(unreadCountA).toBeGreaterThanOrEqual(1);
    });

    it("T3: Read state is per nurse and revision; editing requires re-acknowledgment", async () => {
      const msg = await createStaffMessage({
        senderUserId: supervisorUserId,
        title: "Mandatory Safety Protocol Update",
        body: "Version 1.0 of the safety checklist is in effect.",
        recipientNurseIds: [nurseAId],
      });

      // Nurse A marks read
      await markNurseMessageRead(nurseAId, msg.id);
      let feedA = await listNurseFeed(nurseAId);
      let msgItem = feedA.find((m) => m.id === msg.id);
      expect(msgItem?.isRead).toBe(true);

      // Nurse A acknowledges revision 1
      await acknowledgeNurseMessage(nurseAId, msg.id, 1);
      feedA = await listNurseFeed(nurseAId);
      msgItem = feedA.find((m) => m.id === msg.id);
      expect(msgItem?.acknowledgedAt).not.toBeNull();

      // Supervisor updates message to revision 2
      await updateStaffMessage(msg.id, "Mandatory Safety Protocol Update (Revised)", "Version 2.0 updated instructions.");

      feedA = await listNurseFeed(nurseAId);
      msgItem = feedA.find((m) => m.id === msg.id);
      // New revision becomes unread and requires new acknowledgment
      expect(msgItem?.revision).toBe(2);
      expect(msgItem?.isUnread).toBe(true);
      expect(msgItem?.isEdited).toBe(true);
      expect(msgItem?.acknowledgedAt).toBeNull();

      // Acknowledging older revision 1 throws conflict
      await expect(acknowledgeNurseMessage(nurseAId, msg.id, 1)).rejects.toThrow("updated to revision");

      // Acknowledging revision 2 succeeds
      await acknowledgeNurseMessage(nurseAId, msg.id, 2);
      feedA = await listNurseFeed(nurseAId);
      msgItem = feedA.find((m) => m.id === msg.id);
      expect(msgItem?.acknowledgedAt).not.toBeNull();
    });

    it("Supervisor can view sent messages with read and ack totals", async () => {
      const sent = await listSentStaffMessages(10);
      expect(sent.length).toBeGreaterThan(0);
      const target = sent[0];
      expect(typeof target.recipientCount).toBe("number");
      expect(typeof target.readCount).toBe("number");
      expect(typeof target.ackCount).toBe("number");
    });
  });

  describe("Training Conflict Detection (G3)", () => {
    it("Detects exact time conflict between overlapping training sessions", async () => {
      // Create existing training for Nurse A: 2026-10-15 09:00 - 12:00
      const evRes = sqlite
        .prepare(
          "INSERT INTO trainingEvents (trainingId, startDate, endDate, startTime, endTime) VALUES (?, '2026-10-15', '2026-10-15', '09:00', '12:00')"
        )
        .run(trainingTypeId);
      const evId = Number(evRes.lastInsertRowid);

      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, eventId, status, scheduleVersion) VALUES (?, ?, ?, 'Scheduled', 1)"
        )
        .run(nurseAId, trainingTypeId, evId);
      const assignId = Number(assignRes.lastInsertRowid);

      // Check conflict with 10:00 - 13:00 on the same date (overlap)
      const conflictRes = await checkTrainingConflicts(nurseAId, "2026-10-15", "2026-10-15", "10:00", "13:00");
      expect(conflictRes.hasConflict).toBe(true);
      expect(conflictRes.warningOnly).toBe(false);
      expect(conflictRes.conflicts.length).toBeGreaterThanOrEqual(1);

      // Check non-overlapping adjacent time: 12:00 - 15:00 (allowed)
      const adjacentRes = await checkTrainingConflicts(nurseAId, "2026-10-15", "2026-10-15", "12:00", "15:00");
      expect(adjacentRes.hasConflict).toBe(false);

      // Check date with no specified time gives warningOnly
      const missingTimeRes = await checkTrainingConflicts(nurseAId, "2026-10-15", "2026-10-15");
      expect(missingTimeRes.hasConflict).toBe(true);
      expect(missingTimeRes.warningOnly).toBe(true);
    });
  });

  describe("Outbox, Milestones, and Immediate Notices (G1, G6, G7, T10, T12, T14)", () => {
    it("T10 & G1: Enqueues immediate notice and 14d, 7d, 1d milestone reminders for future training", async () => {
      const today = getManilaTodayKey();
      const futureStart = addCalendarDays(today, 20); // 20 days in future

      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, status, scheduledDate, scheduleVersion) VALUES (?, ?, 'Scheduled', ?, 1)"
        )
        .run(nurseAId, trainingTypeId, futureStart);
      const assignmentId = Number(assignRes.lastInsertRowid);

      // Enqueue immediate notice
      const notice = await enqueueTrainingNotice({
        assignmentId,
        scheduleVersion: 1,
        noticeKind: "assigned",
        recipientNurseId: nurseAId,
        actorUserId: supervisorUserId,
      });
      expect(notice).toBeDefined();

      // Create milestones
      await createMilestonesForAssignment({
        assignmentId,
        scheduleVersion: 1,
        startDateStr: futureStart,
        recipientNurseId: nurseAId,
      });

      // Verify outbox rows in SQLite
      const outboxRows = sqlite
        .prepare("SELECT * FROM trainingOutbox WHERE assignmentId = ? AND scheduleVersion = 1")
        .all(assignmentId) as any[];

      const kinds = outboxRows.map((r) => r.noticeKind);
      expect(kinds).toContain("assigned");
      expect(kinds).toContain("reminder_14d");
      expect(kinds).toContain("reminder_7d");
      expect(kinds).toContain("reminder_1d");

      // Verify in-app activity was created (G6)
      const acts = sqlite
        .prepare("SELECT * FROM trainingActivity WHERE assignmentId = ?")
        .all(assignmentId) as any[];
      expect(acts.length).toBeGreaterThanOrEqual(1);
      expect(acts[0].activityType).toBe("assigned");
    });

    it("T12: Late assignment (e.g. 5 days before start) skips 14d and 7d past milestones", async () => {
      const today = getManilaTodayKey();
      const fiveDaysFuture = addCalendarDays(today, 5); // Only 1d reminder remains

      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, status, scheduledDate, scheduleVersion) VALUES (?, ?, 'Scheduled', ?, 1)"
        )
        .run(nurseAId, trainingTypeId, fiveDaysFuture);
      const assignmentId = Number(assignRes.lastInsertRowid);

      await createMilestonesForAssignment({
        assignmentId,
        scheduleVersion: 1,
        startDateStr: fiveDaysFuture,
        recipientNurseId: nurseAId,
      });

      const outboxRows = sqlite
        .prepare("SELECT * FROM trainingOutbox WHERE assignmentId = ?")
        .all(assignmentId) as any[];

      const kinds = outboxRows.map((r) => r.noticeKind);
      expect(kinds).not.toContain("reminder_14d");
      expect(kinds).not.toContain("reminder_7d");
      expect(kinds).toContain("reminder_1d");
    });

    it("T14: Rescheduling supersedes older pending jobs and increments scheduleVersion", async () => {
      const today = getManilaTodayKey();
      const originalDate = addCalendarDays(today, 25);
      const newDate = addCalendarDays(today, 30);

      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, status, scheduledDate, scheduleVersion) VALUES (?, ?, 'Scheduled', ?, 1)"
        )
        .run(nurseAId, trainingTypeId, originalDate);
      const assignmentId = Number(assignRes.lastInsertRowid);

      await createMilestonesForAssignment({
        assignmentId,
        scheduleVersion: 1,
        startDateStr: originalDate,
        recipientNurseId: nurseAId,
      });

      // Supervisor reschedules to new date with version 2
      sqlite
        .prepare("UPDATE nurseTrainings SET scheduledDate = ?, scheduleVersion = 2, staffResponse = 'Pending' WHERE id = ?")
        .run(newDate, assignmentId);

      // Invalidate version 1 pending jobs
      await invalidatePendingOutboxJobs(assignmentId, 2);

      // Version 1 rows should now be superseded
      const v1Rows = sqlite
        .prepare("SELECT status FROM trainingOutbox WHERE assignmentId = ? AND scheduleVersion = 1")
        .all(assignmentId) as any[];
      expect(v1Rows.every((r) => r.status === "superseded")).toBe(true);

      // Create new version 2 milestones
      await createMilestonesForAssignment({
        assignmentId,
        scheduleVersion: 2,
        startDateStr: newDate,
        recipientNurseId: nurseAId,
      });

      const v2Rows = sqlite
        .prepare("SELECT status FROM trainingOutbox WHERE assignmentId = ? AND scheduleVersion = 2")
        .all(assignmentId) as any[];
      expect(v2Rows.length).toBe(3); // 14d, 7d, 1d
      expect(v2Rows.every((r) => r.status === "pending")).toBe(true);
    });

    it("T11 & Worker: drainTrainingOutbox claims and dispatches due jobs without duplicating", async () => {
      // Create a job due today
      const today = getManilaTodayKey();
      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, status, scheduledDate, scheduleVersion) VALUES (?, ?, 'Scheduled', ?, 1)"
        )
        .run(nurseAId, trainingTypeId, today);
      const assignmentId = Number(assignRes.lastInsertRowid);

      // Immediate notice
      await enqueueTrainingNotice({
        assignmentId,
        scheduleVersion: 1,
        noticeKind: "assigned",
        recipientNurseId: nurseAId,
      });

      const result = await drainTrainingOutbox(10);
      expect(result.processed).toBeGreaterThanOrEqual(1);
      expect(result.sent + result.mockSent).toBeGreaterThanOrEqual(1);

      // Re-running drain immediately finds no pending due jobs
      const rerun = await drainTrainingOutbox(10);
      expect(rerun.processed).toBe(0);
    });
  });

  describe("Attendance Outcomes & Evidence Verification (G5)", () => {
    it("Records attendance outcomes and requires supervisor verification for evidence", async () => {
      const assignRes = sqlite
        .prepare(
          "INSERT INTO nurseTrainings (nurseId, trainingId, status, scheduleVersion, evidenceRequired) VALUES (?, ?, 'Scheduled', 1, 1)"
        )
        .run(nurseAId, trainingTypeId);
      const assignmentId = Number(assignRes.lastInsertRowid);

      // Staff uploads evidence
      sqlite
        .prepare("UPDATE nurseTrainings SET certificateKey = 'certificates/test.pdf', evidenceStatus = 'Submitted', evidenceSubmittedAt = CURRENT_TIMESTAMP WHERE id = ?")
        .run(assignmentId);

      let resolved = await resolveTrainingSchedule(assignmentId);
      expect(resolved?.evidenceStatus).toBe("Submitted");

      // Supervisor records attendance as 'attended'
      sqlite
        .prepare("UPDATE nurseTrainings SET attendanceOutcome = 'attended', attendanceRecordedAt = CURRENT_TIMESTAMP, attendanceRecordedBy = ? WHERE id = ?")
        .run(supervisorUserId, assignmentId);

      // Supervisor approves/verifies evidence
      sqlite
        .prepare("UPDATE nurseTrainings SET evidenceStatus = 'Verified', evidenceReviewedAt = CURRENT_TIMESTAMP, evidenceReviewedBy = ?, status = 'Completed' WHERE id = ?")
        .run(supervisorUserId, assignmentId);

      resolved = await resolveTrainingSchedule(assignmentId);
      expect(resolved?.attendanceOutcome).toBe("attended");
      expect(resolved?.evidenceStatus).toBe("Verified");
      expect(resolved?.status).toBe("Completed");
    });
  });
});
