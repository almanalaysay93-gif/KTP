import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _sqliteDb: Database.Database | null = null;

export function getSqliteDb(): Database.Database {
  if (!_sqliteDb) {
    const dataDir = path.join(__dirname, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "local.db");
    _sqliteDb = new Database(dbPath);
    _sqliteDb.pragma("journal_mode = WAL");
    initSchemaAndSeed(_sqliteDb);
  }
  return _sqliteDb;
}

function initSchemaAndSeed(db: Database.Database) {
  // Create tables
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

    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      sortOrder INTEGER DEFAULT 99 NOT NULL,
      active INTEGER DEFAULT 1 NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nurses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId TEXT NOT NULL UNIQUE,
      firstName TEXT NOT NULL,
      middleName TEXT,
      lastName TEXT NOT NULL,
      suffix TEXT,
      position TEXT,
      staffType TEXT DEFAULT 'Registered Nurse' NOT NULL,
      dateHired TEXT,
      employmentStatus TEXT DEFAULT 'Active' NOT NULL,
      currentAreaId INTEGER,
      profilePhotoKey TEXT,
      contactNumber TEXT,
      accountEmail TEXT,
      linkedUserId INTEGER,
      archivedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS areaAssignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurseId INTEGER NOT NULL,
      areaId INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      assignmentType TEXT,
      remarks TEXT,
      isCurrent INTEGER DEFAULT 0 NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credentialTypes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      issuingOrganizationDefault TEXT,
      active INTEGER DEFAULT 1 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nurseCredentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurseId INTEGER NOT NULL,
      credentialTypeId INTEGER NOT NULL,
      licenseNumber TEXT,
      issuingOrganization TEXT,
      issueDate TEXT,
      expiryDate TEXT NOT NULL,
      renewalStatus TEXT DEFAULT 'Not Started' NOT NULL,
      verificationStatus TEXT DEFAULT 'Unverified' NOT NULL,
      documentKey TEXT,
      renewalCycleKey TEXT NOT NULL,
      remarks TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS licenseReminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credentialId INTEGER NOT NULL,
      thresholdDays INTEGER NOT NULL,
      renewalCycleKey TEXT NOT NULL,
      triggerDate TEXT NOT NULL,
      generatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      acknowledgedAt TEXT,
      status TEXT DEFAULT 'active' NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trainingCatalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      kind TEXT DEFAULT 'Training' NOT NULL,
      renewalRequired INTEGER DEFAULT 0 NOT NULL,
      defaultValidityMonths INTEGER,
      active INTEGER DEFAULT 1 NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trainingEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainingId INTEGER NOT NULL,
      provider TEXT,
      venue TEXT,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      targetStaffType TEXT DEFAULT 'All' NOT NULL,
      remarks TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS areaTrainingRequirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      areaId INTEGER NOT NULL,
      trainingId INTEGER NOT NULL,
      required INTEGER DEFAULT 1 NOT NULL,
      UNIQUE(areaId, trainingId)
    );

    CREATE TABLE IF NOT EXISTS nurseTrainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurseId INTEGER NOT NULL,
      trainingId INTEGER NOT NULL,
      eventId INTEGER,
      participationRole TEXT DEFAULT 'Participant' NOT NULL,
      provider TEXT,
      status TEXT DEFAULT 'Scheduled' NOT NULL,
      scheduledDate TEXT,
      completionDate TEXT,
      expiryDate TEXT,
      trainingHours INTEGER,
      cpdUnits INTEGER,
      certificateNumber TEXT,
      certificateKey TEXT,
      remarks TEXT,
      scheduleVersion INTEGER DEFAULT 1 NOT NULL,
      staffResponse TEXT DEFAULT 'Pending' NOT NULL,
      staffResponseReason TEXT,
      staffRespondedAt TEXT,
      staffResponseVersion INTEGER,
      attendanceOutcome TEXT DEFAULT 'not_recorded' NOT NULL,
      attendanceRecordedAt TEXT,
      attendanceRecordedBy INTEGER,
      attendanceNote TEXT,
      evidenceStatus TEXT DEFAULT 'None' NOT NULL,
      evidenceRequired INTEGER DEFAULT 0 NOT NULL,
      evidenceSubmittedAt TEXT,
      evidenceReviewedAt TEXT,
      evidenceReviewedBy INTEGER,
      evidenceReviewNote TEXT,
      conflictOverrideReason TEXT,
      conflictOverrideBy INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customCalendarEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      eventDate TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      allDay INTEGER DEFAULT 1 NOT NULL,
      nurseId INTEGER,
      areaId INTEGER,
      description TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      nurseId INTEGER,
      relatedEntityType TEXT,
      relatedEntityId INTEGER,
      readAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      dayKey TEXT
    );

    CREATE TABLE IF NOT EXISTS activityLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supervisorId INTEGER,
      nurseId INTEGER,
      actionType TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      summary TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS emailLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurseId INTEGER NOT NULL,
      recipientEmail TEXT NOT NULL,
      emailType TEXT NOT NULL,
      referenceId INTEGER,
      thresholdKey TEXT,
      subject TEXT NOT NULL,
      status TEXT DEFAULT 'sent' NOT NULL,
      errorMessage TEXT,
      sentAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staffMessages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderUserId INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      revision INTEGER DEFAULT 1 NOT NULL,
      archivedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staffMessageRecipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      nurseId INTEGER NOT NULL,
      readAt TEXT,
      lastReadRevision INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(messageId, nurseId)
    );

    CREATE TABLE IF NOT EXISTS staffMessageAcknowledgments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      nurseId INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      acknowledgedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(messageId, nurseId, revision)
    );

    CREATE TABLE IF NOT EXISTS trainingOutbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignmentId INTEGER NOT NULL,
      scheduleVersion INTEGER NOT NULL,
      noticeKind TEXT NOT NULL,
      thresholdDays INTEGER,
      dueDate TEXT,
      recipientNurseId INTEGER NOT NULL,
      recipientEmail TEXT,
      status TEXT DEFAULT 'pending' NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      lastAttemptAt TEXT,
      claimedAt TEXT,
      providerMessageId TEXT,
      errorDetail TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(assignmentId, scheduleVersion, noticeKind)
    );

    CREATE TABLE IF NOT EXISTS trainingActivity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurseId INTEGER NOT NULL,
      assignmentId INTEGER NOT NULL,
      activityType TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      readAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storedFiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  // Migrate existing SQLite schema if missing newly added columns
  const cols = db.prepare("PRAGMA table_info(nurses)").all() as { name: string }[];
  const colSet = new Set(cols.map((c) => c.name));
  if (!colSet.has("contactNumber")) db.exec("ALTER TABLE nurses ADD COLUMN contactNumber TEXT");
  if (!colSet.has("accountEmail")) db.exec("ALTER TABLE nurses ADD COLUMN accountEmail TEXT");
  if (!colSet.has("linkedUserId")) db.exec("ALTER TABLE nurses ADD COLUMN linkedUserId INTEGER");

  const ntCols = db.prepare("PRAGMA table_info(nurseTrainings)").all() as { name: string }[];
  const ntColSet = new Set(ntCols.map((c) => c.name));
  if (!ntColSet.has("scheduleVersion")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN scheduleVersion INTEGER DEFAULT 1 NOT NULL");
  if (!ntColSet.has("staffResponse")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN staffResponse TEXT DEFAULT 'Pending' NOT NULL");
  if (!ntColSet.has("staffResponseReason")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN staffResponseReason TEXT");
  if (!ntColSet.has("staffRespondedAt")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN staffRespondedAt TEXT");
  if (!ntColSet.has("staffResponseVersion")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN staffResponseVersion INTEGER");
  if (!ntColSet.has("attendanceOutcome")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN attendanceOutcome TEXT DEFAULT 'Not recorded' NOT NULL");
  if (!ntColSet.has("attendanceRecordedAt")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN attendanceRecordedAt TEXT");
  if (!ntColSet.has("attendanceRecordedBy")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN attendanceRecordedBy INTEGER");
  if (!ntColSet.has("attendanceNote")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN attendanceNote TEXT");
  if (!ntColSet.has("evidenceStatus")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceStatus TEXT DEFAULT 'None' NOT NULL");
  if (!ntColSet.has("evidenceRequired")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceRequired INTEGER DEFAULT 0 NOT NULL");
  if (!ntColSet.has("evidenceSubmittedAt")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceSubmittedAt TEXT");
  if (!ntColSet.has("evidenceReviewedAt")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceReviewedAt TEXT");
  if (!ntColSet.has("evidenceReviewedBy")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceReviewedBy INTEGER");
  if (!ntColSet.has("evidenceReviewNote")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN evidenceReviewNote TEXT");
  if (!ntColSet.has("conflictOverrideReason")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN conflictOverrideReason TEXT");
  if (!ntColSet.has("conflictOverrideBy")) db.exec("ALTER TABLE nurseTrainings ADD COLUMN conflictOverrideBy INTEGER");

  // Check if data already seeded
  const countRow = db.prepare("SELECT count(*) as cnt FROM nurses").get() as { cnt: number };
  if (countRow.cnt === 0) {
    seedFromSeedJson(db);
  }
}

export function seedFromSeedJson(db: Database.Database) {
  const seedPath = path.join(__dirname, "data", "seedData.json");
  if (!fs.existsSync(seedPath)) {
    console.warn(`[LocalDB] Seed file not found at ${seedPath}`);
    return;
  }
  const raw = fs.readFileSync(seedPath, "utf-8");
  const data = JSON.parse(raw);

  console.log(`[LocalDB] Auto-populating SQLite with ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} seminar events...`);

  // 1. Credential types
  const insCredType = db.prepare("INSERT OR IGNORE INTO credentialTypes (id, name, issuingOrganizationDefault, active) VALUES (?, ?, ?, 1)");
  insCredType.run(1, "PRC Registered Nurse License", "Professional Regulation Commission (PRC)");
  insCredType.run(2, "TESDA NC II / PRC Attendant Certification", "TESDA / SPMC");

  // 2. Areas
  const insArea = db.prepare("INSERT OR REPLACE INTO areas (code, name, description, sortOrder, active) VALUES (?, ?, ?, ?, 1)");
  for (const a of data.areas) {
    insArea.run(a.code, a.name, a.description, a.sortOrder);
  }

  const allAreas = db.prepare("SELECT id, code FROM areas").all() as { id: number; code: string }[];
  const areaIdByCode = new Map(allAreas.map((a) => [a.code, a.id]));

  // 3. Training catalog (case-insensitive dedup — source data has mixed-case
  // duplicates of the same training from different Excel sheets/years).
  const insCat = db.prepare("INSERT OR REPLACE INTO trainingCatalog (name, category, kind, renewalRequired, defaultValidityMonths, active) VALUES (?, ?, ?, ?, ?, 1)");
  const seenCatalogNames = new Set<string>();
  for (const c of data.trainingCatalog) {
    const key = c.name.trim().toLowerCase();
    if (seenCatalogNames.has(key)) continue;
    seenCatalogNames.add(key);
    insCat.run(c.name, c.category, c.kind, c.renewalRequired ? 1 : 0, c.defaultValidityMonths ?? null);
  }

  const allCat = db.prepare("SELECT id, name FROM trainingCatalog").all() as { id: number; name: string }[];
  const catIdByName = new Map(allCat.map((c) => [c.name.trim().toLowerCase(), c.id]));

  // 4. Staff & Credentials
  const insNurse = db.prepare(`
    INSERT OR REPLACE INTO nurses (employeeId, firstName, middleName, lastName, suffix, position, staffType, employmentStatus, currentAreaId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insAsgn = db.prepare(`
    INSERT INTO areaAssignments (nurseId, areaId, startDate, assignmentType, remarks, isCurrent)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insCred = db.prepare(`
    INSERT OR REPLACE INTO nurseCredentials (nurseId, credentialTypeId, licenseNumber, issuingOrganization, issueDate, expiryDate, renewalStatus, verificationStatus, renewalCycleKey, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const nurseIdByNormName = new Map<string, number>();
  const nurseIdByEmployeeId = new Map<string, number>();

  const insertStaffTx = db.transaction((staffList: any[]) => {
    for (const person of staffList) {
      const areaId = areaIdByCode.get(person.currentAreaCode) ?? allAreas[0]?.id ?? 1;
      const isCurrentlyAssigned = person.employmentStatus === "Active";
      const res = insNurse.run(
        person.employeeId,
        person.nameInfo.firstName || person.nameInfo.lastName,
        person.nameInfo.middleName ?? null,
        person.nameInfo.lastName,
        person.nameInfo.suffix ?? null,
        person.position,
        person.staffType,
        person.employmentStatus,
        isCurrentlyAssigned ? areaId : null
      );
      const nurseId = Number(res.lastInsertRowid);

      const normKey = `${person.nameInfo.lastName.toUpperCase()}, ${person.nameInfo.firstName.toUpperCase()}`;
      nurseIdByEmployeeId.set(person.employeeId, nurseId);
      nurseIdByNormName.set(normKey, nurseId);
      nurseIdByNormName.set(person.nameInfo.lastName.toUpperCase(), nurseId);

      insAsgn.run(
        nurseId,
        areaId,
        "2026-01-01",
        person.employmentStatus === "Rotated" ? "Rotation" : "Permanent Transfer",
        person.historyNotes || "Initial Assignment",
        isCurrentlyAssigned ? 1 : 0
      );

      if (person.licenseExpiry) {
        const credTypeId = person.staffType === "Registered Nurse" ? 1 : 2;
        const cycleKey = `${nurseId}-${person.licenseExpiry}`;
        insCred.run(
          nurseId,
          credTypeId,
          person.licenseNumber ?? null,
          person.staffType === "Registered Nurse" ? "PRC" : "TESDA / SPMC",
          "2023-01-01",
          person.licenseExpiry,
          "Not Started",
          "Verified",
          cycleKey,
          person.historyNotes ?? null
        );
      }
    }
  });

  insertStaffTx(data.staff);

  // 5. Events & Attendances
  const insEvent = db.prepare(`
    INSERT INTO trainingEvents (trainingId, provider, venue, startDate, endDate, targetStaffType, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insAttend = db.prepare(`
    INSERT INTO nurseTrainings (nurseId, trainingId, eventId, participationRole, provider, status, scheduledDate, completionDate, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalAttendances = 0;
  // The workbook lists attendees who are not in the seed roster (staff from
  // later imports). Skip them: a local dev seed must not fail on them.
  const unresolvedAttendees = new Set<string>();
  const insertEventsTx = db.transaction((eventsList: any[]) => {
    for (const ev of eventsList) {
      const catId = catIdByName.get(ev.title.trim().toLowerCase());
      if (!catId) continue;

      const evRes = insEvent.run(
        catId,
        ev.provider,
        ev.venue,
        ev.startDate,
        ev.endDate,
        "All",
        `Conducted by ${ev.provider}`
      );
      const eventId = Number(evRes.lastInsertRowid);

      for (const att of ev.attendees) {
        const nurseId = nurseIdByEmployeeId.get(att.employeeId) ?? nurseIdByNormName.get(att.normName);
        if (!nurseId) {
          unresolvedAttendees.add(String(att.staffName));
          continue;
        }

        insAttend.run(
          nurseId,
          catId,
          eventId,
          att.role || "Participant",
          ev.provider,
          "Completed",
          ev.startDate,
          att.completionDate,
          `Attended ${ev.title}`
        );
        totalAttendances++;
      }
    }
  });

  insertEventsTx(data.events);
  if (unresolvedAttendees.size > 0) {
    console.warn(`[LocalDB] Seed skipped attendances for ${unresolvedAttendees.size} people who are not in the seed roster.`);
  }

  // Initial Activity Log
  db.prepare("INSERT INTO activityLog (actionType, summary) VALUES (?, ?)").run(
    "system.seed.excel",
    `Auto-populated NN LDI Database Summary: ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} events, ${totalAttendances} attendances.`
  );

  console.log(`[LocalDB] Seed completed successfully! ${data.staff.length} staff, ${totalAttendances} attendance records ready.`);
}
