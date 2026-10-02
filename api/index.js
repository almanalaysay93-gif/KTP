var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var ktp, pgTable, touchedOnUpdate, date, users, doctors, patients, storedFiles, activityLog, appSettings, emailLogs, notifications, messages, messageRecipients, messageAcknowledgments, reminderOutbox, checklistCatalog, patientChecklist, serviceRecords, labTests, labResults, recordRevisions, appointments;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    ktp = pgSchema("ktp");
    pgTable = ktp.table;
    touchedOnUpdate = () => /* @__PURE__ */ new Date();
    date = customType({
      dataType: () => "date",
      toDriver: (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10),
      fromDriver: (value) => /* @__PURE__ */ new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
    });
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: varchar("role", { length: 16, enum: ["user", "admin"] }).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    doctors = pgTable("doctors", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 128 }).notNull(),
      role: varchar("role", { length: 32, enum: ["Nephrologist", "Fellow"] }).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    patients = pgTable(
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
        accountEmail: varchar("accountEmail", { length: 320 }).notNull(),
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
          enum: ["Active", "Inactive", "Deceased", "Transferred"]
        }).default("Active").notNull(),
        photoFileId: integer("photoFileId"),
        consentAcceptedAt: timestamp("consentAcceptedAt"),
        consentVersion: integer("consentVersion"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (table) => [
        uniqueIndex("patients_hrn_idx").on(table.hrn),
        uniqueIndex("patients_email_lower_idx").on(sql`lower(${table.accountEmail})`),
        index("patients_stage_idx").on(table.stage),
        index("patients_status_idx").on(table.status),
        index("patients_type_idx").on(table.patientType)
      ]
    );
    storedFiles = pgTable("storedFiles", {
      id: serial("id").primaryKey(),
      fileName: text("fileName").notNull(),
      fileType: varchar("fileType", { length: 128 }).notNull(),
      fileSize: integer("fileSize").notNull(),
      storageKey: text("storageKey").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    activityLog = pgTable("activityLog", {
      id: serial("id").primaryKey(),
      actorUserId: integer("actorUserId"),
      patientId: integer("patientId"),
      action: varchar("action", { length: 64 }).notNull(),
      details: text("details"),
      ipAddress: varchar("ipAddress", { length: 45 }),
      userAgent: text("userAgent"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    appSettings = pgTable("appSettings", {
      id: serial("id").primaryKey(),
      key: varchar("key", { length: 64 }).notNull().unique(),
      value: text("value").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    emailLogs = pgTable("emailLogs", {
      id: serial("id").primaryKey(),
      recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
      subject: text("subject").notNull(),
      templateName: varchar("templateName", { length: 64 }).notNull(),
      status: varchar("status", { length: 16, enum: ["sent", "failed", "mock"] }).notNull(),
      errorMessage: text("errorMessage"),
      patientId: integer("patientId"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    notifications = pgTable("notifications", {
      id: serial("id").primaryKey(),
      patientId: integer("patientId"),
      title: text("title").notNull(),
      message: text("message").notNull(),
      type: varchar("type", { length: 32, enum: ["info", "warning", "urgent"] }).default("info").notNull(),
      read: boolean("read").default(false).notNull(),
      linkUrl: text("linkUrl"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    messages = pgTable("messages", {
      id: serial("id").primaryKey(),
      senderUserId: integer("senderUserId").notNull(),
      subject: text("subject").notNull(),
      body: text("body").notNull(),
      targetType: varchar("targetType", {
        length: 32,
        enum: ["All", "Recipient", "Donor", "Stage", "Individual"]
      }).notNull(),
      targetStage: varchar("targetStage", { length: 32 }),
      targetPatientId: integer("targetPatientId"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    messageRecipients = pgTable("messageRecipients", {
      id: serial("id").primaryKey(),
      messageId: integer("messageId").notNull(),
      patientId: integer("patientId").notNull(),
      readAt: timestamp("readAt")
    });
    messageAcknowledgments = pgTable("messageAcknowledgments", {
      id: serial("id").primaryKey(),
      messageId: integer("messageId").notNull(),
      patientId: integer("patientId").notNull(),
      acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull()
    });
    reminderOutbox = pgTable("reminderOutbox", {
      id: serial("id").primaryKey(),
      patientId: integer("patientId").notNull(),
      serviceRecordId: integer("serviceRecordId"),
      appointmentId: integer("appointmentId"),
      triggerType: varchar("triggerType", { length: 64 }).notNull(),
      scheduledFor: timestamp("scheduledFor").notNull(),
      sentAt: timestamp("sentAt"),
      status: varchar("status", {
        length: 16,
        enum: ["pending", "sent", "failed", "cancelled"]
      }).default("pending").notNull(),
      errorMessage: text("errorMessage")
    });
    checklistCatalog = pgTable("checklistCatalog", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      category: varchar("category", {
        length: 32,
        enum: ["Lab", "Imaging", "Clearance", "Milestone"]
      }).notNull(),
      phase: integer("phase"),
      appliesTo: varchar("appliesTo", { length: 16, enum: ["Recipient", "Donor", "Both"] }).default("Both").notNull(),
      asIndicated: boolean("asIndicated").default(false).notNull(),
      sortOrder: integer("sortOrder").default(99).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    patientChecklist = pgTable(
      "patientChecklist",
      {
        id: serial("id").primaryKey(),
        patientId: integer("patientId").notNull(),
        catalogId: integer("catalogId").notNull(),
        status: varchar("status", { length: 16, enum: ["Pending", "Done", "NA"] }).default("Pending").notNull(),
        doneDate: date("doneDate"),
        note: text("note"),
        fileIds: text("fileIds"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (table) => [
        uniqueIndex("patient_checklist_unique_idx").on(table.patientId, table.catalogId)
      ]
    );
    serviceRecords = pgTable("serviceRecords", {
      id: serial("id").primaryKey(),
      patientId: integer("patientId").notNull(),
      serviceType: varchar("serviceType", {
        length: 32,
        enum: ["Meds", "Laboratory", "Tacro", "XrayUsd"]
      }).notNull(),
      label: text("label").notNull(),
      status: varchar("status", {
        length: 16,
        enum: ["Planned", "Done", "Superseded"]
      }).default("Planned").notNull(),
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
          "Other"
        ]
      }),
      repeatEveryDays: integer("repeatEveryDays"),
      source: varchar("source", { length: 16, enum: ["Manual", "Guide"] }).default("Manual").notNull(),
      /** Work-up phase of a lab result entered from the Labs tab. Null for a service scheduled in Tracker. */
      phase: varchar("phase", {
        length: 16,
        enum: ["Phase1", "Phase2", "Phase3", "PostKT", "PostDonation"]
      }),
      note: text("note"),
      fileIds: text("fileIds"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    labTests = pgTable("labTests", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 128 }).notNull(),
      unit: varchar("unit", { length: 32 }).notNull(),
      low: text("low"),
      high: text("high"),
      active: boolean("active").default(true).notNull(),
      sortOrder: integer("sortOrder").default(99).notNull()
    });
    labResults = pgTable("labResults", {
      id: serial("id").primaryKey(),
      serviceRecordId: integer("serviceRecordId").notNull(),
      labTestId: integer("labTestId").notNull(),
      value: text("value").notNull(),
      lowSnapshot: text("lowSnapshot"),
      highSnapshot: text("highSnapshot"),
      flag: varchar("flag", { length: 16, enum: ["Low", "Normal", "High"] }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    recordRevisions = pgTable("recordRevisions", {
      id: serial("id").primaryKey(),
      entityType: varchar("entityType", { length: 32 }).notNull(),
      entityId: integer("entityId").notNull(),
      before: text("before").notNull(),
      after: text("after").notNull(),
      reason: text("reason").notNull(),
      userId: integer("userId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    appointments = pgTable("appointments", {
      id: serial("id").primaryKey(),
      patientId: integer("patientId").notNull(),
      title: text("title").notNull(),
      kind: varchar("kind", {
        length: 32,
        enum: ["FollowUp", "Biopsy", "Workup", "Clearance", "Other"]
      }).notNull(),
      startsAt: timestamp("startsAt").notNull(),
      location: text("location"),
      note: text("note"),
      response: varchar("response", {
        length: 32,
        enum: ["Pending", "Confirmed", "RescheduleRequested"]
      }).default("Pending").notNull(),
      responseNote: text("responseNote"),
      respondedAt: timestamp("respondedAt"),
      cancelledAt: timestamp("cancelledAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
  }
});

// server/adminAccess.ts
function hasFullAccess(email) {
  return FULL_ACCESS_EMAILS.some((allowed) => allowed === email?.trim().toLowerCase());
}
function roleForEmail(email) {
  return hasFullAccess(email) ? "admin" : "user";
}
var FULL_ACCESS_EMAILS;
var init_adminAccess = __esm({
  "server/adminAccess.ts"() {
    "use strict";
    FULL_ACCESS_EMAILS = [
      "nncluster@spmcdvo.net",
      "share@spmcdvo.net",
      "almanalaysay93@gmail.com"
    ];
  }
});

// server/baselineSql.ts
var BASELINE_SQL;
var init_baselineSql = __esm({
  "server/baselineSql.ts"() {
    "use strict";
    BASELINE_SQL = `
CREATE SCHEMA IF NOT EXISTS "ktp";

CREATE TABLE IF NOT EXISTS "ktp"."activityLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer,
	"patientId" integer,
	"action" varchar(64) NOT NULL,
	"details" text,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."appSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appSettings_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "ktp"."appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"title" text NOT NULL,
	"kind" varchar(32) NOT NULL,
	"startsAt" timestamp NOT NULL,
	"location" text,
	"note" text,
	"response" varchar(32) DEFAULT 'Pending' NOT NULL,
	"responseNote" text,
	"respondedAt" timestamp,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."checklistCatalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" varchar(32) NOT NULL,
	"phase" integer,
	"appliesTo" varchar(16) DEFAULT 'Both' NOT NULL,
	"asIndicated" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 99 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"role" varchar(32) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."emailLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipientEmail" varchar(320) NOT NULL,
	"subject" text NOT NULL,
	"templateName" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"errorMessage" text,
	"patientId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."labResults" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceRecordId" integer NOT NULL,
	"labTestId" integer NOT NULL,
	"value" text NOT NULL,
	"lowSnapshot" text,
	"highSnapshot" text,
	"flag" varchar(16),
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."labTests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"low" text,
	"high" text,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 99 NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."messageAcknowledgments" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"patientId" integer NOT NULL,
	"acknowledgedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."messageRecipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" integer NOT NULL,
	"patientId" integer NOT NULL,
	"readAt" timestamp
);

CREATE TABLE IF NOT EXISTS "ktp"."messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"senderUserId" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"targetType" varchar(32) NOT NULL,
	"targetStage" varchar(32),
	"targetPatientId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" varchar(32) DEFAULT 'info' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"linkUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."patientChecklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"catalogId" integer NOT NULL,
	"status" varchar(16) DEFAULT 'Pending' NOT NULL,
	"doneDate" date,
	"note" text,
	"fileIds" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"hrn" varchar(64) NOT NULL,
	"patientType" varchar(16) NOT NULL,
	"firstName" varchar(128) NOT NULL,
	"middleName" varchar(128),
	"lastName" varchar(128) NOT NULL,
	"suffix" varchar(32),
	"sex" varchar(8),
	"birthDate" date,
	"contactNumber" varchar(32),
	"accountEmail" varchar(320) NOT NULL,
	"linkedUserId" integer,
	"nephrologistId" integer,
	"fellowId" integer,
	"stage" varchar(32) NOT NULL,
	"riskCategory" varchar(32),
	"surgeryDate" date,
	"linkedRecipientId" integer,
	"followupMonths" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"photoFileId" integer,
	"consentAcceptedAt" timestamp,
	"consentVersion" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_hrn_unique" UNIQUE("hrn"),
	CONSTRAINT "patients_linkedUserId_unique" UNIQUE("linkedUserId")
);

CREATE TABLE IF NOT EXISTS "ktp"."recordRevisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"before" text NOT NULL,
	"after" text NOT NULL,
	"reason" text NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."reminderOutbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceRecordId" integer,
	"appointmentId" integer,
	"triggerType" varchar(64) NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"sentAt" timestamp,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"errorMessage" text
);

CREATE TABLE IF NOT EXISTS "ktp"."serviceRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceType" varchar(32) NOT NULL,
	"label" text NOT NULL,
	"status" varchar(16) DEFAULT 'Planned' NOT NULL,
	"dueDate" date NOT NULL,
	"serviceDate" date,
	"claimDeadline" date,
	"claimFiledDate" date,
	"repeatOfId" integer,
	"repeatReason" varchar(32),
	"repeatEveryDays" integer,
	"source" varchar(16) DEFAULT 'Manual' NOT NULL,
	"phase" varchar(16),
	"note" text,
	"fileIds" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."storedFiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileName" text NOT NULL,
	"fileType" varchar(128) NOT NULL,
	"fileSize" integer NOT NULL,
	"storageKey" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ktp"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_checklist_unique_idx" ON "ktp"."patientChecklist" USING btree ("patientId","catalogId");
CREATE UNIQUE INDEX IF NOT EXISTS "patients_hrn_idx" ON "ktp"."patients" USING btree ("hrn");
CREATE UNIQUE INDEX IF NOT EXISTS "patients_email_lower_idx" ON "ktp"."patients" USING btree (lower("accountEmail"));
CREATE INDEX IF NOT EXISTS "patients_stage_idx" ON "ktp"."patients" USING btree ("stage");
CREATE INDEX IF NOT EXISTS "patients_status_idx" ON "ktp"."patients" USING btree ("status");
CREATE INDEX IF NOT EXISTS "patients_type_idx" ON "ktp"."patients" USING btree ("patientType");
`;
  }
});

// server/clinicalCatalog.ts
function* syncCatalog() {
  const tests = new Set((yield query('SELECT name FROM "labTests"')).map((row) => row.name));
  for (const [name, unit, sort] of LAB_CATALOG) {
    if (!tests.has(name)) yield query('INSERT INTO "labTests" (name, unit, "sortOrder", active) VALUES (?, ?, ?, true)', name, unit, sort);
  }
  const insertItem = (row) => query(
    `INSERT INTO "checklistCatalog" (name, category, phase, "appliesTo", "asIndicated", "sortOrder", active) VALUES (?, ?, ?, ?, ${flag(row[4])}, ?, true) RETURNING id`,
    row[0],
    row[1],
    row[2],
    row[3],
    row[5]
  );
  const items = yield query('SELECT * FROM "checklistCatalog"');
  if (items.length === 0) {
    for (const row of CHECKLIST_CATALOG) yield insertItem(row);
    return;
  }
  const panels = items.filter((item) => item.active && CHECKLIST_SPLITS[item.name]);
  if (panels.length === 0) return;
  yield query('UPDATE "checklistCatalog" SET "sortOrder" = "sortOrder" * 10');
  for (const panel of panels) {
    for (const [index2, name] of CHECKLIST_SPLITS[panel.name].entries()) {
      let [item] = yield query('SELECT id FROM "checklistCatalog" WHERE name = ? AND phase = ? AND active = true', name, panel.phase);
      if (!item) [item] = yield insertItem([name, panel.category, panel.phase, panel.appliesTo, panel.asIndicated ? 1 : 0, panel.sortOrder * 10 + index2 + 1]);
      yield query(`INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate", note)
        SELECT "patientId", ?, status, "doneDate", note FROM "patientChecklist" WHERE "catalogId" = ?
        ON CONFLICT ("patientId", "catalogId") DO NOTHING`, item.id, panel.id);
    }
    yield query('UPDATE "checklistCatalog" SET active = false WHERE id = ?', panel.id);
  }
}
var LAB_CATALOG, CHECKLIST_SPLITS, PANEL_CATALOG, CHECKLIST_CATALOG, query, flag;
var init_clinicalCatalog = __esm({
  "server/clinicalCatalog.ts"() {
    "use strict";
    LAB_CATALOG = [
      ["Hemoglobin", "g/L", 1],
      ["WBC", "x10^9/L", 2],
      ["Platelets", "x10^9/L", 3],
      ["Creatinine", "umol/L", 4],
      ["BUN", "mmol/L", 5],
      ["FBS", "mmol/L", 6],
      ["Sodium", "mmol/L", 7],
      ["Potassium", "mmol/L", 8],
      ["ALT (SGPT)", "U/L", 9],
      ["Tacrolimus trough", "ng/mL", 10],
      ["Total cholesterol", "mmol/L", 11],
      ["Triglycerides", "mmol/L", 12],
      ["HDL", "mmol/L", 13],
      ["LDL", "mmol/L", 14],
      ["CMV PCR", "IU/mL", 15],
      // Tests of the work-up panels. New tests go at the end: the lab document parser uses the IDs of the first 15.
      ["Bleeding time", "min", 16],
      ["Clotting time", "min", 17],
      ["PT/INR", "INR", 18],
      ["aPTT", "s", 19],
      ["HbA1c", "%", 20],
      ["Uric acid", "umol/L", 21],
      ["AST (SGOT)", "U/L", 22],
      ["ALP", "U/L", 23],
      ["Calcium", "mmol/L", 24],
      ["Phosphorus", "mmol/L", 25],
      ["Magnesium", "mmol/L", 26],
      ["Albumin", "g/L", 27],
      ["Total protein", "g/L", 28],
      ["iPTH", "pmol/L", 29]
    ];
    CHECKLIST_SPLITS = {
      "CBC with differential": ["Hemoglobin", "WBC", "Platelets"],
      "BT, CT, PT/INR, aPTT": ["Bleeding time", "Clotting time", "PT/INR", "aPTT"],
      "FBS and HbA1c": ["FBS", "HbA1c"],
      "Creatinine, BUN, uric acid": ["Creatinine", "BUN", "Uric acid"],
      "SGPT, SGOT, ALP": ["ALT (SGPT)", "AST (SGOT)", "ALP"],
      "Na, K, Ca, phosphorus, Mg": ["Sodium", "Potassium", "Calcium", "Phosphorus", "Magnesium"],
      "Lipid profile": ["Total cholesterol", "Triglycerides", "HDL", "LDL"],
      "Albumin and total protein": ["Albumin", "Total protein"],
      "Repeat urinalysis and CBC": ["Repeat urinalysis", "Repeat CBC"]
    };
    PANEL_CATALOG = [
      // Milestones
      ["Pre-transplant orientation", "Milestone", null, "Both", 0, 1],
      ["Initial nephrology assessment", "Milestone", null, "Both", 0, 2],
      ["HTEC evaluation and approval", "Milestone", null, "Both", 0, 3],
      ["CDTE and risk stratification", "Milestone", null, "Recipient", 0, 4],
      ["PhilHealth Z Package qualification and application", "Milestone", null, "Recipient", 0, 5],
      // Phase 1 labs
      ["CBC with differential", "Lab", 1, "Both", 0, 10],
      ["Blood typing ABO and Rh", "Lab", 1, "Both", 0, 11],
      ["BT, CT, PT/INR, aPTT", "Lab", 1, "Both", 0, 12],
      ["FBS and HbA1c", "Lab", 1, "Both", 0, 13],
      ["Creatinine, BUN, uric acid", "Lab", 1, "Both", 0, 14],
      ["SGPT, SGOT, ALP", "Lab", 1, "Both", 0, 15],
      ["Na, K, Ca, phosphorus, Mg", "Lab", 1, "Both", 0, 16],
      ["Lipid profile", "Lab", 1, "Both", 0, 17],
      ["Albumin and total protein", "Lab", 1, "Both", 0, 18],
      ["iPTH", "Lab", 1, "Both", 0, 19],
      ["Hepatitis B markers", "Lab", 1, "Both", 0, 20],
      ["Anti-HCV", "Lab", 1, "Both", 0, 21],
      ["TPPA/VDRL/RPR", "Lab", 1, "Both", 0, 22],
      ["HIV", "Lab", 1, "Both", 0, 23],
      ["Malaria (BSMP)", "Lab", 1, "Both", 0, 24],
      ["CMV IgG", "Lab", 1, "Both", 0, 25],
      ["EBV IgG", "Lab", 1, "Both", 0, 26],
      ["Varicella IgG", "Lab", 1, "Both", 0, 27],
      ["TB Quantiferon", "Lab", 1, "Both", 0, 28],
      ["Throat swab GS and C/S", "Lab", 1, "Both", 0, 29],
      ["Urinalysis with microscopy", "Lab", 1, "Both", 0, 30],
      ["Urine C/S", "Lab", 1, "Both", 0, 31],
      ["UACR or 24-hour urine protein and creatinine", "Lab", 1, "Both", 0, 32],
      ["Fecalysis with occult blood or FIT", "Lab", 1, "Both", 0, 33],
      ["Pregnancy test", "Lab", 1, "Both", 1, 34],
      // Phase 1 imaging
      ["Chest X-ray PA", "Imaging", 1, "Both", 0, 40],
      ["12-lead ECG", "Imaging", 1, "Both", 0, 41],
      ["Whole abdomen ultrasound", "Imaging", 1, "Both", 0, 42],
      ["2D echo with Doppler", "Imaging", 1, "Both", 0, 43],
      // Phase 2
      ["HLA typing class I and II", "Lab", 2, "Both", 0, 50],
      ["PRA screening class I, II, MICA", "Lab", 2, "Recipient", 0, 51],
      ["Single antigen bead / DSA", "Lab", 2, "Recipient", 0, 52],
      ["T and B cell crossmatch", "Lab", 2, "Recipient", 0, 53],
      ["Renal CT angiography with 3D reconstruction", "Imaging", 2, "Donor", 0, 54],
      ["Nuclear GFR scan (split function)", "Imaging", 2, "Donor", 0, 55],
      ["Aorto-iliac duplex ultrasound", "Imaging", 2, "Donor", 0, 56],
      // Phase 3
      ["Repeat chest X-ray", "Imaging", 3, "Both", 0, 60],
      ["Repeat urinalysis and CBC", "Lab", 3, "Both", 0, 61],
      ["RT-PCR on admission day", "Lab", 3, "Both", 0, 62],
      ["Pre-transplant HD or PD session", "Clearance", 3, "Recipient", 1, 63],
      // Clearances
      ["Cardiology", "Clearance", null, "Both", 0, 70],
      ["Infectious disease", "Clearance", null, "Both", 0, 71],
      ["Dental", "Clearance", null, "Both", 0, 72],
      ["Neuropsychiatric", "Clearance", null, "Both", 0, 73],
      ["Endocrinology", "Clearance", null, "Both", 0, 74],
      ["Donor advocate", "Clearance", null, "Donor", 0, 75],
      ["Gastroenterology or hepatology", "Clearance", null, "Both", 1, 76],
      ["Pulmonology", "Clearance", null, "Both", 1, 77],
      ["Urology", "Clearance", null, "Both", 1, 78],
      ["OB-Gyn with Pap smear or mammogram", "Clearance", null, "Both", 1, 79]
    ];
    CHECKLIST_CATALOG = PANEL_CATALOG.flatMap(([name, category, phase, appliesTo, asIndicated, sort]) => CHECKLIST_SPLITS[name] ? CHECKLIST_SPLITS[name].map((test, index2) => [test, category, phase, appliesTo, asIndicated, sort * 10 + index2 + 1]) : [[name, category, phase, appliesTo, asIndicated, sort * 10]]);
    query = (sql4, ...args) => ({ sql: sql4, args });
    flag = (value) => value ? "true" : "false";
  }
});

// server/localDb.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
function getSqliteDb() {
  if (!_sqliteDb) {
    const DatabaseConstructor = require2("better-sqlite3");
    const dbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, "data", "local.db");
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const instance = new DatabaseConstructor(dbPath);
    instance.pragma("journal_mode = WAL");
    initSchemaAndSeed(instance);
    _sqliteDb = instance;
  }
  return _sqliteDb;
}
function initSchemaAndSeed(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT DEFAULT 'user' NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      lastSignedIn TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER DEFAULT 1 NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hrn TEXT NOT NULL UNIQUE,
      patientType TEXT NOT NULL,
      firstName TEXT NOT NULL,
      middleName TEXT,
      lastName TEXT NOT NULL,
      suffix TEXT,
      sex TEXT,
      birthDate TEXT,
      contactNumber TEXT,
      accountEmail TEXT NOT NULL,
      linkedUserId INTEGER UNIQUE,
      nephrologistId INTEGER,
      fellowId INTEGER,
      stage TEXT NOT NULL,
      riskCategory TEXT,
      surgeryDate TEXT,
      linkedRecipientId INTEGER,
      followupMonths INTEGER DEFAULT 1 NOT NULL,
      status TEXT DEFAULT 'Active' NOT NULL,
      photoFileId INTEGER,
      consentAcceptedAt TEXT,
      consentVersion INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS patients_email_lower_idx ON patients (lower(accountEmail));

    CREATE TABLE IF NOT EXISTS storedFiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      storageKey TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activityLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actorUserId INTEGER,
      patientId INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emailLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipientEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      templateName TEXT NOT NULL,
      status TEXT NOT NULL,
      errorMessage TEXT,
      patientId INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' NOT NULL,
      read INTEGER DEFAULT 0 NOT NULL,
      linkUrl TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderUserId INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetStage TEXT,
      targetPatientId INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messageRecipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      readAt TEXT
    );

    CREATE TABLE IF NOT EXISTS messageAcknowledgments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      patientId INTEGER NOT NULL,
      acknowledgedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminderOutbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      serviceRecordId INTEGER,
      appointmentId INTEGER,
      triggerType TEXT NOT NULL,
      scheduledFor TEXT NOT NULL,
      sentAt TEXT,
      status TEXT DEFAULT 'pending' NOT NULL,
      errorMessage TEXT
    );

    CREATE TABLE IF NOT EXISTS checklistCatalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      phase INTEGER,
      appliesTo TEXT DEFAULT 'Both' NOT NULL,
      asIndicated INTEGER DEFAULT 0 NOT NULL,
      sortOrder INTEGER DEFAULT 99 NOT NULL,
      active INTEGER DEFAULT 1 NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patientChecklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      catalogId INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending' NOT NULL,
      doneDate TEXT,
      note TEXT,
      fileIds TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(patientId, catalogId)
    );

    CREATE TABLE IF NOT EXISTS serviceRecords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      serviceType TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT DEFAULT 'Planned' NOT NULL,
      dueDate TEXT NOT NULL,
      serviceDate TEXT,
      claimDeadline TEXT,
      claimFiledDate TEXT,
      repeatOfId INTEGER,
      repeatReason TEXT,
      repeatEveryDays INTEGER,
      source TEXT DEFAULT 'Manual' NOT NULL,
      note TEXT,
      fileIds TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS labTests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      low TEXT,
      high TEXT,
      active INTEGER DEFAULT 1 NOT NULL,
      sortOrder INTEGER DEFAULT 99 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS labResults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serviceRecordId INTEGER NOT NULL,
      labTestId INTEGER NOT NULL,
      value TEXT NOT NULL,
      lowSnapshot TEXT,
      highSnapshot TEXT,
      flag TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recordRevisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      before TEXT NOT NULL,
      after TEXT NOT NULL,
      reason TEXT NOT NULL,
      userId INTEGER NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      startsAt TEXT NOT NULL,
      location TEXT,
      note TEXT,
      response TEXT DEFAULT 'Pending' NOT NULL,
      responseNote TEXT,
      respondedAt TEXT,
      cancelledAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  if (!db.prepare("SELECT 1 FROM pragma_table_info('serviceRecords') WHERE name = 'phase'").get()) {
    db.exec("ALTER TABLE serviceRecords ADD COLUMN phase TEXT");
  }
  const settingCount = db.prepare("SELECT count(*) as count FROM appSettings").get();
  if (settingCount.count === 0) {
    const insertSetting = db.prepare("INSERT INTO appSettings (key, value) VALUES (?, ?)");
    insertSetting.run("consentVersion", "1");
    insertSetting.run(
      "consentNoticeText",
      "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination."
    );
    insertSetting.run(
      "emergencyHotlineText",
      "KT Unit Hotline: 0917-000-0000 | Hospital Trunk: (082) 227-2731 loc 4100"
    );
  }
  const docCount = db.prepare("SELECT count(*) as count FROM doctors").get();
  if (docCount.count === 0) {
    const insertDoc = db.prepare("INSERT INTO doctors (name, role, active) VALUES (?, ?, 1)");
    insertDoc.run("Dr. Maria Santos", "Nephrologist");
    insertDoc.run("Dr. Roberto Cruz", "Nephrologist");
    insertDoc.run("Dr. Juan Reyes", "Fellow");
    insertDoc.run("Dr. Ana Lim", "Fellow");
  }
  db.transaction(() => {
    const sync = syncCatalog();
    let step = sync.next();
    while (!step.done) {
      const statement = db.prepare(step.value.sql);
      const rows = statement.reader ? statement.all(...step.value.args) : (statement.run(...step.value.args), []);
      step = sync.next(rows);
    }
  })();
  const existingPatient = db.prepare("SELECT * FROM patients WHERE lower(accountEmail) = 'alai12152201@gmail.com'").get();
  if (!existingPatient) {
    db.prepare(`
      INSERT INTO patients (
        hrn, patientType, firstName, lastName, accountEmail, stage, status, surgeryDate, consentVersion, consentAcceptedAt
      ) VALUES (
        'KTP-2026-0001', 'Recipient', 'Alai', 'Patient', 'alai12152201@gmail.com', 'PostKT', 'Active', '2026-01-15', 1, CURRENT_TIMESTAMP
      )
    `).run();
  }
}
var require2, __filename, __dirname, _sqliteDb;
var init_localDb = __esm({
  "server/localDb.ts"() {
    "use strict";
    init_clinicalCatalog();
    require2 = createRequire(import.meta.url);
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    _sqliteDb = null;
  }
});

// server/dbPatients.ts
import { and, eq, ilike, or, sql as sql2 } from "drizzle-orm";
async function getPatientById(id2) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id2);
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.id, id2)).limit(1);
  return result[0] ?? null;
}
async function getPatientByHrn(hrn) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE hrn = ?").get(hrn);
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.hrn, hrn)).limit(1);
  return result[0] ?? null;
}
async function getPatientByLinkedUserId(userId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE linkedUserId = ?").get(userId);
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.linkedUserId, userId)).limit(1);
  return result[0] ?? null;
}
async function getPatientByAccountEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE lower(accountEmail) = ?").get(cleanEmail);
    return row ?? null;
  }
  const result = await db.select().from(patients).where(sql2`lower(${patients.accountEmail}) = ${cleanEmail}`).limit(1);
  return result[0] ?? null;
}
async function autoLinkPatientByEmail(userId, email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const patient3 = sqlite.prepare("SELECT * FROM patients WHERE lower(accountEmail) = ? AND status = 'Active'").get(cleanEmail);
    if (!patient3) return null;
    sqlite.prepare("UPDATE patients SET linkedUserId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(userId, patient3.id);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(patient3.id);
  }
  const [match] = await db.select().from(patients).where(and(sql2`lower(${patients.accountEmail}) = ${cleanEmail}`, eq(patients.status, "Active"))).limit(1);
  if (!match) return null;
  const [updated] = await db.update(patients).set({ linkedUserId: userId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(patients.id, match.id)).returning();
  return updated ?? null;
}
async function listPatients(opts = {}) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    let query4 = "SELECT * FROM patients WHERE 1=1";
    const params = [];
    if (opts.type) {
      query4 += " AND patientType = ?";
      params.push(opts.type);
    }
    if (opts.stage) {
      query4 += " AND stage = ?";
      params.push(opts.stage);
    }
    if (opts.doctorId) {
      query4 += " AND (nephrologistId = ? OR fellowId = ?)";
      params.push(opts.doctorId, opts.doctorId);
    }
    if (opts.status) {
      query4 += " AND status = ?";
      params.push(opts.status);
    }
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      query4 += " AND (lower(firstName) LIKE ? OR lower(lastName) LIKE ? OR lower(hrn) LIKE ?)";
      params.push(term, term, term);
    }
    query4 += " ORDER BY lastName ASC, firstName ASC";
    return sqlite.prepare(query4).all(...params);
  }
  const conditions = [];
  if (opts.type) conditions.push(eq(patients.patientType, opts.type));
  if (opts.stage) conditions.push(eq(patients.stage, opts.stage));
  if (opts.doctorId) {
    conditions.push(or(eq(patients.nephrologistId, opts.doctorId), eq(patients.fellowId, opts.doctorId)));
  }
  if (opts.status) conditions.push(eq(patients.status, opts.status));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(ilike(patients.firstName, term), ilike(patients.lastName, term), ilike(patients.hrn, term))
    );
  }
  return db.select().from(patients).where(conditions.length > 0 ? and(...conditions) : void 0).orderBy(patients.lastName, patients.firstName);
}
async function createPatient(data) {
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
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(Number(info.lastInsertRowid));
  }
  const [row] = await db.insert(patients).values(data).returning();
  return row;
}
async function updatePatient(id2, data) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id2);
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = data[k];
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v ?? null;
    });
    sqlite.prepare(`UPDATE patients SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id2);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id2);
  }
  const [updated] = await db.update(patients).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(patients.id, id2)).returning();
  return updated ?? null;
}
async function updatePatientConsent(patientId, version) {
  return updatePatient(patientId, {
    consentVersion: version,
    consentAcceptedAt: /* @__PURE__ */ new Date()
  });
}
async function listDoctors(opts = {}) {
  const activeOnly = opts.activeOnly !== false;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    let query4 = "SELECT * FROM doctors WHERE 1=1";
    const params = [];
    if (activeOnly) query4 += " AND active = 1";
    if (opts.role) {
      query4 += " AND role = ?";
      params.push(opts.role);
    }
    query4 += " ORDER BY name ASC";
    return sqlite.prepare(query4).all(...params);
  }
  const conditions = [];
  if (activeOnly) conditions.push(eq(doctors.active, true));
  if (opts.role) conditions.push(eq(doctors.role, opts.role));
  return db.select().from(doctors).where(conditions.length > 0 ? and(...conditions) : void 0).orderBy(doctors.name);
}
async function getDoctorById(id2) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id2);
    return row ?? null;
  }
  const [doc] = await db.select().from(doctors).where(eq(doctors.id, id2)).limit(1);
  return doc ?? null;
}
async function createDoctor(data) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite.prepare("INSERT INTO doctors (name, role, active) VALUES (?, ?, ?)").run(data.name, data.role, data.active === false ? 0 : 1);
    return sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(Number(info.lastInsertRowid));
  }
  const [doc] = await db.insert(doctors).values(data).returning();
  return doc;
}
async function updateDoctor(id2, data) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id2);
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = data[k];
      return typeof v === "boolean" ? v ? 1 : 0 : v ?? null;
    });
    sqlite.prepare(`UPDATE doctors SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id2);
    return sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id2);
  }
  const [updated] = await db.update(doctors).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(doctors.id, id2)).returning();
  return updated ?? null;
}
var init_dbPatients = __esm({
  "server/dbPatients.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_localDb();
  }
});

