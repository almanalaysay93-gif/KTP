import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  json,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const nursetrack = pgSchema("nursetrack");
const pgTable = nursetrack.table;

/** Postgres has no ON UPDATE CURRENT_TIMESTAMP; drizzle stamps it on update instead. */
const touchedOnUpdate = () => new Date();

/**
 * DATE column that reads back as a UTC-midnight Date (what the old MySQL driver returned)
 * and accepts either a Date or a "YYYY-MM-DD" string on write — callers pass both.
 */
const date = customType<{ data: Date; driverData: string }>({
  dataType: () => "date",
  toDriver: (value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10),
  fromDriver: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`),
});

/**
 * Core user table backing auth flow (Google OAuth).
 * Single supervisor role in v1 — the supervisor is the account owner.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16, enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Areas of assignment (RDU MAIN, RDU ANNEX, SKTI SERVICE WARD, SKTI ICU, SKTI PAY). */
export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  sortOrder: integer("sortOrder").default(99).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type Area = typeof areas.$inferSelect;
export type InsertArea = typeof areas.$inferInsert;

/** Nurse staff records. Never hard-deleted; archived nurses are flagged. */
export const nurses = pgTable(
  "nurses",
  {
    id: serial("id").primaryKey(),
    employeeId: varchar("employeeId", { length: 64 }).notNull().unique(),
    firstName: varchar("firstName", { length: 128 }).notNull(),
    middleName: varchar("middleName", { length: 128 }),
    lastName: varchar("lastName", { length: 128 }).notNull(),
    suffix: varchar("suffix", { length: 32 }),
    position: varchar("position", { length: 128 }),
    staffType: varchar("staffType", { length: 32, enum: ["Registered Nurse", "Nursing Attendant"] })
      .default("Registered Nurse")
      .notNull(),
    dateHired: date("dateHired", { mode: "date" }),
    employmentStatus: varchar("employmentStatus", {
      length: 32,
      enum: [
        "Active",
        "On Leave",
        "Temporary Assignment",
        "Transferred",
        "Rotated",
        "Resigned",
        "Retired",
        "Archived",
      ],
    })
      .default("Active")
      .notNull(),
    currentAreaId: integer("currentAreaId"),
    profilePhotoKey: text("profilePhotoKey"),
    contactNumber: varchar("contactNumber", { length: 32 }),
    /** Google account email used to self-link this nurse's staff self-service login. Not the HR record of truth — just the login identity. */
    accountEmail: varchar("accountEmail", { length: 320 }),
    /** users.id of the linked Google account, once the staff member has linked (via supervisor pre-fill or self-link by PRC number + name). Null = not linked yet. */
    linkedUserId: integer("linkedUserId"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [
    uniqueIndex("idx_nurses_employee").on(t.employeeId),
    index("idx_nurses_lastname").on(t.lastName),
    index("idx_nurses_area").on(t.currentAreaId),
    uniqueIndex("idx_nurses_linked_user").on(t.linkedUserId),
    // Case-insensitive: `accountEmail` is the staff sign-in identity, so
    // "Nurse@x.com" and "nurse@x.com" must not both be claimable.
    uniqueIndex("idx_nurses_account_email").on(sql`lower(${t.accountEmail})`),
  ],
);
export type Nurse = typeof nurses.$inferSelect;
export type InsertNurse = typeof nurses.$inferInsert;

/** Historical area assignments. Never destroyed on area changes. */
export const areaAssignments = pgTable(
  "areaAssignments",
  {
    id: serial("id").primaryKey(),
    nurseId: integer("nurseId").notNull(),
    areaId: integer("areaId").notNull(),
    startDate: date("startDate", { mode: "date" }).notNull(),
    endDate: date("endDate", { mode: "date" }),
    assignmentType: varchar("assignmentType", { length: 64 }),
    remarks: text("remarks"),
    isCurrent: boolean("isCurrent").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_asgn_nurse").on(t.nurseId), index("idx_asgn_area").on(t.areaId)],
);
export type AreaAssignment = typeof areaAssignments.$inferSelect;

/** Credential types — PRC Registered Nurse License seeded by default. */
export const credentialTypes = pgTable("credentialTypes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  issuingOrganizationDefault: text("issuingOrganizationDefault"),
  active: boolean("active").default(true).notNull(),
});
export type CredentialType = typeof credentialTypes.$inferSelect;

/** Professional license / credential records. */
export const nurseCredentials = pgTable(
  "nurseCredentials",
  {
    id: serial("id").primaryKey(),
    nurseId: integer("nurseId").notNull(),
    credentialTypeId: integer("credentialTypeId").notNull(),
    licenseNumber: varchar("licenseNumber", { length: 64 }),
    issuingOrganization: varchar("issuingOrganization", { length: 128 }),
    issueDate: date("issueDate", { mode: "date" }),
    expiryDate: date("expiryDate", { mode: "date" }).notNull(),
    renewalStatus: varchar("renewalStatus", {
      length: 32,
      enum: ["Not Started", "Renewal In Progress", "Submitted", "Renewed"],
    })
      .default("Not Started")
      .notNull(),
    verificationStatus: varchar("verificationStatus", {
      length: 32,
      enum: ["Unverified", "Pending Verification", "Verified"],
    })
      .default("Unverified")
      .notNull(),
    documentKey: text("documentKey"),
    renewalCycleKey: varchar("renewalCycleKey", { length: 128 }).notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_cred_nurse").on(t.nurseId), index("idx_cred_expiry").on(t.expiryDate)],
);
export type NurseCredential = typeof nurseCredentials.$inferSelect;

/** Automated license renewal reminders (one per credential + threshold + cycle). */
export const licenseReminders = pgTable(
  "licenseReminders",
  {
    id: serial("id").primaryKey(),
    credentialId: integer("credentialId").notNull(),
    thresholdDays: integer("thresholdDays").notNull(),
    renewalCycleKey: varchar("renewalCycleKey", { length: 128 }).notNull(),
    triggerDate: date("triggerDate", { mode: "date" }).notNull(),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledgedAt"),
    status: varchar("status", { length: 16, enum: ["active", "acknowledged", "expired"] })
      .default("active")
      .notNull(),
  },
  (t) => [uniqueIndex("uniq_reminder_cycle").on(t.credentialId, t.thresholdDays, t.renewalCycleKey)],
);
export type LicenseReminder = typeof licenseReminders.$inferSelect;

/** Training catalog types. */
export const trainingCatalog = pgTable("trainingCatalog", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  category: varchar("category", { length: 64 }),
  kind: varchar("kind", { length: 16, enum: ["Training", "Seminar", "LDI"] })
    .default("Training")
    .notNull(),
  renewalRequired: boolean("renewalRequired").default(false).notNull(),
  defaultValidityMonths: integer("defaultValidityMonths"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type TrainingCatalog = typeof trainingCatalog.$inferSelect;

/** Scheduled seminar/LDI occurrence. A catalog item may run on multiple dates. */
export const trainingEvents = pgTable(
  "trainingEvents",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("trainingId").notNull(),
    provider: varchar("provider", { length: 128 }),
    venue: varchar("venue", { length: 256 }),
    startDate: date("startDate", { mode: "date" }).notNull(),
    endDate: date("endDate", { mode: "date" }).notNull(),
    startTime: varchar("startTime", { length: 8 }),
    endTime: varchar("endTime", { length: 8 }),
    targetStaffType: varchar("targetStaffType", {
      length: 32,
      enum: ["All", "Registered Nurse", "Nursing Attendant"],
    })
      .default("All")
      .notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_training_event_date").on(t.trainingId, t.startDate)],
);
export type TrainingEvent = typeof trainingEvents.$inferSelect;

/** Which trainings are required for which areas. */
export const areaTrainingRequirements = pgTable(
  "areaTrainingRequirements",
  {
    id: serial("id").primaryKey(),
    areaId: integer("areaId").notNull(),
    trainingId: integer("trainingId").notNull(),
    required: boolean("required").default(true).notNull(),
  },
  (t) => [uniqueIndex("uniq_area_training_req").on(t.areaId, t.trainingId)],
);
export type AreaTrainingRequirement = typeof areaTrainingRequirements.$inferSelect;

/** Nurse training records (each renewal = new record). */
export const nurseTrainings = pgTable(
  "nurseTrainings",
  {
    id: serial("id").primaryKey(),
    nurseId: integer("nurseId").notNull(),
    trainingId: integer("trainingId").notNull(),
    eventId: integer("eventId"),
    participationRole: varchar("participationRole", {
      length: 32,
      enum: ["Participant", "Speaker", "Facilitator", "Preceptor"],
    })
      .default("Participant")
      .notNull(),
    provider: varchar("provider", { length: 128 }),
    status: varchar("status", { length: 16, enum: ["Scheduled", "Completed", "Expired", "Cancelled"] })
      .default("Scheduled")
      .notNull(),
    scheduledDate: date("scheduledDate", { mode: "date" }),
    completionDate: date("completionDate", { mode: "date" }),
    expiryDate: date("expiryDate", { mode: "date" }),
    trainingHours: integer("trainingHours"),
    cpdUnits: integer("cpdUnits"),
    certificateNumber: varchar("certificateNumber", { length: 64 }),
    certificateKey: text("certificateKey"),
    remarks: text("remarks"),
    scheduleVersion: integer("scheduleVersion").default(1).notNull(),
    staffResponse: varchar("staffResponse", {
      length: 32,
      enum: ["Pending", "Confirmed", "Cannot attend"],
    })
      .default("Pending")
      .notNull(),
    staffResponseReason: text("staffResponseReason"),
    staffRespondedAt: timestamp("staffRespondedAt"),
    staffResponseVersion: integer("staffResponseVersion"),
    attendanceOutcome: varchar("attendanceOutcome", {
      length: 32,
      enum: ["Not recorded", "Attended", "Missed", "Excused"],
    })
      .default("Not recorded")
      .notNull(),
    attendanceRecordedAt: timestamp("attendanceRecordedAt"),
    attendanceRecordedBy: integer("attendanceRecordedBy"),
    attendanceNote: text("attendanceNote"),
    evidenceStatus: varchar("evidenceStatus", {
      length: 32,
      enum: ["None", "Submitted", "Verified", "Rejected"],
    })
      .default("None")
      .notNull(),
    evidenceRequired: boolean("evidenceRequired").default(false).notNull(),
    evidenceSubmittedAt: timestamp("evidenceSubmittedAt"),
    evidenceReviewedAt: timestamp("evidenceReviewedAt"),
    evidenceReviewedBy: integer("evidenceReviewedBy"),
    evidenceReviewNote: text("evidenceReviewNote"),
    conflictOverrideReason: text("conflictOverrideReason"),
    conflictOverrideBy: integer("conflictOverrideBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [
    index("idx_nt_nurse").on(t.nurseId),
    index("idx_nt_training").on(t.trainingId),
    index("idx_nt_event").on(t.eventId),
    uniqueIndex("uniq_nt_event_nurse").on(t.eventId, t.nurseId),
    index("idx_nt_expiry").on(t.expiryDate),
  ],
);
export type NurseTraining = typeof nurseTrainings.$inferSelect;

/** Supervisor-created custom calendar events. */
export const customCalendarEvents = pgTable(
  "customCalendarEvents",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 256 }).notNull(),
    eventDate: date("eventDate", { mode: "date" }).notNull(),
    startTime: varchar("startTime", { length: 8 }), // HH:mm
    endTime: varchar("endTime", { length: 8 }),
    allDay: boolean("allDay").default(true).notNull(),
    nurseId: integer("nurseId"),
    areaId: integer("areaId"),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_cce_date").on(t.eventDate)],
);
export type CustomCalendarEvent = typeof customCalendarEvents.$inferSelect;

/** In-app notifications generated by automation or actions. */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 32 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    message: text("message"),
    nurseId: integer("nurseId"),
    relatedEntityType: varchar("relatedEntityType", { length: 64 }),
    relatedEntityId: integer("relatedEntityId"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    dayKey: date("dayKey", { mode: "date" }),
  },
  (t) => [
    index("idx_notif_read").on(t.readAt),
    uniqueIndex("uniq_notif_day").on(t.type, t.nurseId, t.relatedEntityType, t.relatedEntityId, t.dayKey),
  ],
);
export type Notification = typeof notifications.$inferSelect;

/** Audit trail for important record changes. */
export const activityLog = pgTable(
  "activityLog",
  {
    id: serial("id").primaryKey(),
    supervisorId: integer("supervisorId"),
    nurseId: integer("nurseId"),
    actionType: varchar("actionType", { length: 64 }).notNull(),
    entityType: varchar("entityType", { length: 64 }),
    entityId: integer("entityId"),
    summary: text("summary").notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_activity_nurse").on(t.nurseId)],
);
export type ActivityLog = typeof activityLog.$inferSelect;

/** App settings stored as a simple key/value table. */
export const appSettings = pgTable("appSettings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value"),
});
export type AppSetting = typeof appSettings.$inferSelect;

/** Outbound email delivery ledger for audit and deduplication. */
export const emailLogs = pgTable(
  "emailLogs",
  {
    id: serial("id").primaryKey(),
    nurseId: integer("nurseId").notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    emailType: varchar("emailType", { length: 64 }).notNull(),
    referenceId: integer("referenceId"),
    thresholdKey: varchar("thresholdKey", { length: 64 }),
    subject: varchar("subject", { length: 256 }).notNull(),
    status: varchar("status", { length: 32 }).default("sent").notNull(),
    errorMessage: text("errorMessage"),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
  },
  (t) => [index("idx_email_nurse").on(t.nurseId), index("idx_email_typeref").on(t.emailType, t.referenceId)],
);
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/** Supervisor broadcast/direct messages for the nurse portal feed. */
export const staffMessages = pgTable(
  "staffMessages",
  {
    id: serial("id").primaryKey(),
    senderUserId: integer("senderUserId").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    revision: integer("revision").default(1).notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_msg_created").on(t.createdAt)],
);
export type StaffMessage = typeof staffMessages.$inferSelect;
export type InsertStaffMessage = typeof staffMessages.$inferInsert;

/** Recipients and per-nurse read state for supervisor messages. */
export const staffMessageRecipients = pgTable(
  "staffMessageRecipients",
  {
    id: serial("id").primaryKey(),
    messageId: integer("messageId").notNull(),
    nurseId: integer("nurseId").notNull(),
    readAt: timestamp("readAt"),
    lastReadRevision: integer("lastReadRevision"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_msg_recipient").on(t.messageId, t.nurseId),
    index("idx_msg_recip_nurse").on(t.nurseId),
  ],
);
export type StaffMessageRecipient = typeof staffMessageRecipients.$inferSelect;

/** Explicit revision-specific nurse acknowledgment of supervisor messages. */
export const staffMessageAcknowledgments = pgTable(
  "staffMessageAcknowledgments",
  {
    id: serial("id").primaryKey(),
    messageId: integer("messageId").notNull(),
    nurseId: integer("nurseId").notNull(),
    revision: integer("revision").notNull(),
    acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_msg_ack").on(t.messageId, t.nurseId, t.revision),
    index("idx_msg_ack_nurse").on(t.nurseId),
  ],
);
export type StaffMessageAcknowledgment = typeof staffMessageAcknowledgments.$inferSelect;

/** Durable outbox for training milestone reminders and immediate notices. */
export const trainingOutbox = pgTable(
  "trainingOutbox",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignmentId").notNull(),
    scheduleVersion: integer("scheduleVersion").notNull(),
    noticeKind: varchar("noticeKind", { length: 32 }).notNull(), // assignment, reschedule, cancellation, reminder_14d, reminder_7d, reminder_1d, combined_due
    thresholdDays: integer("thresholdDays"), // 14, 7, 1, or null
    dueDate: date("dueDate", { mode: "date" }),
    recipientNurseId: integer("recipientNurseId").notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    status: varchar("status", { length: 32 }).default("pending").notNull(), // pending, claimed, sent, mock_sent, failed, skipped, superseded
    attempts: integer("attempts").default(0).notNull(),
    lastAttemptAt: timestamp("lastAttemptAt"),
    claimedAt: timestamp("claimedAt"),
    providerMessageId: text("providerMessageId"),
    errorDetail: text("errorDetail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [
    index("idx_outbox_status_due").on(t.status, t.dueDate),
    index("idx_outbox_assignment").on(t.assignmentId, t.scheduleVersion),
    uniqueIndex("uniq_outbox_milestone").on(t.assignmentId, t.scheduleVersion, t.noticeKind),
  ],
);
export type TrainingOutboxItem = typeof trainingOutbox.$inferSelect;

/** In-app training activity feed items for the staff portal. */
export const trainingActivity = pgTable(
  "trainingActivity",
  {
    id: serial("id").primaryKey(),
    nurseId: integer("nurseId").notNull(),
    assignmentId: integer("assignmentId").notNull(),
    activityType: varchar("activityType", { length: 32 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    message: text("message"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_tact_nurse").on(t.nurseId), index("idx_tact_assignment").on(t.assignmentId)],
);
export type TrainingActivityItem = typeof trainingActivity.$inferSelect;

/** Database storage fallback for uploaded photos and documents when S3 is unconfigured. */
export const storedFiles = pgTable(
  "storedFiles",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 512 }).notNull().unique(),
    data: text("data").notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    fileSize: integer("fileSize").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_stored_file_key").on(t.key)],
);
export type StoredFile = typeof storedFiles.$inferSelect;

/** Audience-scoped broadcast memos (department, nursing, hospital). */
export const memos = pgTable(
  "memos",
  {
    id: serial("id").primaryKey(),
    memoType: varchar("memoType", { length: 32, enum: ["department", "nursing", "hospital"] }).notNull(),
    areaId: integer("areaId"),
    title: varchar("title", { length: 256 }).notNull(),
    body: text("body").notNull(),
    authorUserId: integer("authorUserId").notNull(),
    status: varchar("status", { length: 16, enum: ["sent", "retracted"] }).default("sent").notNull(),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
    retractedAt: timestamp("retractedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (t) => [index("idx_memos_sent").on(t.sentAt), index("idx_memos_type").on(t.memoType)],
);
export type Memo = typeof memos.$inferSelect;

/** One row per intended nurse for a broadcast memo, including read receipts. */
export const memoRecipients = pgTable(
  "memoRecipients",
  {
    id: serial("id").primaryKey(),
    memoId: integer("memoId").notNull(),
    nurseId: integer("nurseId").notNull(),
    linkedAtSend: boolean("linkedAtSend").default(false).notNull(),
    readAt: timestamp("readAt"),
  },
  (t) => [
    uniqueIndex("uniq_memo_nurse").on(t.memoId, t.nurseId),
    index("idx_memo_rcp_nurse").on(t.nurseId),
    index("idx_memo_rcp_memo").on(t.memoId),
  ],
);
export type MemoRecipient = typeof memoRecipients.$inferSelect;
