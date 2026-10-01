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
  const labCount = db.prepare("SELECT count(*) as count FROM labTests").get();
  if (labCount.count === 0) {
    const insertLab = db.prepare("INSERT INTO labTests (name, unit, sortOrder, active) VALUES (?, ?, ?, 1)");
    const tests = [
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
      ["CMV PCR", "IU/mL", 15]
    ];
    for (const [name, unit, sort] of tests) {
      insertLab.run(name, unit, sort);
    }
  }
  const checklistCount = db.prepare("SELECT count(*) as count FROM checklistCatalog").get();
  if (checklistCount.count === 0) {
    const insertChecklist = db.prepare(
      "INSERT INTO checklistCatalog (name, category, phase, appliesTo, asIndicated, sortOrder, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    );
    const items = [
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
    for (const [name, cat, phase, applies, asInd, sort] of items) {
      insertChecklist.run(name, cat, phase, applies, asInd, sort);
    }
  }
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
    require2 = createRequire(import.meta.url);
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    _sqliteDb = null;
  }
});

// server/dbPatients.ts
import { and, eq, ilike, or, sql as sql2 } from "drizzle-orm";
async function getPatientById(id) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id);
    return row ?? null;
  }
  const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
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
    const patient = sqlite.prepare("SELECT * FROM patients WHERE lower(accountEmail) = ? AND status = 'Active'").get(cleanEmail);
    if (!patient) return null;
    sqlite.prepare("UPDATE patients SET linkedUserId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(userId, patient.id);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(patient.id);
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
    let query = "SELECT * FROM patients WHERE 1=1";
    const params = [];
    if (opts.type) {
      query += " AND patientType = ?";
      params.push(opts.type);
    }
    if (opts.stage) {
      query += " AND stage = ?";
      params.push(opts.stage);
    }
    if (opts.doctorId) {
      query += " AND (nephrologistId = ? OR fellowId = ?)";
      params.push(opts.doctorId, opts.doctorId);
    }
    if (opts.status) {
      query += " AND status = ?";
      params.push(opts.status);
    }
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      query += " AND (lower(firstName) LIKE ? OR lower(lastName) LIKE ? OR lower(hrn) LIKE ?)";
      params.push(term, term, term);
    }
    query += " ORDER BY lastName ASC, firstName ASC";
    return sqlite.prepare(query).all(...params);
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
async function updatePatient(id, data) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id);
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = data[k];
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return v ?? null;
    });
    sqlite.prepare(`UPDATE patients SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id);
    return sqlite.prepare("SELECT * FROM patients WHERE id = ?").get(id);
  }
  const [updated] = await db.update(patients).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(patients.id, id)).returning();
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
    let query = "SELECT * FROM doctors WHERE 1=1";
    const params = [];
    if (activeOnly) query += " AND active = 1";
    if (opts.role) {
      query += " AND role = ?";
      params.push(opts.role);
    }
    query += " ORDER BY name ASC";
    return sqlite.prepare(query).all(...params);
  }
  const conditions = [];
  if (activeOnly) conditions.push(eq(doctors.active, true));
  if (opts.role) conditions.push(eq(doctors.role, opts.role));
  return db.select().from(doctors).where(conditions.length > 0 ? and(...conditions) : void 0).orderBy(doctors.name);
}
async function getDoctorById(id) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id);
    return row ?? null;
  }
  const [doc] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
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
async function updateDoctor(id, data) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id);
    if (!existing) return null;
    const keys = Object.keys(data).filter((k) => k !== "id");
    if (keys.length === 0) return existing;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => {
      const v = data[k];
      return typeof v === "boolean" ? v ? 1 : 0 : v ?? null;
    });
    sqlite.prepare(`UPDATE doctors SET ${sets}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...vals, id);
    return sqlite.prepare("SELECT * FROM doctors WHERE id = ?").get(id);
  }
  const [updated] = await db.update(doctors).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(doctors.id, id)).returning();
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
async function markNotificationRead(id, patientId) {
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND patientId = ?").run(id, patientId);
    return;
  }
  await db.update(notifications).set({ read: true }).where(and2(eq2(notifications.id, id), eq2(notifications.patientId, patientId)));
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
var _db, _schemaEnsured, _reminderLockHeld;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_adminAccess();
    init_baselineSql();
    init_localDb();
    init_dbPatients();
    _db = null;
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
var RECIPIENT_STAGES, DONOR_STAGES, PATIENT_TYPES, PATIENT_STATUSES, DOCTOR_ROLES, RISK_CATEGORIES;
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
    RISK_CATEGORIES = ["StandardLow", "High"];
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