// server/db.ts
import { and as and2, desc, eq as eq2, sql as sql3 } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
async function ensureSchema(client) {
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
    await client`ALTER TABLE "ktp"."serviceRecords" ADD COLUMN IF NOT EXISTS "phase" varchar(16)`;
    await client`
      INSERT INTO "ktp"."patients" (
        "hrn", "patientType", "firstName", "lastName", "accountEmail", "stage", "status", "surgeryDate", "consentVersion", "consentAcceptedAt"
      ) VALUES (
        'KTP-2026-0001', 'Recipient', 'Alai', 'Patient', 'alai12152201@gmail.com', 'PostKT', 'Active', '2026-01-15'::date, 1, now()
      ) ON CONFLICT ("hrn") DO UPDATE SET "accountEmail" = 'alai12152201@gmail.com', "status" = 'Active';
    `;
  } catch (error) {
    console.error("[Database] Auto-migration check failed:", error);
    _schemaEnsured = false;
  }
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, {
        max: 3,
        prepare: false,
        idle_timeout: 20,
        connect_timeout: 15,
        connection: {
          search_path: "ktp, public"
        }
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
function getBatchClient() {
  if (!_batchPg && process.env.DATABASE_URL) {
    _batchPg = postgres(process.env.DATABASE_URL, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
      connection: {
        search_path: "ktp, public"
      }
    });
  }
  return _batchPg;
}
async function upsertUser(user) {
  const db = await getDb();
  const effectiveRole = roleForEmail(user.email);
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare(
      `INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(openId) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           loginMethod = excluded.loginMethod,
           role = ?,
           lastSignedIn = CURRENT_TIMESTAMP,
           updatedAt = CURRENT_TIMESTAMP`
    ).run(user.openId, user.name, user.email, user.loginMethod, effectiveRole, effectiveRole);
    return;
  }
  await db.insert(users).values({ ...user, role: effectiveRole, lastSignedIn: /* @__PURE__ */ new Date() }).onConflictDoUpdate({
    target: users.openId,
    set: {
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: effectiveRole,
      lastSignedIn: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function touchUserSession(openId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing2 = sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId);
    if (!existing2) return null;
    const effectiveRole2 = roleForEmail(existing2.email);
    sqlite.prepare("UPDATE users SET lastSignedIn = CURRENT_TIMESTAMP, role = ?, updatedAt = CURRENT_TIMESTAMP WHERE openId = ?").run(effectiveRole2, openId);
    return sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId);
  }
  const existing = await db.select().from(users).where(eq2(users.openId, openId)).limit(1);
  if (existing.length === 0) return null;
  const effectiveRole = roleForEmail(existing[0].email);
  const [updated] = await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date(), role: effectiveRole, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.openId, openId)).returning();
  return updated ?? null;
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId);
    return row ?? null;
  }
  const result = await db.select().from(users).where(eq2(users.openId, openId)).limit(1);
  return result[0] ?? null;
}
async function getSetting(key) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = ?").get(key);
    return row?.value ?? null;
  }
  const [match] = await db.select({ value: appSettings.value }).from(appSettings).where(eq2(appSettings.key, key)).limit(1);
  return match?.value ?? null;
}
async function setSetting(key, value) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare(
      `INSERT INTO appSettings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`
    ).run(key, value);
    return;
  }
  await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({
    target: appSettings.key,
    set: { value, updatedAt: /* @__PURE__ */ new Date() }
  });
}
async function getAllSettings() {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const rows2 = sqlite.prepare("SELECT key, value FROM appSettings").all();
    return Object.fromEntries(rows2.map((r) => [r.key, r.value]));
  }
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function logActivity(actorUserId, patientId, action, details, ipAddress, userAgent) {
  const detailsStr = details ? typeof details === "string" ? details : JSON.stringify(details) : null;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("INSERT INTO activityLog (actorUserId, patientId, action, details, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?, ?)").run(actorUserId, patientId, action, detailsStr, ipAddress ?? null, userAgent ?? null);
    return;
  }
  await db.insert(activityLog).values({
    actorUserId,
    patientId,
    action,
    details: detailsStr,
    ipAddress,
    userAgent
  });
}
async function listActivityLogs(patientId, limit = 50) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    if (patientId) {
      return sqlite.prepare("SELECT * FROM activityLog WHERE patientId = ? ORDER BY id DESC LIMIT ?").all(patientId, limit);
    }
    return sqlite.prepare("SELECT * FROM activityLog ORDER BY id DESC LIMIT ?").all(limit);
  }
  if (patientId) {
    return db.select().from(activityLog).where(eq2(activityLog.patientId, patientId)).orderBy(desc(activityLog.id)).limit(limit);
  }
  return db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(limit);
}
async function listNotifications(patientId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    return sqlite.prepare("SELECT * FROM notifications WHERE patientId = ? ORDER BY id DESC").all(patientId);
  }
  return db.select().from(notifications).where(eq2(notifications.patientId, patientId)).orderBy(desc(notifications.id));
}
async function countUnreadNotifications(patientId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT count(*) as count FROM notifications WHERE patientId = ? AND read = 0").get(patientId);
    return row.count;
  }
  const result = await db.select({ count: sql3`count(*)` }).from(notifications).where(and2(eq2(notifications.patientId, patientId), eq2(notifications.read, false)));
  return Number(result[0]?.count ?? 0);
}
async function markNotificationRead(id2, patientId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND patientId = ?").run(id2, patientId);
    return;
  }
  await db.update(notifications).set({ read: true }).where(and2(eq2(notifications.id, id2), eq2(notifications.patientId, patientId)));
}
async function markAllNotificationsRead(patientId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE notifications SET read = 1 WHERE patientId = ?").run(patientId);
    return;
  }
  await db.update(notifications).set({ read: true }).where(eq2(notifications.patientId, patientId));
}
async function getStoredFileByStorageKey(storageKey) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM storedFiles WHERE storageKey = ?").get(storageKey);
    return row ?? null;
  }
  const [file] = await db.select().from(storedFiles).where(eq2(storedFiles.storageKey, storageKey)).limit(1);
  return file ?? null;
}
async function purgeOrphanStoredFiles(olderThanDays = 2) {
  const cutoff = new Date(Date.now() - olderThanDays * 864e5);
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const info = sqlite.prepare("DELETE FROM storedFiles WHERE createdAt < ?").run(cutoff.toISOString());
    return info.changes;
  }
  const deleted = await db.delete(storedFiles).where(sql3`${storedFiles.createdAt} < ${cutoff}`).returning();
  return deleted.length;
}
async function acquireReminderLock() {
  if (_reminderLockHeld) return false;
  _reminderLockHeld = true;
  return true;
}
async function releaseReminderLock() {
  _reminderLockHeld = false;
}
var _db, _batchPg, _schemaEnsured, _reminderLockHeld;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_adminAccess();
    init_baselineSql();
    init_localDb();
    init_dbPatients();
    _db = null;
    _batchPg = null;
    _schemaEnsured = false;
    _reminderLockHeld = false;
  }
});

