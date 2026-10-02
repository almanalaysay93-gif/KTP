import { LAB_CATALOG, CHECKLIST_CATALOG } from "./clinicalCatalog";
import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _sqliteDb: Database.Database | null = null;

export function getSqliteDb(): Database.Database {
  if (!_sqliteDb) {
    const DatabaseConstructor = require("better-sqlite3");
    const dbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, "data", "local.db");
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const instance: Database.Database = new DatabaseConstructor(dbPath);
    instance.pragma("journal_mode = WAL");
    initSchemaAndSeed(instance);
    _sqliteDb = instance;
  }
  return _sqliteDb!;
}

export function closeSqliteDb(): void {
  if (_sqliteDb) {
    try {
      _sqliteDb.close();
    } catch {
      // ignore
    }
    _sqliteDb = null;
  }
}

function initSchemaAndSeed(db: Database.Database) {
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

  // Seed settings if empty
  const settingCount = db.prepare("SELECT count(*) as count FROM appSettings").get() as { count: number };
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

  // Seed doctors if empty
  const docCount = db.prepare("SELECT count(*) as count FROM doctors").get() as { count: number };
  if (docCount.count === 0) {
    const insertDoc = db.prepare("INSERT INTO doctors (name, role, active) VALUES (?, ?, 1)");
    insertDoc.run("Dr. Maria Santos", "Nephrologist");
    insertDoc.run("Dr. Roberto Cruz", "Nephrologist");
    insertDoc.run("Dr. Juan Reyes", "Fellow");
    insertDoc.run("Dr. Ana Lim", "Fellow");
  }

  // Seed lab tests if empty
  const labCount = db.prepare("SELECT count(*) as count FROM labTests").get() as { count: number };
  if (labCount.count === 0) {
    const insertLab = db.prepare("INSERT INTO labTests (name, unit, sortOrder, active) VALUES (?, ?, ?, 1)");
    for (const [name, unit, sort] of LAB_CATALOG) {
      insertLab.run(name, unit, sort);
    }
  }

  // Seed checklist catalog if empty
  const checklistCount = db.prepare("SELECT count(*) as count FROM checklistCatalog").get() as { count: number };
  if (checklistCount.count === 0) {
    const insertChecklist = db.prepare(
      "INSERT INTO checklistCatalog (name, category, phase, appliesTo, asIndicated, sortOrder, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    );

    for (const [name, cat, phase, applies, asInd, sort] of CHECKLIST_CATALOG) {
      insertChecklist.run(name, cat, phase, applies, asInd, sort);
    }
  }

  // Seed default patient for alai12152201@gmail.com if not exists
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

