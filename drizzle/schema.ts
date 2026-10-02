import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  numeric,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const ktp = pgSchema("ktp");
const pgTable = ktp.table;

const touchedOnUpdate = () => new Date();

/**
 * DATE column that reads back as a UTC-midnight Date
 * and accepts either a Date or a YYYY-MM-DD string on write.
 */
const date = customType<{ data: Date; driverData: string }>({
  dataType: () => "date",
  toDriver: (value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10),
  fromDriver: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`),
});

/** Users table for admin authentication and linked Google accounts. */
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

/** Doctors: Nephrologists and Fellows */
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 32, enum: ["Nephrologist", "Fellow"] }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = typeof doctors.$inferInsert;

/** Patients: Recipients and Donors */
export const patients = pgTable(
  "patients",
  {
    id: serial("id").primaryKey(),
    hrn: varchar("hrn", { length: 64 }).notNull().unique(),
    patientType: varchar("patientType", { length: 16, enum: ["Recipient", "Donor"] }).notNull(),
    firstName: varchar("firstName", { length: 128 }).notNull(),
    middleName: varchar("middleName", { length: 128 }),
    lastName: varchar("lastName", { length: 128 }).notNull(),
    suffix: varchar("suffix", { length: 32 }),
    sex: varchar("sex", { length: 8, enum: ["M", "F"] }),
    birthDate: date("birthDate"),
    contactNumber: varchar("contactNumber", { length: 32 }),
    /** Gmail account for the patient portal. Null: the patient has no portal access. */
    accountEmail: varchar("accountEmail", { length: 320 }),
    linkedUserId: integer("linkedUserId").unique(),
    nephrologistId: integer("nephrologistId"),
    fellowId: integer("fellowId"),
    stage: varchar("stage", { length: 32 }).notNull(),
    riskCategory: varchar("riskCategory", { length: 32, enum: ["StandardLow", "High"] }),
    surgeryDate: date("surgeryDate"),
    linkedRecipientId: integer("linkedRecipientId"),
    followupMonths: integer("followupMonths").default(1).notNull(),
    status: varchar("status", {
      length: 32,
      enum: ["Active", "Inactive", "Deceased", "Transferred"],
    })
      .default("Active")
      .notNull(),
    photoFileId: integer("photoFileId"),
    consentAcceptedAt: timestamp("consentAcceptedAt"),
    consentVersion: integer("consentVersion"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (table) => [
    uniqueIndex("patients_hrn_idx").on(table.hrn),
    uniqueIndex("patients_email_lower_idx").on(sql`lower(${table.accountEmail})`),
    index("patients_stage_idx").on(table.stage),
    index("patients_status_idx").on(table.status),
    index("patients_type_idx").on(table.patientType),
  ]
);
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

/** Stored file metadata for uploads and attachments */
export const storedFiles = pgTable("storedFiles", {
  id: serial("id").primaryKey(),
  fileName: text("fileName").notNull(),
  fileType: varchar("fileType", { length: 128 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  storageKey: text("storageKey").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StoredFile = typeof storedFiles.$inferSelect;
export type InsertStoredFile = typeof storedFiles.$inferInsert;

/** Admin and user activity audit trail */
export const activityLog = pgTable("activityLog", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actorUserId"),
  patientId: integer("patientId"),
  action: varchar("action", { length: 64 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/** Key-value application settings */
export const appSettings = pgTable("appSettings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/** Email delivery audit log */
export const emailLogs = pgTable("emailLogs", {
  id: serial("id").primaryKey(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: text("subject").notNull(),
  templateName: varchar("templateName", { length: 64 }).notNull(),
  status: varchar("status", { length: 16, enum: ["sent", "failed", "mock"] }).notNull(),
  errorMessage: text("errorMessage"),
  patientId: integer("patientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/** In-app notifications */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 32, enum: ["info", "warning", "urgent"] })
    .default("info")
    .notNull(),
  read: boolean("read").default(false).notNull(),
  linkUrl: text("linkUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/** One-way broadcast and targeted messages */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderUserId: integer("senderUserId").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  targetType: varchar("targetType", {
    length: 32,
    enum: ["All", "Recipient", "Donor", "Stage", "Individual"],
  }).notNull(),
  targetStage: varchar("targetStage", { length: 32 }),
  targetPatientId: integer("targetPatientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const messageRecipients = pgTable("messageRecipients", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId").notNull(),
  patientId: integer("patientId").notNull(),
  readAt: timestamp("readAt"),
});
export type MessageRecipient = typeof messageRecipients.$inferSelect;
export type InsertMessageRecipient = typeof messageRecipients.$inferInsert;

export const messageAcknowledgments = pgTable("messageAcknowledgments", {
  id: serial("id").primaryKey(),
  messageId: integer("messageId").notNull(),
  patientId: integer("patientId").notNull(),
  acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
});
export type MessageAcknowledgment = typeof messageAcknowledgments.$inferSelect;
export type InsertMessageAcknowledgment = typeof messageAcknowledgments.$inferInsert;

/** Outbox queue for scheduled email reminders */
export const reminderOutbox = pgTable("reminderOutbox", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceRecordId: integer("serviceRecordId"),
  appointmentId: integer("appointmentId"),
  triggerType: varchar("triggerType", { length: 64 }).notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  sentAt: timestamp("sentAt"),
  status: varchar("status", {
    length: 16,
    enum: ["pending", "sent", "failed", "cancelled"],
  })
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
});
export type ReminderOutbox = typeof reminderOutbox.$inferSelect;
export type InsertReminderOutbox = typeof reminderOutbox.$inferInsert;

/** Checklist catalog template items */
export const checklistCatalog = pgTable("checklistCatalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: varchar("category", {
    length: 32,
    enum: ["Lab", "Imaging", "Clearance", "Milestone"],
  }).notNull(),
  phase: integer("phase"),
  appliesTo: varchar("appliesTo", { length: 16, enum: ["Recipient", "Donor", "Both"] })
    .default("Both")
    .notNull(),
  asIndicated: boolean("asIndicated").default(false).notNull(),
  sortOrder: integer("sortOrder").default(99).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type ChecklistCatalogItem = typeof checklistCatalog.$inferSelect;
export type InsertChecklistCatalogItem = typeof checklistCatalog.$inferInsert;

/** Patient checklist progress */
export const patientChecklist = pgTable(
  "patientChecklist",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patientId").notNull(),
    catalogId: integer("catalogId").notNull(),
    status: varchar("status", { length: 16, enum: ["Pending", "Done", "NA"] })
      .default("Pending")
      .notNull(),
    doneDate: date("doneDate"),
    note: text("note"),
    fileIds: text("fileIds"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
  },
  (table) => [
    uniqueIndex("patient_checklist_unique_idx").on(table.patientId, table.catalogId),
  ]
);
export type PatientChecklistItem = typeof patientChecklist.$inferSelect;
export type InsertPatientChecklistItem = typeof patientChecklist.$inferInsert;

/** Service records: recurring items tracker (Meds, Laboratory, Tacro, XrayUsd) */
export const serviceRecords = pgTable("serviceRecords", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceType: varchar("serviceType", {
    length: 32,
    enum: ["Meds", "Laboratory", "Tacro", "XrayUsd"],
  }).notNull(),
  label: text("label").notNull(),
  status: varchar("status", {
    length: 16,
    enum: ["Planned", "Done", "Superseded"],
  })
    .default("Planned")
    .notNull(),
  dueDate: date("dueDate").notNull(),
  serviceDate: date("serviceDate"),
  claimDeadline: date("claimDeadline"),
  claimFiledDate: date("claimFiledDate"),
  repeatOfId: integer("repeatOfId"),
  repeatReason: varchar("repeatReason", {
    length: 32,
    enum: [
      "Hemolyzed",
      "Clotted",
      "WrongTroughTiming",
      "LabError",
      "DoctorRequest",
      "Other",
    ],
  }),
  repeatEveryDays: integer("repeatEveryDays"),
  source: varchar("source", { length: 16, enum: ["Manual", "Guide"] })
    .default("Manual")
    .notNull(),
  /** Work-up phase of a lab result entered from the Labs tab. Null for a service scheduled in Tracker. */
  phase: varchar("phase", {
    length: 16,
    enum: ["Phase1", "Phase2", "Phase3", "PostKT", "PostDonation"],
  }),
  note: text("note"),
  fileIds: text("fileIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type InsertServiceRecord = typeof serviceRecords.$inferInsert;

/** Lab test catalog with unit and reference ranges */
export const labTests = pgTable("labTests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  low: text("low"),
  high: text("high"),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(99).notNull(),
});
export type LabTest = typeof labTests.$inferSelect;
export type InsertLabTest = typeof labTests.$inferInsert;

/** Lab results tied to a completed service record */
export const labResults = pgTable("labResults", {
  id: serial("id").primaryKey(),
  serviceRecordId: integer("serviceRecordId").notNull(),
  labTestId: integer("labTestId").notNull(),
  value: text("value").notNull(),
  lowSnapshot: text("lowSnapshot"),
  highSnapshot: text("highSnapshot"),
  flag: varchar("flag", { length: 16, enum: ["Low", "Normal", "High"] }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LabResult = typeof labResults.$inferSelect;
export type InsertLabResult = typeof labResults.$inferInsert;

/** Audit trail of record revisions (typo fixes, corrections) with reasons */
export const recordRevisions = pgTable("recordRevisions", {
  id: serial("id").primaryKey(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: integer("entityId").notNull(),
  before: text("before").notNull(),
  after: text("after").notNull(),
  reason: text("reason").notNull(),
  userId: integer("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecordRevision = typeof recordRevisions.$inferSelect;
export type InsertRecordRevision = typeof recordRevisions.$inferInsert;

/** Appointments: clinic visits, follow-ups, clearances */
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  title: text("title").notNull(),
  kind: varchar("kind", {
    length: 32,
    enum: ["FollowUp", "Biopsy", "Workup", "Clearance", "Other"],
  }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  location: text("location"),
  note: text("note"),
  response: varchar("response", {
    length: 32,
    enum: ["Pending", "Confirmed", "RescheduleRequested"],
  })
    .default("Pending")
    .notNull(),
  responseNote: text("responseNote"),
  respondedAt: timestamp("respondedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
});
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