// shared/ktp.ts
function todayDate(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function isValidStageForPatientType(stage, patientType) {
  if (patientType === "Recipient") {
    return RECIPIENT_STAGES.includes(stage);
  }
  if (patientType === "Donor") {
    return DONOR_STAGES.includes(stage);
  }
  return false;
}
var RECIPIENT_STAGES, DONOR_STAGES, PATIENT_TYPES, PATIENT_STATUSES, DOCTOR_ROLES, LAB_PHASES, LAB_PHASE_LABEL, RISK_CATEGORIES;
var init_ktp = __esm({
  "shared/ktp.ts"() {
    "use strict";
    RECIPIENT_STAGES = [
      "Orientation",
      "Phase1",
      "Phase2",
      "Clearances",
      "PhilHealthZ",
      "Phase3",
      "PostKT"
    ];
    DONOR_STAGES = [
      "Orientation",
      "Phase1",
      "Phase2",
      "Clearances",
      "Phase3",
      "PostDonation"
    ];
    PATIENT_TYPES = ["Recipient", "Donor"];
    PATIENT_STATUSES = ["Active", "Inactive", "Deceased", "Transferred"];
    DOCTOR_ROLES = ["Nephrologist", "Fellow"];
    LAB_PHASES = ["Phase1", "Phase2", "Phase3", "PostKT", "PostDonation"];
    LAB_PHASE_LABEL = {
      Phase1: "Phase 1",
      Phase2: "Phase 2",
      Phase3: "Phase 3",
      PostKT: "Post-KT",
      PostDonation: "Post-donation"
    };
    RISK_CATEGORIES = ["StandardLow", "High"];
  }
});

// server/labOcrBridge.ts
var labOcrBridge_exports = {};
__export(labOcrBridge_exports, {
  parseLabBuffer: () => parseLabBuffer,
  parseLabFile: () => parseLabFile
});
import { execFile } from "child_process";
import fs2 from "fs";
import os from "os";
import path2 from "path";
import { promisify } from "util";
async function parseLabFile(filePath) {
  try {
    const pythonExe = process.platform === "win32" ? "python" : "python3";
    const { stdout, stderr } = await execFileAsync(pythonExe, [PARSER_SCRIPT, filePath], {
      timeout: 3e4,
      maxBuffer: 10 * 1024 * 1024
    });
    if (stderr && stderr.includes("Traceback")) {
      console.error("[Lab OCR Python Error]", stderr);
    }
    const parsed = JSON.parse(stdout);
    return parsed;
  } catch (err) {
    console.error("[Lab OCR Execution Failed]", err);
    return {
      success: false,
      detectedDate: null,
      tests: [],
      extractedCount: 0,
      error: err.message || "Failed to execute Python OCR engine"
    };
  }
}
async function parseLabBuffer(buffer, fileName) {
  const ext = path2.extname(fileName) || ".pdf";
  const tempPath = path2.join(os.tmpdir(), `ktp-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  try {
    await fs2.promises.writeFile(tempPath, buffer);
    return await parseLabFile(tempPath);
  } finally {
    try {
      if (fs2.existsSync(tempPath)) {
        await fs2.promises.unlink(tempPath);
      }
    } catch {
    }
  }
}
var execFileAsync, PARSER_SCRIPT;
var init_labOcrBridge = __esm({
  "server/labOcrBridge.ts"() {
    "use strict";
    execFileAsync = promisify(execFile);
    PARSER_SCRIPT = path2.resolve(process.cwd(), "scripts", "parse_lab_ocr.py");
  }
});

// server/reminders.ts
async function runDailyReminders(dateKey = todayDate()) {
  return {
    created: 0,
    skippedExisting: 0,
    expiredCredentials: 0,
    archivedSkipped: 0
  };
}
var init_reminders = __esm({
  "server/reminders.ts"() {
    "use strict";
    init_ktp();
  }
});

// server/scheduled.ts
var scheduled_exports = {};
__export(scheduled_exports, {
  getManilaDateKey: () => getManilaDateKey,
  runDailyReminderJob: () => runDailyReminderJob
});
function getManilaDateKey() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
  return formatter.format(/* @__PURE__ */ new Date());
}
async function runDailyReminderJob(dateKey = getManilaDateKey()) {
  const acquired = await acquireReminderLock();
  if (!acquired) {
    return {
      ok: false,
      dateKey,
      locked: true,
      message: "Reminder job is already running or locked",
      notifications: { created: 0, skippedExisting: 0, expiredCredentials: 0, archivedSkipped: 0 }
    };
  }
  try {
    const notifications2 = await runDailyReminders(dateKey);
    const purgedOrphanFiles = await purgeOrphanStoredFiles(2);
    return {
      ok: true,
      dateKey,
      notifications: notifications2,
      purgedOrphanFiles
    };
  } finally {
    await releaseReminderLock();
  }
}
var init_scheduled = __esm({
  "server/scheduled.ts"() {
    "use strict";
    init_reminders();
    init_db();
  }
});

// server/vercel.ts
import "dotenv/config";
import crypto2 from "crypto";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var OAUTH_STATE_COOKIE_PLAIN = "oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
init_db();
init_adminAccess();
import { parse as parseCookieHeader2 } from "cookie";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/_core/env.ts
var ENV = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerEmail: process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL ?? "",
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  localDevAuth: process.env.LOCAL_DEV_AUTH === "1",
  isProduction: process.env.NODE_ENV === "production",
  s3BucketName: process.env.S3_BUCKET_NAME ?? "",
  s3Region: process.env.AWS_REGION ?? process.env.S3_REGION ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free"
};

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
var OAuthService = class {
  constructor(client) {
    this.client = client;
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      console.error(
        "[OAuth] ERROR: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured!"
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const { data } = await this.client.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        code,
        redirect_uri: this.decodeState(state),
        grant_type: "authorization_code"
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      scope: data.scope,
      idToken: data.id_token
    };
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.get(
      GOOGLE_USERINFO_URL,
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    );
    if (data.email_verified !== true) {
      throw ForbiddenError("Google email is not verified");
    }
    return {
      openId: data.sub,
      name: data.name || data.email || data.sub,
      email: data.email ?? null,
      loginMethod: "google"
    };
  }
};
var createOAuthHttpClient = () => axios.create({
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    return this.oauthService.getUserInfoByToken({
      accessToken
    });
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    if (ENV.isProduction && !ENV.cookieSecret) {
      throw new Error("FATAL: JWT_SECRET environment variable is missing in production!");
    }
    const secret = ENV.cookieSecret || "skti-default-jwt-secret-key-32-chars-min!";
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.googleClientId || "skti-app",
        name: options.name || "User"
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId || "skti-app",
      name: payload.name || "User"
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing valid openId");
        return null;
      }
      return {
        openId,
        appId: typeof appId === "string" ? appId : "skti-app",
        name: typeof name === "string" ? name : "User"
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const user = await touchUserSession(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const cookies = parseCookieHeader2(req.headers.cookie ?? "");
    const expectedNonce = cookies[OAUTH_STATE_COOKIE] ?? cookies[OAUTH_STATE_COOKIE_PLAIN];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    res.clearCookie(OAUTH_STATE_COOKIE_PLAIN, { path: "/" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId(userInfo.openId);
      const email = userInfo.email ?? "";
      const isAdmin = hasFullAccess(email);
      let linkedPatient = null;
      if (user) {
        linkedPatient = await autoLinkPatientByEmail(user.id, email);
      }
      if (!isAdmin && !linkedPatient) {
        res.redirect(302, "/not-enrolled");
        return;
      }
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, isAdmin ? "/dashboard" : "/me");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/storage.ts
init_db();
var _client = null;
async function getClient() {
  if (!ENV.s3BucketName) {
    return null;
  }
  if (!_client) {
    const { S3Client: Client } = await import("@aws-sdk/client-s3");
    _client = new Client(ENV.s3Region ? { region: ENV.s3Region } : {});
  }
  return _client;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
async function storageGetSignedUrl(relKey) {
  const key = normalizeKey(relKey);
  if (!ENV.s3BucketName) {
    return `/storage/${key}`;
  }
  const client = await getClient();
  if (!client) {
    return `/storage/${key}`;
  }
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner")
  ]);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.s3BucketName, Key: key }), { expiresIn: 300 });
}

// server/_core/storageProxy.ts
init_db();
function registerStorageProxy(app) {
  app.get("/storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    try {
      if (ENV.s3BucketName) {
        const url = await storageGetSignedUrl(key);
        if (url !== `/storage/${key}`) {
          res.set("Cache-Control", "no-store");
          return res.redirect(307, url);
        }
      }
      const stored = await getStoredFileByStorageKey(key);
      if (stored) {
        res.setHeader("Content-Type", stored.fileType || "application/octet-stream");
        res.setHeader("Content-Length", stored.fileSize);
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.status(200).send();
      }
      res.status(404).send("File not found");
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers/clinical.ts
import { z } from "zod";

// server/_core/trpc.ts
init_adminAccess();
init_db();
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var SLOW_PROCEDURE_MS = 1e3;
var timing = t.middleware(async ({ path: path3, type, next }) => {
  const started = Date.now();
  const result = await next();
  const ms = Date.now() - started;
  if (ms > SLOW_PROCEDURE_MS) {
    console.warn(`[tRPC] slow ${type} ${path3} ${ms}ms ok=${result.ok}`);
  }
  return result;
});
var baseProcedure = t.procedure.use(timing);
var publicProcedure = baseProcedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = baseProcedure.use(requireUser);
var adminProcedure = baseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !hasFullAccess(ctx.user.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var patientBaseProcedure = baseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    let patient3 = await getPatientByLinkedUserId(ctx.user.id);
    if (!patient3 && ctx.user.email) {
      patient3 = await autoLinkPatientByEmail(ctx.user.id, ctx.user.email);
    }
    if (!patient3) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
    const patientEmail = (patient3.accountEmail ?? "").trim().toLowerCase();
    if (!userEmail || !patientEmail || userEmail !== patientEmail || patient3.status !== "Active") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        patientId: patient3.id,
        patient: patient3
      }
    });
  })
);
var patientProcedure = patientBaseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const patient3 = ctx.patient;
    const currentConsentVersion = await getSetting("consentVersion");
    const requiredVersion = currentConsentVersion ? parseInt(currentConsentVersion, 10) : 1;
    const acceptedVersion = patient3.consentVersion ?? 0;
    if (acceptedVersion < requiredVersion) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CONSENT_REQUIRED"
      });
    }
    return next({
      ctx: {
        ...ctx,
        patientId: patient3.id,
        patient: patient3
      }
    });
  })
);

// server/dbClinical.ts
init_clinicalCatalog();
init_db();
init_localDb();
init_ktp();
import { TRPCError as TRPCError2 } from "@trpc/server";
var query2 = (sql4, ...args) => ({ sql: sql4, args });
var fail = (message, code = "BAD_REQUEST") => {
  throw new TRPCError2({ code, message });
};
async function execute(make) {
  if (!process.env.DATABASE_URL) {
    const db = getSqliteDb();
    return db.transaction(() => {
      const program = make();
      let step = program.next();
      while (!step.done) {
        const statement = db.prepare(step.value.sql);
        const rows = statement.reader ? statement.all(...step.value.args) : (statement.run(...step.value.args), []);
        step = program.next(rows);
      }
      return step.value;
    }).immediate();
  }
  if (!await getDb()) throw new Error("Database unavailable");
  const client = getBatchClient();
  await ensureCatalog();
  return await client.begin(async (transaction) => {
    const program = make();
    let step = program.next();
    while (!step.done) {
      let parameter = 0;
      const sql4 = step.value.sql.replace(/\?/g, () => `$${++parameter}`);
      const rows = await transaction.unsafe(sql4, step.value.args);
      step = program.next([...rows]);
    }
    return step.value;
  });
}
function* patient(patientId) {
  const rows = yield query2('SELECT * FROM "patients" WHERE id = ?', patientId);
  return rows[0] ?? fail("Patient not found", "NOT_FOUND");
}
function* audit(actor, patientId, action, id2, extra) {
  yield query2(
    'INSERT INTO "activityLog" ("actorUserId", "patientId", action, details) VALUES (?, ?, ?, ?)',
    actor,
    patientId,
    action,
    JSON.stringify({ id: id2, ...extra })
  );
}
function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : null;
}
function service(row) {
  return {
    ...row,
    dueDate: dateOnly(row.dueDate),
    serviceDate: dateOnly(row.serviceDate),
    claimDeadline: dateOnly(row.claimDeadline),
    claimFiledDate: dateOnly(row.claimFiledDate)
  };
}
function appointment(row) {
  const iso = (value) => value instanceof Date ? value.toISOString() : new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(" ", "T")}Z`).toISOString();
  return { ...row, startsAt: iso(row.startsAt), cancelledAt: row.cancelledAt ? iso(row.cancelledAt) : null };
}
async function getClinical(patientId) {
  return execute(function* () {
    const profile = yield* patient(patientId);
    const services = yield query2('SELECT * FROM "serviceRecords" WHERE "patientId" = ? ORDER BY "dueDate" DESC, id DESC', patientId);
    const tests = yield query2('SELECT * FROM "labTests" WHERE active = true ORDER BY "sortOrder", name');
    const labs = yield query2(`SELECT r.*, t.name AS "testName", t.unit, s."serviceDate", s.phase
      FROM "labResults" r JOIN "labTests" t ON t.id = r."labTestId"
      JOIN "serviceRecords" s ON s.id = r."serviceRecordId"
      WHERE s."patientId" = ? AND s.status = 'Done' ORDER BY s."serviceDate" DESC, r.id DESC`, patientId);
    const checklist = yield query2(`SELECT c.*, c.id AS "catalogId", COALESCE(p.status, 'Pending') AS status, p."doneDate", p.note
      FROM "checklistCatalog" c LEFT JOIN "patientChecklist" p ON p."catalogId" = c.id AND p."patientId" = ?
      WHERE c.active = true AND (c."appliesTo" = 'Both' OR c."appliesTo" = ?) ORDER BY c.phase, c."sortOrder", c.id`, patientId, profile.patientType);
    const visits = yield query2('SELECT *, CAST("startsAt" AS TEXT) AS "startsAt", CAST("cancelledAt" AS TEXT) AS "cancelledAt" FROM appointments WHERE "patientId" = ? ORDER BY appointments."startsAt" DESC, id DESC', patientId);
    return {
      services: services.map(service),
      labTests: tests,
      labResults: labs.map((row) => ({ ...row, serviceDate: dateOnly(row.serviceDate) })),
      checklist: checklist.map((row) => ({ ...row, asIndicated: Boolean(row.asIndicated), doneDate: dateOnly(row.doneDate) })),
      appointments: visits.map(appointment)
    };
  });
}
async function listClinicalDashboard() {
  return execute(function* () {
    const services = yield query2('SELECT s.* FROM "serviceRecords" s JOIN patients p ON p.id = s."patientId" WHERE p.status = ?', "Active");
    const visits = yield query2('SELECT a.*, CAST(a."startsAt" AS TEXT) AS "startsAt", CAST(a."cancelledAt" AS TEXT) AS "cancelledAt" FROM appointments a JOIN patients p ON p.id = a."patientId" WHERE p.status = ?', "Active");
    return { services: services.map(service), appointments: visits.map(appointment) };
  });
}
async function addService(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query2(
      'INSERT INTO "serviceRecords" ("patientId", "serviceType", label, "dueDate", note) VALUES (?, ?, ?, ?, ?) RETURNING id',
      input.patientId,
      input.serviceType,
      input.label,
      input.dueDate,
      input.note ?? null
    );
    yield* audit(actor, input.patientId, "clinical.service.add", row.id);
    return { id: row.id };
  });
}
function labFlag(value, lowRaw, highRaw) {
  const numeric2 = Number(value);
  const bound = (raw) => raw == null || String(raw).trim() === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
  const low = bound(lowRaw), high = bound(highRaw);
  return !Number.isFinite(numeric2) || low === null && high === null ? null : low !== null && numeric2 < low ? "Low" : high !== null && numeric2 > high ? "High" : "Normal";
}
async function recordResult(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query2('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.serviceRecordId, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (current.status !== "Planned") fail("Only planned services can receive results", "CONFLICT");
    if (input.results?.length && !["Laboratory", "Tacro"].includes(current.serviceType)) fail("Lab values require a laboratory or tacrolimus service");
    const approvalTag = input.nurseApproved ? input.approvedByNurse ? `[Approved by Nurse: ${input.approvedByNurse}]` : "[Approved by Nurse]" : null;
    const finalNote = [input.note, approvalTag].filter(Boolean).join(" ") || null;
    const changed = yield query2(
      `UPDATE "serviceRecords" SET status = 'Done', "serviceDate" = ?, "claimDeadline" = ?, note = COALESCE(?, note), "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ? AND "patientId" = ? AND status = 'Planned' RETURNING id`,
      input.serviceDate,
      input.claimDeadline ?? null,
      finalNote,
      input.serviceRecordId,
      input.patientId
    );
    if (!changed.length) fail("Service already changed; refresh and retry", "CONFLICT");
    for (const value of input.results ?? []) {
      const [test] = yield query2('SELECT * FROM "labTests" WHERE id = ? AND active = true', value.labTestId);
      if (!test) fail("Lab test not found", "NOT_FOUND");
      const flag2 = labFlag(value.value, test.low, test.high);
      yield query2(
        'INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?)',
        input.serviceRecordId,
        value.labTestId,
        value.value,
        test.low,
        test.high,
        flag2
      );
    }
    yield* audit(actor, input.patientId, "clinical.result.record", input.serviceRecordId, {
      nurseApproved: input.nurseApproved ?? false,
      approvedByNurse: input.approvedByNurse ?? null
    });
    return { id: input.serviceRecordId };
  });
}
async function addLabResults(input, actor) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    if (!isValidStageForPatientType(input.phase, profile.patientType)) fail("Phase does not apply to this patient type");
    let [record] = yield query2(
      `SELECT id, note FROM "serviceRecords" WHERE "patientId" = ? AND phase = ? AND "serviceDate" = ? AND "serviceType" = 'Laboratory' AND status = 'Done' ORDER BY id LIMIT 1`,
      input.patientId,
      input.phase,
      input.serviceDate
    );
    if (!record) [record] = yield query2(
      `INSERT INTO "serviceRecords" ("patientId", "serviceType", label, status, "dueDate", "serviceDate", phase) VALUES (?, 'Laboratory', ?, 'Done', ?, ?, ?) RETURNING id, note`,
      input.patientId,
      `${LAB_PHASE_LABEL[input.phase]} labs`,
      input.serviceDate,
      input.serviceDate,
      input.phase
    );
    const approvalTag = input.nurseApproved ? input.approvedByNurse ? `[Approved by Nurse: ${input.approvedByNurse}]` : "[Approved by Nurse]" : null;
    if (approvalTag && !String(record.note ?? "").includes(approvalTag)) {
      yield query2('UPDATE "serviceRecords" SET note = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?', [record.note, approvalTag].filter(Boolean).join(" "), record.id);
    }
    const phaseNumber = /^Phase(\d)$/.exec(input.phase)?.[1];
    const ids = [];
    for (const result of input.results) {
      const [test] = yield query2('SELECT * FROM "labTests" WHERE id = ? AND active = true', result.labTestId);
      if (!test) fail("Lab test not found", "NOT_FOUND");
      const saved = yield query2('SELECT id FROM "labResults" WHERE "serviceRecordId" = ? AND "labTestId" = ?', record.id, result.labTestId);
      if (saved.length) fail(`${test.name} already has a result for that phase and date. Remove it first, or correct it in Edit patient.`, "CONFLICT");
      const [row] = yield query2(
        'INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        record.id,
        result.labTestId,
        result.value,
        test.low,
        test.high,
        labFlag(result.value, test.low, test.high)
      );
      const [item] = phaseNumber ? yield query2(
        `SELECT id FROM "checklistCatalog" WHERE name = ? AND phase = ? AND active = true AND ("appliesTo" = 'Both' OR "appliesTo" = ?)`,
        test.name,
        Number(phaseNumber),
        profile.patientType
      ) : [];
      if (item) yield query2(`INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate") VALUES (?, ?, 'Done', ?)
        ON CONFLICT ("patientId", "catalogId") DO UPDATE SET status = 'Done', "doneDate" = excluded."doneDate", "updatedAt" = CURRENT_TIMESTAMP
        WHERE "patientChecklist".status <> 'Done'`, input.patientId, item.id, input.serviceDate);
      yield* audit(actor, input.patientId, "clinical.lab.add", row.id, {
        serviceRecordId: record.id,
        phase: input.phase,
        nurseApproved: input.nurseApproved ?? false,
        approvedByNurse: input.approvedByNurse ?? null
      });
      ids.push(row.id);
    }
    return { ids, serviceRecordId: record.id };
  });
}
async function addLabResult({ labTestId, value, ...input }, actor) {
  const saved = await addLabResults({ ...input, results: [{ labTestId, value }] }, actor);
  return { id: saved.ids[0], serviceRecordId: saved.serviceRecordId };
}
async function updateService(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query2('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.id, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (current.status === "Superseded") fail("Superseded services cannot be edited", "CONFLICT");
    if (current.status === "Planned" && (input.serviceDate || input.claimFiledDate || input.results?.length)) fail("Record a result before editing result details");
    if (input.results?.length && !["Laboratory", "Tacro"].includes(current.serviceType)) fail("Lab values require a laboratory or tacrolimus service");
    const keep = (next, saved) => next === void 0 ? saved : next;
    const before = {
      label: current.label,
      dueDate: dateOnly(current.dueDate),
      serviceDate: dateOnly(current.serviceDate),
      claimDeadline: dateOnly(current.claimDeadline),
      claimFiledDate: dateOnly(current.claimFiledDate),
      note: current.note ?? null
    };
    const after = {
      label: keep(input.label, before.label),
      dueDate: keep(input.dueDate, before.dueDate),
      serviceDate: keep(input.serviceDate, before.serviceDate),
      claimDeadline: keep(input.claimDeadline, before.claimDeadline),
      claimFiledDate: keep(input.claimFiledDate, before.claimFiledDate),
      note: input.note === void 0 ? before.note : input.note || null
    };
    if (after.serviceDate && after.claimDeadline && after.claimDeadline < after.serviceDate) fail("Claim deadline cannot precede service date");
    if (after.serviceDate && after.claimFiledDate && after.claimFiledDate < after.serviceDate) fail("Claim filing cannot precede service date");
    const labs = 'SELECT * FROM "labResults" WHERE "serviceRecordId" = ? ORDER BY "labTestId", id';
    const values = (rows) => rows.map((row) => ({ labTestId: Number(row.labTestId), value: String(row.value) }));
    const labsBefore = yield query2(labs, input.id);
    yield query2(
      `UPDATE "serviceRecords" SET label = ?, "dueDate" = ?, "serviceDate" = ?, "claimDeadline" = ?, "claimFiledDate" = ?, note = ?, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ? AND "patientId" = ?`,
      after.label,
      after.dueDate,
      after.serviceDate,
      after.claimDeadline,
      after.claimFiledDate,
      after.note,
      input.id,
      input.patientId
    );
    for (const value of input.results ?? []) {
      const saved = labsBefore.find((row) => Number(row.labTestId) === value.labTestId);
      if (value.value === "") {
        if (saved) yield query2('DELETE FROM "labResults" WHERE "serviceRecordId" = ? AND "labTestId" = ?', input.id, value.labTestId);
      } else if (saved) {
        yield query2(
          'UPDATE "labResults" SET value = ?, flag = ? WHERE "serviceRecordId" = ? AND "labTestId" = ?',
          value.value,
          labFlag(value.value, saved.lowSnapshot, saved.highSnapshot),
          input.id,
          value.labTestId
        );
      } else {
        const [test] = yield query2('SELECT * FROM "labTests" WHERE id = ? AND active = true', value.labTestId);
        if (!test) fail("Lab test not found", "NOT_FOUND");
        yield query2(
          'INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag) VALUES (?, ?, ?, ?, ?, ?)',
          input.id,
          value.labTestId,
          value.value,
          test.low,
          test.high,
          labFlag(value.value, test.low, test.high)
        );
      }
    }
    const labsAfter = yield query2(labs, input.id);
    const snapshot = { before: JSON.stringify({ ...before, labs: values(labsBefore) }), after: JSON.stringify({ ...after, labs: values(labsAfter) }) };
    if (snapshot.before === snapshot.after) fail("No change to save");
    yield query2(
      'INSERT INTO "recordRevisions" ("entityType", "entityId", "before", "after", reason, "userId") VALUES (?, ?, ?, ?, ?, ?)',
      "serviceRecord",
      input.id,
      snapshot.before,
      snapshot.after,
      input.reason,
      actor
    );
    yield* audit(actor, input.patientId, "clinical.service.update", input.id, { reason: input.reason });
    return { id: input.id };
  });
}
function* checklistWrite(profile, input, actor) {
  const [catalog] = yield query2('SELECT * FROM "checklistCatalog" WHERE id = ? AND active = true', input.catalogId);
  if (!catalog || !["Both", profile.patientType].includes(catalog.appliesTo)) fail("Checklist item not found for this patient", "NOT_FOUND");
  const [row] = yield query2(
    `INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate", note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT ("patientId", "catalogId") DO UPDATE SET status = excluded.status, "doneDate" = excluded."doneDate", note = excluded.note, "updatedAt" = CURRENT_TIMESTAMP RETURNING id`,
    input.patientId,
    input.catalogId,
    input.status,
    input.status === "Done" ? input.doneDate : null,
    input.note ?? null
  );
  yield* audit(actor, input.patientId, "clinical.checklist.update", row.id);
  return row.id;
}
async function setChecklist(input, actor) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    return { id: yield* checklistWrite(profile, input, actor) };
  });
}
async function setChecklistMany(input, actor) {
  return execute(function* () {
    const profile = yield* patient(input.patientId);
    for (const item of input.items) yield* checklistWrite(profile, { ...item, patientId: input.patientId }, actor);
    return { count: input.items.length };
  });
}
async function addAppointment(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query2(
      'INSERT INTO appointments ("patientId", title, kind, "startsAt", location, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      input.patientId,
      input.title,
      input.kind,
      new Date(input.startsAt).toISOString(),
      input.location ?? null,
      input.note ?? null
    );
    yield* audit(actor, input.patientId, "clinical.appointment.add", row.id);
    return { id: row.id };
  });
}
async function cancelAppointment(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query2('UPDATE appointments SET "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "cancelledAt" IS NULL RETURNING id, title', input.id, input.patientId);
    if (!row) fail("Appointment missing or already cancelled", "CONFLICT");
    yield* audit(actor, input.patientId, "clinical.appointment.cancel", row.id);
    return { id: input.id };
  });
}
async function fileClaim(input, actor) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [current] = yield query2('SELECT * FROM "serviceRecords" WHERE id = ? AND "patientId" = ?', input.id, input.patientId);
    if (!current) fail("Service not found", "NOT_FOUND");
    if (!current.serviceDate || current.status === "Planned") fail("Record a result before filing a claim");
    if (input.claimFiledDate < dateOnly(current.serviceDate)) fail("Claim filing cannot precede service date");
    const changed = yield query2('UPDATE "serviceRecords" SET "claimFiledDate" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "claimFiledDate" IS NULL RETURNING id', input.claimFiledDate, input.id, input.patientId);
    if (!changed.length) fail("Claim already filed", "CONFLICT");
    yield* audit(actor, input.patientId, "clinical.claim.file", input.id);
    return { id: input.id };
  });
}
async function respondToAppointment(input) {
  return execute(function* () {
    yield* patient(input.patientId);
    const [row] = yield query2(
      'UPDATE appointments SET response = ?, "responseNote" = ?, "respondedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ? AND "cancelledAt" IS NULL RETURNING id, title',
      input.response,
      input.responseNote ?? null,
      input.id,
      input.patientId
    );
    if (!row) fail("Appointment missing or cancelled", "CONFLICT");
    yield* audit(input.patientId, input.patientId, `clinical.appointment.respond.${input.response}`, row.id);
    return { id: input.id, response: input.response };
  });
}
async function listAllAppointments() {
  return execute(function* () {
    const rows = yield query2(`
      SELECT a.*,
        CAST(a."startsAt" AS TEXT) AS "startsAt",
        CAST(a."cancelledAt" AS TEXT) AS "cancelledAt",
        CAST(a."respondedAt" AS TEXT) AS "respondedAt",
        p.hrn, p."firstName", p."lastName", p."patientType", p.stage, p."contactNumber"
      FROM appointments a
      JOIN patients p ON p.id = a."patientId"
      WHERE p.status = 'Active'
      ORDER BY a."startsAt" ASC, a.id DESC
    `);
    return rows.map((r) => ({
      ...appointment(r),
      patientName: `${r.lastName}, ${r.firstName}`,
      hrn: String(r.hrn),
      patientType: String(r.patientType),
      stage: String(r.stage),
      contactNumber: r.contactNumber ? String(r.contactNumber) : null
    }));
  });
}
var catalogReady;
function ensureCatalog() {
  return catalogReady ??= getBatchClient().begin(async (tx) => {
    await tx.unsafe('LOCK TABLE "labTests", "checklistCatalog" IN SHARE ROW EXCLUSIVE MODE');
    const sync = syncCatalog();
    let step = sync.next();
    while (!step.done) {
      let parameter = 0;
      const rows = await tx.unsafe(step.value.sql.replace(/\?/g, () => `$${++parameter}`), step.value.args);
      step = sync.next([...rows]);
    }
  }).then(() => void 0).catch((error) => {
    catalogReady = void 0;
    throw error;
  });
}