// server/_core/systemRouter.ts
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
var timing = t.middleware(async ({ path: path2, type, next }) => {
  const started = Date.now();
  const result = await next();
  const ms = Date.now() - started;
  if (ms > SLOW_PROCEDURE_MS) {
    console.warn(`[tRPC] slow ${type} ${path2} ${ms}ms ok=${result.ok}`);
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
    const patient = await getPatientByLinkedUserId(ctx.user.id);
    if (!patient) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
    const patientEmail = (patient.accountEmail ?? "").trim().toLowerCase();
    if (!userEmail || !patientEmail || userEmail !== patientEmail || patient.status !== "Active") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        patientId: patient.id,
        patient
      }
    });
  })
);
var patientProcedure = patientBaseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const patient = ctx.patient;
    const currentConsentVersion = await getSetting("consentVersion");
    const requiredVersion = currentConsentVersion ? parseInt(currentConsentVersion, 10) : 1;
    const acceptedVersion = patient.consentVersion ?? 0;
    if (acceptedVersion < requiredVersion) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CONSENT_REQUIRED"
      });
    }
    return next({
      ctx: {
        ...ctx,
        patientId: patient.id,
        patient
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers/patients.ts
init_db();
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z as z2 } from "zod";
init_adminAccess();
init_ktp();
var patientInputSchema = z2.object({
  hrn: z2.string().min(1, "HRN is required").max(64),
  patientType: z2.enum(PATIENT_TYPES),
  firstName: z2.string().min(1, "First name is required").max(128),
  middleName: z2.string().max(128).nullable().optional(),
  lastName: z2.string().min(1, "Last name is required").max(128),
  suffix: z2.string().max(32).nullable().optional(),
  sex: z2.enum(["M", "F"]).nullable().optional(),
  birthDate: z2.string().nullable().optional(),
  contactNumber: z2.string().max(32).nullable().optional(),
  accountEmail: z2.string().email("Valid Gmail account is required").max(320),
  nephrologistId: z2.number().nullable().optional(),
  fellowId: z2.number().nullable().optional(),
  stage: z2.string().min(1, "Stage is required"),
  riskCategory: z2.enum(RISK_CATEGORIES).nullable().optional(),
  surgeryDate: z2.string().nullable().optional(),
  linkedRecipientId: z2.number().nullable().optional(),
  followupMonths: z2.number().int().min(1).max(3).default(1),
  status: z2.enum(PATIENT_STATUSES).default("Active"),
  photoFileId: z2.number().nullable().optional()
});
function validatePatientBusinessRules(data, patientId) {
  if (hasFullAccess(data.accountEmail)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Patient Gmail cannot be on the admin email allowlist"
    });
  }
  if (!isValidStageForPatientType(data.stage, data.patientType)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Stage '${data.stage}' is not valid for patient type '${data.patientType}'`
    });
  }
  if ((data.stage === "PostKT" || data.stage === "PostDonation") && !data.surgeryDate) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Surgery date is required when stage is '${data.stage}'`
    });
  }
  if (data.patientType === "Donor") {
    if (!data.linkedRecipientId) {
      throw new TRPCError2({
        code: "BAD_REQUEST",
        message: "Living donor must be linked to a recipient"
      });
    }
    if (patientId && data.linkedRecipientId === patientId) {
      throw new TRPCError2({
        code: "BAD_REQUEST",
        message: "Donor cannot be linked to themselves"
      });
    }
  }
}
var patientsRouter = router({
  list: adminProcedure.input(
    z2.object({
      type: z2.enum(PATIENT_TYPES).optional(),
      stage: z2.string().optional(),
      doctorId: z2.number().optional(),
      status: z2.enum(PATIENT_STATUSES).optional(),
      search: z2.string().optional()
    }).optional()
  ).query(async ({ input }) => {
    return listPatients(input);
  }),
  getById: adminProcedure.input(z2.object({ id: z2.number().int().positive().safe() })).query(async ({ ctx, input }) => {
    const patient = await getPatientById(input.id);
    if (!patient) {
      throw new TRPCError2({ code: "NOT_FOUND", message: "Patient not found" });
    }
    await logActivity(
      ctx.user.id,
      patient.id,
      "VIEW_PATIENT_PROFILE",
      { hrn: patient.hrn, name: `${patient.lastName}, ${patient.firstName}` },
      ctx.req.ip,
      ctx.req.headers["user-agent"]
    );
    let linkedRecipient = null;
    if (patient.linkedRecipientId) {
      linkedRecipient = await getPatientById(patient.linkedRecipientId);
    }
    let linkedDonors = [];
    if (patient.patientType === "Recipient") {
      const allPatients = await listPatients({ type: "Donor" });
      linkedDonors = allPatients.filter((p) => p.linkedRecipientId === patient.id);
    }
    return {
      patient,
      linkedRecipient,
      linkedDonors
    };
  }),
  create: adminProcedure.input(patientInputSchema).mutation(async ({ ctx, input }) => {
    validatePatientBusinessRules(input);
    const existingHrn = await getPatientByHrn(input.hrn);
    if (existingHrn) {
      throw new TRPCError2({ code: "CONFLICT", message: "A patient with this HRN already exists" });
    }
    const existingEmail = await getPatientByAccountEmail(input.accountEmail);
    if (existingEmail) {
      throw new TRPCError2({
        code: "CONFLICT",
        message: "A patient with this Gmail account is already enrolled"
      });
    }
    if (input.patientType === "Donor" && input.linkedRecipientId) {
      const recipient = await getPatientById(input.linkedRecipientId);
      if (!recipient || recipient.patientType !== "Recipient") {
        throw new TRPCError2({
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
    z2.object({
      id: z2.number().int().positive().safe(),
      data: patientInputSchema.partial()
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await getPatientById(input.id);
    if (!existing) {
      throw new TRPCError2({ code: "NOT_FOUND", message: "Patient not found" });
    }
    const merged = {
      ...existing,
      ...input.data
    };
    validatePatientBusinessRules(merged, input.id);
    if (input.data.hrn && input.data.hrn !== existing.hrn) {
      const dupHrn = await getPatientByHrn(input.data.hrn);
      if (dupHrn && dupHrn.id !== input.id) {
        throw new TRPCError2({ code: "CONFLICT", message: "A patient with this HRN already exists" });
      }
    }
    if (input.data.accountEmail && input.data.accountEmail.toLowerCase() !== existing.accountEmail.toLowerCase()) {
      const dupEmail = await getPatientByAccountEmail(input.data.accountEmail);
      if (dupEmail && dupEmail.id !== input.id) {
        throw new TRPCError2({
          code: "CONFLICT",
          message: "A patient with this Gmail account is already enrolled"
        });
      }
    }
    if (merged.patientType === "Donor" && merged.linkedRecipientId) {
      const recipient = await getPatientById(merged.linkedRecipientId);
      if (!recipient || recipient.patientType !== "Recipient") {
        throw new TRPCError2({
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
    z2.object({
      id: z2.number().int().positive().safe(),
      status: z2.enum(["Inactive", "Deceased", "Transferred"]),
      reason: z2.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await getPatientById(input.id);
    if (!existing) {
      throw new TRPCError2({ code: "NOT_FOUND", message: "Patient not found" });
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
  activityLogs: adminProcedure.input(z2.object({ patientId: z2.number().int().positive().safe(), limit: z2.number().optional() })).query(async ({ input }) => {
    return listActivityLogs(input.patientId, input.limit ?? 50);
  })
});

// server/routers/doctors.ts
init_db();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z3 } from "zod";
init_ktp();
var doctorsRouter = router({
  list: protectedProcedure.input(
    z3.object({
      role: z3.enum(DOCTOR_ROLES).optional(),
      activeOnly: z3.boolean().default(true)
    }).optional()
  ).query(async ({ input }) => {
    return listDoctors(input);
  }),
  getById: adminProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
    const doc = await getDoctorById(input.id);
    if (!doc) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "Doctor not found" });
    }
    return doc;
  }),
  create: adminProcedure.input(
    z3.object({
      name: z3.string().min(1, "Doctor name is required").max(128),
      role: z3.enum(DOCTOR_ROLES),
      active: z3.boolean().default(true)
    })
  ).mutation(async ({ input }) => {
    return createDoctor(input);
  }),
  update: adminProcedure.input(
    z3.object({
      id: z3.number(),
      name: z3.string().min(1).max(128).optional(),
      role: z3.enum(DOCTOR_ROLES).optional(),
      active: z3.boolean().optional()
    })
  ).mutation(async ({ input }) => {
    const { id, ...data } = input;
    const updated = await updateDoctor(id, data);
    if (!updated) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "Doctor not found" });
    }
    return updated;
  })
});

// server/routers/settings.ts
import { z as z4 } from "zod";
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
    z4.object({
      emergencyHotlineText: z4.string().max(1e3).optional(),
      consentNoticeText: z4.string().max(5e3).optional(),
      consentVersion: z4.number().int().min(1).optional(),
      appTitle: z4.string().max(128).optional(),
      orgName: z4.string().max(128).optional(),
      contactEmail: z4.string().email().or(z4.literal("")).optional()
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
    const patients2 = await listPatients();
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
import { z as z5 } from "zod";
init_db();
var notificationsRouter = router({
  myList: patientProcedure.query(async ({ ctx }) => {
    return listNotifications(ctx.patientId);
  }),
  myUnreadCount: patientProcedure.query(async ({ ctx }) => {
    return countUnreadNotifications(ctx.patientId);
  }),
  markMyRead: patientProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ ctx, input }) => {
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
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z6 } from "zod";
var patientPortalRouter = router({
  getMyProfile: patientProcedure.query(async ({ ctx }) => {
    const patient = await getPatientById(ctx.patientId);
    if (!patient) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Patient profile not found" });
    }
    let nephrologist = null;
    if (patient.nephrologistId) {
      nephrologist = await getDoctorById(patient.nephrologistId);
    }
    let fellow = null;
    if (patient.fellowId) {
      fellow = await getDoctorById(patient.fellowId);
    }
    let linkedRecipientName = null;
    if (patient.linkedRecipientId) {
      const recipient = await getPatientById(patient.linkedRecipientId);
      if (recipient) {
        linkedRecipientName = `${recipient.firstName} ${recipient.lastName}`;
      }
    }
    return {
      patient,
      nephrologist,
      fellow,
      linkedRecipientName
    };
  }),
  updateContact: patientProcedure.input(z6.object({ contactNumber: z6.string().max(32).nullable() })).mutation(async ({ ctx, input }) => {
    const updated = await updatePatient(ctx.patientId, {
      contactNumber: input.contactNumber
    });
    return updated;
  }),
  updatePhoto: patientProcedure.input(z6.object({ photoFileId: z6.number().nullable() })).mutation(async ({ ctx, input }) => {
    const updated = await updatePatient(ctx.patientId, {
      photoFileId: input.photoFileId
    });
    return updated;
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
      let patient = null;
      let consentRequired = false;
      if (!isAdmin) {
        patient = await getPatientByLinkedUserId(ctx.user.id);
        if (patient) {
          const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
          const patientEmail = (patient.accountEmail ?? "").trim().toLowerCase();
          if (userEmail !== patientEmail || patient.status !== "Active") {
            patient = null;
          } else {
            const currentConsent = await getSetting("consentVersion");
            const reqVersion = currentConsent ? parseInt(currentConsent, 10) : 1;
            consentRequired = (patient.consentVersion ?? 0) < reqVersion;
          }
        }
      }
      return {
        ...ctx.user,
        isAdmin,
        patient,
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
  patients: patientsRouter,
  doctors: doctorsRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  patientPortal: patientPortalRouter
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