// server/routers/clinical.ts
init_labOcrBridge();
init_ktp();
var id = z.number().int().positive().safe();
var patient2 = z.object({ patientId: id });
var date2 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= "1900-01-01";
}, "Use a valid calendar date");
var pastDate = date2.refine((value) => value <= todayDate(), "Date cannot be in the future");
var note = z.string().trim().max(4e3).optional();
var checklistItem = z.object({ catalogId: id, status: z.enum(["Pending", "Done", "NA"]), doneDate: pastDate.optional(), note });
var checklistDone = (input) => input.status !== "Done" || !!input.doneDate;
var clinicalRouter = router({
  get: adminProcedure.input(patient2).query(({ input }) => getClinical(input.patientId)),
  listAppointments: adminProcedure.query(() => listAllAppointments()),
  addService: adminProcedure.input(patient2.extend({
    serviceType: z.enum(["Meds", "Laboratory", "Tacro", "XrayUsd"]),
    label: z.string().trim().min(1).max(200),
    dueDate: date2,
    note
  })).mutation(({ input, ctx }) => addService(input, ctx.user.id)),
  recordResult: adminProcedure.input(patient2.extend({
    serviceRecordId: id,
    serviceDate: pastDate,
    claimDeadline: date2.optional(),
    note,
    nurseApproved: z.boolean().optional(),
    approvedByNurse: z.string().trim().max(200).optional(),
    results: z.array(z.object({ labTestId: id, value: z.string().trim().min(1).max(100) })).max(100).optional()
  }).refine((input) => !input.claimDeadline || input.claimDeadline >= input.serviceDate, "Claim deadline cannot precede service date").refine((input) => new Set(input.results?.map((row) => row.labTestId)).size === (input.results?.length ?? 0), "Each lab test may occur once")).mutation(({ input, ctx }) => recordResult(input, ctx.user.id)),
  addLabResult: adminProcedure.input(patient2.extend({
    phase: z.enum(LAB_PHASES),
    serviceDate: pastDate,
    labTestId: id,
    value: z.string().trim().min(1).max(100)
  })).mutation(({ input, ctx }) => addLabResult(input, ctx.user.id)),
  addLabResults: adminProcedure.input(patient2.extend({
    phase: z.enum(LAB_PHASES),
    serviceDate: pastDate,
    nurseApproved: z.boolean().optional(),
    approvedByNurse: z.string().trim().max(200).optional(),
    results: z.array(z.object({ labTestId: id, value: z.string().trim().min(1).max(100) })).min(1).max(100)
  }).refine((input) => new Set(input.results.map((row) => row.labTestId)).size === input.results.length, "Each lab test may occur once")).mutation(({ input, ctx }) => addLabResults(input, ctx.user.id)),
  updateService: adminProcedure.input(patient2.extend({
    id,
    reason: z.string().trim().min(1).max(500).default("Correction"),
    label: z.string().trim().min(1).max(200).optional(),
    dueDate: date2.optional(),
    serviceDate: pastDate.optional(),
    claimDeadline: date2.nullable().optional(),
    claimFiledDate: pastDate.nullable().optional(),
    note: z.string().trim().max(4e3).nullable().optional(),
    results: z.array(z.object({ labTestId: id, value: z.string().trim().max(100) })).max(100).optional()
  }).refine((input) => new Set(input.results?.map((row) => row.labTestId)).size === (input.results?.length ?? 0), "Each lab test may occur once")).mutation(({ input, ctx }) => updateService(input, ctx.user.id)),
  setChecklist: adminProcedure.input(patient2.extend(checklistItem.shape).refine(checklistDone, "Completion date is required")).mutation(({ input, ctx }) => setChecklist(input, ctx.user.id)),
  setChecklistMany: adminProcedure.input(patient2.extend({
    items: z.array(checklistItem.refine(checklistDone, "Completion date is required")).min(1).max(100)
  }).refine((input) => new Set(input.items.map((item) => item.catalogId)).size === input.items.length, "Each checklist item may occur once")).mutation(({ input, ctx }) => setChecklistMany(input, ctx.user.id)),
  addAppointment: adminProcedure.input(patient2.extend({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(["FollowUp", "Biopsy", "Workup", "Clearance", "Other"]),
    startsAt: z.string().datetime({ offset: true }).refine((value) => Number.isFinite(new Date(value).getTime()), "Invalid appointment time"),
    location: z.string().trim().max(300).optional(),
    note
  })).mutation(({ input, ctx }) => addAppointment(input, ctx.user.id)),
  cancelAppointment: adminProcedure.input(patient2.extend({ id })).mutation(({ input, ctx }) => cancelAppointment(input, ctx.user.id)),
  fileClaim: adminProcedure.input(patient2.extend({ id, claimFiledDate: pastDate })).mutation(({ input, ctx }) => fileClaim(input, ctx.user.id)),
  parseLabDocument: adminProcedure.input(
    z.object({
      base64: z.string().min(10),
      fileName: z.string().max(255).default("document.pdf")
    })
  ).mutation(async ({ input }) => {
    const cleanBase64 = input.base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    return parseLabBuffer(buffer, input.fileName);
  })
});

// server/_core/systemRouter.ts
import { z as z2 } from "zod";
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers/patients.ts
init_db();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z3 } from "zod";
init_adminAccess();
init_ktp();
var patientInputSchema = z3.object({
  hrn: z3.string().min(1, "HRN is required").max(64),
  patientType: z3.enum(PATIENT_TYPES),
  firstName: z3.string().min(1, "First name is required").max(128),
  middleName: z3.string().max(128).nullable().optional(),
  lastName: z3.string().min(1, "Last name is required").max(128),
  suffix: z3.string().max(32).nullable().optional(),
  sex: z3.enum(["M", "F"]).nullable().optional(),
  birthDate: z3.string().nullable().optional(),
  contactNumber: z3.string().max(32).nullable().optional(),
  accountEmail: z3.string().email("Valid Gmail account is required").max(320),
  nephrologistId: z3.number().nullable().optional(),
  fellowId: z3.number().nullable().optional(),
  stage: z3.string().min(1, "Stage is required"),
  riskCategory: z3.enum(RISK_CATEGORIES).nullable().optional(),
  surgeryDate: z3.string().nullable().optional(),
  linkedRecipientId: z3.number().nullable().optional(),
  followupMonths: z3.number().int().min(1).max(3).default(1),
  status: z3.enum(PATIENT_STATUSES).default("Active"),
  photoFileId: z3.number().nullable().optional()
});
function validatePatientBusinessRules(data, patientId) {
  if (hasFullAccess(data.accountEmail)) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "Patient Gmail cannot be on the admin email allowlist"
    });
  }
  if (!isValidStageForPatientType(data.stage, data.patientType)) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: `Stage '${data.stage}' is not valid for patient type '${data.patientType}'`
    });
  }
  if ((data.stage === "PostKT" || data.stage === "PostDonation") && !data.surgeryDate) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: `Surgery date is required when stage is '${data.stage}'`
    });
  }
  if (data.patientType === "Donor") {
    if (!data.linkedRecipientId) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: "Living donor must be linked to a recipient"
      });
    }
    if (patientId && data.linkedRecipientId === patientId) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: "Donor cannot be linked to themselves"
      });
    }
  }
}
var patientsRouter = router({
  list: adminProcedure.input(
    z3.object({
      type: z3.enum(PATIENT_TYPES).optional(),
      stage: z3.string().optional(),
      doctorId: z3.number().optional(),
      status: z3.enum(PATIENT_STATUSES).optional(),
      search: z3.string().optional()
    }).optional()
  ).query(async ({ input }) => {
    return listPatients(input);
  }),
  getById: adminProcedure.input(
    z3.object({
      id: z3.number().int().positive().safe(),
      allowMissing: z3.boolean().optional()
    })
  ).query(async ({ ctx, input }) => {
    const patient3 = await getPatientById(input.id);
    if (!patient3) {
      if (input.allowMissing) {
        return { patient: null, linkedRecipient: null, linkedDonors: [] };
      }
      throw new TRPCError3({ code: "NOT_FOUND", message: "Patient not found" });
    }
    await logActivity(
      ctx.user.id,
      patient3.id,
      "VIEW_PATIENT_PROFILE",
      { hrn: patient3.hrn, name: `${patient3.lastName}, ${patient3.firstName}` },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    let linkedRecipient = null;
    if (patient3.linkedRecipientId) {
      linkedRecipient = await getPatientById(patient3.linkedRecipientId);
    }
    let linkedDonors = [];
    if (patient3.patientType === "Recipient") {
      const allPatients = await listPatients({ type: "Donor" });
      linkedDonors = allPatients.filter((p) => p.linkedRecipientId === patient3.id);
    }
    return {
      patient: patient3,
      linkedRecipient,
      linkedDonors
    };
  }),
  create: adminProcedure.input(patientInputSchema).mutation(async ({ ctx, input }) => {
    validatePatientBusinessRules(input);
    const existingHrn = await getPatientByHrn(input.hrn);
    if (existingHrn) {
      throw new TRPCError3({ code: "CONFLICT", message: "A patient with this HRN already exists" });
    }
    const existingEmail = await getPatientByAccountEmail(input.accountEmail);
    if (existingEmail) {
      throw new TRPCError3({
        code: "CONFLICT",
        message: "A patient with this Gmail account is already enrolled"
      });
    }
    if (input.patientType === "Donor" && input.linkedRecipientId) {
      const recipient = await getPatientById(input.linkedRecipientId);
      if (!recipient || recipient.patientType !== "Recipient") {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "Linked recipient not found or is not a recipient profile"
        });
      }
    }
    const created = await createPatient(input);
    await logActivity(
      ctx.user.id,
      created.id,
      "ENROLL_PATIENT",
      { hrn: created.hrn, type: created.patientType, stage: created.stage },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    return created;
  }),
  update: adminProcedure.input(
    z3.object({
      id: z3.number().int().positive().safe(),
      data: patientInputSchema.partial()
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await getPatientById(input.id);
    if (!existing) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "Patient not found" });
    }
    const merged = {
      ...existing,
      ...input.data
    };
    validatePatientBusinessRules(merged, input.id);
    if (input.data.hrn && input.data.hrn !== existing.hrn) {
      const dupHrn = await getPatientByHrn(input.data.hrn);
      if (dupHrn && dupHrn.id !== input.id) {
        throw new TRPCError3({ code: "CONFLICT", message: "A patient with this HRN already exists" });
      }
    }
    if (input.data.accountEmail && input.data.accountEmail.toLowerCase() !== existing.accountEmail.toLowerCase()) {
      const dupEmail = await getPatientByAccountEmail(input.data.accountEmail);
      if (dupEmail && dupEmail.id !== input.id) {
        throw new TRPCError3({
          code: "CONFLICT",
          message: "A patient with this Gmail account is already enrolled"
        });
      }
    }
    if (merged.patientType === "Donor" && merged.linkedRecipientId) {
      const recipient = await getPatientById(merged.linkedRecipientId);
      if (!recipient || recipient.patientType !== "Recipient") {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "Linked recipient not found or is not a recipient profile"
        });
      }
    }
    const updated = await updatePatient(input.id, input.data);
    await logActivity(
      ctx.user.id,
      input.id,
      "UPDATE_PATIENT",
      { changes: Object.keys(input.data) },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    return updated;
  }),
  archive: adminProcedure.input(
    z3.object({
      id: z3.number().int().positive().safe(),
      status: z3.enum(["Inactive", "Deceased", "Transferred"]),
      reason: z3.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await getPatientById(input.id);
    if (!existing) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "Patient not found" });
    }
    const updated = await updatePatient(input.id, { status: input.status });
    await logActivity(
      ctx.user.id,
      input.id,
      "ARCHIVE_PATIENT",
      { previousStatus: existing.status, newStatus: input.status, reason: input.reason },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    return updated;
  }),
  activityLogs: adminProcedure.input(z3.object({ patientId: z3.number().int().positive().safe(), limit: z3.number().optional() })).query(async ({ input }) => {
    return listActivityLogs(input.patientId, input.limit ?? 50);
  })
});

// server/routers/doctors.ts
init_db();
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z4 } from "zod";
init_ktp();
var doctorsRouter = router({
  list: protectedProcedure.input(
    z4.object({
      role: z4.enum(DOCTOR_ROLES).optional(),
      activeOnly: z4.boolean().default(true)
    }).optional()
  ).query(async ({ input }) => {
    return listDoctors(input);
  }),
  getById: adminProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
    const doc = await getDoctorById(input.id);
    if (!doc) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Doctor not found" });
    }
    return doc;
  }),
  create: adminProcedure.input(
    z4.object({
      name: z4.string().min(1, "Doctor name is required").max(128),
      role: z4.enum(DOCTOR_ROLES),
      active: z4.boolean().default(true)
    })
  ).mutation(async ({ input }) => {
    return createDoctor(input);
  }),
  update: adminProcedure.input(
    z4.object({
      id: z4.number(),
      name: z4.string().min(1).max(128).optional(),
      role: z4.enum(DOCTOR_ROLES).optional(),
      active: z4.boolean().optional()
    })
  ).mutation(async ({ input }) => {
    const { id: id2, ...data } = input;
    const updated = await updateDoctor(id2, data);
    if (!updated) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Doctor not found" });
    }
    return updated;
  })
});

// server/routers/settings.ts
import { z as z5 } from "zod";
init_db();
var settingsRouter = router({
  getAll: adminProcedure.query(async () => {
    const all = await getAllSettings();
    return {
      appTitle: all.appTitle ?? "KTP",
      orgName: all.orgName ?? "Organ Transplant Services",
      contactEmail: all.contactEmail ?? "",
      emergencyHotlineText: all.emergencyHotlineText ?? "KT Unit Hotline: 0917-000-0000 | Hospital Trunk: (082) 227-2731 loc 4100",
      consentNoticeText: all.consentNoticeText ?? "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.",
      consentVersion: all.consentVersion ?? "1"
    };
  }),
  getConsentNotice: publicProcedure.query(async () => {
    const consentNoticeText = await getSetting("consentNoticeText") ?? "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.";
    const consentVersion = await getSetting("consentVersion") ?? "1";
    return {
      consentNoticeText,
      consentVersion: parseInt(consentVersion, 10) || 1
    };
  }),
  update: adminProcedure.input(
    z5.object({
      emergencyHotlineText: z5.string().max(1e3).optional(),
      consentNoticeText: z5.string().max(5e3).optional(),
      consentVersion: z5.number().int().min(1).optional(),
      appTitle: z5.string().max(128).optional(),
      orgName: z5.string().max(128).optional(),
      contactEmail: z5.string().email().or(z5.literal("")).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (input.emergencyHotlineText !== void 0) {
      await setSetting("emergencyHotlineText", input.emergencyHotlineText);
    }
    if (input.consentNoticeText !== void 0) {
      await setSetting("consentNoticeText", input.consentNoticeText);
    }
    if (input.consentVersion !== void 0) {
      await setSetting("consentVersion", String(input.consentVersion));
    }
    if (input.appTitle !== void 0) {
      await setSetting("appTitle", input.appTitle);
    }
    if (input.orgName !== void 0) {
      await setSetting("orgName", input.orgName);
    }
    if (input.contactEmail !== void 0) {
      await setSetting("contactEmail", input.contactEmail);
    }
    await logActivity(
      ctx.user.id,
      null,
      "UPDATE_SETTINGS",
      { updatedKeys: Object.keys(input) },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    return { success: true };
  })
});

// server/routers/dashboard.ts
init_db();
init_ktp();
var dashboardRouter = router({
  initial: adminProcedure.query(async () => {
    const [patients2, clinical] = await Promise.all([listPatients(), listClinicalDashboard()]);
    const today = todayDate();
    const active = patients2.filter((p) => p.status === "Active");
    const recipients = active.filter((p) => p.patientType === "Recipient");
    const donors = active.filter((p) => p.patientType === "Donor");
    const recipientStages = {};
    for (const p of recipients) {
      recipientStages[p.stage] = (recipientStages[p.stage] || 0) + 1;
    }
    const donorStages = {};
    for (const p of donors) {
      donorStages[p.stage] = (donorStages[p.stage] || 0) + 1;
    }
    return {
      ...clinical,
      today,
      patients: patients2,
      activeCount: active.length,
      totalPatients: patients2.length,
      recipientCount: recipients.length,
      donorCount: donors.length,
      recipientStages,
      donorStages,
      overdueServices: [],
      claimsDueSoon: [],
      rescheduleRequests: [],
      supersededUnfiledClaims: []
    };
  })
});

// server/routers/notifications.ts
import { z as z6 } from "zod";
init_db();
var notificationsRouter = router({
  myList: patientProcedure.query(async ({ ctx }) => {
    return listNotifications(ctx.patientId);
  }),
  myUnreadCount: patientProcedure.query(async ({ ctx }) => {
    return countUnreadNotifications(ctx.patientId);
  }),
  markMyRead: patientProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
    await markNotificationRead(input.id, ctx.patientId);
    return { success: true };
  }),
  markAllMyRead: patientProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.patientId);
    return { success: true };
  })
});

// server/routers/patientPortal.ts
init_db();
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z7 } from "zod";

// server/dbMessages.ts
init_db();
init_localDb();
import { TRPCError as TRPCError5 } from "@trpc/server";
var query3 = (sql4, ...args) => ({ sql: sql4, args });
async function execute2(make) {
  if (!process.env.DATABASE_URL) {
    const db = getSqliteDb();
    return db.transaction(() => {
      const program = make();
      let step = program.next();
      while (!step.done) {
        const statement = db.prepare(step.value.sql);
        const rows = statement.reader ? statement.all(...step.value.args) : (statement.run(...step.value.args), []);
        step = program.next(rows);
      }
      return step.value;
    }).immediate();
  }
  if (!await getDb()) throw new Error("Database unavailable");
  const client = getBatchClient();
  return await client.begin(async (transaction) => {
    const program = make();
    let step = program.next();
    while (!step.done) {
      let parameter = 0;
      const sql4 = step.value.sql.replace(/\?/g, () => `$${++parameter}`);
      const rows = await transaction.unsafe(sql4, step.value.args);
      step = program.next([...rows]);
    }
    return step.value;
  });
}
async function createBroadcastMessage(input) {
  return execute2(function* () {
    let patientSql = "SELECT id FROM patients WHERE status = 'Active'";
    const patientArgs = [];
    if (input.targetType === "Recipient") {
      patientSql += ' AND "patientType" = ?';
      patientArgs.push("Recipient");
    } else if (input.targetType === "Donor") {
      patientSql += ' AND "patientType" = ?';
      patientArgs.push("Donor");
    } else if (input.targetType === "Stage" && input.targetStage) {
      patientSql += " AND stage = ?";
      patientArgs.push(input.targetStage);
    } else if (input.targetType === "Specific" && input.targetPatientId) {
      patientSql += " AND id = ?";
      patientArgs.push(input.targetPatientId);
    }
    const recipients = yield query3(patientSql, ...patientArgs);
    if (!recipients.length) {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "No active patients match the chosen broadcast target"
      });
    }
    const [msg] = yield query3(
      `INSERT INTO messages ("senderUserId", subject, body, "targetType", "targetStage", "targetPatientId")
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      input.senderUserId,
      input.subject,
      input.body,
      input.targetType,
      input.targetStage ?? null,
      input.targetPatientId ?? null
    );
    const messageId = msg.id;
    for (const p of recipients) {
      yield query3(
        'INSERT INTO "messageRecipients" ("messageId", "patientId") VALUES (?, ?)',
        messageId,
        p.id
      );
      yield query3(
        `INSERT INTO notifications ("patientId", title, message, type, "linkUrl")
         VALUES (?, ?, ?, 'info', '/me/messages')`,
        p.id,
        input.subject,
        input.body.slice(0, 150)
      );
    }
    return { id: messageId, recipientCount: recipients.length };
  });
}
async function listAdminMessages() {
  return execute2(function* () {
    const rows = yield query3(`
      SELECT m.id, m."senderUserId", m.subject, m.body, m."targetType", m."targetStage", m."targetPatientId",
        CAST(m."createdAt" AS TEXT) AS "createdAt",
        (SELECT COUNT(*) FROM "messageRecipients" mr WHERE mr."messageId" = m.id) AS "recipientCount",
        (SELECT COUNT(*) FROM "messageRecipients" mr WHERE mr."messageId" = m.id AND mr."readAt" IS NOT NULL) AS "readCount",
        (SELECT COUNT(*) FROM "messageAcknowledgments" ma WHERE ma."messageId" = m.id) AS "acknowledgedCount"
      FROM messages m
      ORDER BY m.id DESC
    `);
    return rows.map((r) => ({
      id: Number(r.id),
      senderUserId: Number(r.senderUserId),
      subject: String(r.subject),
      body: String(r.body),
      targetType: String(r.targetType),
      targetStage: r.targetStage ? String(r.targetStage) : null,
      targetPatientId: r.targetPatientId ? Number(r.targetPatientId) : null,
      createdAt: String(r.createdAt),
      recipientCount: Number(r.recipientCount || 0),
      readCount: Number(r.readCount || 0),
      acknowledgedCount: Number(r.acknowledgedCount || 0)
    }));
  });
}
async function listPatientMessages(patientId) {
  return execute2(function* () {
    const rows = yield query3(
      `SELECT m.id, m.subject, m.body,
        CAST(m."createdAt" AS TEXT) AS "createdAt",
        CAST(mr."readAt" AS TEXT) AS "readAt",
        CAST(ma."acknowledgedAt" AS TEXT) AS "acknowledgedAt"
      FROM "messageRecipients" mr
      JOIN messages m ON m.id = mr."messageId"
      LEFT JOIN "messageAcknowledgments" ma ON ma."messageId" = m.id AND ma."patientId" = mr."patientId"
      WHERE mr."patientId" = ?
      ORDER BY m.id DESC`,
      patientId
    );
    return rows.map((r) => ({
      id: Number(r.id),
      subject: String(r.subject),
      body: String(r.body),
      createdAt: String(r.createdAt),
      readAt: r.readAt ? String(r.readAt) : null,
      acknowledgedAt: r.acknowledgedAt ? String(r.acknowledgedAt) : null
    }));
  });
}
async function acknowledgePatientMessage(patientId, messageId) {
  return execute2(function* () {
    yield query3(
      'UPDATE "messageRecipients" SET "readAt" = CURRENT_TIMESTAMP WHERE "messageId" = ? AND "patientId" = ? AND "readAt" IS NULL',
      messageId,
      patientId
    );
    yield query3(
      'INSERT INTO "messageAcknowledgments" ("messageId", "patientId") VALUES (?, ?)',
      messageId,
      patientId
    );
    return { success: true };
  });
}

// server/routers/patientPortal.ts
var patientPortalRouter = router({
  getMyProfile: patientProcedure.query(async ({ ctx }) => {
    const patient3 = await getPatientById(ctx.patientId);
    if (!patient3) {
      throw new TRPCError6({ code: "NOT_FOUND", message: "Patient profile not found" });
    }
    let nephrologist = null;
    if (patient3.nephrologistId) {
      nephrologist = await getDoctorById(patient3.nephrologistId);
    }
    let fellow = null;
    if (patient3.fellowId) {
      fellow = await getDoctorById(patient3.fellowId);
    }
    let linkedRecipientName = null;
    if (patient3.linkedRecipientId) {
      const recipient = await getPatientById(patient3.linkedRecipientId);
      if (recipient) {
        linkedRecipientName = `${recipient.firstName} ${recipient.lastName}`;
      }
    }
    return {
      patient: patient3,
      nephrologist,
      fellow,
      linkedRecipientName
    };
  }),
  getMyClinical: patientProcedure.query(async ({ ctx }) => {
    return getClinical(ctx.patientId);
  }),
  respondAppointment: patientProcedure.input(
    z7.object({
      appointmentId: z7.number().int().positive().safe(),
      response: z7.enum(["Confirmed", "RescheduleRequested"]),
      responseNote: z7.string().trim().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    return respondToAppointment({
      patientId: ctx.patientId,
      id: input.appointmentId,
      response: input.response,
      responseNote: input.responseNote
    });
  }),
  getMyMessages: patientProcedure.query(async ({ ctx }) => {
    return listPatientMessages(ctx.patientId);
  }),
  acknowledgeMessage: patientProcedure.input(z7.object({ messageId: z7.number().int().positive().safe() })).mutation(async ({ ctx, input }) => {
    return acknowledgePatientMessage(ctx.patientId, input.messageId);
  }),
  updateContact: patientProcedure.input(z7.object({ contactNumber: z7.string().max(32).nullable() })).mutation(async ({ ctx, input }) => {
    const updated = await updatePatient(ctx.patientId, {
      contactNumber: input.contactNumber
    });
    return updated;
  }),
  updatePhoto: patientProcedure.input(z7.object({ photoFileId: z7.number().nullable() })).mutation(async ({ ctx, input }) => {
    const updated = await updatePatient(ctx.patientId, {
      photoFileId: input.photoFileId
    });
    return updated;
  }),
  parseLabDocument: patientProcedure.input(
    z7.object({
      fileName: z7.string().min(1).max(255).optional(),
      base64: z7.string().min(1)
    })
  ).mutation(async ({ input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const { parseLabBuffer: parseLabBuffer2 } = await Promise.resolve().then(() => (init_labOcrBridge(), labOcrBridge_exports));
    return parseLabBuffer2(buffer, input.fileName || "document.pdf");
  }),
  submitPatientLab: patientProcedure.input(
    z7.object({
      serviceDate: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z7.string().trim().max(1e3).optional(),
      items: z7.array(
        z7.object({
          labTestId: z7.number().int().positive(),
          value: z7.string().trim().min(1).max(100)
        })
      )
    })
  ).mutation(async ({ ctx, input }) => {
    const res = await recordResult(
      {
        patientId: ctx.patientId,
        serviceRecordId: 0,
        serviceDate: input.serviceDate,
        label: "Patient self-uploaded lab report",
        nurseApproved: false,
        approvedByNurse: "Pending Verification",
        note: input.note ? `[Patient Upload] ${input.note}` : "[Patient Upload] Pending clinical verification",
        results: input.items
      },
      ctx.user?.id ?? 0
    );
    await logActivity(
      ctx.user?.id ?? 0,
      ctx.patientId,
      "PATIENT_UPLOAD_LAB",
      { serviceDate: input.serviceDate, testCount: input.items.length },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    return { success: true, recordId: res?.id };
  })
});

// server/routers/messages.ts
import { z as z8 } from "zod";
var messagesRouter = router({
  list: adminProcedure.query(async () => {
    return listAdminMessages();
  }),
  create: adminProcedure.input(
    z8.object({
      subject: z8.string().trim().min(1, "Subject is required").max(200),
      body: z8.string().trim().min(1, "Message content is required").max(4e3),
      targetType: z8.enum(["All", "Recipient", "Donor", "Stage", "Specific"]),
      targetStage: z8.string().optional(),
      targetPatientId: z8.number().int().positive().safe().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    return createBroadcastMessage({
      senderUserId: ctx.user.id,
      subject: input.subject,
      body: input.body,
      targetType: input.targetType,
      targetStage: input.targetStage,
      targetPatientId: input.targetPatientId
    });
  })
});

// server/routers/automations.ts
import { z as z9 } from "zod";

// server/emailService.ts
init_db();
init_localDb();
init_ktp();
var DEFAULT_AUTOMATION_CONFIG = {
  masterEnabled: true,
  dispatchTimeManila: "08:00",
  triggers: [
    {
      key: "appointment_reminder",
      label: "Clinic Appointment Notice",
      description: "Send patient email reminder 2 days before scheduled clinic visit.",
      enabled: true,
      leadDays: 2
    },
    {
      key: "overdue_lab",
      label: "Overdue Lab Workup Alert",
      description: "Send alert when scheduled laboratory workup due date has passed.",
      enabled: true,
      leadDays: 1
    },
    {
      key: "weekly_digest",
      label: "Weekly Nephrology Digest",
      description: "Send weekly patient census and pending clearance digest to doctors.",
      enabled: true,
      leadDays: 7
    }
  ],
  lastRunAt: null,
  lastRunStats: null
};
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function baseTemplate(title, patientBanner, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0; padding:0; background-color:#e2e5d5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#2a301e; }
    .wrapper { width:100%; max-width:600px; margin:24px auto; background-color:#fbfbf7; border-radius:12px; border:1px solid #cbd0bb; overflow:hidden; }
    .header { background-color:#f3f4ec; padding:20px 24px; border-bottom:1px solid #cbd0bb; }
    .title { font-size:18px; font-weight:700; margin:0; color:#2a301e; }
    .sub { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#545b45; margin-top:4px; }
    .banner { background-color:#d8dcc9; padding:12px 24px; font-size:12px; font-family:monospace; color:#2a301e; border-bottom:1px solid #cbd0bb; }
    .content { padding:24px; font-size:14px; line-height:1.5; color:#2a301e; }
    .footer { background-color:#f3f4ec; padding:16px 24px; font-size:11px; color:#545b45; border-top:1px solid #cbd0bb; }
    .btn { display:inline-block; background-color:#ae3c30; color:#fffaf6; text-decoration:none; padding:10px 18px; font-size:13px; font-weight:600; border-radius:6px; margin-top:16px; }
    .highlight { background-color:#dcefdc; color:#1d6433; padding:2px 6px; border-radius:4px; font-weight:600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="title">SPMC Kidney Transplant Service</h1>
      <div class="sub">Clinical Notification System \xB7 Confidential</div>
    </div>
    ${patientBanner ? `<div class="banner">${patientBanner}</div>` : ""}
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      Southern Philippines Medical Center \xB7 Kidney Transplant Program<br>
      This notification is sent automatically. For urgent clinical emergencies, visit the emergency department.
    </div>
  </div>
</body>
</html>`;
}
function renderEmailTemplate(templateName, data) {
  const patientName = data.patientName || "Patient";
  const hrn = data.hrn || "KTP-2026-0000";
  if (templateName === "AppointmentNotice") {
    const subject2 = `Appointment Notice: ${patientName} (${hrn}) on ${data.appointmentDate || todayDate()}`;
    const banner = `PATIENT: ${escapeHtml(patientName)} | HRN: ${escapeHtml(hrn)} | VISIT: ${escapeHtml(data.kind || "FollowUp")}`;
    const body2 = `
      <p>Dear <strong>${escapeHtml(patientName)}</strong>,</p>
      <p>This is an automated reminder of your upcoming kidney transplant clinic appointment:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Date and Time:</strong> <span class="highlight">${escapeHtml(data.appointmentDate || "")} at ${escapeHtml(data.time || "09:00 AM")}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Attending Doctor:</strong> ${escapeHtml(data.doctorName || "Transplant Specialist")}</p>
        <p style="margin:0;"><strong>Location:</strong> SPMC Kidney Transplant Clinic, OPD Building</p>
      </div>
      <p>Please arrive 15 minutes before your scheduled time. Bring your previous lab results and PhilHealth identification.</p>
      <a href="https://ktp-beryl.vercel.app/me/calendar" class="btn">View Appointment in Patient Portal</a>
    `;
    const text2 = `SPMC Kidney Transplant Appointment Reminder
Patient: ${patientName} (${hrn})
Date: ${data.appointmentDate} at ${data.time}
Doctor: ${data.doctorName}
Location: SPMC Kidney Transplant Clinic`;
    return { subject: subject2, html: baseTemplate("Clinic Appointment Notice", banner, body2), text: text2 };
  }
  if (templateName === "OverdueLabAlert") {
    const subject2 = `Action Required: Scheduled Lab Workup Due for ${patientName} (${hrn})`;
    const banner = `PATIENT: ${escapeHtml(patientName)} | HRN: ${escapeHtml(hrn)} | ALERT: Due Lab Service`;
    const body2 = `
      <p>Dear <strong>${escapeHtml(patientName)}</strong>,</p>
      <p>Our records show a scheduled laboratory workup has reached its due date without recorded results:</p>
      <div style="background-color:#fbe1e8; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #ae3c30;">
        <p style="margin:0 0 8px 0; color:#ae3c30;"><strong>Laboratory Requirement:</strong> ${escapeHtml(data.labTitle || "Periodic Blood Chemistry")}</p>
        <p style="margin:0; color:#2a301e;"><strong>Target Due Date:</strong> ${escapeHtml(data.dueDate || todayDate())}</p>
      </div>
      <p>Routine lab monitoring is critical to protect your graft function. Please complete your blood draw and upload your results or submit them to the transplant coordinator.</p>
      <a href="https://ktp-beryl.vercel.app/me/labs" class="btn">Upload Results to Portal</a>
    `;
    const text2 = `SPMC Kidney Transplant Lab Workup Alert
Patient: ${patientName} (${hrn})
Requirement: ${data.labTitle}
Due Date: ${data.dueDate}`;
    return { subject: subject2, html: baseTemplate("Overdue Lab Workup Alert", banner, body2), text: text2 };
  }
  if (templateName === "WeeklyClinicalDigest") {
    const subject2 = `Weekly Kidney Transplant Clinical Digest: ${data.date || todayDate()}`;
    const banner = `CLINICAL DIGEST | SPMC TRANSPLANT SERVICE | CENSUS SUMMARY`;
    const body2 = `
      <p>Dear <strong>${escapeHtml(data.doctorName || "Transplant Team")}</strong>,</p>
      <p>Here is the weekly active patient census and workup status summary:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Active Transplant Patients:</strong> <span class="highlight">${data.activeCount || 0}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Pending Lab Workups:</strong> ${data.pendingLabs || 0}</p>
        <p style="margin:0 0 8px 0;"><strong>Upcoming Clinic Visits (7 Days):</strong> ${data.upcomingVisits || 0}</p>
        <p style="margin:0;"><strong>Patients in Pre-Transplant Evaluation:</strong> ${data.evalCount || 0}</p>
      </div>
      <a href="https://ktp-beryl.vercel.app/dashboard" class="btn">Open Transplant Dashboard</a>
    `;
    const text2 = `Weekly Transplant Digest
Active Patients: ${data.activeCount}
Pending Labs: ${data.pendingLabs}
Upcoming Visits: ${data.upcomingVisits}`;
    return { subject: subject2, html: baseTemplate("Weekly Clinical Digest", banner, body2), text: text2 };
  }
  const subject = `KTP Notification System Test (${data.testId || "Ping"})`;
  const body = `
    <p>This is a test notification confirming email delivery connectivity for the SPMC Kidney Transplant Program.</p>
    <p>Timestamp: <strong>${(/* @__PURE__ */ new Date()).toISOString()}</strong></p>
    <p>Status: All automated clinical dispatch pipelines operational.</p>
  `;
  return { subject, html: baseTemplate("Notification System Test", "", body), text: "KTP Email Test OK" };
}
async function sendEmail({
  to,
  subject,
  html,
  text: text2,
  templateName,
  patientId
}) {
  const apiKey = process.env.RESEND_API_KEY;
  let status = "mock";
  let errorMessage = null;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "KTP Notifications <notifications@spmcdvo.net>",
          to: [to],
          subject,
          html,
          text: text2
        })
      });
      if (res.ok) {
        status = "sent";
      } else {
        const errorData = await res.json().catch(() => ({}));
        status = "failed";
        errorMessage = errorData.message || `HTTP ${res.status}`;
      }
    } catch (err) {
      status = "failed";
      errorMessage = err.message || "Network dispatch failure";
    }
  } else {
    status = "mock";
  }
  const db = getBatchClient();
  let logId = 0;
  if (db) {
    try {
      const [row] = await db`
        INSERT INTO "ktp"."emailLogs" ("recipientEmail", "subject", "templateName", "status", "errorMessage", "patientId")
        VALUES (${to}, ${subject}, ${templateName}, ${status}, ${errorMessage}, ${patientId || null})
        RETURNING id
      `;
      logId = Number(row?.id || 0);
    } catch (e) {
      console.error("[Email Log Insert Failed PG]", e);
    }
  } else {
    try {
      const sqlite = getSqliteDb();
      const res = sqlite.prepare(
        "INSERT INTO emailLogs (recipientEmail, subject, templateName, status, errorMessage, patientId) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(to, subject, templateName, status, errorMessage, patientId || null);
      logId = Number(res.lastInsertRowid);
    } catch (e) {
      console.error("[Email Log Insert Failed SQLite]", e);
    }
  }
  return { id: logId, status };
}
async function getAutomationConfig() {
  const db = getBatchClient();
  try {
    if (db) {
      const rows = await db`SELECT value FROM "ktp"."appSettings" WHERE key = 'email_automation_config' LIMIT 1`;
      if (rows.length && rows[0].value) return JSON.parse(rows[0].value);
    } else {
      const sqlite = getSqliteDb();
      const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = 'email_automation_config'").get();
      if (row?.value) return JSON.parse(row.value);
    }
  } catch (e) {
  }
  return DEFAULT_AUTOMATION_CONFIG;
}
async function updateAutomationConfig(config) {
  const jsonStr = JSON.stringify(config);
  const db = getBatchClient();
  try {
    if (db) {
      await db`
        INSERT INTO "ktp"."appSettings" (key, value)
        VALUES ('email_automation_config', ${jsonStr})
        ON CONFLICT (key) DO UPDATE SET value = ${jsonStr}, "updatedAt" = now()
      `;
    } else {
      const sqlite = getSqliteDb();
      sqlite.prepare("INSERT INTO appSettings (key, value) VALUES ('email_automation_config', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(jsonStr, jsonStr);
    }
    return true;
  } catch (e) {
    console.error("[Update Email Config Error]", e);
    return false;
  }
}
async function runEmailAutomationSweep() {
  const config = await getAutomationConfig();
  if (!config.masterEnabled) {
    return { created: 0, sent: 0, failed: 0, skipped: 0 };
  }
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const today = todayDate();
  const db = getBatchClient();
  const apptTrigger = config.triggers.find((t2) => t2.key === "appointment_reminder");
  if (apptTrigger && apptTrigger.enabled) {
    try {
      let appointments2 = [];
      if (db) {
        appointments2 = await db`
          SELECT a.id, a."patientId", a.title, a.kind, a."startsAt", a.location, p."firstName", p."lastName", p."accountEmail", p."hrn"
          FROM "ktp"."appointments" a
          JOIN "ktp"."patients" p ON p.id = a."patientId"
          WHERE a."cancelledAt" IS NULL
            AND a."startsAt"::date >= ${today}::date
            AND a."startsAt"::date <= (${today}::date + interval '2 days')
        `;
      } else {
        const sqlite = getSqliteDb();
        appointments2 = sqlite.prepare(`
          SELECT a.id, a.patientId, a.title, a.kind, a.startsAt, a.location, p.firstName, p.lastName, p.accountEmail, p.hrn
          FROM appointments a
          JOIN patients p ON p.id = a.patientId
          WHERE a.cancelledAt IS NULL
            AND substr(a.startsAt, 1, 10) >= ?
            AND substr(a.startsAt, 1, 10) <= date(?, '+2 days')
        `).all(today, today);
      }
      for (const appt of appointments2) {
        if (!appt.accountEmail || !appt.accountEmail.includes("@")) {
          skipped++;
          continue;
        }
        const patientName = `${appt.firstName} ${appt.lastName}`;
        const appointmentDate = (appt.startsAt || "").slice(0, 10);
        const { subject, html, text: text2 } = renderEmailTemplate("AppointmentNotice", {
          patientName,
          hrn: appt.hrn,
          appointmentDate,
          doctorName: appt.location || "SPMC Nephrology Clinic",
          kind: appt.kind
        });
        const res = await sendEmail({
          to: appt.accountEmail,
          subject,
          html,
          text: text2,
          templateName: "AppointmentNotice",
          patientId: appt.patientId
        });
        if (res.status === "failed") failed++;
        else sent++;
      }
    } catch (err) {
      console.error("[Sweep Appointment Error]", err);
    }
  }
  config.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  config.lastRunStats = { sent, failed, skipped };
  await updateAutomationConfig(config);
  return { created: sent + failed, sent, failed, skipped };
}
async function listEmailLogs({
  status,
  search,
  limit = 50,
  offset = 0
}) {
  const db = getBatchClient();
  if (db) {
    let rows2 = [];
    if (status && status !== "all") {
      rows2 = await db`
        SELECT l.*, p."firstName", p."lastName", p."hrn"
        FROM "ktp"."emailLogs" l
        LEFT JOIN "ktp"."patients" p ON p.id = l."patientId"
        WHERE l.status = ${status}
        ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows2 = await db`
        SELECT l.*, p."firstName", p."lastName", p."hrn"
        FROM "ktp"."emailLogs" l
        LEFT JOIN "ktp"."patients" p ON p.id = l."patientId"
        ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return rows2.map((r) => ({
      id: Number(r.id),
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      templateName: r.templateName,
      status: r.status,
      errorMessage: r.errorMessage,
      patientId: r.patientId ? Number(r.patientId) : null,
      patientName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
      patientHrn: r.hrn || null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  const sqlite = getSqliteDb();
  let query4 = `
    SELECT l.*, p.firstName, p.lastName, p.hrn
    FROM emailLogs l
    LEFT JOIN patients p ON p.id = l.patientId
  `;
  const params = [];
  if (status && status !== "all") {
    query4 += " WHERE l.status = ?";
    params.push(status);
  }
  query4 += " ORDER BY l.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const rows = sqlite.prepare(query4).all(...params);
  return rows.map((r) => ({
    id: Number(r.id),
    recipientEmail: r.recipientEmail,
    subject: r.subject,
    templateName: r.templateName,
    status: r.status,
    errorMessage: r.errorMessage,
    patientId: r.patientId ? Number(r.patientId) : null,
    patientName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
    patientHrn: r.hrn || null,
    createdAt: r.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  }));
}

// server/routers/automations.ts
var automationsRouter = router({
  getConfig: adminProcedure.query(async () => {
    return getAutomationConfig();
  }),
  updateConfig: adminProcedure.input(
    z9.object({
      masterEnabled: z9.boolean(),
      dispatchTimeManila: z9.string().regex(/^\d{2}:\d{2}$/),
      triggers: z9.array(
        z9.object({
          key: z9.enum(["appointment_reminder", "overdue_lab", "weekly_digest"]),
          label: z9.string(),
          description: z9.string(),
          enabled: z9.boolean(),
          leadDays: z9.number().int().min(1).max(30)
        })
      )
    })
  ).mutation(async ({ input }) => {
    const current = await getAutomationConfig();
    const updated = {
      ...current,
      masterEnabled: input.masterEnabled,
      dispatchTimeManila: input.dispatchTimeManila,
      triggers: input.triggers
    };
    const ok = await updateAutomationConfig(updated);
    return { success: ok };
  }),
  runManualSweep: adminProcedure.mutation(async () => {
    const stats = await runEmailAutomationSweep();
    return { success: true, stats };
  }),
  listLogs: adminProcedure.input(
    z9.object({
      status: z9.string().optional(),
      search: z9.string().optional(),
      limit: z9.number().int().min(1).max(100).default(50),
      offset: z9.number().int().min(0).default(0)
    })
  ).query(async ({ input }) => {
    const items = await listEmailLogs(input);
    return { items };
  }),
  sendTestEmail: adminProcedure.input(
    z9.object({
      to: z9.string().email(),
      templateName: z9.enum([
        "AppointmentNotice",
        "OverdueLabAlert",
        "WeeklyClinicalDigest",
        "TestNotice"
      ])
    })
  ).mutation(async ({ input }) => {
    const { subject, html, text: text2 } = renderEmailTemplate(input.templateName, {
      patientName: "Sample Test Patient",
      hrn: "KTP-2026-TEST",
      appointmentDate: "2026-10-08",
      time: "10:00 AM",
      doctorName: "Dr. Nephrologist",
      labTitle: "Serum Creatinine and Electrolytes",
      dueDate: "2026-10-04",
      activeCount: 42,
      pendingLabs: 8,
      upcomingVisits: 14,
      evalCount: 12
    });
    const res = await sendEmail({
      to: input.to,
      subject,
      html,
      text: text2,
      templateName: input.templateName
    });
    return { success: res.status !== "failed", status: res.status, id: res.id };
  }),
  renderPreview: adminProcedure.input(
    z9.object({
      templateName: z9.enum([
        "AppointmentNotice",
        "OverdueLabAlert",
        "WeeklyClinicalDigest",
        "TestNotice"
      ]),
      sampleData: z9.record(z9.string(), z9.any()).optional()
    })
  ).query(async ({ input }) => {
    const data = input.sampleData || {
      patientName: "Juan Dela Cruz",
      hrn: "KTP-2026-0001",
      appointmentDate: "2026-10-06",
      time: "09:30 AM",
      doctorName: "Dr. Maria Santos",
      labTitle: "Complete Blood Count and Creatinine",
      dueDate: "2026-10-03",
      activeCount: 38,
      pendingLabs: 6,
      upcomingVisits: 11,
      evalCount: 9
    };
    const { subject, html, text: text2 } = renderEmailTemplate(input.templateName, data);
    return { subject, html, text: text2 };
  })
});

// server/routers.ts
init_db();
init_adminAccess();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const isAdmin = hasFullAccess(ctx.user.email);
      let patient3 = null;
      let consentRequired = false;
      if (!isAdmin) {
        patient3 = await getPatientByLinkedUserId(ctx.user.id);
        if (!patient3 && ctx.user.email) {
          patient3 = await autoLinkPatientByEmail(ctx.user.id, ctx.user.email);
        }
        if (patient3) {
          const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
          const patientEmail = (patient3.accountEmail ?? "").trim().toLowerCase();
          if (userEmail !== patientEmail || patient3.status !== "Active") {
            patient3 = null;
          } else {
            const currentConsent = await getSetting("consentVersion");
            const reqVersion = currentConsent ? parseInt(currentConsent, 10) : 1;
            consentRequired = (patient3.consentVersion ?? 0) < reqVersion;
          }
        }
      }
      return {
        ...ctx.user,
        isAdmin,
        patient: patient3,
        consentRequired
      };
    }),
    getConsentNotice: publicProcedure.query(async () => {
      const consentNoticeText = await getSetting("consentNoticeText") ?? "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.";
      const currentVersion = await getSetting("consentVersion") ?? "1";
      return {
        consentNoticeText,
        consentVersion: parseInt(currentVersion, 10) || 1
      };
    }),
    acceptConsent: patientBaseProcedure.mutation(async ({ ctx }) => {
      const currentVersion = await getSetting("consentVersion") ?? "1";
      const verNum = parseInt(currentVersion, 10) || 1;
      const updated = await updatePatientConsent(ctx.patientId, verNum);
      await logActivity(
        ctx.user.id,
        ctx.patientId,
        "ACCEPT_CONSENT",
        { consentVersion: verNum },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );
      return { success: true, consentVersion: verNum, patient: updated };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  clinical: clinicalRouter,
  patients: patientsRouter,
  doctors: doctorsRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  patientPortal: patientPortalRouter,
  messages: messagesRouter,
  automations: automationsRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/vercel.ts
var appPromise = null;
async function getApp() {
  const app = express();
  app.use((req, res, next) => {
    if (req.url.includes("%VITE_") || req.url.includes("%25VITE_")) {
      return res.status(204).end();
    }
    try {
      decodeURI(req.url);
      next();
    } catch {
      return res.status(400).end();
    }
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/api/cron/daily-reminders", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const authHeader = req.headers["authorization"];
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.length < 16) {
      return res.status(500).json({ error: "CRON_SECRET is unconfigured or insecure on server" });
    }
    const expected = `Bearer ${cronSecret}`;
    if (typeof authHeader !== "string" || authHeader.length !== expected.length || !crypto2.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { runDailyReminderJob: runDailyReminderJob2 } = await Promise.resolve().then(() => (init_scheduled(), scheduled_exports));
      const result = await runDailyReminderJob2();
      if (result.locked) {
        return res.status(409).json({ error: result.message });
      }
      return res.status(200).json({ ok: true, result });
    } catch (err) {
      console.error("[Cron:DailyReminders] Execution failed:", err);
      return res.status(500).json({ error: "Daily reminder job execution failed" });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}
async function handler(req, res) {
  try {
    if (!appPromise) {
      appPromise = getApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error("[Vercel Serverless Error]:", error);
    appPromise = null;
    res.status(500).json({ error: "Internal Server Error" });
  }
}
export {
  handler as default
};
