var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/const.ts
var COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG, OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_PLAIN, CLAIM_COOKIE_NAME, CLAIM_TTL_MS, decodeOAuthState;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "app_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    AXIOS_TIMEOUT_MS = 3e4;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
    OAUTH_STATE_COOKIE = "__Host-oauth_state";
    OAUTH_STATE_COOKIE_PLAIN = "oauth_state";
    CLAIM_COOKIE_NAME = "staff_claim_session";
    CLAIM_TTL_MS = 1e3 * 60 * 30;
    decodeOAuthState = (state) => {
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
  }
});

// shared/nursetrack.ts
function dateKey(value) {
  if (value === null || value === void 0) return "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}
function daysUntilExpiry(expiryDate, today = todayDate()) {
  if (!expiryDate) return -1;
  const expiry = parseLocalDate(expiryDate);
  const todayMs = parseLocalDate(today).getTime();
  return Math.floor((expiry.getTime() - todayMs) / 864e5);
}
function todayDate() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseLocalDate(value) {
  if (!value) return /* @__PURE__ */ new Date(NaN);
  const key = dateKey(value);
  if (key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? /* @__PURE__ */ new Date(NaN) : value;
  return new Date(value);
}
function deriveLicenseStatus(expiryDate, today = todayDate()) {
  const days = daysUntilExpiry(expiryDate, today);
  if (days < 0) return "Expired";
  if (days <= 180) return "Within 6 Months";
  if (days <= 365) return "Within 1 Year";
  return "Valid";
}
function renewalCycleKey(credentialId) {
  return `credential-${credentialId}`;
}
function daysBetween(start, end, today = todayDate()) {
  if (!start) return 0;
  const s = parseLocalDate(start).getTime();
  const e = end ? parseLocalDate(end).getTime() : parseLocalDate(today).getTime();
  if (e < s) return 0;
  return Math.floor((e - s) / 864e5);
}
function trainingCompliance(params) {
  const { requiredTrainingIds, nurseTrainingRecords, today = todayDate() } = params;
  if (requiredTrainingIds.length === 0) return 100;
  let satisfied = 0;
  for (const tid of requiredTrainingIds) {
    const records = nurseTrainingRecords.filter((r) => r.trainingId === tid && r.status === "Completed");
    if (records.length === 0) continue;
    const hasValid = records.some((r) => {
      if (!r.expiryDate) return true;
      return daysUntilExpiry(r.expiryDate, today) > 0;
    });
    if (hasValid) satisfied++;
  }
  return Math.round(satisfied / requiredTrainingIds.length * 100);
}
function nurseFullName(n) {
  const parts = [n.firstName];
  if (n.middleName) parts.push(n.middleName);
  parts.push(n.lastName);
  if (n.suffix) parts.push(n.suffix);
  return parts.join(" ");
}
function validateMime(mime, kind, fileName) {
  let effectiveMime = (mime || "").toLowerCase().trim();
  if (!effectiveMime || effectiveMime === "application/octet-stream") {
    if (fileName) {
      const ext = fileName.split(".").pop()?.toLowerCase();
      if (ext === "jpg" || ext === "jpeg") effectiveMime = "image/jpeg";
      else if (ext === "png") effectiveMime = "image/png";
      else if (ext === "webp") effectiveMime = "image/webp";
      else if (ext === "gif") effectiveMime = "image/gif";
      else if (ext === "heic" || ext === "heif") effectiveMime = "image/heic";
      else if (ext === "pdf") effectiveMime = "application/pdf";
      else if (ext === "csv") effectiveMime = "text/csv";
      else if (ext === "xlsx" || ext === "xls")
        effectiveMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (ext === "docx")
        effectiveMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  }
  if (!effectiveMime) return { ok: false, error: "File type could not be detected." };
  const allowed = kind === "photo" ? ALLOWED_PHOTO_MIMES : kind === "document" ? ALLOWED_DOCUMENT_MIMES : ALLOWED_SMART_IMPORT_MIMES;
  if (!allowed.includes(effectiveMime)) {
    return {
      ok: false,
      error: kind === "smartImport" ? "File type not supported. Use JPG, PNG, WEBP, PDF, TXT, CSV, XLS, XLSX or DOCX." : "File type not supported. Use JPG, PNG, WEBP" + (kind === "document" ? " or PDF" : "") + "."
    };
  }
  return { ok: true };
}
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}
function storageKey(bucket, nurseId, name) {
  const safe = sanitizeFilename(name);
  const ts = Date.now();
  return `nursetrack/${bucket}/nurse-${nurseId}-${ts}-${safe}`;
}
var ASSIGNMENT_TYPES, EMPLOYMENT_STATUSES, INACTIVE_EMPLOYMENT_STATUSES, STAFF_TYPES, TRAINING_KINDS, PARTICIPATION_ROLES, TARGET_STAFF_TYPES, RENEWAL_STATUSES, VERIFICATION_STATUSES, TRAINING_STATUSES, ALLOWED_PHOTO_MIMES, ALLOWED_DOCUMENT_MIMES, ALLOWED_SMART_IMPORT_MIMES, MAX_FILE_BYTES, MEMO_TYPES;
var init_nursetrack = __esm({
  "shared/nursetrack.ts"() {
    "use strict";
    ASSIGNMENT_TYPES = [
      "Permanent Transfer",
      "Temporary Assignment",
      "Rotation",
      "Training Exposure",
      "Return to Previous Area",
      "Other"
    ];
    EMPLOYMENT_STATUSES = [
      "Active",
      "On Leave",
      "Temporary Assignment",
      "Transferred",
      "Rotated",
      "Resigned",
      "Retired",
      "Archived"
    ];
    INACTIVE_EMPLOYMENT_STATUSES = ["Archived", "Resigned", "Retired"];
    STAFF_TYPES = ["Registered Nurse", "Nursing Attendant"];
    TRAINING_KINDS = ["Training", "Seminar", "LDI"];
    PARTICIPATION_ROLES = ["Participant", "Speaker", "Facilitator", "Preceptor"];
    TARGET_STAFF_TYPES = ["All", ...STAFF_TYPES];
    RENEWAL_STATUSES = ["Not Started", "Renewal In Progress", "Submitted", "Renewed"];
    VERIFICATION_STATUSES = ["Unverified", "Pending Verification", "Verified"];
    TRAINING_STATUSES = ["Scheduled", "Completed", "Expired", "Cancelled"];
    ALLOWED_PHOTO_MIMES = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif"
    ];
    ALLOWED_DOCUMENT_MIMES = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    ALLOWED_SMART_IMPORT_MIMES = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    MAX_FILE_BYTES = 10 * 1024 * 1024;
    MEMO_TYPES = ["department", "nursing", "hospital"];
  }
});

// drizzle/schema.ts
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
  varchar
} from "drizzle-orm/pg-core";
var nursetrack, pgTable, touchedOnUpdate, date, users, areas, nurses, areaAssignments, credentialTypes, nurseCredentials, licenseReminders, trainingCatalog, trainingEvents, areaTrainingRequirements, nurseTrainings, customCalendarEvents, notifications, activityLog, appSettings, emailLogs, staffMessages, staffMessageRecipients, staffMessageAcknowledgments, trainingOutbox, trainingActivity, storedFiles, memos, memoRecipients;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    nursetrack = pgSchema("nursetrack");
    pgTable = nursetrack.table;
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
    areas = pgTable("areas", {
      id: serial("id").primaryKey(),
      code: varchar("code", { length: 64 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull().unique(),
      description: text("description"),
      sortOrder: integer("sortOrder").default(99).notNull(),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    nurses = pgTable(
      "nurses",
      {
        id: serial("id").primaryKey(),
        employeeId: varchar("employeeId", { length: 64 }).notNull().unique(),
        firstName: varchar("firstName", { length: 128 }).notNull(),
        middleName: varchar("middleName", { length: 128 }),
        lastName: varchar("lastName", { length: 128 }).notNull(),
        suffix: varchar("suffix", { length: 32 }),
        position: varchar("position", { length: 128 }),
        staffType: varchar("staffType", { length: 32, enum: ["Registered Nurse", "Nursing Attendant"] }).default("Registered Nurse").notNull(),
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
            "Archived"
          ]
        }).default("Active").notNull(),
        currentAreaId: integer("currentAreaId"),
        profilePhotoKey: text("profilePhotoKey"),
        contactNumber: varchar("contactNumber", { length: 32 }),
        /** Google account email used to self-link this nurse's staff self-service login. Not the HR record of truth — just the login identity. */
        accountEmail: varchar("accountEmail", { length: 320 }),
        /** users.id of the linked Google account, once the staff member has linked (via supervisor pre-fill or self-link by PRC number + name). Null = not linked yet. */
        linkedUserId: integer("linkedUserId"),
        archivedAt: timestamp("archivedAt"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [
        uniqueIndex("idx_nurses_employee").on(t2.employeeId),
        index("idx_nurses_lastname").on(t2.lastName),
        index("idx_nurses_area").on(t2.currentAreaId),
        uniqueIndex("idx_nurses_linked_user").on(t2.linkedUserId),
        // Case-insensitive: `accountEmail` is the staff sign-in identity, so
        // "Nurse@x.com" and "nurse@x.com" must not both be claimable.
        uniqueIndex("idx_nurses_account_email").on(sql`lower(${t2.accountEmail})`)
      ]
    );
    areaAssignments = pgTable(
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
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_asgn_nurse").on(t2.nurseId), index("idx_asgn_area").on(t2.areaId)]
    );
    credentialTypes = pgTable("credentialTypes", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 128 }).notNull().unique(),
      issuingOrganizationDefault: text("issuingOrganizationDefault"),
      active: boolean("active").default(true).notNull()
    });
    nurseCredentials = pgTable(
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
          enum: ["Not Started", "Renewal In Progress", "Submitted", "Renewed"]
        }).default("Not Started").notNull(),
        verificationStatus: varchar("verificationStatus", {
          length: 32,
          enum: ["Unverified", "Pending Verification", "Verified"]
        }).default("Unverified").notNull(),
        documentKey: text("documentKey"),
        renewalCycleKey: varchar("renewalCycleKey", { length: 128 }).notNull(),
        remarks: text("remarks"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_cred_nurse").on(t2.nurseId), index("idx_cred_expiry").on(t2.expiryDate)]
    );
    licenseReminders = pgTable(
      "licenseReminders",
      {
        id: serial("id").primaryKey(),
        credentialId: integer("credentialId").notNull(),
        thresholdDays: integer("thresholdDays").notNull(),
        renewalCycleKey: varchar("renewalCycleKey", { length: 128 }).notNull(),
        triggerDate: date("triggerDate", { mode: "date" }).notNull(),
        generatedAt: timestamp("generatedAt").defaultNow().notNull(),
        acknowledgedAt: timestamp("acknowledgedAt"),
        status: varchar("status", { length: 16, enum: ["active", "acknowledged", "expired"] }).default("active").notNull()
      },
      (t2) => [uniqueIndex("uniq_reminder_cycle").on(t2.credentialId, t2.thresholdDays, t2.renewalCycleKey)]
    );
    trainingCatalog = pgTable("trainingCatalog", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 128 }).notNull().unique(),
      category: varchar("category", { length: 64 }),
      kind: varchar("kind", { length: 16, enum: ["Training", "Seminar", "LDI"] }).default("Training").notNull(),
      renewalRequired: boolean("renewalRequired").default(false).notNull(),
      defaultValidityMonths: integer("defaultValidityMonths"),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
    });
    trainingEvents = pgTable(
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
          enum: ["All", "Registered Nurse", "Nursing Attendant"]
        }).default("All").notNull(),
        remarks: text("remarks"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_training_event_date").on(t2.trainingId, t2.startDate)]
    );
    areaTrainingRequirements = pgTable(
      "areaTrainingRequirements",
      {
        id: serial("id").primaryKey(),
        areaId: integer("areaId").notNull(),
        trainingId: integer("trainingId").notNull(),
        required: boolean("required").default(true).notNull()
      },
      (t2) => [uniqueIndex("uniq_area_training_req").on(t2.areaId, t2.trainingId)]
    );
    nurseTrainings = pgTable(
      "nurseTrainings",
      {
        id: serial("id").primaryKey(),
        nurseId: integer("nurseId").notNull(),
        trainingId: integer("trainingId").notNull(),
        eventId: integer("eventId"),
        participationRole: varchar("participationRole", {
          length: 32,
          enum: ["Participant", "Speaker", "Facilitator", "Preceptor"]
        }).default("Participant").notNull(),
        provider: varchar("provider", { length: 128 }),
        status: varchar("status", { length: 16, enum: ["Scheduled", "Completed", "Expired", "Cancelled"] }).default("Scheduled").notNull(),
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
          enum: ["Pending", "Confirmed", "Cannot attend"]
        }).default("Pending").notNull(),
        staffResponseReason: text("staffResponseReason"),
        staffRespondedAt: timestamp("staffRespondedAt"),
        staffResponseVersion: integer("staffResponseVersion"),
        attendanceOutcome: varchar("attendanceOutcome", {
          length: 32,
          enum: ["Not recorded", "Attended", "Missed", "Excused"]
        }).default("Not recorded").notNull(),
        attendanceRecordedAt: timestamp("attendanceRecordedAt"),
        attendanceRecordedBy: integer("attendanceRecordedBy"),
        attendanceNote: text("attendanceNote"),
        evidenceStatus: varchar("evidenceStatus", {
          length: 32,
          enum: ["None", "Submitted", "Verified", "Rejected"]
        }).default("None").notNull(),
        evidenceRequired: boolean("evidenceRequired").default(false).notNull(),
        evidenceSubmittedAt: timestamp("evidenceSubmittedAt"),
        evidenceReviewedAt: timestamp("evidenceReviewedAt"),
        evidenceReviewedBy: integer("evidenceReviewedBy"),
        evidenceReviewNote: text("evidenceReviewNote"),
        conflictOverrideReason: text("conflictOverrideReason"),
        conflictOverrideBy: integer("conflictOverrideBy"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [
        index("idx_nt_nurse").on(t2.nurseId),
        index("idx_nt_training").on(t2.trainingId),
        index("idx_nt_event").on(t2.eventId),
        uniqueIndex("uniq_nt_event_nurse").on(t2.eventId, t2.nurseId),
        index("idx_nt_expiry").on(t2.expiryDate)
      ]
    );
    customCalendarEvents = pgTable(
      "customCalendarEvents",
      {
        id: serial("id").primaryKey(),
        title: varchar("title", { length: 256 }).notNull(),
        eventDate: date("eventDate", { mode: "date" }).notNull(),
        startTime: varchar("startTime", { length: 8 }),
        // HH:mm
        endTime: varchar("endTime", { length: 8 }),
        allDay: boolean("allDay").default(true).notNull(),
        nurseId: integer("nurseId"),
        areaId: integer("areaId"),
        description: text("description"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_cce_date").on(t2.eventDate)]
    );
    notifications = pgTable(
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
        dayKey: date("dayKey", { mode: "date" })
      },
      (t2) => [
        index("idx_notif_read").on(t2.readAt),
        uniqueIndex("uniq_notif_day").on(t2.type, t2.nurseId, t2.relatedEntityType, t2.relatedEntityId, t2.dayKey)
      ]
    );
    activityLog = pgTable(
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
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("idx_activity_nurse").on(t2.nurseId)]
    );
    appSettings = pgTable("appSettings", {
      id: serial("id").primaryKey(),
      key: varchar("key", { length: 64 }).notNull().unique(),
      value: text("value")
    });
    emailLogs = pgTable(
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
        sentAt: timestamp("sentAt").defaultNow().notNull()
      },
      (t2) => [index("idx_email_nurse").on(t2.nurseId), index("idx_email_typeref").on(t2.emailType, t2.referenceId)]
    );
    staffMessages = pgTable(
      "staffMessages",
      {
        id: serial("id").primaryKey(),
        senderUserId: integer("senderUserId").notNull(),
        title: varchar("title", { length: 160 }).notNull(),
        body: text("body").notNull(),
        revision: integer("revision").default(1).notNull(),
        archivedAt: timestamp("archivedAt"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_msg_created").on(t2.createdAt)]
    );
    staffMessageRecipients = pgTable(
      "staffMessageRecipients",
      {
        id: serial("id").primaryKey(),
        messageId: integer("messageId").notNull(),
        nurseId: integer("nurseId").notNull(),
        readAt: timestamp("readAt"),
        lastReadRevision: integer("lastReadRevision"),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [
        uniqueIndex("uniq_msg_recipient").on(t2.messageId, t2.nurseId),
        index("idx_msg_recip_nurse").on(t2.nurseId)
      ]
    );
    staffMessageAcknowledgments = pgTable(
      "staffMessageAcknowledgments",
      {
        id: serial("id").primaryKey(),
        messageId: integer("messageId").notNull(),
        nurseId: integer("nurseId").notNull(),
        revision: integer("revision").notNull(),
        acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull()
      },
      (t2) => [
        uniqueIndex("uniq_msg_ack").on(t2.messageId, t2.nurseId, t2.revision),
        index("idx_msg_ack_nurse").on(t2.nurseId)
      ]
    );
    trainingOutbox = pgTable(
      "trainingOutbox",
      {
        id: serial("id").primaryKey(),
        assignmentId: integer("assignmentId").notNull(),
        scheduleVersion: integer("scheduleVersion").notNull(),
        noticeKind: varchar("noticeKind", { length: 32 }).notNull(),
        // assignment, reschedule, cancellation, reminder_14d, reminder_7d, reminder_1d, combined_due
        thresholdDays: integer("thresholdDays"),
        // 14, 7, 1, or null
        dueDate: date("dueDate", { mode: "date" }),
        recipientNurseId: integer("recipientNurseId").notNull(),
        recipientEmail: varchar("recipientEmail", { length: 320 }),
        status: varchar("status", { length: 32 }).default("pending").notNull(),
        // pending, claimed, sent, mock_sent, failed, skipped, superseded
        attempts: integer("attempts").default(0).notNull(),
        lastAttemptAt: timestamp("lastAttemptAt"),
        claimedAt: timestamp("claimedAt"),
        providerMessageId: text("providerMessageId"),
        errorDetail: text("errorDetail"),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [
        index("idx_outbox_status_due").on(t2.status, t2.dueDate),
        index("idx_outbox_assignment").on(t2.assignmentId, t2.scheduleVersion),
        uniqueIndex("uniq_outbox_milestone").on(t2.assignmentId, t2.scheduleVersion, t2.noticeKind)
      ]
    );
    trainingActivity = pgTable(
      "trainingActivity",
      {
        id: serial("id").primaryKey(),
        nurseId: integer("nurseId").notNull(),
        assignmentId: integer("assignmentId").notNull(),
        activityType: varchar("activityType", { length: 32 }).notNull(),
        title: varchar("title", { length: 256 }).notNull(),
        message: text("message"),
        readAt: timestamp("readAt"),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [index("idx_tact_nurse").on(t2.nurseId), index("idx_tact_assignment").on(t2.assignmentId)]
    );
    storedFiles = pgTable(
      "storedFiles",
      {
        id: serial("id").primaryKey(),
        key: varchar("key", { length: 512 }).notNull().unique(),
        data: text("data").notNull(),
        mimeType: varchar("mimeType", { length: 128 }).notNull(),
        fileSize: integer("fileSize").notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull()
      },
      (t2) => [uniqueIndex("uniq_stored_file_key").on(t2.key)]
    );
    memos = pgTable(
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
        updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(touchedOnUpdate).notNull()
      },
      (t2) => [index("idx_memos_sent").on(t2.sentAt), index("idx_memos_type").on(t2.memoType)]
    );
    memoRecipients = pgTable(
      "memoRecipients",
      {
        id: serial("id").primaryKey(),
        memoId: integer("memoId").notNull(),
        nurseId: integer("nurseId").notNull(),
        linkedAtSend: boolean("linkedAtSend").default(false).notNull(),
        readAt: timestamp("readAt")
      },
      (t2) => [
        uniqueIndex("uniq_memo_nurse").on(t2.memoId, t2.nurseId),
        index("idx_memo_rcp_nurse").on(t2.nurseId),
        index("idx_memo_rcp_memo").on(t2.memoId)
      ]
    );
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
      "almanalaysay93@gmail.com"
    ];
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
    const dataDir = path.join(__dirname, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "local.db");
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

    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memoType TEXT NOT NULL,
      areaId INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      authorUserId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      sentAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      retractedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memoRecipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memoId INTEGER NOT NULL,
      nurseId INTEGER NOT NULL,
      linkedAtSend INTEGER NOT NULL DEFAULT 0,
      readAt TEXT
    );
  `);
  const cols = db.prepare("PRAGMA table_info(nurses)").all();
  const colSet = new Set(cols.map((c) => c.name));
  if (!colSet.has("contactNumber")) db.exec("ALTER TABLE nurses ADD COLUMN contactNumber TEXT");
  if (!colSet.has("accountEmail")) db.exec("ALTER TABLE nurses ADD COLUMN accountEmail TEXT");
  if (!colSet.has("linkedUserId")) db.exec("ALTER TABLE nurses ADD COLUMN linkedUserId INTEGER");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_memo_nurse ON memoRecipients(memoId, nurseId);
    CREATE INDEX IF NOT EXISTS idx_memo_rcp_nurse ON memoRecipients(nurseId);
    CREATE INDEX IF NOT EXISTS idx_memo_rcp_memo ON memoRecipients(memoId);
    CREATE INDEX IF NOT EXISTS idx_memos_sent ON memos(sentAt);
  `);
  const ntCols = db.prepare("PRAGMA table_info(nurseTrainings)").all();
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
  const countRow = db.prepare("SELECT count(*) as cnt FROM nurses").get();
  if (countRow.cnt === 0) {
    seedFromSeedJson(db);
  }
}
function seedFromSeedJson(db) {
  const seedPath = path.join(__dirname, "data", "seedData.json");
  if (!fs.existsSync(seedPath)) {
    console.warn(`[LocalDB] Seed file not found at ${seedPath}`);
    return;
  }
  const raw = fs.readFileSync(seedPath, "utf-8");
  const data = JSON.parse(raw);
  console.log(`[LocalDB] Auto-populating SQLite with ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} seminar events...`);
  const insCredType = db.prepare("INSERT OR IGNORE INTO credentialTypes (id, name, issuingOrganizationDefault, active) VALUES (?, ?, ?, 1)");
  insCredType.run(1, "PRC Registered Nurse License", "Professional Regulation Commission (PRC)");
  insCredType.run(2, "TESDA NC II / PRC Attendant Certification", "TESDA / SPMC");
  const insArea = db.prepare("INSERT OR REPLACE INTO areas (code, name, description, sortOrder, active) VALUES (?, ?, ?, ?, 1)");
  for (const a of data.areas) {
    insArea.run(a.code, a.name, a.description, a.sortOrder);
  }
  const allAreas = db.prepare("SELECT id, code FROM areas").all();
  const areaIdByCode = new Map(allAreas.map((a) => [a.code, a.id]));
  const insCat = db.prepare("INSERT OR REPLACE INTO trainingCatalog (name, category, kind, renewalRequired, defaultValidityMonths, active) VALUES (?, ?, ?, ?, ?, 1)");
  const seenCatalogNames = /* @__PURE__ */ new Set();
  for (const c of data.trainingCatalog) {
    const key = c.name.trim().toLowerCase();
    if (seenCatalogNames.has(key)) continue;
    seenCatalogNames.add(key);
    insCat.run(c.name, c.category, c.kind, c.renewalRequired ? 1 : 0, c.defaultValidityMonths ?? null);
  }
  const allCat = db.prepare("SELECT id, name FROM trainingCatalog").all();
  const catIdByName = new Map(allCat.map((c) => [c.name.trim().toLowerCase(), c.id]));
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
  const nurseIdByNormName = /* @__PURE__ */ new Map();
  const nurseIdByEmployeeId = /* @__PURE__ */ new Map();
  const insertStaffTx = db.transaction((staffList) => {
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
  const insEvent = db.prepare(`
    INSERT INTO trainingEvents (trainingId, provider, venue, startDate, endDate, targetStaffType, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insAttend = db.prepare(`
    INSERT INTO nurseTrainings (nurseId, trainingId, eventId, participationRole, provider, status, scheduledDate, completionDate, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let totalAttendances = 0;
  const unresolvedAttendees = /* @__PURE__ */ new Set();
  const insertEventsTx = db.transaction((eventsList) => {
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
  db.prepare("INSERT INTO activityLog (actionType, summary) VALUES (?, ?)").run(
    "system.seed.excel",
    `Auto-populated NN LDI Database Summary: ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} events, ${totalAttendances} attendances.`
  );
  console.log(`[LocalDB] Seed completed successfully! ${data.staff.length} staff, ${totalAttendances} attendance records ready.`);
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

// server/db.ts
var db_exports = {};
__export(db_exports, {
  INACTIVE_STATUS_SQL_LIST: () => INACTIVE_STATUS_SQL_LIST,
  acknowledgeReminder: () => acknowledgeReminder,
  acquireReminderLock: () => acquireReminderLock,
  activeNurseCondition: () => activeNurseCondition,
  adminSetNurseAccountEmail: () => adminSetNurseAccountEmail,
  autoLinkNurseByEmail: () => autoLinkNurseByEmail,
  bulkSetAccountEmailsByLicense: () => bulkSetAccountEmailsByLicense,
  changeNurseAccountEmail: () => changeNurseAccountEmail,
  claimNurseByIdentifier: () => claimNurseByIdentifier,
  clearCurrentAssignmentsForNurse: () => clearCurrentAssignmentsForNurse,
  closeAssignment: () => closeAssignment,
  countActiveNurses: () => countActiveNurses,
  countUnreadNotifications: () => countUnreadNotifications,
  countUnreadNotificationsPg: () => countUnreadNotificationsPg,
  createArea: () => createArea,
  createAssignment: () => createAssignment,
  createCredential: () => createCredential,
  createCredentialType: () => createCredentialType,
  createCustomEvent: () => createCustomEvent,
  createNotification: () => createNotification,
  createNotificationsBatch: () => createNotificationsBatch,
  createNurse: () => createNurse,
  createNurseTraining: () => createNurseTraining,
  createReminder: () => createReminder,
  createTrainingType: () => createTrainingType,
  deleteCustomEvent: () => deleteCustomEvent,
  deleteNurse: () => deleteNurse,
  deleteNurseTraining: () => deleteNurseTraining,
  deleteStoredFile: () => deleteStoredFile,
  deleteTrainingCatalogItem: () => deleteTrainingCatalogItem,
  deleteTrainingEvent: () => deleteTrainingEvent,
  findNurseIdsByLicenseNumber: () => findNurseIdsByLicenseNumber,
  findNurseTrainingByKey: () => findNurseTrainingByKey,
  findOrCreateTrainingEvent: () => findOrCreateTrainingEvent,
  getAllNurseLicenseInfos: () => getAllNurseLicenseInfos,
  getAllSettings: () => getAllSettings,
  getAreaById: () => getAreaById,
  getAreaTrainingRequirementIds: () => getAreaTrainingRequirementIds,
  getAssignmentsForArea: () => getAssignmentsForArea,
  getBatchClient: () => getBatchClient,
  getDb: () => getDb,
  getLatestLicenseInfoPerNurse: () => getLatestLicenseInfoPerNurse,
  getNotificationLogicalKey: () => getNotificationLogicalKey,
  getNurseByEmployeeId: () => getNurseByEmployeeId,
  getNurseById: () => getNurseById,
  getNurseByLinkedUserId: () => getNurseByLinkedUserId,
  getNurseLicenseInfo: () => getNurseLicenseInfo,
  getNurseLicenseStatus: () => getNurseLicenseStatus,
  getNurseTrainingById: () => getNurseTrainingById,
  getSetting: () => getSetting,
  getStoredFile: () => getStoredFile,
  getUserByOpenId: () => getUserByOpenId,
  isEmailDuplicate: () => isEmailDuplicate,
  isNurseClaimable: () => isNurseClaimable,
  listActivityForNurse: () => listActivityForNurse,
  listAllActiveAssignments: () => listAllActiveAssignments,
  listAreas: () => listAreas,
  listAssignmentsForNurse: () => listAssignmentsForNurse,
  listCredentialTypes: () => listCredentialTypes,
  listCredentials: () => listCredentials,
  listCustomEvents: () => listCustomEvents,
  listNotifications: () => listNotifications,
  listNurseTrainings: () => listNurseTrainings,
  listNurses: () => listNurses,
  listRecentEmailLogs: () => listRecentEmailLogs,
  listReminders: () => listReminders,
  listRequiredTrainings: () => listRequiredTrainings,
  listTrainingCatalog: () => listTrainingCatalog,
  logActivity: () => logActivity,
  markAllNotificationsRead: () => markAllNotificationsRead,
  markNotificationRead: () => markNotificationRead,
  markReminderExpiredByCredential: () => markReminderExpiredByCredential,
  purgeOrphanStoredFiles: () => purgeOrphanStoredFiles,
  recordEmailLog: () => recordEmailLog,
  releaseReminderLock: () => releaseReminderLock,
  saveClaimEmail: () => saveClaimEmail,
  saveStoredFile: () => saveStoredFile,
  searchNurses: () => searchNurses,
  setAreaTrainingRequirement: () => setAreaTrainingRequirement,
  setSetting: () => setSetting,
  touchUserSession: () => touchUserSession,
  updateArea: () => updateArea,
  updateCredential: () => updateCredential,
  updateCredentialType: () => updateCredentialType,
  updateCustomEvent: () => updateCustomEvent,
  updateNurse: () => updateNurse,
  updateNurseTraining: () => updateNurseTraining,
  updateTrainingType: () => updateTrainingType,
  upsertNursePrcLicense: () => upsertNursePrcLicense,
  upsertUser: () => upsertUser
});
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, not, or, sql as sql2 } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
function activeNurseCondition() {
  return and(isNull(nurses.archivedAt), not(inArray(nurses.employmentStatus, INACTIVE_EMPLOYMENT_STATUSES)));
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
          search_path: "nursetrack, public"
        }
      });
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
        search_path: "nursetrack, public"
      }
    });
  }
  return _batchPg;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    for (const field of textFields) {
      if (user[field] !== void 0) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    }
    values.role = roleForEmail(user.email);
    updateSet.role = values.role;
    if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
    return;
  }
  const sqlite = getSqliteDb();
  const assignedRole = roleForEmail(user.email);
  sqlite.prepare(`
    INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(openId) DO UPDATE SET
      name = COALESCE(excluded.name, users.name),
      email = excluded.email,
      role = excluded.role,
      lastSignedIn = CURRENT_TIMESTAMP
  `).run(user.openId, user.name ?? null, user.email ?? null, user.loginMethod ?? "local", assignedRole);
}
async function touchUserSession(openId) {
  const db = await getDb();
  if (db) {
    const set = {
      lastSignedIn: /* @__PURE__ */ new Date(),
      role: sql2`CASE WHEN lower(trim(${users.email})) IN (${FULL_ACCESS_EMAILS[0]}, ${FULL_ACCESS_EMAILS[1]}) THEN 'admin' ELSE 'user' END`
    };
    const rows = await db.update(users).set(set).where(eq(users.openId, openId)).returning();
    return rows.length > 0 ? rows[0] : void 0;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare(
    "UPDATE users SET lastSignedIn = CURRENT_TIMESTAMP, role = CASE WHEN lower(trim(email)) IN (?, ?) THEN 'admin' ELSE 'user' END WHERE openId = ?"
  ).run(...FULL_ACCESS_EMAILS, openId);
  return sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId);
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : void 0;
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM users WHERE openId = ?").get(openId);
}
async function listAreas(includeInactive = true) {
  const db = await getDb();
  if (db) {
    const q = includeInactive ? db.select().from(areas) : db.select().from(areas).where(eq(areas.active, true));
    return await q.orderBy(asc(areas.sortOrder), asc(areas.name));
  }
  const sqlite = getSqliteDb();
  const query = includeInactive ? "SELECT * FROM areas ORDER BY sortOrder ASC, name ASC" : "SELECT * FROM areas WHERE active = 1 ORDER BY sortOrder ASC, name ASC";
  const rows = sqlite.prepare(query).all();
  return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
}
async function createArea(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(areas).values(data).returning({ id: areas.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const res = sqlite.prepare("INSERT INTO areas (code, name, description, sortOrder, active) VALUES (?, ?, ?, ?, ?)").run(
    data.code,
    data.name,
    data.description ?? null,
    data.sortOrder ?? 99,
    data.active !== false ? 1 : 0
  );
  return Number(res.lastInsertRowid);
}
async function updateArea(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(areas).set(data).where(eq(areas.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  if (data.code !== void 0) {
    sets.push("code = ?");
    vals.push(data.code);
  }
  if (data.name !== void 0) {
    sets.push("name = ?");
    vals.push(data.name);
  }
  if (data.description !== void 0) {
    sets.push("description = ?");
    vals.push(data.description);
  }
  if (data.sortOrder !== void 0) {
    sets.push("sortOrder = ?");
    vals.push(data.sortOrder);
  }
  if (data.active !== void 0) {
    sets.push("active = ?");
    vals.push(data.active ? 1 : 0);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE areas SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function getAreaById(id) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
    return rows[0];
  }
  const sqlite = getSqliteDb();
  const r = sqlite.prepare("SELECT * FROM areas WHERE id = ?").get(id);
  return r ? { ...r, active: Boolean(r.active) } : void 0;
}
async function createNurse(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(nurses).values(data).returning({ id: nurses.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const res = sqlite.prepare(`
    INSERT INTO nurses (employeeId, firstName, middleName, lastName, suffix, position, staffType, dateHired, employmentStatus, currentAreaId, profilePhotoKey, contactNumber, accountEmail, linkedUserId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.employeeId,
    data.firstName,
    data.middleName ?? null,
    data.lastName,
    data.suffix ?? null,
    data.position ?? null,
    data.staffType ?? "Registered Nurse",
    data.dateHired ? dateKey(data.dateHired) : null,
    data.employmentStatus ?? "Active",
    data.currentAreaId ?? null,
    data.profilePhotoKey ?? null,
    data.contactNumber ?? null,
    data.accountEmail ?? null,
    data.linkedUserId ?? null
  );
  return Number(res.lastInsertRowid);
}
async function updateNurse(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(nurses).set(data).where(eq(nurses.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  const fields = ["employeeId", "firstName", "middleName", "lastName", "suffix", "position", "staffType", "employmentStatus", "currentAreaId", "profilePhotoKey", "contactNumber", "accountEmail", "linkedUserId", "archivedAt"];
  for (const f of fields) {
    if (data[f] !== void 0) {
      sets.push(`${f} = ?`);
      vals.push(data[f] instanceof Date ? data[f].toISOString().slice(0, 19).replace("T", " ") : data[f] ?? null);
    }
  }
  if (data.dateHired !== void 0) {
    sets.push("dateHired = ?");
    vals.push(data.dateHired ? dateKey(data.dateHired) : null);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE nurses SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function deleteNurse(id) {
  const db = await getDb();
  if (db) {
    await db.transaction(async (tx) => {
      const credentialIds = (await tx.select({ id: nurseCredentials.id }).from(nurseCredentials).where(eq(nurseCredentials.nurseId, id))).map((c) => c.id);
      if (credentialIds.length) {
        await tx.delete(licenseReminders).where(inArray(licenseReminders.credentialId, credentialIds));
      }
      await tx.delete(emailLogs).where(eq(emailLogs.nurseId, id));
      await tx.delete(notifications).where(eq(notifications.nurseId, id));
      await tx.delete(customCalendarEvents).where(eq(customCalendarEvents.nurseId, id));
      await tx.delete(nurseTrainings).where(eq(nurseTrainings.nurseId, id));
      await tx.delete(nurseCredentials).where(eq(nurseCredentials.nurseId, id));
      await tx.delete(areaAssignments).where(eq(areaAssignments.nurseId, id));
      await tx.delete(activityLog).where(eq(activityLog.nurseId, id));
      await tx.delete(nurses).where(eq(nurses.id, id));
    });
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM licenseReminders WHERE credentialId IN (SELECT id FROM nurseCredentials WHERE nurseId = ?)").run(id);
    sqlite.prepare("DELETE FROM emailLogs WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM notifications WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM customCalendarEvents WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM nurseTrainings WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM nurseCredentials WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM areaAssignments WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM activityLog WHERE nurseId = ?").run(id);
    sqlite.prepare("DELETE FROM nurses WHERE id = ?").run(id);
  })();
}
async function listNurses(opts = {}) {
  const db = await getDb();
  if (db) {
    const conds2 = [];
    if (opts.archived === false) conds2.push(isNull(nurses.archivedAt));
    if (opts.archived === true) conds2.push(isNotNull(nurses.archivedAt));
    if (opts.areaId !== void 0) conds2.push(eq(nurses.currentAreaId, opts.areaId));
    if (opts.employmentStatus) conds2.push(eq(nurses.employmentStatus, opts.employmentStatus));
    const q = conds2.length ? db.select().from(nurses).where(and(...conds2)) : db.select().from(nurses);
    return await q.orderBy(asc(nurses.lastName), asc(nurses.firstName));
  }
  const sqlite = getSqliteDb();
  const conds = [];
  const params = [];
  if (opts.archived === false) conds.push("archivedAt IS NULL");
  if (opts.archived === true) conds.push("archivedAt IS NOT NULL");
  if (opts.areaId !== void 0) {
    conds.push("currentAreaId = ?");
    params.push(opts.areaId);
  }
  if (opts.employmentStatus) {
    conds.push("employmentStatus = ?");
    params.push(opts.employmentStatus);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return sqlite.prepare(`SELECT * FROM nurses ${where} ORDER BY lastName ASC, firstName ASC`).all(...params);
}
async function getNurseByEmployeeId(employeeId) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(nurses).where(eq(nurses.employeeId, employeeId)).limit(1);
    return rows[0];
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM nurses WHERE employeeId = ?").get(employeeId);
}
async function getNurseByLinkedUserId(userId) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(nurses).where(eq(nurses.linkedUserId, userId)).limit(1);
    return rows[0];
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM nurses WHERE linkedUserId = ?").get(userId);
}
async function findNurseIdsByLicenseNumber(licenseNumber) {
  const normPrc = normalizeForMatch(licenseNumber);
  const db = await getDb();
  if (db) {
    const credRows = await db.select({ nurseId: nurseCredentials.nurseId, licenseNumber: nurseCredentials.licenseNumber }).from(nurseCredentials).where(isNotNull(nurseCredentials.licenseNumber));
    return credRows.filter((r) => r.licenseNumber && normalizeForMatch(r.licenseNumber) === normPrc).map((r) => r.nurseId);
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare("SELECT nurseId, licenseNumber FROM nurseCredentials WHERE licenseNumber IS NOT NULL").all();
  return rows.filter((r) => r.licenseNumber && normalizeForMatch(r.licenseNumber) === normPrc).map((r) => r.nurseId);
}
async function bulkSetAccountEmailsByLicense(rows) {
  const db = await getDb();
  if (!db) return { matched: 0, ambiguous: 0, notFound: 0 };
  let matched = 0, ambiguous = 0, notFound = 0;
  for (const row of rows) {
    if (!row.licenseNumber || !row.email) continue;
    const nurseIds = await findNurseIdsByLicenseNumber(row.licenseNumber);
    if (nurseIds.length === 0) {
      notFound++;
      continue;
    }
    if (nurseIds.length > 1) {
      ambiguous++;
      continue;
    }
    await db.update(nurses).set({ accountEmail: row.email }).where(eq(nurses.id, nurseIds[0]));
    matched++;
  }
  return { matched, ambiguous, notFound };
}
async function autoLinkNurseByEmail(userId, email) {
  if (!email) return;
  const norm = email.trim().toLowerCase();
  if (!norm || isBlockedStaffEmail(norm)) return;
  const db = await getDb();
  if (!db) {
    const sqlite = getSqliteDb();
    const existing2 = sqlite.prepare("SELECT id FROM nurses WHERE linkedUserId = ?").get(userId);
    if (existing2) return;
    const candidate2 = sqlite.prepare("SELECT id, linkedUserId, employmentStatus, archivedAt FROM nurses WHERE lower(accountEmail) = ?").get(norm);
    if (!candidate2 || candidate2.archivedAt) return;
    if (INACTIVE_EMPLOYMENT_STATUSES.includes(candidate2.employmentStatus)) return;
    sqlite.prepare("UPDATE nurses SET linkedUserId = ? WHERE id = ? AND lower(accountEmail) = ?").run(userId, candidate2.id, norm);
    return;
  }
  const existing = await db.select({ id: nurses.id }).from(nurses).where(eq(nurses.linkedUserId, userId)).limit(1);
  if (existing.length > 0) return;
  const rows = await db.select({
    id: nurses.id,
    linkedUserId: nurses.linkedUserId,
    employmentStatus: nurses.employmentStatus,
    archivedAt: nurses.archivedAt
  }).from(nurses).where(sql2`lower(${nurses.accountEmail}) = ${norm}`).limit(1);
  const candidate = rows[0];
  if (!candidate || candidate.archivedAt) return;
  if (INACTIVE_EMPLOYMENT_STATUSES.includes(candidate.employmentStatus)) return;
  await db.update(nurses).set({ linkedUserId: userId }).where(
    and(
      eq(nurses.id, candidate.id),
      sql2`lower(${nurses.accountEmail}) = ${norm}`
    )
  );
}
function isNurseClaimable(nurse) {
  if (!nurse) return false;
  if (nurse.archivedAt) return false;
  if (INACTIVE_EMPLOYMENT_STATUSES.includes(nurse.employmentStatus)) return false;
  if (nurse.accountEmail) return false;
  return true;
}
async function nurseHasLicenseNumber(nurseId) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ licenseNumber: nurseCredentials.licenseNumber }).from(nurseCredentials).where(and(eq(nurseCredentials.nurseId, nurseId), isNotNull(nurseCredentials.licenseNumber)));
  return rows.some((r) => (r.licenseNumber ?? "").trim().length > 0);
}
async function claimNurseByIdentifier(identifier) {
  const norm = identifier.trim();
  if (!norm) return { ok: false };
  const dbConn = await getDb();
  if (!dbConn) return { ok: false };
  const nurseIds = await findNurseIdsByLicenseNumber(norm);
  if (nurseIds.length > 1) return { ok: false };
  if (nurseIds.length === 1) {
    const nurse = await getNurseById(nurseIds[0]);
    return nurse && isNurseClaimable(nurse) ? { ok: true, nurseId: nurse.id } : { ok: false };
  }
  const byEmployeeId = await getNurseByEmployeeId(norm);
  if (!byEmployeeId) return { ok: false };
  if (byEmployeeId.staffType !== "Nursing Attendant") return { ok: false };
  if (await nurseHasLicenseNumber(byEmployeeId.id)) return { ok: false };
  return isNurseClaimable(byEmployeeId) ? { ok: true, nurseId: byEmployeeId.id } : { ok: false };
}
function isBlockedStaffEmail(email) {
  const norm = email.trim().toLowerCase();
  return FULL_ACCESS_EMAILS.some((e) => e.toLowerCase() === norm);
}
async function saveClaimEmail(nurseId, email) {
  const norm = email.trim().toLowerCase();
  if (isBlockedStaffEmail(norm)) return { ok: false, reason: "in_use" };
  const dbConn = await getDb();
  if (!dbConn) return { ok: false, reason: "already_claimed" };
  try {
    const rows = await dbConn.update(nurses).set({ accountEmail: norm }).where(and(eq(nurses.id, nurseId), isNull(nurses.accountEmail))).returning({ id: nurses.id });
    if (rows.length === 0) return { ok: false, reason: "already_claimed" };
    return { ok: true };
  } catch (error) {
    if (error?.code === "23505") return { ok: false, reason: "in_use" };
    throw error;
  }
}
async function adminSetNurseAccountEmail(nurseId, email) {
  const dbConn = await getDb();
  if (!dbConn) {
    const sqlite = getSqliteDb();
    if (email === null) {
      sqlite.prepare("UPDATE nurses SET accountEmail = NULL, linkedUserId = NULL WHERE id = ?").run(nurseId);
      return { ok: true };
    }
    const norm2 = email.trim().toLowerCase();
    if (isBlockedStaffEmail(norm2)) return { ok: false, reason: "in_use" };
    const existing = sqlite.prepare("SELECT id FROM nurses WHERE lower(accountEmail) = ? AND id != ?").get(norm2, nurseId);
    if (existing) return { ok: false, reason: "in_use" };
    sqlite.prepare("UPDATE nurses SET accountEmail = ? WHERE id = ?").run(norm2, nurseId);
    return { ok: true };
  }
  if (email === null) {
    await dbConn.update(nurses).set({ accountEmail: null, linkedUserId: null }).where(eq(nurses.id, nurseId));
    return { ok: true };
  }
  const norm = email.trim().toLowerCase();
  if (isBlockedStaffEmail(norm)) return { ok: false, reason: "in_use" };
  try {
    const conflict = await dbConn.select({ id: nurses.id }).from(nurses).where(and(sql2`lower(${nurses.accountEmail}) = ${norm}`, sql2`${nurses.id} != ${nurseId}`)).limit(1);
    if (conflict.length > 0) return { ok: false, reason: "in_use" };
    await dbConn.update(nurses).set({ accountEmail: norm }).where(eq(nurses.id, nurseId));
    return { ok: true };
  } catch (error) {
    if (error?.code === "23505") return { ok: false, reason: "in_use" };
    throw error;
  }
}
async function changeNurseAccountEmail(nurseId, email) {
  const norm = email.trim().toLowerCase();
  if (isBlockedStaffEmail(norm)) return { ok: false, reason: "in_use" };
  const dbConn = await getDb();
  if (!dbConn) {
    const sqlite = getSqliteDb();
    const existing = sqlite.prepare("SELECT id FROM nurses WHERE lower(accountEmail) = ? AND id != ?").get(norm, nurseId);
    if (existing) return { ok: false, reason: "in_use" };
    sqlite.prepare("UPDATE nurses SET accountEmail = ? WHERE id = ?").run(norm, nurseId);
    return { ok: true };
  }
  try {
    const conflict = await dbConn.select({ id: nurses.id }).from(nurses).where(and(sql2`lower(${nurses.accountEmail}) = ${norm}`, sql2`${nurses.id} != ${nurseId}`)).limit(1);
    if (conflict.length > 0) return { ok: false, reason: "in_use" };
    await dbConn.update(nurses).set({ accountEmail: norm }).where(eq(nurses.id, nurseId));
    return { ok: true };
  } catch (error) {
    if (error?.code === "23505") return { ok: false, reason: "in_use" };
    throw error;
  }
}
function deriveLicenseStatusFromCred(cred) {
  if (cred.renewalStatus === "Renewed") return "Valid";
  const days = Math.floor((parseLocalDate2(cred.expiryDate).getTime() - parseLocalDate2(todayDate2()).getTime()) / 864e5);
  if (days < 0) return "Expired";
  if (days <= 180) return "Within 6 Months";
  if (days <= 365) return "Within 1 Year";
  return "Valid";
}
async function getNurseLicenseInfo(nurseId) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(nurseCredentials).where(eq(nurseCredentials.nurseId, nurseId)).orderBy(desc(nurseCredentials.expiryDate)).limit(1);
    const cred2 = rows[0];
    if (!cred2) return { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null, issueDate: null };
    const expKey2 = dateKey(cred2.expiryDate);
    const days2 = expKey2 ? daysUntilExpiry(expKey2) : null;
    return {
      status: deriveLicenseStatusFromCred(cred2),
      licenseNumber: cred2.licenseNumber ?? null,
      expiryDate: expKey2 || null,
      daysRemaining: days2,
      issueDate: cred2.issueDate ? dateKey(cred2.issueDate) : null
    };
  }
  const sqlite = getSqliteDb();
  const cred = sqlite.prepare("SELECT * FROM nurseCredentials WHERE nurseId = ? ORDER BY date(expiryDate) DESC LIMIT 1").get(nurseId);
  if (!cred) return { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null, issueDate: null };
  const expKey = dateKey(cred.expiryDate);
  const days = expKey ? daysUntilExpiry(expKey) : null;
  return {
    status: deriveLicenseStatusFromCred(cred),
    licenseNumber: cred.licenseNumber ?? null,
    expiryDate: expKey || null,
    daysRemaining: days,
    issueDate: cred.issueDate ? dateKey(cred.issueDate) : null
  };
}
async function getNurseLicenseStatus(nurseId) {
  return (await getNurseLicenseInfo(nurseId)).status;
}
async function getLatestLicenseInfoPerNurse(db) {
  const creds = await db.selectDistinctOn([nurseCredentials.nurseId], {
    nurseId: nurseCredentials.nurseId,
    licenseNumber: nurseCredentials.licenseNumber,
    expiryDate: nurseCredentials.expiryDate,
    renewalStatus: nurseCredentials.renewalStatus
  }).from(nurseCredentials).orderBy(nurseCredentials.nurseId, desc(nurseCredentials.expiryDate), desc(nurseCredentials.id));
  const map = /* @__PURE__ */ new Map();
  for (const cred of creds) {
    const expKey = dateKey(cred.expiryDate);
    map.set(cred.nurseId, {
      status: deriveLicenseStatusFromCred(cred),
      licenseNumber: cred.licenseNumber ?? null,
      expiryDate: expKey || null,
      daysRemaining: expKey ? daysUntilExpiry(expKey) : null
    });
  }
  return map;
}
async function getAllNurseLicenseInfos() {
  const map = /* @__PURE__ */ new Map();
  const db = await getDb();
  if (db) return getLatestLicenseInfoPerNurse(db);
  const sqlite = getSqliteDb();
  const creds = sqlite.prepare("SELECT * FROM nurseCredentials ORDER BY date(expiryDate) DESC").all();
  for (const cred of creds) {
    if (!map.has(cred.nurseId)) {
      const expKey = dateKey(cred.expiryDate);
      const days = expKey ? daysUntilExpiry(expKey) : null;
      map.set(cred.nurseId, {
        status: deriveLicenseStatusFromCred(cred),
        licenseNumber: cred.licenseNumber ?? null,
        expiryDate: expKey || null,
        daysRemaining: days
      });
    }
  }
  return map;
}
function parseLocalDate2(value) {
  if (value instanceof Date) return value;
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function todayDate2() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function getNurseById(id) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(nurses).where(eq(nurses.id, id)).limit(1);
    return rows[0];
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM nurses WHERE id = ?").get(id);
}
async function searchNurses(query) {
  const q = query.trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const db = await getDb();
  if (db) {
    const tokenConditions = tokens.map((token) => {
      const term = `%${token}%`;
      return or(
        ilike(nurses.firstName, term),
        ilike(nurses.middleName, term),
        ilike(nurses.lastName, term),
        ilike(nurses.employeeId, term)
      );
    });
    return await db.select().from(nurses).where(and(isNull(nurses.archivedAt), ...tokenConditions)).orderBy(asc(nurses.lastName), asc(nurses.firstName)).limit(10);
  }
  const sqlite = getSqliteDb();
  const tokenClauses = tokens.map(() => "(firstName LIKE ? OR middleName LIKE ? OR lastName LIKE ? OR employeeId LIKE ?)");
  const params = tokens.flatMap((t2) => [`%${t2}%`, `%${t2}%`, `%${t2}%`, `%${t2}%`]);
  return sqlite.prepare(`
    SELECT * FROM nurses 
    WHERE archivedAt IS NULL AND ${tokenClauses.join(" AND ")}
    ORDER BY lastName ASC, firstName ASC
    LIMIT 10
  `).all(...params);
}
async function listAssignmentsForNurse(nurseId) {
  const db = await getDb();
  if (db) {
    return await db.select().from(areaAssignments).where(eq(areaAssignments.nurseId, nurseId)).orderBy(desc(areaAssignments.startDate));
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare("SELECT * FROM areaAssignments WHERE nurseId = ? ORDER BY date(startDate) DESC").all(nurseId);
  return rows.map((r) => ({ ...r, isCurrent: Boolean(r.isCurrent) }));
}
async function listAllActiveAssignments() {
  const db = await getDb();
  if (db) {
    return await db.select({
      id: areaAssignments.id,
      nurseId: areaAssignments.nurseId,
      areaId: areaAssignments.areaId,
      startDate: areaAssignments.startDate,
      endDate: areaAssignments.endDate,
      assignmentType: areaAssignments.assignmentType,
      remarks: areaAssignments.remarks,
      isCurrent: areaAssignments.isCurrent
    }).from(areaAssignments).where(isNull(areaAssignments.endDate));
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare("SELECT * FROM areaAssignments WHERE endDate IS NULL").all();
  return rows.map((r) => ({ ...r, isCurrent: Boolean(r.isCurrent) }));
}
async function createAssignment(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(areaAssignments).values(data).returning({ id: areaAssignments.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const start = data.startDate instanceof Date ? data.startDate.toISOString().slice(0, 10) : String(data.startDate);
  const end = data.endDate ? data.endDate instanceof Date ? data.endDate.toISOString().slice(0, 10) : String(data.endDate) : null;
  const res = sqlite.prepare(`
    INSERT INTO areaAssignments (nurseId, areaId, startDate, endDate, assignmentType, remarks, isCurrent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.nurseId, data.areaId, start, end, data.assignmentType ?? null, data.remarks ?? null, data.isCurrent ? 1 : 0);
  return Number(res.lastInsertRowid);
}
async function closeAssignment(id, endDate) {
  const db = await getDb();
  if (db) {
    await db.update(areaAssignments).set({ endDate, isCurrent: false }).where(eq(areaAssignments.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const end = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate);
  sqlite.prepare("UPDATE areaAssignments SET endDate = ?, isCurrent = 0 WHERE id = ?").run(end, id);
}
async function clearCurrentAssignmentsForNurse(nurseId) {
  const db = await getDb();
  if (db) {
    await db.update(areaAssignments).set({ isCurrent: false }).where(eq(areaAssignments.nurseId, nurseId));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE areaAssignments SET isCurrent = 0 WHERE nurseId = ?").run(nurseId);
}
async function getAssignmentsForArea(areaId) {
  const db = await getDb();
  if (db) {
    const activeNurses2 = await db.select().from(nurses).where(and(eq(nurses.currentAreaId, areaId), activeNurseCondition())).orderBy(asc(nurses.lastName), asc(nurses.firstName));
    if (activeNurses2.length === 0) return [];
    const nurseIds2 = activeNurses2.map((n) => n.id);
    const asgns2 = await db.select().from(areaAssignments).where(and(eq(areaAssignments.areaId, areaId), eq(areaAssignments.isCurrent, true), inArray(areaAssignments.nurseId, nurseIds2)));
    const asgnMap2 = new Map(asgns2.map((a) => [a.nurseId, a]));
    return activeNurses2.map((nurse) => {
      const a = asgnMap2.get(nurse.id);
      return {
        assignment: a ?? {
          id: 0,
          nurseId: nurse.id,
          areaId,
          startDate: nurse.dateHired ?? /* @__PURE__ */ new Date(),
          endDate: null,
          assignmentType: "Permanent Transfer",
          remarks: null,
          isCurrent: true,
          createdAt: nurse.createdAt,
          updatedAt: nurse.updatedAt
        },
        nurse
      };
    });
  }
  const sqlite = getSqliteDb();
  const activeNurses = sqlite.prepare(`
    SELECT * FROM nurses
    WHERE currentAreaId = ? AND archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST})
    ORDER BY lastName ASC, firstName ASC
  `).all(areaId);
  if (activeNurses.length === 0) return [];
  const nurseIds = activeNurses.map((n) => n.id);
  const asgns = sqlite.prepare(`
    SELECT * FROM areaAssignments
    WHERE areaId = ? AND isCurrent = 1 AND nurseId IN (${nurseIds.join(", ")})
  `).all(areaId);
  const asgnMap = new Map(asgns.map((a) => [a.nurseId, a]));
  return activeNurses.map((nurse) => {
    const a = asgnMap.get(nurse.id);
    return {
      assignment: a ? {
        id: a.id,
        nurseId: a.nurseId,
        areaId: a.areaId,
        startDate: a.startDate,
        endDate: a.endDate,
        assignmentType: a.assignmentType,
        remarks: a.remarks,
        isCurrent: Boolean(a.isCurrent)
      } : {
        id: 0,
        nurseId: nurse.id,
        areaId,
        startDate: nurse.dateHired ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        endDate: null,
        assignmentType: "Permanent Transfer",
        remarks: null,
        isCurrent: true
      },
      nurse: {
        id: nurse.id,
        employeeId: nurse.employeeId,
        firstName: nurse.firstName,
        middleName: nurse.middleName,
        lastName: nurse.lastName,
        suffix: nurse.suffix,
        position: nurse.position,
        staffType: nurse.staffType,
        currentAreaId: nurse.currentAreaId,
        archivedAt: nurse.archivedAt
      }
    };
  });
}
async function listCredentials(opts = {}) {
  const db = await getDb();
  if (db) {
    const q = opts.nurseId !== void 0 ? db.select().from(nurseCredentials).where(eq(nurseCredentials.nurseId, opts.nurseId)) : db.select().from(nurseCredentials);
    return await q.orderBy(asc(nurseCredentials.expiryDate));
  }
  const sqlite = getSqliteDb();
  if (opts.nurseId !== void 0) {
    return sqlite.prepare("SELECT * FROM nurseCredentials WHERE nurseId = ? ORDER BY date(expiryDate) ASC").all(opts.nurseId);
  }
  return sqlite.prepare("SELECT * FROM nurseCredentials ORDER BY date(expiryDate) ASC").all();
}
async function createCredential(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(nurseCredentials).values(data).returning({ id: nurseCredentials.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const issue = data.issueDate ? data.issueDate instanceof Date ? data.issueDate.toISOString().slice(0, 10) : String(data.issueDate) : null;
  const expiry = data.expiryDate instanceof Date ? data.expiryDate.toISOString().slice(0, 10) : String(data.expiryDate);
  const res = sqlite.prepare(`
    INSERT INTO nurseCredentials (nurseId, credentialTypeId, licenseNumber, issuingOrganization, issueDate, expiryDate, renewalStatus, verificationStatus, documentKey, renewalCycleKey, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.nurseId,
    data.credentialTypeId,
    data.licenseNumber ?? null,
    data.issuingOrganization ?? null,
    issue,
    expiry,
    data.renewalStatus ?? "Not Started",
    data.verificationStatus ?? "Unverified",
    data.documentKey ?? null,
    data.renewalCycleKey,
    data.remarks ?? null
  );
  return Number(res.lastInsertRowid);
}
async function updateCredential(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(nurseCredentials).set(data).where(eq(nurseCredentials.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  const fields = ["licenseNumber", "issuingOrganization", "renewalStatus", "verificationStatus", "documentKey", "renewalCycleKey", "remarks"];
  for (const f of fields) {
    if (data[f] !== void 0) {
      sets.push(`${f} = ?`);
      vals.push(data[f] ?? null);
    }
  }
  if (data.issueDate !== void 0) {
    sets.push("issueDate = ?");
    vals.push(data.issueDate ? data.issueDate instanceof Date ? data.issueDate.toISOString().slice(0, 10) : String(data.issueDate) : null);
  }
  if (data.expiryDate !== void 0) {
    sets.push("expiryDate = ?");
    vals.push(data.expiryDate instanceof Date ? data.expiryDate.toISOString().slice(0, 10) : String(data.expiryDate));
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE nurseCredentials SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function upsertNursePrcLicense(nurseId, licenseNumber, dates) {
  const norm = licenseNumber ? licenseNumber.trim() : null;
  if (norm) {
    const matchingNurseIds = await findNurseIdsByLicenseNumber(norm);
    const hasConflict = matchingNurseIds.some((id) => id !== nurseId);
    if (hasConflict) {
      return { ok: false, reason: "conflict" };
    }
  }
  const creds = await listCredentials({ nurseId });
  const types = await listCredentialTypes(true);
  const prcType = types.find((t2) => t2.name.toLowerCase().includes("prc")) ?? types[0];
  const existingPrc = creds.find((c) => prcType && c.credentialTypeId === prcType.id) ?? creds[0];
  if (existingPrc) {
    const patch = {
      licenseNumber: norm || null,
      verificationStatus: "Pending Verification"
    };
    if (dates?.issueDate !== void 0) {
      patch.issueDate = dates.issueDate ? new Date(dates.issueDate) : null;
    }
    if (dates?.expiryDate !== void 0 && dates.expiryDate) {
      const newExpiry = new Date(dates.expiryDate);
      patch.expiryDate = newExpiry;
      const existingExpiryStr = existingPrc.expiryDate ? existingPrc.expiryDate instanceof Date ? existingPrc.expiryDate.toISOString().slice(0, 10) : String(existingPrc.expiryDate).slice(0, 10) : null;
      if (newExpiry.toISOString().slice(0, 10) !== existingExpiryStr) {
        patch.renewalCycleKey = renewalCycleKey(`${existingPrc.id}-${newExpiry.toISOString()}`);
      }
    }
    await updateCredential(existingPrc.id, patch);
    return { ok: true, credentialId: existingPrc.id };
  }
  if (norm || dates?.expiryDate) {
    let expiryDate;
    if (dates?.expiryDate) {
      expiryDate = new Date(dates.expiryDate);
    } else {
      expiryDate = /* @__PURE__ */ new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 3);
    }
    const issueDate = dates?.issueDate ? new Date(dates.issueDate) : void 0;
    const typeId = prcType ? prcType.id : 1;
    const credId = await createCredential({
      nurseId,
      credentialTypeId: typeId,
      licenseNumber: norm ?? void 0,
      issuingOrganization: prcType?.issuingOrganizationDefault || "Professional Regulation Commission (PRC)",
      issueDate,
      expiryDate,
      renewalStatus: "Not Started",
      verificationStatus: "Pending Verification",
      renewalCycleKey: renewalCycleKey(`prc-${nurseId}-${Date.now()}`)
    });
    return { ok: true, credentialId: credId };
  }
  return { ok: true };
}
async function listCredentialTypes(includeInactive = true) {
  const db = await getDb();
  if (db) {
    const q = includeInactive ? db.select().from(credentialTypes) : db.select().from(credentialTypes).where(eq(credentialTypes.active, true));
    return await q.orderBy(asc(credentialTypes.name));
  }
  const sqlite = getSqliteDb();
  const query = includeInactive ? "SELECT * FROM credentialTypes ORDER BY name ASC" : "SELECT * FROM credentialTypes WHERE active = 1 ORDER BY name ASC";
  const rows = sqlite.prepare(query).all();
  return rows.map((r) => ({ ...r, active: Boolean(r.active) }));
}
async function createCredentialType(name, issuingOrganizationDefault) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(credentialTypes).values({ name, issuingOrganizationDefault }).returning({ id: credentialTypes.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const res = sqlite.prepare("INSERT INTO credentialTypes (name, issuingOrganizationDefault, active) VALUES (?, ?, 1)").run(name, issuingOrganizationDefault ?? null);
  return Number(res.lastInsertRowid);
}
async function updateCredentialType(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(credentialTypes).set(data).where(eq(credentialTypes.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  if (data.name !== void 0) {
    sets.push("name = ?");
    vals.push(data.name);
  }
  if (data.issuingOrganizationDefault !== void 0) {
    sets.push("issuingOrganizationDefault = ?");
    vals.push(data.issuingOrganizationDefault);
  }
  if (data.active !== void 0) {
    sets.push("active = ?");
    vals.push(data.active ? 1 : 0);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE credentialTypes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function listReminders() {
  const db = await getDb();
  if (db) return await db.select().from(licenseReminders).orderBy(desc(licenseReminders.generatedAt));
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM licenseReminders ORDER BY date(generatedAt) DESC").all();
}
async function createReminder(data) {
  const db = await getDb();
  if (db) {
    const existing2 = await db.select({ id: licenseReminders.id }).from(licenseReminders).where(and(eq(licenseReminders.credentialId, data.credentialId), eq(licenseReminders.thresholdDays, data.thresholdDays), eq(licenseReminders.renewalCycleKey, data.renewalCycleKey))).limit(1);
    if (existing2.length > 0) return existing2[0].id;
    const [row] = await db.insert(licenseReminders).values(data).returning({ id: licenseReminders.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const existing = sqlite.prepare("SELECT id FROM licenseReminders WHERE credentialId = ? AND thresholdDays = ? AND renewalCycleKey = ?").get(data.credentialId, data.thresholdDays, data.renewalCycleKey);
  if (existing) return existing.id;
  const trigger = data.triggerDate instanceof Date ? data.triggerDate.toISOString().slice(0, 10) : String(data.triggerDate);
  const res = sqlite.prepare("INSERT INTO licenseReminders (credentialId, thresholdDays, renewalCycleKey, triggerDate) VALUES (?, ?, ?, ?)").run(data.credentialId, data.thresholdDays, data.renewalCycleKey, trigger);
  return Number(res.lastInsertRowid);
}
async function acknowledgeReminder(id) {
  const db = await getDb();
  if (db) {
    await db.update(licenseReminders).set({ acknowledgedAt: /* @__PURE__ */ new Date(), status: "acknowledged" }).where(eq(licenseReminders.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE licenseReminders SET acknowledgedAt = CURRENT_TIMESTAMP, status = 'acknowledged' WHERE id = ?").run(id);
}
async function markReminderExpiredByCredential(credentialId) {
  const db = await getDb();
  if (db) {
    await db.update(licenseReminders).set({ status: "expired" }).where(eq(licenseReminders.credentialId, credentialId));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE licenseReminders SET status = 'expired' WHERE credentialId = ?").run(credentialId);
}
async function listTrainingCatalog(includeInactive = false) {
  const db = await getDb();
  if (db) {
    const q = includeInactive ? db.select().from(trainingCatalog) : db.select().from(trainingCatalog).where(eq(trainingCatalog.active, true));
    return await q.orderBy(asc(trainingCatalog.name));
  }
  const sqlite = getSqliteDb();
  const query = includeInactive ? "SELECT * FROM trainingCatalog ORDER BY name ASC" : "SELECT * FROM trainingCatalog WHERE active = 1 ORDER BY name ASC";
  const rows = sqlite.prepare(query).all();
  return rows.map((r) => ({ ...r, active: Boolean(r.active), renewalRequired: Boolean(r.renewalRequired) }));
}
async function createTrainingType(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(trainingCatalog).values(data).returning({ id: trainingCatalog.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const res = sqlite.prepare("INSERT INTO trainingCatalog (name, category, kind, renewalRequired, defaultValidityMonths, active) VALUES (?, ?, ?, ?, ?, 1)").run(
    data.name,
    data.category ?? null,
    data.kind ?? "Training",
    data.renewalRequired ? 1 : 0,
    data.defaultValidityMonths ?? null
  );
  return Number(res.lastInsertRowid);
}
async function updateTrainingType(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(trainingCatalog).set(data).where(eq(trainingCatalog.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  if (data.name !== void 0) {
    sets.push("name = ?");
    vals.push(data.name);
  }
  if (data.category !== void 0) {
    sets.push("category = ?");
    vals.push(data.category);
  }
  if (data.kind !== void 0) {
    sets.push("kind = ?");
    vals.push(data.kind);
  }
  if (data.renewalRequired !== void 0) {
    sets.push("renewalRequired = ?");
    vals.push(data.renewalRequired ? 1 : 0);
  }
  if (data.defaultValidityMonths !== void 0) {
    sets.push("defaultValidityMonths = ?");
    vals.push(data.defaultValidityMonths);
  }
  if (data.active !== void 0) {
    sets.push("active = ?");
    vals.push(data.active ? 1 : 0);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE trainingCatalog SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function listNurseTrainings(opts = {}) {
  const db = await getDb();
  if (db) {
    const q = opts.nurseId !== void 0 ? db.select().from(nurseTrainings).where(eq(nurseTrainings.nurseId, opts.nurseId)) : db.select().from(nurseTrainings);
    return await q.orderBy(desc(nurseTrainings.scheduledDate));
  }
  const sqlite = getSqliteDb();
  if (opts.nurseId !== void 0) {
    return sqlite.prepare("SELECT * FROM nurseTrainings WHERE nurseId = ? ORDER BY date(scheduledDate) DESC").all(opts.nurseId);
  }
  return sqlite.prepare("SELECT * FROM nurseTrainings ORDER BY date(scheduledDate) DESC").all();
}
async function createNurseTraining(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(nurseTrainings).values(data).returning({ id: nurseTrainings.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const sched = data.scheduledDate ? data.scheduledDate instanceof Date ? data.scheduledDate.toISOString().slice(0, 10) : String(data.scheduledDate) : null;
  const comp = data.completionDate ? data.completionDate instanceof Date ? data.completionDate.toISOString().slice(0, 10) : String(data.completionDate) : null;
  const exp = data.expiryDate ? data.expiryDate instanceof Date ? data.expiryDate.toISOString().slice(0, 10) : String(data.expiryDate) : null;
  const res = sqlite.prepare(`
    INSERT INTO nurseTrainings (
      nurseId, trainingId, eventId, participationRole, provider, status, scheduledDate, completionDate, expiryDate,
      trainingHours, cpdUnits, certificateNumber, certificateKey, remarks, scheduleVersion, staffResponse,
      staffResponseReason, attendanceOutcome, evidenceStatus, evidenceRequired, conflictOverrideReason, conflictOverrideBy
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.nurseId,
    data.trainingId,
    data.eventId ?? null,
    data.participationRole ?? "Participant",
    data.provider ?? null,
    data.status ?? "Scheduled",
    sched,
    comp,
    exp,
    data.trainingHours ?? null,
    data.cpdUnits ?? null,
    data.certificateNumber ?? null,
    data.certificateKey ?? null,
    data.remarks ?? null,
    data.scheduleVersion ?? 1,
    data.staffResponse ?? "Pending",
    data.staffResponseReason ?? null,
    data.attendanceOutcome ?? "not_recorded",
    data.evidenceStatus ?? "None",
    data.evidenceRequired !== void 0 ? data.evidenceRequired ? 1 : 0 : 0,
    data.conflictOverrideReason ?? null,
    data.conflictOverrideBy ?? null
  );
  return Number(res.lastInsertRowid);
}
async function updateNurseTraining(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(nurseTrainings).set(data).where(eq(nurseTrainings.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  const fields = [
    "status",
    "participationRole",
    "provider",
    "trainingHours",
    "cpdUnits",
    "certificateNumber",
    "certificateKey",
    "remarks",
    "scheduleVersion",
    "staffResponse",
    "staffResponseReason",
    "staffResponseVersion",
    "attendanceOutcome",
    "attendanceRecordedBy",
    "attendanceNote",
    "evidenceStatus",
    "evidenceRequired",
    "evidenceReviewedBy",
    "evidenceReviewNote",
    "conflictOverrideReason",
    "conflictOverrideBy"
  ];
  for (const f of fields) {
    if (data[f] !== void 0) {
      sets.push(`${f} = ?`);
      vals.push(data[f] ?? null);
    }
  }
  if (data.scheduledDate !== void 0) {
    sets.push("scheduledDate = ?");
    vals.push(data.scheduledDate ? data.scheduledDate instanceof Date ? data.scheduledDate.toISOString().slice(0, 10) : String(data.scheduledDate) : null);
  }
  if (data.completionDate !== void 0) {
    sets.push("completionDate = ?");
    vals.push(data.completionDate ? data.completionDate instanceof Date ? data.completionDate.toISOString().slice(0, 10) : String(data.completionDate) : null);
  }
  if (data.expiryDate !== void 0) {
    sets.push("expiryDate = ?");
    vals.push(data.expiryDate ? data.expiryDate instanceof Date ? data.expiryDate.toISOString().slice(0, 10) : String(data.expiryDate) : null);
  }
  if (data.staffRespondedAt !== void 0) {
    sets.push("staffRespondedAt = ?");
    vals.push(data.staffRespondedAt ? data.staffRespondedAt instanceof Date ? data.staffRespondedAt.toISOString() : String(data.staffRespondedAt) : null);
  }
  if (data.attendanceRecordedAt !== void 0) {
    sets.push("attendanceRecordedAt = ?");
    vals.push(data.attendanceRecordedAt ? data.attendanceRecordedAt instanceof Date ? data.attendanceRecordedAt.toISOString() : String(data.attendanceRecordedAt) : null);
  }
  if (data.evidenceSubmittedAt !== void 0) {
    sets.push("evidenceSubmittedAt = ?");
    vals.push(data.evidenceSubmittedAt ? data.evidenceSubmittedAt instanceof Date ? data.evidenceSubmittedAt.toISOString() : String(data.evidenceSubmittedAt) : null);
  }
  if (data.evidenceReviewedAt !== void 0) {
    sets.push("evidenceReviewedAt = ?");
    vals.push(data.evidenceReviewedAt ? data.evidenceReviewedAt instanceof Date ? data.evidenceReviewedAt.toISOString() : String(data.evidenceReviewedAt) : null);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE nurseTrainings SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function deleteNurseTraining(id) {
  const db = await getDb();
  if (db) {
    return db.transaction(async (tx) => {
      const [record] = await tx.select().from(nurseTrainings).where(eq(nurseTrainings.id, id)).limit(1);
      if (!record) return null;
      await tx.delete(nurseTrainings).where(eq(nurseTrainings.id, id));
      return record;
    });
  }
  const sqlite = getSqliteDb();
  return sqlite.transaction(() => {
    const record = sqlite.prepare("SELECT * FROM nurseTrainings WHERE id = ?").get(id);
    if (!record) return null;
    sqlite.prepare("DELETE FROM nurseTrainings WHERE id = ?").run(id);
    return record;
  })();
}
async function findOrCreateTrainingEvent(data) {
  const startKey = dateKey(data.startDate);
  const endKey = dateKey(data.endDate) || startKey;
  if (!startKey) throw new Error("findOrCreateTrainingEvent requires a valid startDate");
  const start = /* @__PURE__ */ new Date(`${startKey}T00:00:00Z`);
  const end = /* @__PURE__ */ new Date(`${endKey}T00:00:00Z`);
  const db = await getDb();
  if (db) {
    const [existing2] = await db.select({ id: trainingEvents.id }).from(trainingEvents).where(and(eq(trainingEvents.trainingId, data.trainingId), eq(trainingEvents.startDate, start), eq(trainingEvents.endDate, end))).limit(1);
    if (existing2) return { id: existing2.id, created: false };
    const [row] = await db.insert(trainingEvents).values({
      trainingId: data.trainingId,
      startDate: start,
      endDate: end,
      provider: data.provider ?? null,
      venue: data.venue ?? null,
      remarks: data.remarks ?? null
    }).returning({ id: trainingEvents.id });
    return { id: row.id, created: true };
  }
  const sqlite = getSqliteDb();
  const existing = sqlite.prepare("SELECT id FROM trainingEvents WHERE trainingId = ? AND startDate = ? AND endDate = ? LIMIT 1").get(data.trainingId, startKey, endKey);
  if (existing) return { id: existing.id, created: false };
  const res = sqlite.prepare("INSERT INTO trainingEvents (trainingId, provider, venue, startDate, endDate, remarks) VALUES (?, ?, ?, ?, ?, ?)").run(data.trainingId, data.provider ?? null, data.venue ?? null, startKey, endKey, data.remarks ?? null);
  return { id: Number(res.lastInsertRowid), created: true };
}
async function getNurseTrainingById(id) {
  const db = await getDb();
  if (db) {
    const [row] = await db.select().from(nurseTrainings).where(eq(nurseTrainings.id, id)).limit(1);
    return row ?? null;
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM nurseTrainings WHERE id = ?").get(id) ?? null;
}
async function findNurseTrainingByKey(params) {
  const compKey = dateKey(params.completionDate ?? null);
  const db = await getDb();
  if (db) {
    const conditions = [eq(nurseTrainings.nurseId, params.nurseId), eq(nurseTrainings.trainingId, params.trainingId)];
    if (params.eventId != null) conditions.push(eq(nurseTrainings.eventId, params.eventId));
    conditions.push(compKey ? eq(nurseTrainings.completionDate, /* @__PURE__ */ new Date(`${compKey}T00:00:00Z`)) : isNull(nurseTrainings.completionDate));
    const [row2] = await db.select({ id: nurseTrainings.id }).from(nurseTrainings).where(and(...conditions)).limit(1);
    return row2 ?? null;
  }
  const sqlite = getSqliteDb();
  const clauses = ["nurseId = ?", "trainingId = ?"];
  const vals = [params.nurseId, params.trainingId];
  if (params.eventId != null) {
    clauses.push("eventId = ?");
    vals.push(params.eventId);
  }
  if (compKey) {
    clauses.push("completionDate = ?");
    vals.push(compKey);
  } else {
    clauses.push("completionDate IS NULL");
  }
  const row = sqlite.prepare(`SELECT id FROM nurseTrainings WHERE ${clauses.join(" AND ")} LIMIT 1`).get(...vals);
  return row ?? null;
}
async function deleteTrainingEvent(id) {
  const db = await getDb();
  if (db) {
    return db.transaction(async (tx) => {
      const [selected] = await tx.select({ event: trainingEvents, training: trainingCatalog }).from(trainingEvents).innerJoin(trainingCatalog, eq(trainingCatalog.id, trainingEvents.trainingId)).where(eq(trainingEvents.id, id)).limit(1);
      if (!selected) return null;
      const attendance = await tx.select({ id: nurseTrainings.id }).from(nurseTrainings).where(eq(nurseTrainings.eventId, id));
      await tx.delete(nurseTrainings).where(eq(nurseTrainings.eventId, id));
      await tx.delete(trainingEvents).where(eq(trainingEvents.id, id));
      return { ...selected, attendanceDeleted: attendance.length };
    });
  }
  const sqlite = getSqliteDb();
  return sqlite.transaction(() => {
    const selected = sqlite.prepare(`
      SELECT e.*, c.id AS catalogId, c.name AS trainingName, c.kind AS trainingKind
      FROM trainingEvents e
      INNER JOIN trainingCatalog c ON c.id = e.trainingId
      WHERE e.id = ?
    `).get(id);
    if (!selected) return null;
    const attendanceDeleted = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM nurseTrainings WHERE eventId = ?").get(id).count);
    sqlite.prepare("DELETE FROM nurseTrainings WHERE eventId = ?").run(id);
    sqlite.prepare("DELETE FROM trainingEvents WHERE id = ?").run(id);
    const { catalogId, trainingName, trainingKind, ...event } = selected;
    return {
      event,
      training: { id: catalogId, name: trainingName, kind: trainingKind },
      attendanceDeleted
    };
  })();
}
async function deleteTrainingCatalogItem(id) {
  const db = await getDb();
  if (db) {
    return db.transaction(async (tx) => {
      const [catalog] = await tx.select().from(trainingCatalog).where(eq(trainingCatalog.id, id)).limit(1);
      if (!catalog) return null;
      const attendance = await tx.select({ id: nurseTrainings.id }).from(nurseTrainings).where(eq(nurseTrainings.trainingId, id));
      const events = await tx.select({ id: trainingEvents.id }).from(trainingEvents).where(eq(trainingEvents.trainingId, id));
      await tx.delete(nurseTrainings).where(eq(nurseTrainings.trainingId, id));
      await tx.delete(trainingEvents).where(eq(trainingEvents.trainingId, id));
      await tx.delete(areaTrainingRequirements).where(eq(areaTrainingRequirements.trainingId, id));
      await tx.delete(trainingCatalog).where(eq(trainingCatalog.id, id));
      return {
        catalog,
        eventsDeleted: events.length,
        attendanceDeleted: attendance.length
      };
    });
  }
  const sqlite = getSqliteDb();
  return sqlite.transaction(() => {
    const catalog = sqlite.prepare("SELECT * FROM trainingCatalog WHERE id = ?").get(id);
    if (!catalog) return null;
    const attendanceDeleted = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM nurseTrainings WHERE trainingId = ?").get(id).count);
    const eventsDeleted = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM trainingEvents WHERE trainingId = ?").get(id).count);
    sqlite.prepare("DELETE FROM nurseTrainings WHERE trainingId = ?").run(id);
    sqlite.prepare("DELETE FROM trainingEvents WHERE trainingId = ?").run(id);
    sqlite.prepare("DELETE FROM areaTrainingRequirements WHERE trainingId = ?").run(id);
    sqlite.prepare("DELETE FROM trainingCatalog WHERE id = ?").run(id);
    return {
      catalog: {
        ...catalog,
        active: Boolean(catalog.active),
        renewalRequired: Boolean(catalog.renewalRequired)
      },
      eventsDeleted,
      attendanceDeleted
    };
  })();
}
async function getAreaTrainingRequirementIds(areaId) {
  const db = await getDb();
  if (db) {
    const rows2 = await db.select({ trainingId: areaTrainingRequirements.trainingId }).from(areaTrainingRequirements).where(and(eq(areaTrainingRequirements.areaId, areaId), eq(areaTrainingRequirements.required, true)));
    return rows2.map((r) => r.trainingId);
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare("SELECT trainingId FROM areaTrainingRequirements WHERE areaId = ? AND required = 1").all(areaId);
  return rows.map((r) => r.trainingId);
}
async function listRequiredTrainings() {
  const db = await getDb();
  if (db) {
    return db.select({ areaId: areaTrainingRequirements.areaId, trainingId: areaTrainingRequirements.trainingId }).from(areaTrainingRequirements).where(eq(areaTrainingRequirements.required, true));
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT areaId, trainingId FROM areaTrainingRequirements WHERE required = 1").all();
}
async function setAreaTrainingRequirement(areaId, trainingId, required) {
  const db = await getDb();
  if (db) {
    await db.insert(areaTrainingRequirements).values({ areaId, trainingId, required }).onConflictDoUpdate({
      target: [areaTrainingRequirements.areaId, areaTrainingRequirements.trainingId],
      set: { required }
    });
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("INSERT INTO areaTrainingRequirements (areaId, trainingId, required) VALUES (?, ?, ?) ON CONFLICT(areaId, trainingId) DO UPDATE SET required = excluded.required").run(areaId, trainingId, required ? 1 : 0);
}
async function listCustomEvents(opts = {}) {
  const db = await getDb();
  if (db) {
    const conds2 = [];
    if (opts.from) conds2.push(gte(customCalendarEvents.eventDate, opts.from));
    if (opts.to) conds2.push(lte(customCalendarEvents.eventDate, opts.to));
    if (opts.nurseId !== void 0) conds2.push(eq(customCalendarEvents.nurseId, opts.nurseId));
    if (opts.areaId !== void 0) conds2.push(eq(customCalendarEvents.areaId, opts.areaId));
    const q = conds2.length ? db.select().from(customCalendarEvents).where(and(...conds2)) : db.select().from(customCalendarEvents);
    return await q.orderBy(asc(customCalendarEvents.eventDate));
  }
  const sqlite = getSqliteDb();
  const conds = [];
  const params = [];
  if (opts.from) {
    conds.push("date(eventDate) >= date(?)");
    params.push(opts.from instanceof Date ? opts.from.toISOString().slice(0, 10) : String(opts.from));
  }
  if (opts.to) {
    conds.push("date(eventDate) <= date(?)");
    params.push(opts.to instanceof Date ? opts.to.toISOString().slice(0, 10) : String(opts.to));
  }
  if (opts.nurseId !== void 0) {
    conds.push("nurseId = ?");
    params.push(opts.nurseId);
  }
  if (opts.areaId !== void 0) {
    conds.push("areaId = ?");
    params.push(opts.areaId);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = sqlite.prepare(`SELECT * FROM customCalendarEvents ${where} ORDER BY date(eventDate) ASC`).all(...params);
  return rows.map((r) => ({ ...r, allDay: Boolean(r.allDay) }));
}
async function createCustomEvent(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(customCalendarEvents).values(data).returning({ id: customCalendarEvents.id });
    return row.id;
  }
  const sqlite = getSqliteDb();
  const dateStr = data.eventDate instanceof Date ? data.eventDate.toISOString().slice(0, 10) : String(data.eventDate);
  const res = sqlite.prepare("INSERT INTO customCalendarEvents (title, eventDate, startTime, endTime, allDay, nurseId, areaId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    data.title,
    dateStr,
    data.startTime ?? null,
    data.endTime ?? null,
    data.allDay !== false ? 1 : 0,
    data.nurseId ?? null,
    data.areaId ?? null,
    data.description ?? null
  );
  return Number(res.lastInsertRowid);
}
async function updateCustomEvent(id, data) {
  const db = await getDb();
  if (db) {
    await db.update(customCalendarEvents).set(data).where(eq(customCalendarEvents.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  const sets = [];
  const vals = [];
  if (data.title !== void 0) {
    sets.push("title = ?");
    vals.push(data.title);
  }
  if (data.eventDate !== void 0) {
    sets.push("eventDate = ?");
    vals.push(data.eventDate instanceof Date ? data.eventDate.toISOString().slice(0, 10) : String(data.eventDate));
  }
  if (data.startTime !== void 0) {
    sets.push("startTime = ?");
    vals.push(data.startTime);
  }
  if (data.endTime !== void 0) {
    sets.push("endTime = ?");
    vals.push(data.endTime);
  }
  if (data.allDay !== void 0) {
    sets.push("allDay = ?");
    vals.push(data.allDay ? 1 : 0);
  }
  if (data.nurseId !== void 0) {
    sets.push("nurseId = ?");
    vals.push(data.nurseId);
  }
  if (data.areaId !== void 0) {
    sets.push("areaId = ?");
    vals.push(data.areaId);
  }
  if (data.description !== void 0) {
    sets.push("description = ?");
    vals.push(data.description);
  }
  if (sets.length) {
    vals.push(id);
    sqlite.prepare(`UPDATE customCalendarEvents SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
}
async function deleteCustomEvent(id) {
  const db = await getDb();
  if (db) {
    await db.delete(customCalendarEvents).where(eq(customCalendarEvents.id, id));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("DELETE FROM customCalendarEvents WHERE id = ?").run(id);
}
function getNotificationLogicalKey(n) {
  if (n.type === "license.expired") {
    return `license.expired:${n.nurseId ?? ""}:${n.relatedEntityType ?? ""}:${n.relatedEntityId ?? ""}`;
  }
  if (n.type === "license.renewalReminder") {
    const prefix = (n.title ?? "").split(" \u2014 ")[0].trim();
    return `license.renewalReminder:${n.nurseId ?? ""}:${n.relatedEntityType ?? ""}:${n.relatedEntityId ?? ""}:${prefix}`;
  }
  if (n.relatedEntityType && n.relatedEntityId) {
    return `${n.type}:${n.nurseId ?? ""}:${n.relatedEntityType}:${n.relatedEntityId}`;
  }
  return `notif:${n.id ?? Math.random()}`;
}
async function listNotifications(limit = 100) {
  const db = await getDb();
  let rawRows = [];
  if (db) {
    rawRows = await db.select().from(notifications).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit * 3);
  } else {
    const sqlite = getSqliteDb();
    rawRows = sqlite.prepare("SELECT * FROM notifications ORDER BY datetime(createdAt) DESC, id DESC LIMIT ?").all(limit * 3);
  }
  const seen = /* @__PURE__ */ new Set();
  const deduplicated = [];
  for (const row of rawRows) {
    const key = getNotificationLogicalKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(row);
      if (deduplicated.length >= limit) break;
    }
  }
  return deduplicated;
}
async function countUnreadNotificationsPg(db) {
  const [row] = await db.select({ count: sql2`count(distinct ${notificationLogicalKeySql})::int` }).from(notifications).where(isNull(notifications.readAt));
  return Number(row?.count ?? 0);
}
async function countUnreadNotifications() {
  const db = await getDb();
  if (db) return countUnreadNotificationsPg(db);
  const sqlite = getSqliteDb();
  const unreadRows = sqlite.prepare("SELECT * FROM notifications WHERE readAt IS NULL").all();
  const seen = /* @__PURE__ */ new Set();
  for (const row of unreadRows) {
    const key = getNotificationLogicalKey(row);
    seen.add(key);
  }
  return seen.size;
}
async function createNotification(data) {
  const db = await getDb();
  if (db) {
    const dayKey2 = data.dayKey != null ? /* @__PURE__ */ new Date(data.dayKey + "T00:00:00") : /* @__PURE__ */ new Date(todayDate2().slice(0, 10) + "T00:00:00");
    await db.insert(notifications).values({
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message ?? null,
      nurseId: data.nurseId ?? null,
      relatedEntityType: data.relatedEntityType ?? null,
      relatedEntityId: data.relatedEntityId ?? null,
      dayKey: dayKey2
    }).onConflictDoNothing();
    return 1;
  }
  const sqlite = getSqliteDb();
  const dayKey = data.dayKey ?? todayDate2();
  const res = sqlite.prepare("INSERT INTO notifications (type, severity, title, message, nurseId, relatedEntityType, relatedEntityId, dayKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    data.type,
    data.severity,
    data.title,
    data.message ?? null,
    data.nurseId ?? null,
    data.relatedEntityType ?? null,
    data.relatedEntityId ?? null,
    dayKey
  );
  return Number(res.lastInsertRowid);
}
async function createNotificationsBatch(data) {
  if (data.length === 0) return;
  const db = await getDb();
  if (db) {
    const rawRows = data.map((d) => ({
      type: d.type,
      severity: d.severity,
      title: d.title,
      message: d.message ?? null,
      nurseId: d.nurseId ?? null,
      relatedEntityType: d.relatedEntityType ?? null,
      relatedEntityId: d.relatedEntityId ?? null,
      dayKey: d.dayKey != null ? /* @__PURE__ */ new Date(d.dayKey + "T00:00:00") : /* @__PURE__ */ new Date(todayDate2().slice(0, 10) + "T00:00:00")
    }));
    const seen = /* @__PURE__ */ new Set();
    const rows = rawRows.filter((r) => {
      const k = `${r.type}:${r.nurseId}:${r.relatedEntityType}:${r.relatedEntityId}:${dateKey(r.dayKey)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (rows.length > 0) {
      await db.insert(notifications).values(rows).onConflictDoNothing();
    }
    return;
  }
  const sqlite = getSqliteDb();
  const insert = sqlite.prepare("INSERT OR IGNORE INTO notifications (type, severity, title, message, nurseId, relatedEntityType, relatedEntityId, dayKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertAll = sqlite.transaction((rows) => {
    for (const d of rows) {
      insert.run(d.type, d.severity, d.title, d.message ?? null, d.nurseId ?? null, d.relatedEntityType ?? null, d.relatedEntityId ?? null, d.dayKey ?? todayDate2());
    }
  });
  insertAll(data);
}
async function markNotificationRead(id) {
  const db = await getDb();
  if (db) {
    const target2 = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (target2.length > 0) {
      const t2 = target2[0];
      if (t2.relatedEntityType && t2.relatedEntityId) {
        await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(sql2`${notifications.type} = ${t2.type} AND (${notifications.nurseId} = ${t2.nurseId} OR (${notifications.nurseId} IS NULL AND ${t2.nurseId} IS NULL)) AND ${notifications.relatedEntityType} = ${t2.relatedEntityType} AND ${notifications.relatedEntityId} = ${t2.relatedEntityId} AND ${notifications.readAt} IS NULL`);
      } else {
        await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(eq(notifications.id, id));
      }
    }
    return;
  }
  const sqlite = getSqliteDb();
  const target = sqlite.prepare("SELECT * FROM notifications WHERE id = ?").get(id);
  if (target && target.relatedEntityType && target.relatedEntityId) {
    sqlite.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE type = ? AND (nurseId = ? OR (nurseId IS NULL AND ? IS NULL)) AND relatedEntityType = ? AND relatedEntityId = ? AND readAt IS NULL").run(target.type, target.nurseId ?? null, target.nurseId ?? null, target.relatedEntityType, target.relatedEntityId);
  } else {
    sqlite.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  }
}
async function markAllNotificationsRead() {
  const db = await getDb();
  if (db) {
    await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(isNull(notifications.readAt));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE readAt IS NULL").run();
}
async function logActivity(data) {
  const db = await getDb();
  if (db) {
    await db.insert(activityLog).values(data);
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("INSERT INTO activityLog (supervisorId, nurseId, actionType, entityType, entityId, summary, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    data.supervisorId ?? null,
    data.nurseId ?? null,
    data.actionType,
    data.entityType ?? null,
    data.entityId ?? null,
    data.summary,
    data.metadata ? JSON.stringify(data.metadata) : null
  );
}
async function listActivityForNurse(nurseId) {
  const db = await getDb();
  if (db) return await db.select().from(activityLog).where(eq(activityLog.nurseId, nurseId)).orderBy(desc(activityLog.createdAt)).limit(200);
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM activityLog WHERE nurseId = ? ORDER BY date(createdAt) DESC LIMIT 200").all(nurseId);
}
async function getSetting(key) {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }
  const sqlite = getSqliteDb();
  const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = ?").get(key);
  return row?.value ?? null;
}
async function setSetting(key, value) {
  const db = await getDb();
  if (db) {
    await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("INSERT INTO appSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
async function getAllSettings() {
  const db = await getDb();
  if (db) return await db.select().from(appSettings);
  const sqlite = getSqliteDb();
  return sqlite.prepare("SELECT * FROM appSettings").all();
}
async function countActiveNurses(today) {
  const db = await getDb();
  if (db) {
    const rows = await db.select({ count: sql2`count(*)` }).from(nurses).where(activeNurseCondition());
    return Number(rows[0]?.count ?? 0);
  }
  const sqlite = getSqliteDb();
  const row = sqlite.prepare(`SELECT count(*) as count FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST})`).get();
  return row.count;
}
async function recordEmailLog(data) {
  const db = await getDb();
  if (db) {
    const [row] = await db.insert(emailLogs).values(data).returning({ id: emailLogs.id });
    return Number(row?.id ?? 0);
  }
  const sqlite = getSqliteDb();
  const info = sqlite.prepare(
    `INSERT INTO emailLogs (nurseId, recipientEmail, emailType, referenceId, thresholdKey, subject, status, errorMessage, sentAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    data.nurseId,
    data.recipientEmail,
    data.emailType,
    data.referenceId ?? null,
    data.thresholdKey ?? null,
    data.subject,
    data.status ?? "sent",
    data.errorMessage ?? null
  );
  return Number(info.lastInsertRowid);
}
async function isEmailDuplicate(params) {
  const countMock = params.includeMock ?? !process.env.RESEND_API_KEY;
  const statuses = countMock ? ["sent", "mock_sent"] : ["sent"];
  const db = await getDb();
  if (db) {
    const conditions = [
      eq(emailLogs.nurseId, params.nurseId),
      eq(emailLogs.emailType, params.emailType),
      inArray(emailLogs.status, statuses)
    ];
    if (params.referenceId !== void 0) {
      conditions.push(params.referenceId === null ? isNull(emailLogs.referenceId) : eq(emailLogs.referenceId, params.referenceId));
    }
    if (params.thresholdKey !== void 0) {
      conditions.push(params.thresholdKey === null ? isNull(emailLogs.thresholdKey) : eq(emailLogs.thresholdKey, params.thresholdKey));
    }
    const rows = await db.select({ id: emailLogs.id }).from(emailLogs).where(and(...conditions)).limit(1);
    return rows.length > 0;
  }
  const sqlite = getSqliteDb();
  const statusList = statuses.map((s) => `'${s}'`).join(", ");
  let query = `SELECT id FROM emailLogs WHERE nurseId = ? AND emailType = ? AND status IN (${statusList})`;
  const binds = [params.nurseId, params.emailType];
  if (params.referenceId !== void 0) {
    if (params.referenceId === null) {
      query += ` AND referenceId IS NULL`;
    } else {
      query += ` AND referenceId = ?`;
      binds.push(params.referenceId);
    }
  }
  if (params.thresholdKey !== void 0) {
    if (params.thresholdKey === null) {
      query += ` AND thresholdKey IS NULL`;
    } else {
      query += ` AND thresholdKey = ?`;
      binds.push(params.thresholdKey);
    }
  }
  query += ` LIMIT 1`;
  const row = sqlite.prepare(query).get(...binds);
  return Boolean(row);
}
async function listRecentEmailLogs(limit = 50) {
  const db = await getDb();
  if (db) {
    return await db.select({
      id: emailLogs.id,
      nurseId: emailLogs.nurseId,
      recipientEmail: emailLogs.recipientEmail,
      emailType: emailLogs.emailType,
      referenceId: emailLogs.referenceId,
      thresholdKey: emailLogs.thresholdKey,
      subject: emailLogs.subject,
      status: emailLogs.status,
      errorMessage: emailLogs.errorMessage,
      sentAt: emailLogs.sentAt,
      nurseName: sql2`concat(${nurses.firstName}, ' ', ${nurses.lastName})`,
      nursePhotoKey: nurses.profilePhotoKey
    }).from(emailLogs).leftJoin(nurses, eq(nurses.id, emailLogs.nurseId)).orderBy(desc(emailLogs.sentAt)).limit(limit);
  }
  const sqlite = getSqliteDb();
  return sqlite.prepare(
    `SELECT l.*, (n.firstName || ' ' || n.lastName) as nurseName, n.profilePhotoKey as nursePhotoKey
       FROM emailLogs l
       LEFT JOIN nurses n ON n.id = l.nurseId
       ORDER BY l.sentAt DESC LIMIT ?`
  ).all(limit);
}
async function acquireReminderLock(leaseDurationMs = 5 * 60 * 1e3) {
  const now = Date.now();
  const expiresAt = now + leaseDurationMs;
  const dbConn = await getDb();
  if (dbConn) {
    const current = await dbConn.select().from(appSettings).where(eq(appSettings.key, "reminder_lock")).limit(1);
    if (current.length > 0 && current[0].value) {
      try {
        const parsed = JSON.parse(current[0].value);
        if (parsed.leaseExpiresAt && parsed.leaseExpiresAt > now) {
          return false;
        }
      } catch {
      }
    }
    const val2 = JSON.stringify({ lockedAt: now, leaseExpiresAt: expiresAt });
    await dbConn.insert(appSettings).values({ key: "reminder_lock", value: val2 }).onConflictDoUpdate({ target: appSettings.key, set: { value: val2 } });
    return true;
  }
  const sqlite = getSqliteDb();
  const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = ?").get("reminder_lock");
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed.leaseExpiresAt && parsed.leaseExpiresAt > now) {
        return false;
      }
    } catch {
    }
  }
  const val = JSON.stringify({ lockedAt: now, leaseExpiresAt: expiresAt });
  sqlite.prepare("INSERT INTO appSettings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("reminder_lock", val);
  return true;
}
async function releaseReminderLock() {
  const dbConn = await getDb();
  if (dbConn) {
    await dbConn.delete(appSettings).where(eq(appSettings.key, "reminder_lock"));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("DELETE FROM appSettings WHERE key = ?").run("reminder_lock");
}
async function ensureStoredFilesTable() {
  if (_storedFilesTableEnsured) return;
  const pg = getBatchClient();
  if (pg) {
    try {
      await pg.unsafe(`
        CREATE TABLE IF NOT EXISTS nursetrack."storedFiles" (
          id SERIAL PRIMARY KEY,
          key VARCHAR(512) NOT NULL UNIQUE,
          data TEXT NOT NULL,
          "mimeType" VARCHAR(128) NOT NULL,
          "fileSize" INTEGER NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      _storedFilesTableEnsured = true;
      return;
    } catch (e) {
      console.warn("[Database] Could not create nursetrack.storedFiles table:", e);
    }
  }
  const sqlite = getSqliteDb();
  if (sqlite) {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS storedFiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL,
          mimeType TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      _storedFilesTableEnsured = true;
    } catch (e) {
      console.warn("[Database] Could not create sqlite storedFiles table:", e);
    }
  }
}
async function saveStoredFile(key, base64Data, mimeType, fileSize) {
  await ensureStoredFilesTable();
  const pg = getBatchClient();
  if (pg) {
    await pg.unsafe(
      `
      INSERT INTO nursetrack."storedFiles" (key, data, "mimeType", "fileSize", "createdAt")
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = EXCLUDED.data,
          "mimeType" = EXCLUDED."mimeType",
          "fileSize" = EXCLUDED."fileSize",
          "createdAt" = NOW()
    `,
      [key, base64Data, mimeType, fileSize]
    );
    return;
  }
  const d = await getDb();
  if (d) {
    try {
      await d.insert(storedFiles).values({
        key,
        data: base64Data,
        mimeType,
        fileSize
      }).onConflictDoUpdate({
        target: storedFiles.key,
        set: {
          data: base64Data,
          mimeType,
          fileSize,
          createdAt: /* @__PURE__ */ new Date()
        }
      });
      return;
    } catch {
    }
  }
  const sqlite = getSqliteDb();
  sqlite.prepare(
    `INSERT INTO storedFiles (key, data, mimeType, fileSize, createdAt)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, mimeType = excluded.mimeType, fileSize = excluded.fileSize, createdAt = CURRENT_TIMESTAMP`
  ).run(key, base64Data, mimeType, fileSize);
}
async function getStoredFile(key) {
  await ensureStoredFilesTable();
  const pg = getBatchClient();
  if (pg) {
    try {
      const rows = await pg.unsafe(
        `SELECT key, data, "mimeType", "fileSize" FROM nursetrack."storedFiles" WHERE key = $1 LIMIT 1`,
        [key]
      );
      if (rows && rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[Database] getStoredFile pg query failed:", err);
    }
  }
  const d = await getDb();
  if (d) {
    try {
      const rows = await d.select().from(storedFiles).where(eq(storedFiles.key, key)).limit(1);
      if (rows && rows.length > 0) {
        return {
          key: rows[0].key,
          data: rows[0].data,
          mimeType: rows[0].mimeType,
          fileSize: rows[0].fileSize
        };
      }
    } catch {
    }
  }
  try {
    const sqlite = getSqliteDb();
    const row = sqlite.prepare(`SELECT key, data, mimeType, fileSize FROM storedFiles WHERE key = ? LIMIT 1`).get(key);
    return row ?? null;
  } catch {
    return null;
  }
}
async function deleteStoredFile(key) {
  await ensureStoredFilesTable();
  const pg = getBatchClient();
  if (pg) {
    try {
      await pg.unsafe(`DELETE FROM nursetrack."storedFiles" WHERE key = $1`, [key]);
      return;
    } catch (err) {
      console.warn("[Database] deleteStoredFile pg query failed:", err);
    }
  }
  const d = await getDb();
  if (d) {
    try {
      await d.delete(storedFiles).where(eq(storedFiles.key, key));
      return;
    } catch {
    }
  }
  try {
    const sqlite = getSqliteDb();
    sqlite.prepare("DELETE FROM storedFiles WHERE key = ?").run(key);
  } catch (err) {
    console.warn("[Database] deleteStoredFile sqlite failed:", err);
  }
}
async function purgeOrphanStoredFiles(olderThanHours = 2) {
  await ensureStoredFilesTable();
  const timeClausePg = olderThanHours <= 0 ? "" : `AND "createdAt" < NOW() - INTERVAL '${Math.max(1, Math.floor(olderThanHours))} hours'`;
  const timeClauseSqlite = olderThanHours <= 0 ? "" : `AND datetime(createdAt) <= datetime('now', '-${Math.max(1, Math.floor(olderThanHours))} hours')`;
  const pg = getBatchClient();
  if (pg) {
    try {
      const deleted = await pg.unsafe(`
        WITH deleted AS (
          DELETE FROM nursetrack."storedFiles"
          WHERE key NOT IN (
              SELECT "profilePhotoKey" FROM nursetrack.nurses WHERE "profilePhotoKey" IS NOT NULL
              UNION
              SELECT "documentKey" FROM nursetrack."nurseCredentials" WHERE "documentKey" IS NOT NULL
              UNION
              SELECT "certificateKey" FROM nursetrack."nurseTrainings" WHERE "certificateKey" IS NOT NULL
            )
            ${timeClausePg}
          RETURNING id
        )
        SELECT count(*)::int AS count FROM deleted;
      `);
      return deleted[0]?.count ?? 0;
    } catch (err) {
      console.warn("[Database] purgeOrphanStoredFiles pg query failed:", err);
    }
  }
  try {
    const sqlite = getSqliteDb();
    const res = sqlite.prepare(
      `
      DELETE FROM storedFiles
      WHERE key NOT IN (
          SELECT profilePhotoKey FROM nurses WHERE profilePhotoKey IS NOT NULL
          UNION
          SELECT documentKey FROM nurseCredentials WHERE documentKey IS NOT NULL
          UNION
          SELECT certificateKey FROM nurseTrainings WHERE certificateKey IS NOT NULL
        )
        ${timeClauseSqlite}
    `
    ).run();
    return res.changes;
  } catch (err) {
    console.warn("[Database] purgeOrphanStoredFiles sqlite query failed:", err);
    return 0;
  }
}
var _db, _batchPg, INACTIVE_STATUS_SQL_LIST, normalizeForMatch, notificationLogicalKeySql, _storedFilesTableEnsured;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_nursetrack();
    init_schema();
    init_adminAccess();
    init_localDb();
    _db = null;
    _batchPg = null;
    INACTIVE_STATUS_SQL_LIST = INACTIVE_EMPLOYMENT_STATUSES.map((s) => `'${s}'`).join(", ");
    normalizeForMatch = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    notificationLogicalKeySql = sql2`case
  when ${notifications.type} = 'license.expired' then concat(${notifications.type}, ':', coalesce(${notifications.nurseId}::text, ''), ':', coalesce(${notifications.relatedEntityType}, ''), ':', coalesce(${notifications.relatedEntityId}::text, ''))
  when ${notifications.type} = 'license.renewalReminder' then concat(${notifications.type}, ':', coalesce(${notifications.nurseId}::text, ''), ':', coalesce(${notifications.relatedEntityType}, ''), ':', coalesce(${notifications.relatedEntityId}::text, ''), ':', btrim(split_part(coalesce(${notifications.title}, ''), ' — ', 1)))
  when coalesce(${notifications.relatedEntityType}, '') <> '' and coalesce(${notifications.relatedEntityId}, 0) <> 0 then concat(${notifications.type}, ':', coalesce(${notifications.nurseId}::text, ''), ':', ${notifications.relatedEntityType}, ':', ${notifications.relatedEntityId}::text)
  else concat('notif:', ${notifications.id}::text)
end`;
    _storedFilesTableEnsured = false;
  }
});

// shared/_core/errors.ts
var HttpError, ForbiddenError;
var init_errors = __esm({
  "shared/_core/errors.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
      }
    };
    ForbiddenError = (msg) => new HttpError(403, msg);
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
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
  }
});

// server/_core/sdk.ts
import { randomBytes } from "crypto";
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString, GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, OAuthService, createOAuthHttpClient, SDKServer, sdk;
var init_sdk = __esm({
  "server/_core/sdk.ts"() {
    "use strict";
    init_const();
    init_errors();
    init_db();
    init_env();
    isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
    OAuthService = class {
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
    createOAuthHttpClient = () => axios.create({
      timeout: AXIOS_TIMEOUT_MS
    });
    SDKServer = class {
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
      /**
       * Sign a short-lived staff claim token binding one nurseId to the browser
       * that identified via PRC/employee ID, before any Google login exists.
       * Distinct `typ` claim keeps it from ever being accepted as a session token
       * (and vice versa), even though both share the app's JWT secret.
       */
      async createClaimToken(nurseId) {
        const secretKey = this.getSessionSecret();
        const nonce = randomBytes(16).toString("hex");
        const expirationSeconds = Math.floor((Date.now() + CLAIM_TTL_MS) / 1e3);
        return new SignJWT({ typ: "staff-claim", nurseId, nonce }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
      }
      async verifyClaimToken(cookieValue) {
        if (!cookieValue) return null;
        try {
          const secretKey = this.getSessionSecret();
          const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
          if (payload.typ !== "staff-claim") return null;
          const { nurseId } = payload;
          return typeof nurseId === "number" && Number.isFinite(nurseId) ? nurseId : null;
        } catch (error) {
          console.warn("[Auth] Claim token verification failed", String(error));
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
    sdk = new SDKServer();
  }
});

// server/email/service.ts
var service_exports = {};
__export(service_exports, {
  sendEmail: () => sendEmail
});
async function sendEmail(opts) {
  const isProd = process.env.NODE_ENV === "production";
  const apiKey = process.env.NODE_ENV === "test" && !process.env.TEST_RESEND_LIVE ? void 0 : process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (isProd) {
      const errText = "Email service unconfigured: RESEND_API_KEY missing in production";
      console.error(`[Email:ConfigError] ${errText}`);
      await recordEmailLog({
        nurseId: opts.nurseId,
        recipientEmail: opts.to,
        emailType: opts.emailType,
        referenceId: opts.referenceId ?? null,
        thresholdKey: opts.thresholdKey ?? null,
        subject: opts.subject,
        status: "failed",
        errorMessage: errText
      });
      return { success: false, status: "failed", error: errText };
    }
    console.log(`[Email:Mock] To: ${opts.to} | Subject: "${opts.subject}" | Type: ${opts.emailType}`);
    await recordEmailLog({
      nurseId: opts.nurseId,
      recipientEmail: opts.to,
      emailType: opts.emailType,
      referenceId: opts.referenceId ?? null,
      thresholdKey: opts.thresholdKey ?? null,
      subject: opts.subject,
      status: "mock_sent",
      errorMessage: null
    });
    return { success: true, status: "mock_sent" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8e3),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Email:ResendError] ${res.status}: ${errText}`);
      await recordEmailLog({
        nurseId: opts.nurseId,
        recipientEmail: opts.to,
        emailType: opts.emailType,
        referenceId: opts.referenceId ?? null,
        thresholdKey: opts.thresholdKey ?? null,
        subject: opts.subject,
        status: "failed",
        errorMessage: errText.slice(0, 1e3)
      });
      return { success: false, status: "failed", error: errText };
    }
    await recordEmailLog({
      nurseId: opts.nurseId,
      recipientEmail: opts.to,
      emailType: opts.emailType,
      referenceId: opts.referenceId ?? null,
      thresholdKey: opts.thresholdKey ?? null,
      subject: opts.subject,
      status: "sent",
      errorMessage: null
    });
    const resData = await res.json().catch(() => null);
    return { success: true, status: "sent", messageId: resData?.id };
  } catch (err) {
    const errorMsg = err?.message || String(err);
    console.error(`[Email:Exception] ${errorMsg}`);
    await recordEmailLog({
      nurseId: opts.nurseId,
      recipientEmail: opts.to,
      emailType: opts.emailType,
      referenceId: opts.referenceId ?? null,
      thresholdKey: opts.thresholdKey ?? null,
      subject: opts.subject,
      status: "failed",
      errorMessage: errorMsg.slice(0, 1e3)
    });
    return { success: false, status: "failed", error: errorMsg };
  }
}
var DEFAULT_FROM;
var init_service = __esm({
  "server/email/service.ts"() {
    "use strict";
    init_db();
    DEFAULT_FROM = process.env.EMAIL_FROM || "SKTI NurseTrack <onboarding@resend.dev>";
  }
});

// server/email/templates.ts
var templates_exports = {};
__export(templates_exports, {
  escapeHtml: () => escapeHtml,
  renderDirectNoticeEmail: () => renderDirectNoticeEmail,
  renderLicenseExpiryEmail: () => renderLicenseExpiryEmail,
  renderProfileUpdateEmail: () => renderProfileUpdateEmail,
  renderSeminarAnnouncementEmail: () => renderSeminarAnnouncementEmail,
  renderSeminarReminderEmail: () => renderSeminarReminderEmail,
  renderTrainingMilestoneEmail: () => renderTrainingMilestoneEmail,
  renderTrainingNoticeEmail: () => renderTrainingNoticeEmail
});
function baseLayout({
  title,
  preheader,
  contentHtml,
  actionButton
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; color: #1e293b; line-height: 1.6; }
    .wrapper { width: 100%; max-width: 600px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 8px 0 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; }
    .content { padding: 32px 24px; }
    .card-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; text-align: center; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .badge-urgent { display: inline-block; background-color: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
    .badge-warning { display: inline-block; background-color: #fef3c7; color: #d97706; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
    .badge-info { display: inline-block; background-color: #e0f2fe; color: #0284c7; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>` : ""}
  <div class="wrapper">
    <div class="header">
      <p>Southern Philippines Medical Center &middot; Nephrology Cluster</p>
      <h1>SKTI NurseTrack</h1>
    </div>
    <div class="content">
      ${contentHtml}
      ${actionButton ? `<div style="text-align: center; margin-top: 24px;"><a href="${actionButton.url}" class="btn">${actionButton.label}</a></div>` : ""}
    </div>
    <div class="footer">
      <p>This is an automated notification from SKTI NurseTrack.<br>For questions or profile updates, log into your personal profile or contact your clinical supervisor.</p>
    </div>
  </div>
</body>
</html>`;
}
function renderLicenseExpiryEmail({
  nurseName,
  licenseType,
  licenseNumber,
  expiryDateStr,
  daysRemaining,
  thresholdKey,
  actionUrl
}) {
  const isExpired = daysRemaining <= 0;
  const badgeClass = isExpired || daysRemaining <= 30 ? "badge-urgent" : daysRemaining <= 90 ? "badge-warning" : "badge-info";
  const badgeLabel = isExpired ? "License Expired" : daysRemaining <= 30 ? "Urgent Renewal Required" : daysRemaining <= 180 ? "Upcoming Renewal" : "Advance Renewal Notice";
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="${badgeClass}">${badgeLabel}</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${nurseName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      ${isExpired ? `Your <strong>${licenseType}</strong> expired on <strong>${expiryDateStr}</strong> (${Math.abs(daysRemaining)} days ago). Continued clinical duty requires an active license.` : `Your <strong>${licenseType}</strong> is due to expire in <strong>${daysRemaining} days</strong> on <strong>${expiryDateStr}</strong>.`}
    </p>
    <div class="card-box">
      <table style="width: 100%; font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; font-weight: 600;">Credential:</td><td>${licenseType}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">License / ID:</td><td>${licenseNumber}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Expiry Date:</td><td>${expiryDateStr}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Days Remaining:</td><td><strong>${daysRemaining > 0 ? `${daysRemaining} days` : "EXPIRED"}</strong></td></tr>
      </table>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
      Please process your PRC renewal as soon as possible. Once renewed, visit your personal profile to upload your renewed license card or official receipt.
    </p>
  `;
  return baseLayout({
    title: `${isExpired ? "EXPIRED" : "Reminder"}: ${licenseType} Expiry Notice`,
    preheader: `License renewal notification for ${nurseName}`,
    contentHtml: content,
    actionButton: { label: "Upload Renewed License", url: actionUrl }
  });
}
function renderSeminarAnnouncementEmail({
  nurseName,
  seminarTitle,
  scheduledDateStr,
  venue,
  hours,
  cpdUnits,
  actionUrl
}) {
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="badge-info">New Seminar / Training</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${nurseName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      A new training seminar has been published for clinical staff in the Nephrology Cluster:
    </p>
    <div class="card-box">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0284c7;">${seminarTitle}</h3>
      <table style="width: 100%; font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Date & Time:</td><td>${scheduledDateStr}</td></tr>
        ${venue ? `<tr><td style="padding: 4px 0; font-weight: 600;">Venue:</td><td>${venue}</td></tr>` : ""}
        ${hours ? `<tr><td style="padding: 4px 0; font-weight: 600;">Hours:</td><td>${hours} Hours</td></tr>` : ""}
        ${cpdUnits ? `<tr><td style="padding: 4px 0; font-weight: 600;">CPD Units:</td><td>${cpdUnits} CPD Units</td></tr>` : ""}
      </table>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
      Check your staff profile to view your registration status, required training compliance, and seminar details.
    </p>
  `;
  return baseLayout({
    title: `New Training: ${seminarTitle}`,
    preheader: `Upcoming seminar announcement: ${seminarTitle}`,
    contentHtml: content,
    actionButton: { label: "View on NurseTrack", url: actionUrl }
  });
}
function renderSeminarReminderEmail({
  nurseName,
  seminarTitle,
  scheduledDateStr,
  venue,
  actionUrl
}) {
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="badge-warning">Reminder: Upcoming Seminar in 48 Hours</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${nurseName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      This is a friendly reminder that you are scheduled to attend the following seminar in 2 days:
    </p>
    <div class="card-box">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0f172a;">${seminarTitle}</h3>
      <table style="width: 100%; font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Schedule:</td><td>${scheduledDateStr}</td></tr>
        ${venue ? `<tr><td style="padding: 4px 0; font-weight: 600;">Venue:</td><td>${venue}</td></tr>` : ""}
      </table>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
      Please ensure your shift endorsement or coverage is coordinated with your unit head prior to attending.
    </p>
  `;
  return baseLayout({
    title: `Reminder: ${seminarTitle} (48 Hours)`,
    preheader: `Reminder for upcoming seminar ${seminarTitle}`,
    contentHtml: content,
    actionButton: { label: "View Seminar Details", url: actionUrl }
  });
}
function renderProfileUpdateEmail({
  nurseName,
  updateTitle,
  details,
  actionUrl
}) {
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="badge-info">Record Update</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${nurseName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      Your staff record has been updated by your clinical supervisor:
    </p>
    <div class="card-box">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #0284c7;">${updateTitle}</h4>
      <p style="margin: 0; font-size: 13px; color: #334155;">${details}</p>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
      You can review your updated information anytime on your personal staff profile.
    </p>
  `;
  return baseLayout({
    title: `Record Update: ${updateTitle}`,
    preheader: `Staff record update notice for ${nurseName}`,
    contentHtml: content,
    actionButton: { label: "View My Profile", url: actionUrl }
  });
}
function escapeHtml(str2) {
  return str2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function renderTrainingNoticeEmail({
  nurseName,
  noticeKind,
  trainingTitle,
  dateRangeStr,
  timeStr,
  venue,
  instructions,
  actionUrl
}) {
  const safeTitle = escapeHtml(trainingTitle);
  const safeName = escapeHtml(nurseName);
  const safeDates = escapeHtml(dateRangeStr);
  const safeTime = timeStr ? escapeHtml(timeStr) : "Time not specified";
  const safeVenue = venue ? escapeHtml(venue) : null;
  const safeInstructions = instructions ? escapeHtml(instructions) : null;
  let badgeClass = "badge-info";
  let badgeLabel = "Training Assignment";
  let leadText = `You have been assigned to <strong>${safeTitle}</strong>.`;
  if (noticeKind === "rescheduled") {
    badgeClass = "badge-warning";
    badgeLabel = "Schedule Change";
    leadText = `The schedule for <strong>${safeTitle}</strong> has been updated. Attendance confirmation is required for the new schedule.`;
  } else if (noticeKind === "cancelled") {
    badgeClass = "badge-urgent";
    badgeLabel = "Training Cancelled";
    leadText = `The training assignment for <strong>${safeTitle}</strong> has been cancelled. Attendance is no longer required.`;
  }
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="${badgeClass}">${badgeLabel}</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${safeName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      ${leadText}
    </p>
    <div class="card-box">
      <table style="width: 100%; font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Training:</td><td>${safeTitle}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Dates:</td><td>${safeDates}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Time:</td><td>${safeTime}</td></tr>
        ${safeVenue ? `<tr><td style="padding: 4px 0; font-weight: 600;">Venue:</td><td>${safeVenue}</td></tr>` : ""}
        ${safeInstructions ? `<tr><td style="padding: 4px 0; font-weight: 600;">Instructions:</td><td>${safeInstructions}</td></tr>` : ""}
      </table>
    </div>
    ${noticeKind !== "cancelled" ? `<p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
            Please visit your staff training calendar to confirm attendance or notify your supervisor if you cannot attend.
          </p>` : `<p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
            This event has been removed from your active requirements.
          </p>`}
  `;
  return baseLayout({
    title: `${badgeLabel}: ${safeTitle}`,
    preheader: `${badgeLabel} notice for ${safeTitle}`,
    contentHtml: content,
    actionButton: { label: "View in Staff Calendar", url: actionUrl }
  });
}
function renderTrainingMilestoneEmail({
  nurseName,
  trainingTitle,
  dateRangeStr,
  timeStr,
  venue,
  instructions,
  daysRemaining,
  isTodayOrTomorrow,
  actionUrl
}) {
  const safeTitle = escapeHtml(trainingTitle);
  const safeName = escapeHtml(nurseName);
  const safeDates = escapeHtml(dateRangeStr);
  const safeTime = timeStr ? escapeHtml(timeStr) : "Time not specified";
  const safeVenue = venue ? escapeHtml(venue) : null;
  const safeInstructions = instructions ? escapeHtml(instructions) : null;
  let badgeClass = "badge-info";
  let label = `Upcoming Training: ${daysRemaining} Days`;
  if (isTodayOrTomorrow === "today" || daysRemaining <= 0) {
    badgeClass = "badge-urgent";
    label = "Training Today";
  } else if (isTodayOrTomorrow === "tomorrow" || daysRemaining === 1) {
    badgeClass = "badge-warning";
    label = "Training Tomorrow";
  } else if (daysRemaining <= 7) {
    badgeClass = "badge-warning";
    label = `Training in ${daysRemaining} Days`;
  }
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="${badgeClass}">${label}</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${safeName}</h2>
    <p style="margin: 0 0 16px 0; color: #334155;">
      This is a reminder for your assigned training: <strong>${safeTitle}</strong>.
    </p>
    <div class="card-box">
      <table style="width: 100%; font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Training:</td><td>${safeTitle}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Dates:</td><td>${safeDates}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Time:</td><td>${safeTime}</td></tr>
        ${safeVenue ? `<tr><td style="padding: 4px 0; font-weight: 600;">Venue:</td><td>${safeVenue}</td></tr>` : ""}
        ${safeInstructions ? `<tr><td style="padding: 4px 0; font-weight: 600;">Instructions:</td><td>${safeInstructions}</td></tr>` : ""}
      </table>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">
      Please ensure your attendance is confirmed in your staff portal. If you cannot attend, submit your reason promptly so your unit supervisor can adjust coverage.
    </p>
  `;
  return baseLayout({
    title: `Reminder: ${safeTitle} (${label})`,
    preheader: `Reminder: ${safeTitle} starts soon`,
    contentHtml: content,
    actionButton: { label: "View in Staff Calendar", url: actionUrl }
  });
}
function renderDirectNoticeEmail({
  nurseName,
  subject,
  message,
  actionUrl
}) {
  const content = `
    <div style="margin-bottom: 16px;">
      <span class="badge-info">Supervisor Notice</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Hello, ${nurseName}</h2>
    <div class="card-box">
      <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;">${subject}</h3>
      <p style="margin: 0; font-size: 13px; color: #334155; white-space: pre-wrap;">${message}</p>
    </div>
  `;
  return baseLayout({
    title: subject,
    preheader: `Notice from your supervisor for ${nurseName}`,
    contentHtml: content,
    actionButton: { label: "Open NurseTrack Profile", url: actionUrl }
  });
}
var init_templates = __esm({
  "server/email/templates.ts"() {
    "use strict";
  }
});

// server/trainingReminders.ts
import { eq as eq2, and as and2, lte as lte2, isNull as isNull2, sql as sql3, inArray as inArray2, or as or2, desc as desc2 } from "drizzle-orm";
function getManilaTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(/* @__PURE__ */ new Date());
}
function parseDateKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function diffCalendarDays(dateStr2, dateStr1) {
  const d1 = parseDateKey(dateStr1);
  const d2 = parseDateKey(dateStr2);
  const msPerDay = 864e5;
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}
function addCalendarDays(dateStr, days) {
  const d = parseDateKey(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
async function loadTrainingSchedules(scope) {
  const db = await getDb();
  if (db) {
    const rows2 = await db.select({
      assignment: nurseTrainings,
      event: trainingEvents,
      catalog: trainingCatalog
    }).from(nurseTrainings).leftJoin(trainingEvents, eq2(trainingEvents.id, nurseTrainings.eventId)).leftJoin(trainingCatalog, eq2(trainingCatalog.id, nurseTrainings.trainingId)).where("assignmentId" in scope ? eq2(nurseTrainings.id, scope.assignmentId) : eq2(nurseTrainings.nurseId, scope.nurseId)).orderBy(desc2(nurseTrainings.scheduledDate));
    return rows2.map(({ assignment, event, catalog }) => {
      let startDateStr = "";
      let endDateStr = "";
      let startTime = null;
      let endTime = null;
      let venue = null;
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
        attendanceOutcome: assignment.attendanceOutcome || "not_recorded"
      };
    });
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare(
    `SELECT t.*, e.startDate as evStart, e.endDate as evEnd, e.startTime as evStartTime,
              e.endTime as evEndTime, e.venue as evVenue, e.remarks as evRemarks,
              c.name as catalogName
       FROM nurseTrainings t
       LEFT JOIN trainingEvents e ON e.id = t.eventId
       LEFT JOIN trainingCatalog c ON c.id = t.trainingId
       WHERE ${"assignmentId" in scope ? "t.id" : "t.nurseId"} = ?
       ORDER BY date(t.scheduledDate) DESC`
  ).all("assignmentId" in scope ? scope.assignmentId : scope.nurseId);
  return rows.map((row) => {
    let startDateStr = "";
    let endDateStr = "";
    let startTime = null;
    let endTime = null;
    let venue = null;
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
      attendanceOutcome: row.attendanceOutcome || "not_recorded"
    };
  });
}
async function resolveTrainingSchedule(assignmentId) {
  return (await loadTrainingSchedules({ assignmentId }))[0] ?? null;
}
async function listResolvedTrainingSchedules(nurseId) {
  return loadTrainingSchedules({ nurseId });
}
async function checkTrainingConflicts(nurseId, startDateStr, endDateStr, startTime, endTime, excludeAssignmentId) {
  const normEnd = endDateStr || startDateStr;
  const db = await getDb();
  let existingAssignments = [];
  if (db) {
    const rows = await db.select({
      id: nurseTrainings.id,
      eventId: nurseTrainings.eventId,
      scheduledDate: nurseTrainings.scheduledDate,
      status: nurseTrainings.status
    }).from(nurseTrainings).where(and2(eq2(nurseTrainings.nurseId, nurseId), eq2(nurseTrainings.status, "Scheduled")));
    existingAssignments = rows;
  } else {
    const sqlite = getSqliteDb();
    existingAssignments = sqlite.prepare("SELECT id, eventId, scheduledDate, status FROM nurseTrainings WHERE nurseId = ? AND status = 'Scheduled'").all(nurseId);
  }
  const conflicts = [];
  let warningOnly = false;
  for (const assign of existingAssignments) {
    if (excludeAssignmentId && assign.id === excludeAssignmentId) continue;
    const resolved = await resolveTrainingSchedule(assign.id);
    if (!resolved || !resolved.startDateStr) continue;
    const existingStart = resolved.startDateStr;
    const existingEnd = resolved.endDateStr || existingStart;
    const datesOverlap = startDateStr <= existingEnd && normEnd >= existingStart;
    if (!datesOverlap) continue;
    const hasTimes = Boolean(startTime && endTime && resolved.startTime && resolved.endTime);
    if (hasTimes) {
      const t1Start = startTime;
      const t1End = endTime;
      const t2Start = resolved.startTime;
      const t2End = resolved.endTime;
      const timesOverlap = t1Start < t2End && t2Start < t1End;
      if (timesOverlap) {
        conflicts.push({
          id: resolved.assignmentId,
          trainingName: resolved.trainingName,
          dateStr: `${existingStart}${existingEnd !== existingStart ? ` to ${existingEnd}` : ""}`,
          timeStr: `${t2Start} - ${t2End}`,
          reason: `Exact time overlap with ${resolved.trainingName} (${t2Start} - ${t2End})`
        });
      }
    } else {
      warningOnly = true;
      conflicts.push({
        id: resolved.assignmentId,
        trainingName: resolved.trainingName,
        dateStr: `${existingStart}${existingEnd !== existingStart ? ` to ${existingEnd}` : ""}`,
        timeStr: resolved.startTime ? `${resolved.startTime}${resolved.endTime ? ` - ${resolved.endTime}` : ""}` : "Unspecified time",
        reason: `Potential same-day overlap with ${resolved.trainingName}`
      });
    }
  }
  return {
    hasConflict: conflicts.length > 0,
    warningOnly: conflicts.length > 0 && warningOnly && !conflicts.some((c) => c.reason.includes("Exact time overlap")),
    conflicts
  };
}
async function enqueueTrainingNotice(opts) {
  const db = await getDb();
  const today = getManilaTodayKey();
  if (db) {
    const [item] = await db.insert(trainingOutbox).values({
      assignmentId: opts.assignmentId,
      scheduleVersion: opts.scheduleVersion,
      noticeKind: opts.noticeKind,
      thresholdDays: null,
      dueDate: null,
      recipientNurseId: opts.recipientNurseId,
      status: "pending",
      attempts: 0
    }).onConflictDoNothing().returning();
    const resolved2 = await resolveTrainingSchedule(opts.assignmentId);
    const title2 = opts.noticeKind === "rescheduled" ? `Schedule Change: ${resolved2?.trainingName || "Training"}` : opts.noticeKind === "cancelled" ? `Training Cancelled: ${resolved2?.trainingName || "Training"}` : `New Training Assignment: ${resolved2?.trainingName || "Training"}`;
    const message2 = opts.noticeKind === "cancelled" ? `The training assignment for ${resolved2?.trainingName} has been cancelled. Attendance is no longer required.` : opts.noticeKind === "rescheduled" ? `The schedule for ${resolved2?.trainingName} was updated to ${resolved2?.startDateStr}${resolved2?.startTime ? ` at ${resolved2?.startTime}` : ""}. Please confirm your attendance.` : `You have been assigned to ${resolved2?.trainingName} on ${resolved2?.startDateStr}${resolved2?.startTime ? ` at ${resolved2?.startTime}` : ""}.`;
    await db.insert(trainingActivity).values({
      nurseId: opts.recipientNurseId,
      assignmentId: opts.assignmentId,
      activityType: opts.noticeKind,
      title: title2,
      message: message2
    });
    return item;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare(
    `INSERT OR IGNORE INTO trainingOutbox
       (assignmentId, scheduleVersion, noticeKind, thresholdDays, dueDate, recipientNurseId, status, attempts)
       VALUES (?, ?, ?, NULL, NULL, ?, 'pending', 0)`
  ).run(opts.assignmentId, opts.scheduleVersion, opts.noticeKind, opts.recipientNurseId);
  const resolved = await resolveTrainingSchedule(opts.assignmentId);
  const title = opts.noticeKind === "rescheduled" ? `Schedule Change: ${resolved?.trainingName || "Training"}` : opts.noticeKind === "cancelled" ? `Training Cancelled: ${resolved?.trainingName || "Training"}` : `New Training Assignment: ${resolved?.trainingName || "Training"}`;
  const message = opts.noticeKind === "cancelled" ? `The training assignment for ${resolved?.trainingName} has been cancelled. Attendance is no longer required.` : opts.noticeKind === "rescheduled" ? `The schedule for ${resolved?.trainingName} was updated to ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}. Please confirm your attendance.` : `You have been assigned to ${resolved?.trainingName} on ${resolved?.startDateStr}${resolved?.startTime ? ` at ${resolved?.startTime}` : ""}.`;
  sqlite.prepare(
    `INSERT INTO trainingActivity (nurseId, assignmentId, activityType, title, message)
       VALUES (?, ?, ?, ?, ?)`
  ).run(opts.recipientNurseId, opts.assignmentId, opts.noticeKind, title, message);
  return sqlite.prepare("SELECT * FROM trainingOutbox WHERE assignmentId = ? AND scheduleVersion = ? AND noticeKind = ?").get(opts.assignmentId, opts.scheduleVersion, opts.noticeKind);
}
async function createMilestonesForAssignment(opts) {
  const today = getManilaTodayKey();
  const thresholds = [14, 7, 1];
  const db = await getDb();
  const sqlite = db ? null : getSqliteDb();
  for (const t2 of thresholds) {
    const dueDate = addCalendarDays(opts.startDateStr, -t2);
    if (dueDate < today) {
      continue;
    }
    const noticeKind = `reminder_${t2}d`;
    if (db) {
      await db.insert(trainingOutbox).values({
        assignmentId: opts.assignmentId,
        scheduleVersion: opts.scheduleVersion,
        noticeKind,
        thresholdDays: t2,
        dueDate: parseDateKey(dueDate),
        recipientNurseId: opts.recipientNurseId,
        status: "pending",
        attempts: 0
      }).onConflictDoNothing();
    } else if (sqlite) {
      sqlite.prepare(
        `INSERT OR IGNORE INTO trainingOutbox
           (assignmentId, scheduleVersion, noticeKind, thresholdDays, dueDate, recipientNurseId, status, attempts)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`
      ).run(opts.assignmentId, opts.scheduleVersion, noticeKind, t2, dueDate, opts.recipientNurseId);
    }
  }
}
async function invalidatePendingOutboxJobs(assignmentId, currentScheduleVersion) {
  const db = await getDb();
  if (db) {
    if (currentScheduleVersion != null) {
      await db.update(trainingOutbox).set({ status: "superseded", updatedAt: /* @__PURE__ */ new Date() }).where(
        and2(
          eq2(trainingOutbox.assignmentId, assignmentId),
          sql3`${trainingOutbox.scheduleVersion} < ${currentScheduleVersion}`,
          eq2(trainingOutbox.status, "pending")
        )
      );
    } else {
      await db.update(trainingOutbox).set({ status: "superseded", updatedAt: /* @__PURE__ */ new Date() }).where(and2(eq2(trainingOutbox.assignmentId, assignmentId), eq2(trainingOutbox.status, "pending")));
    }
    return;
  }
  const sqlite = getSqliteDb();
  if (currentScheduleVersion != null) {
    sqlite.prepare("UPDATE trainingOutbox SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP WHERE assignmentId = ? AND scheduleVersion < ? AND status = 'pending'").run(assignmentId, currentScheduleVersion);
  } else {
    sqlite.prepare("UPDATE trainingOutbox SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP WHERE assignmentId = ? AND status = 'pending'").run(assignmentId);
  }
}
async function dispatchSingleOutboxItem(itemId) {
  const db = await getDb();
  let item = null;
  if (db) {
    const rows = await db.select().from(trainingOutbox).where(eq2(trainingOutbox.id, itemId)).limit(1);
    if (rows.length > 0) item = rows[0];
  } else {
    const sqlite = getSqliteDb();
    item = sqlite.prepare("SELECT * FROM trainingOutbox WHERE id = ?").get(itemId);
  }
  if (!item || item.status !== "pending") {
    return { ok: false, status: item?.status || "not_found" };
  }
  return processOutboxItem(item);
}
async function drainTrainingOutbox(limit = 25) {
  const today = getManilaTodayKey();
  const db = await getDb();
  let itemsToProcess = [];
  if (db) {
    const rows = await db.select().from(trainingOutbox).where(
      and2(
        eq2(trainingOutbox.status, "pending"),
        or2(isNull2(trainingOutbox.dueDate), lte2(trainingOutbox.dueDate, parseDateKey(today)))
      )
    ).limit(limit);
    if (rows.length === 0) {
      return { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0, superseded: 0 };
    }
    const itemIds = rows.map((r) => r.id);
    await db.update(trainingOutbox).set({ status: "claimed", claimedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(inArray2(trainingOutbox.id, itemIds));
    itemsToProcess = rows;
  } else {
    const sqlite = getSqliteDb();
    const rows = sqlite.prepare(
      `SELECT * FROM trainingOutbox
         WHERE status = 'pending' AND (dueDate IS NULL OR dueDate <= ?)
         LIMIT ?`
    ).all(today, limit);
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
async function processOutboxItem(item) {
  const db = await getDb();
  const sqlite = db ? null : getSqliteDb();
  const updateOutbox = async (status, providerMsgId, errorDetail) => {
    if (db) {
      await db.update(trainingOutbox).set({
        status,
        providerMessageId: providerMsgId ?? null,
        errorDetail: errorDetail ?? null,
        lastAttemptAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(trainingOutbox.id, item.id));
    } else if (sqlite) {
      sqlite.prepare(
        `UPDATE trainingOutbox
           SET status = ?, providerMessageId = ?, errorDetail = ?, lastAttemptAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
      ).run(status, providerMsgId ?? null, errorDetail ?? null, item.id);
    }
  };
  const resolved = await resolveTrainingSchedule(item.assignmentId);
  if (!resolved) {
    await updateOutbox("superseded", null, "Assignment no longer exists");
    return { ok: false, status: "superseded" };
  }
  if (resolved.scheduleVersion !== item.scheduleVersion) {
    await updateOutbox("superseded", null, `Assignment moved to version ${resolved.scheduleVersion}`);
    return { ok: false, status: "superseded" };
  }
  if (resolved.status !== "Scheduled" && item.noticeKind.startsWith("reminder_")) {
    await updateOutbox("superseded", null, `Training status is ${resolved.status}`);
    return { ok: false, status: "superseded" };
  }
  let nurseRow = null;
  if (db) {
    const rows = await db.select().from(nurses).where(eq2(nurses.id, item.recipientNurseId)).limit(1);
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
  const dateRangeStr = resolved.startDateStr === resolved.endDateStr || !resolved.endDateStr ? resolved.startDateStr : `${resolved.startDateStr} to ${resolved.endDateStr}`;
  let subject = "";
  let html = "";
  if (item.noticeKind === "assigned" || item.noticeKind === "rescheduled" || item.noticeKind === "cancelled") {
    const kind = item.noticeKind;
    subject = kind === "rescheduled" ? `Schedule Change: ${resolved.trainingName}` : kind === "cancelled" ? `Training Cancelled: ${resolved.trainingName}` : `Training Assignment: ${resolved.trainingName}`;
    html = renderTrainingNoticeEmail({
      nurseName: fullName,
      noticeKind: kind,
      trainingTitle: resolved.trainingName,
      dateRangeStr,
      timeStr: resolved.startTime ? `${resolved.startTime}${resolved.endTime ? ` - ${resolved.endTime}` : ""}` : null,
      venue: resolved.venue,
      instructions: resolved.remarks,
      actionUrl
    });
  } else {
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
      actionUrl
    });
    const actTitle = `Upcoming Training: ${resolved.trainingName}`;
    const actMessage = `Reminder: ${resolved.trainingName} is scheduled on ${dateRangeStr}${resolved.startTime ? ` at ${resolved.startTime}` : ""}.`;
    if (db) {
      await db.insert(trainingActivity).values({
        nurseId: item.recipientNurseId,
        assignmentId: item.assignmentId,
        activityType: item.noticeKind,
        title: actTitle,
        message: actMessage
      });
    } else if (sqlite) {
      sqlite.prepare("INSERT INTO trainingActivity (nurseId, assignmentId, activityType, title, message) VALUES (?, ?, ?, ?, ?)").run(item.recipientNurseId, item.assignmentId, item.noticeKind, actTitle, actMessage);
    }
  }
  const sendRes = await sendEmail({
    to: recipientEmail,
    subject,
    html,
    nurseId: item.recipientNurseId,
    emailType: "training_reminder",
    referenceId: item.assignmentId,
    thresholdKey: item.noticeKind
  });
  if (sendRes.status === "sent" || sendRes.status === "mock_sent") {
    await updateOutbox(sendRes.status, sendRes.messageId || null, null);
    return { ok: true, status: sendRes.status };
  } else {
    const newAttempts = (item.attempts ?? 0) + 1;
    const finalStatus = newAttempts >= 3 ? "failed" : "pending";
    if (db) {
      await db.update(trainingOutbox).set({
        status: finalStatus,
        attempts: newAttempts,
        lastAttemptAt: /* @__PURE__ */ new Date(),
        errorDetail: sendRes.error || "Email delivery failed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(trainingOutbox.id, item.id));
    } else if (sqlite) {
      sqlite.prepare(
        `UPDATE trainingOutbox
           SET status = ?, attempts = ?, lastAttemptAt = CURRENT_TIMESTAMP, errorDetail = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
      ).run(finalStatus, newAttempts, sendRes.error || "Email delivery failed", item.id);
    }
    return { ok: false, status: finalStatus, error: sendRes.error };
  }
}
async function retryFailedOutboxItem(itemId) {
  const db = await getDb();
  let item = null;
  if (db) {
    const rows = await db.select().from(trainingOutbox).where(eq2(trainingOutbox.id, itemId)).limit(1);
    if (rows.length > 0) item = rows[0];
  } else {
    const sqlite = getSqliteDb();
    item = sqlite.prepare("SELECT * FROM trainingOutbox WHERE id = ?").get(itemId);
  }
  if (!item) throw new Error("Outbox item not found");
  if (item.status !== "failed" && item.status !== "skipped") {
    throw new Error(`Cannot retry item with status ${item.status}`);
  }
  if (db) {
    await db.update(trainingOutbox).set({ status: "pending", attempts: 0, errorDetail: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(trainingOutbox.id, itemId));
  } else {
    const sqlite = getSqliteDb();
    sqlite.prepare("UPDATE trainingOutbox SET status = 'pending', attempts = 0, errorDetail = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(itemId);
  }
  return dispatchSingleOutboxItem(itemId);
}
var APP_URL;
var init_trainingReminders = __esm({
  "server/trainingReminders.ts"() {
    "use strict";
    init_db();
    init_localDb();
    init_schema();
    init_nursetrack();
    init_service();
    init_templates();
    APP_URL = process.env.APP_URL || "http://localhost:3000";
  }
});

// server/reminders.ts
import { eq as eq6, isNull as isNull6, sql as sql7 } from "drizzle-orm";
async function fetchActiveCredentials() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: nurseCredentials.id,
    nurseId: nurseCredentials.nurseId,
    credentialTypeId: nurseCredentials.credentialTypeId,
    expiryDate: nurseCredentials.expiryDate,
    renewalCycleKey: nurseCredentials.renewalCycleKey,
    employeeId: nurses.employeeId,
    firstName: nurses.firstName,
    middleName: nurses.middleName,
    lastName: nurses.lastName,
    suffix: nurses.suffix,
    archivedAt: nurses.archivedAt,
    currentAreaId: nurses.currentAreaId
  }).from(nurseCredentials).innerJoin(nurses, eq6(nurses.id, nurseCredentials.nurseId)).where(isNull6(nurses.archivedAt));
  return rows.map((r) => ({
    id: Number(r.id),
    nurseId: Number(r.nurseId),
    credentialTypeId: Number(r.credentialTypeId),
    expiryDate: r.expiryDate,
    renewalCycleKey: String(r.renewalCycleKey),
    nurse: {
      id: Number(r.nurseId),
      employeeId: String(r.employeeId),
      firstName: String(r.firstName),
      middleName: r.middleName ?? null,
      lastName: String(r.lastName),
      suffix: r.suffix ?? null,
      archivedAt: r.archivedAt ?? null,
      currentAreaId: r.currentAreaId != null ? Number(r.currentAreaId) : null
    }
  }));
}
async function runDailyReminders(today, thresholds = DEFAULT_THRESHOLDS) {
  const db = await getDb();
  const results = { created: 0, skippedExisting: 0, expiredCredentials: 0, archivedSkipped: 0 };
  const credentials = await fetchActiveCredentials();
  if (!db) return results;
  const areaRows = await listAreas(false);
  const areaById = new Map(areaRows.map((a) => [a.id, a.name]));
  const existingReminders = await listReminders();
  const existingSet = new Set(
    existingReminders.map((r) => `${r.credentialId}:${r.thresholdDays}:${r.renewalCycleKey}`)
  );
  const duePairs = [];
  const expiredIds = [];
  const expiredNotes = [];
  for (const cred of credentials) {
    if (cred.nurse.archivedAt) {
      results.archivedSkipped++;
      continue;
    }
    const days = daysUntilExpiry(dateKey(cred.expiryDate), today);
    const status = deriveLicenseStatus(dateKey(cred.expiryDate), today);
    if (status === "Expired") {
      expiredIds.push(cred.id);
      expiredNotes.push({ cred });
      continue;
    }
    for (const threshold of thresholds) {
      if (days > threshold) continue;
      const cycleKey = `${cred.id}:${threshold}:${cred.renewalCycleKey}`;
      if (existingSet.has(cycleKey)) {
        results.skippedExisting++;
        continue;
      }
      const areaName = cred.nurse.currentAreaId ? areaById.get(cred.nurse.currentAreaId) ?? "Unknown area" : "Unassigned";
      duePairs.push({ cred, threshold, days, areaName });
    }
  }
  if (duePairs.length > 0) {
    const rows = duePairs.map(({ cred, threshold }) => ({
      credentialId: cred.id,
      thresholdDays: threshold,
      renewalCycleKey: cred.renewalCycleKey,
      triggerDate: new Date((/* @__PURE__ */ new Date(`${today}T00:00:00`)).getTime() + threshold * 864e5)
    }));
    await db.insert(licenseReminders).values(rows).onConflictDoNothing();
    results.created = duePairs.length;
  }
  if (expiredIds.length > 0) {
    const db2 = await getDb();
    if (db2) {
      await db2.update(licenseReminders).set({ status: "expired" }).where(sql7`${licenseReminders.credentialId} IN (${sql7.join(expiredIds.map((i) => sql7`${i}`), sql7`, `)})`);
    }
  }
  const existingNotifications = await listNotifications(500);
  const existingExpiredNotifKeys = new Set(
    existingNotifications.filter((n) => n.type === "license.expired").map((n) => `${n.nurseId}:${n.relatedEntityType}:${n.relatedEntityId}`)
  );
  const existingRenewalNotifKeys = new Set(
    existingNotifications.filter((n) => n.type === "license.renewalReminder").map((n) => `${n.nurseId}:${n.relatedEntityType}:${n.relatedEntityId}:${(n.title ?? "").split(" \u2014 ")[0].trim()}`)
  );
  const expiredNotifs = expiredNotes.filter(({ cred }) => !existingExpiredNotifKeys.has(`${cred.nurseId}:credential:${cred.id}`)).map(({ cred }) => ({
    type: "license.expired",
    severity: "urgent_or_expired",
    title: `License expired \u2014 ${cred.nurse.firstName} ${cred.nurse.lastName}`,
    message: `The license (${cred.renewalCycleKey}) for ${cred.nurse.firstName} ${cred.nurse.lastName} expired. Mark renewal as complete to start a new cycle.`,
    nurseId: cred.nurseId,
    relatedEntityType: "credential",
    relatedEntityId: cred.id
  }));
  if (expiredNotifs.length > 0) {
    await createNotificationsBatch(expiredNotifs);
  }
  results.expiredCredentials = expiredIds.length;
  const notifsByCred = /* @__PURE__ */ new Map();
  for (const pair of duePairs) {
    const prev = notifsByCred.get(pair.cred.id);
    if (!prev || pair.threshold < prev.threshold) {
      notifsByCred.set(pair.cred.id, pair);
    }
  }
  const notifPayloads = Array.from(notifsByCred.values()).filter(({ cred, threshold }) => {
    const thresholdLabel = threshold === 365 ? "1-year renewal reminder" : `${threshold}-day renewal reminder`;
    return !existingRenewalNotifKeys.has(`${cred.nurseId}:credential:${cred.id}:${thresholdLabel}`);
  }).map(({ cred, threshold, days }) => ({
    type: "license.renewalReminder",
    severity: threshold >= 365 ? "attention" : "upcoming_renewal",
    title: `${threshold === 365 ? "1-year" : `${threshold}-day`} renewal reminder \u2014 ${cred.nurse.firstName} ${cred.nurse.lastName}`,
    message: `${cred.nurse.firstName} ${cred.nurse.lastName} has a license expiring in ${days <= 0 ? "about " + (Math.abs(days) + 1) + " day(s) (due " + dateKey(cred.expiryDate) + ")" : days + " days"}. Review the license and begin renewal.`,
    nurseId: cred.nurseId,
    relatedEntityType: "credential",
    relatedEntityId: cred.id
  }));
  if (notifPayloads.length > 0) {
    await createNotificationsBatch(notifPayloads);
  }
  return results;
}
var DEFAULT_THRESHOLDS;
var init_reminders = __esm({
  "server/reminders.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_nursetrack();
    DEFAULT_THRESHOLDS = [365, 180];
  }
});

// server/deduplicate.ts
import { eq as eq8 } from "drizzle-orm";
function canonicalAreaInfo(rawName) {
  const s = rawName.trim().toUpperCase();
  if (s.includes("MAIN") || s.includes("RDU-MAIN") || s.includes("DU MAIN")) {
    return { code: "RDU-MAIN", name: "RDU Main" };
  }
  if (s.includes("ANNEX") || s.includes("RDU-ANNEX") || s.includes("DU ANNEX")) {
    return { code: "RDU-ANNEX", name: "RDU Annex" };
  }
  if (s.includes("OTSU") || s.includes("SHARE")) {
    return { code: "OTSU-SHARE", name: "OTSU / SHARE" };
  }
  if (s.includes("PERITONEAL") || s === "PD" || s.startsWith("PD ") || s.includes("CAPD")) {
    return { code: "PD", name: "Peritoneal Dialysis" };
  }
  if (s.includes("ICU")) {
    return { code: "SKTI-ICU", name: "SKTI ICU" };
  }
  if (s.includes("PAY")) {
    return { code: "SKTI-PAY", name: "SKTI Payward" };
  }
  if (s.includes("WARD") || s.includes("SERVICE")) {
    return { code: "SKTI-WARD", name: "SKTI Service Ward" };
  }
  if (s.includes("OFFICE") || s.includes("ADMIN")) {
    return { code: "NEPHRO-OFFICE", name: "Nephrology Office" };
  }
  if (s.includes("TRIAGE") || s.includes("RECEIVING")) {
    return { code: "TRIAGE", name: "Triage & Receiving" };
  }
  return null;
}
function nameTokens(fullName) {
  return fullName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t2) => t2.length > 1).sort();
}
function nameTokenKey(first, last, middle) {
  const tokens = nameTokens(`${first} ${middle ?? ""} ${last}`);
  return tokens.join("|");
}
function shortNameKey(first, last) {
  const firstWord = first.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const lastWord = last.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (firstWord.length < 2 || lastWord.length < 2) return "";
  return `${lastWord}|${firstWord}`;
}
function cleanIdKey(idStr) {
  if (!idStr) return "";
  const clean = idStr.trim().replace(/[^a-zA-Z0-9]/g, "");
  if (/^\d+$/.test(clean)) {
    return clean.replace(/^0+/, "");
  }
  return clean.toLowerCase();
}
async function deduplicateDatabase() {
  const db = await getDb();
  let mergedNursesCount = 0;
  let deletedDupNursesCount = 0;
  let deduplicatedTrainingsCount = 0;
  let deduplicatedCredentialsCount = 0;
  let cleanedAreasCount = 0;
  let mergedCredentialTypesCount = 0;
  if (db) {
    const allCredTypesPreMerge = await db.select().from(credentialTypes);
    const credTypeByName = new Map(allCredTypesPreMerge.map((t2) => [t2.name, t2]));
    for (const [legacyName, canonicalName] of Object.entries(LEGACY_CREDENTIAL_TYPE_ALIASES)) {
      const legacy = credTypeByName.get(legacyName);
      const canonical = credTypeByName.get(canonicalName);
      if (legacy && canonical && legacy.id !== canonical.id) {
        await db.update(nurseCredentials).set({ credentialTypeId: canonical.id }).where(eq8(nurseCredentials.credentialTypeId, legacy.id));
        await db.delete(credentialTypes).where(eq8(credentialTypes.id, legacy.id));
        mergedCredentialTypesCount++;
      }
    }
    for (const ca of CANONICAL_AREAS) {
      await db.insert(areas).values({
        code: ca.code,
        name: ca.name,
        description: ca.description,
        sortOrder: ca.sortOrder,
        active: true
      }).onConflictDoUpdate({
        target: areas.code,
        set: {
          name: ca.name,
          description: ca.description,
          sortOrder: ca.sortOrder,
          active: true
        }
      });
    }
    const allDbAreas = await db.select().from(areas);
    const canonicalByCode = new Map(
      allDbAreas.filter((a) => CANONICAL_AREAS.some((c) => c.code === a.code || c.name.toLowerCase() === a.name.toLowerCase())).map((a) => [a.code, a])
    );
    const canonicalByName = new Map(
      allDbAreas.filter((a) => CANONICAL_AREAS.some((c) => c.code === a.code || c.name.toLowerCase() === a.name.toLowerCase())).map((a) => [a.name.toLowerCase(), a])
    );
    for (const a of allDbAreas) {
      const canonicalMatch = canonicalAreaInfo(a.name) || canonicalAreaInfo(a.code);
      if (canonicalMatch) {
        const canonicalArea = canonicalByCode.get(canonicalMatch.code) ?? canonicalByName.get(canonicalMatch.name.toLowerCase());
        if (canonicalArea && canonicalArea.id !== a.id) {
          await db.update(nurses).set({ currentAreaId: canonicalArea.id }).where(eq8(nurses.currentAreaId, a.id));
          await db.update(areaAssignments).set({ areaId: canonicalArea.id }).where(eq8(areaAssignments.areaId, a.id));
          try {
            await db.update(areaTrainingRequirements).set({ areaId: canonicalArea.id }).where(eq8(areaTrainingRequirements.areaId, a.id));
          } catch {
          }
          await db.delete(areas).where(eq8(areas.id, a.id));
          cleanedAreasCount++;
        }
      }
    }
    const allNurses = await db.select().from(nurses);
    const allCreds = await db.select().from(nurseCredentials);
    const credsByNurseId = /* @__PURE__ */ new Map();
    for (const c of allCreds) {
      if (!credsByNurseId.has(c.nurseId)) credsByNurseId.set(c.nurseId, []);
      credsByNurseId.get(c.nurseId).push(c);
    }
    const ds = new DisjointSet();
    const byEmpId = /* @__PURE__ */ new Map();
    const byTokenName = /* @__PURE__ */ new Map();
    const byShortName = /* @__PURE__ */ new Map();
    const byEmail = /* @__PURE__ */ new Map();
    const byLicNum = /* @__PURE__ */ new Map();
    for (const n of allNurses) {
      const nurseId = n.id;
      ds.find(nurseId);
      const empKey = cleanIdKey(n.employeeId);
      if (empKey.length >= 3) {
        if (byEmpId.has(empKey)) {
          ds.union(nurseId, byEmpId.get(empKey));
        } else {
          byEmpId.set(empKey, nurseId);
        }
      }
      const tokenKey = nameTokenKey(n.firstName, n.lastName, n.middleName);
      if (tokenKey.length > 3) {
        if (byTokenName.has(tokenKey)) {
          ds.union(nurseId, byTokenName.get(tokenKey));
        } else {
          byTokenName.set(tokenKey, nurseId);
        }
      }
      const sKey = shortNameKey(n.firstName, n.lastName);
      if (sKey.length > 4) {
        if (byShortName.has(sKey)) {
          ds.union(nurseId, byShortName.get(sKey));
        } else {
          byShortName.set(sKey, nurseId);
        }
      }
      if (n.accountEmail && n.accountEmail.trim().length > 3) {
        const emKey = n.accountEmail.trim().toLowerCase();
        if (byEmail.has(emKey)) {
          ds.union(nurseId, byEmail.get(emKey));
        } else {
          byEmail.set(emKey, nurseId);
        }
      }
      const nurseCredList = credsByNurseId.get(nurseId) ?? [];
      for (const cred of nurseCredList) {
        const licKey = cleanIdKey(cred.licenseNumber);
        if (licKey.length >= 4) {
          if (byLicNum.has(licKey)) {
            ds.union(nurseId, byLicNum.get(licKey));
          } else {
            byLicNum.set(licKey, nurseId);
          }
        }
      }
    }
    const clusters = /* @__PURE__ */ new Map();
    for (const n of allNurses) {
      const root = ds.find(n.id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(n);
    }
    const clusterEntries = Array.from(clusters.values());
    for (let i = 0; i < clusterEntries.length; i++) {
      const group = clusterEntries[i];
      if (group.length <= 1) continue;
      const score = (n) => {
        let s = 0;
        if (n.linkedUserId) s += 1e3;
        if (n.accountEmail) s += 200;
        if (n.position && n.position.toLowerCase() !== "nurse") s += 50;
        if (n.dateHired) s += 30;
        if (n.contactNumber) s += 20;
        if (n.middleName) s += 10;
        if (cleanIdKey(n.employeeId).length >= 5) s += 15;
        s -= n.id * 1e-3;
        return s;
      };
      const sorted = [...group].sort((a, b) => score(b) - score(a));
      const primary = sorted[0];
      const duplicates = group.filter((n) => n.id !== primary.id);
      for (const dup of duplicates) {
        const updates = {};
        if (!primary.accountEmail && dup.accountEmail) updates.accountEmail = dup.accountEmail;
        if (!primary.currentAreaId && dup.currentAreaId) updates.currentAreaId = dup.currentAreaId;
        if (!primary.dateHired && dup.dateHired) updates.dateHired = dup.dateHired;
        if ((!primary.position || primary.position.toLowerCase() === "nurse") && dup.position) {
          updates.position = dup.position;
        }
        if (!primary.contactNumber && dup.contactNumber) updates.contactNumber = dup.contactNumber;
        if (!primary.middleName && dup.middleName) updates.middleName = dup.middleName;
        if (!primary.suffix && dup.suffix) updates.suffix = dup.suffix;
        const primEmpKey = cleanIdKey(primary.employeeId);
        const dupEmpKey = cleanIdKey(dup.employeeId);
        let newEmployeeId = null;
        if (primEmpKey.length < dupEmpKey.length && dupEmpKey.length >= 4) {
          newEmployeeId = dup.employeeId;
        }
        if (Object.keys(updates).length > 0) {
          try {
            await db.update(nurses).set(updates).where(eq8(nurses.id, primary.id));
          } catch {
          }
        }
        await db.update(areaAssignments).set({ nurseId: primary.id }).where(eq8(areaAssignments.nurseId, dup.id));
        await db.update(customCalendarEvents).set({ nurseId: primary.id }).where(eq8(customCalendarEvents.nurseId, dup.id));
        await db.update(notifications).set({ nurseId: primary.id }).where(eq8(notifications.nurseId, dup.id));
        const dupCreds = await db.select().from(nurseCredentials).where(eq8(nurseCredentials.nurseId, dup.id));
        const primCreds = await db.select().from(nurseCredentials).where(eq8(nurseCredentials.nurseId, primary.id));
        for (const dc of dupCreds) {
          const dcLicKey = cleanIdKey(dc.licenseNumber);
          const match = primCreds.find(
            (pc) => pc.credentialTypeId === dc.credentialTypeId || dcLicKey && cleanIdKey(pc.licenseNumber) === dcLicKey
          );
          if (match) {
            const dcExpiry = dc.expiryDate ? new Date(dc.expiryDate).getTime() : 0;
            const matchExpiry = match.expiryDate ? new Date(match.expiryDate).getTime() : 0;
            const credUpdates = {};
            if (dcExpiry > matchExpiry) {
              credUpdates.expiryDate = dc.expiryDate;
              credUpdates.renewalStatus = dc.renewalStatus;
              credUpdates.renewalCycleKey = dc.renewalCycleKey;
            }
            if (!match.licenseNumber && dc.licenseNumber) {
              credUpdates.licenseNumber = dc.licenseNumber;
            }
            if (Object.keys(credUpdates).length > 0) {
              await db.update(nurseCredentials).set(credUpdates).where(eq8(nurseCredentials.id, match.id));
            }
            await db.delete(nurseCredentials).where(eq8(nurseCredentials.id, dc.id));
            deduplicatedCredentialsCount++;
          } else {
            await db.update(nurseCredentials).set({ nurseId: primary.id }).where(eq8(nurseCredentials.id, dc.id));
          }
        }
        const dupTrainings = await db.select().from(nurseTrainings).where(eq8(nurseTrainings.nurseId, dup.id));
        const primTrainings = await db.select().from(nurseTrainings).where(eq8(nurseTrainings.nurseId, primary.id));
        for (const dt of dupTrainings) {
          const dtDate = String(dt.completionDate ?? dt.scheduledDate ?? "").slice(0, 10);
          const exists = primTrainings.some(
            (pt) => pt.trainingId === dt.trainingId && String(pt.completionDate ?? pt.scheduledDate ?? "").slice(0, 10) === dtDate
          );
          if (exists) {
            await db.delete(nurseTrainings).where(eq8(nurseTrainings.id, dt.id));
            deduplicatedTrainingsCount++;
          } else {
            await db.update(nurseTrainings).set({ nurseId: primary.id }).where(eq8(nurseTrainings.id, dt.id));
          }
        }
        await db.delete(nurses).where(eq8(nurses.id, dup.id));
        if (newEmployeeId) {
          try {
            await db.update(nurses).set({ employeeId: newEmployeeId }).where(eq8(nurses.id, primary.id));
          } catch {
          }
        }
        deletedDupNursesCount++;
      }
      mergedNursesCount++;
    }
    const allTrainings = await db.select().from(nurseTrainings);
    const seenTrainings = /* @__PURE__ */ new Set();
    for (const t2 of allTrainings) {
      const dateStr = String(t2.completionDate ?? t2.scheduledDate ?? "").slice(0, 10);
      const key = `${t2.nurseId}-${t2.trainingId}-${dateStr}`;
      if (seenTrainings.has(key)) {
        await db.delete(nurseTrainings).where(eq8(nurseTrainings.id, t2.id));
        deduplicatedTrainingsCount++;
      } else {
        seenTrainings.add(key);
      }
    }
    const allCredsAfterMerge = await db.select().from(nurseCredentials);
    const credsByNurseAndType = /* @__PURE__ */ new Map();
    for (const c of allCredsAfterMerge) {
      const key = `${c.nurseId}-${c.credentialTypeId}`;
      if (!credsByNurseAndType.has(key)) credsByNurseAndType.set(key, []);
      credsByNurseAndType.get(key).push(c);
    }
    const credGroups = Array.from(credsByNurseAndType.values());
    for (const group of credGroups) {
      if (group.length > 1) {
        group.sort((a, b) => {
          const aExp = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
          const bExp = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
          return bExp - aExp || b.id - a.id;
        });
        const primaryCred = group[0];
        const dups = group.slice(1);
        for (const dc of dups) {
          if (!primaryCred.licenseNumber && dc.licenseNumber) {
            await db.update(nurseCredentials).set({ licenseNumber: dc.licenseNumber }).where(eq8(nurseCredentials.id, primaryCred.id));
          }
          await db.delete(nurseCredentials).where(eq8(nurseCredentials.id, dc.id));
          deduplicatedCredentialsCount++;
        }
      }
    }
  } else {
    const sqlite = getSqliteDb();
    const allNurses = sqlite.prepare("SELECT * FROM nurses").all();
    const ds = new DisjointSet();
    const byEmpId = /* @__PURE__ */ new Map();
    const byTokenName = /* @__PURE__ */ new Map();
    const byShortName = /* @__PURE__ */ new Map();
    for (const n of allNurses) {
      const nurseId = n.id;
      ds.find(nurseId);
      const empKey = cleanIdKey(n.employeeId);
      if (empKey.length >= 3) {
        if (byEmpId.has(empKey)) ds.union(nurseId, byEmpId.get(empKey));
        else byEmpId.set(empKey, nurseId);
      }
      const tokenKey = nameTokenKey(n.firstName, n.lastName, n.middleName);
      if (tokenKey.length > 3) {
        if (byTokenName.has(tokenKey)) ds.union(nurseId, byTokenName.get(tokenKey));
        else byTokenName.set(tokenKey, nurseId);
      }
      const sKey = shortNameKey(n.firstName, n.lastName);
      if (sKey.length > 4) {
        if (byShortName.has(sKey)) ds.union(nurseId, byShortName.get(sKey));
        else byShortName.set(sKey, nurseId);
      }
    }
    const clusters = /* @__PURE__ */ new Map();
    for (const n of allNurses) {
      const root = ds.find(n.id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(n);
    }
    const clusterEntries = Array.from(clusters.values());
    for (let i = 0; i < clusterEntries.length; i++) {
      const group = clusterEntries[i];
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => (b.linkedUserId ? 1 : 0) - (a.linkedUserId ? 1 : 0) || a.id - b.id);
      const primary = sorted[0];
      const duplicates = group.filter((n) => n.id !== primary.id);
      for (const dup of duplicates) {
        sqlite.prepare("UPDATE areaAssignments SET nurseId = ? WHERE nurseId = ?").run(primary.id, dup.id);
        sqlite.prepare("UPDATE customCalendarEvents SET nurseId = ? WHERE nurseId = ?").run(primary.id, dup.id);
        sqlite.prepare("UPDATE notifications SET nurseId = ? WHERE nurseId = ?").run(primary.id, dup.id);
        sqlite.prepare("UPDATE nurseCredentials SET nurseId = ? WHERE nurseId = ?").run(primary.id, dup.id);
        sqlite.prepare("UPDATE nurseTrainings SET nurseId = ? WHERE nurseId = ?").run(primary.id, dup.id);
        sqlite.prepare("DELETE FROM nurses WHERE id = ?").run(dup.id);
        deletedDupNursesCount++;
      }
      mergedNursesCount++;
    }
  }
  return {
    mergedNursesGroups: mergedNursesCount,
    deletedDuplicateNurses: deletedDupNursesCount,
    deduplicatedTrainings: deduplicatedTrainingsCount,
    deduplicatedCredentials: deduplicatedCredentialsCount,
    cleanedAreasCount,
    mergedCredentialTypesCount
  };
}
var CANONICAL_AREAS, CANONICAL_CREDENTIAL_TYPES, LEGACY_CREDENTIAL_TYPE_ALIASES, DisjointSet;
var init_deduplicate = __esm({
  "server/deduplicate.ts"() {
    "use strict";
    init_db();
    init_localDb();
    init_schema();
    CANONICAL_AREAS = [
      { code: "NEPHRO-OFFICE", name: "Nephrology Office", description: "Nephrology Nursing Office & Administrative Center", sortOrder: 1 },
      { code: "PD", name: "Peritoneal Dialysis", description: "Peritoneal Dialysis Unit & Outpatient CAPD/APD", sortOrder: 2 },
      { code: "OTSU-SHARE", name: "OTSU / SHARE", description: "Organ Transplant Specialty Unit & SHARE Programs", sortOrder: 3 },
      { code: "RDU-MAIN", name: "RDU Main", description: "Renal Dialysis Unit - Main Building (Station 1-28)", sortOrder: 4 },
      { code: "RDU-ANNEX", name: "RDU Annex", description: "Renal Dialysis Unit - Annex Center", sortOrder: 5 },
      { code: "SKTI-WARD", name: "SKTI Service Ward", description: "Southern Philippines Kidney Transplant Institute - Inpatient Ward", sortOrder: 6 },
      { code: "SKTI-PAY", name: "SKTI Payward", description: "SKTI Pay Patients Inpatient Unit", sortOrder: 7 },
      { code: "SKTI-ICU", name: "SKTI ICU", description: "SKTI Intensive Care Unit", sortOrder: 8 },
      { code: "TRIAGE", name: "Triage & Receiving", description: "Nephrology Triage and Outpatient Receiving", sortOrder: 9 }
    ];
    CANONICAL_CREDENTIAL_TYPES = {
      RN: "PRC Registered Nurse License",
      NA: "TESDA NC II / PRC Attendant Certification"
    };
    LEGACY_CREDENTIAL_TYPE_ALIASES = {
      "PRC License": CANONICAL_CREDENTIAL_TYPES.RN,
      "PRC / NC II License": CANONICAL_CREDENTIAL_TYPES.NA
    };
    DisjointSet = class {
      parent = /* @__PURE__ */ new Map();
      find(i) {
        if (!this.parent.has(i)) this.parent.set(i, i);
        const p = this.parent.get(i);
        if (p === i) return i;
        const root = this.find(p);
        this.parent.set(i, root);
        return root;
      }
      union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
          this.parent.set(rootI, rootJ);
        }
      }
    };
  }
});

// server/email/dispatcher.ts
var dispatcher_exports = {};
__export(dispatcher_exports, {
  fetchLinkedNursesWithExpiringCredentials: () => fetchLinkedNursesWithExpiringCredentials,
  runLicenseExpiryEmailPass: () => runLicenseExpiryEmailPass,
  runUpcomingSeminarEmailPass: () => runUpcomingSeminarEmailPass
});
import { eq as eq9, and as and7, isNull as isNull7, isNotNull as isNotNull2, gte as gte2, lte as lte3, sql as sql9 } from "drizzle-orm";
async function fetchLinkedNursesWithExpiringCredentials() {
  const db = await getDb();
  if (db) {
    const rows2 = await db.select({
      nurseId: nurses.id,
      firstName: nurses.firstName,
      middleName: nurses.middleName,
      lastName: nurses.lastName,
      suffix: nurses.suffix,
      accountEmail: nurses.accountEmail,
      linkedUserId: nurses.linkedUserId,
      credentialId: nurseCredentials.id,
      licenseNumber: nurseCredentials.licenseNumber,
      expiryDate: nurseCredentials.expiryDate,
      renewalCycleKey: nurseCredentials.renewalCycleKey,
      typeName: credentialTypes.name
    }).from(nurses).innerJoin(nurseCredentials, eq9(nurseCredentials.nurseId, nurses.id)).leftJoin(credentialTypes, eq9(credentialTypes.id, nurseCredentials.credentialTypeId)).where(
      and7(
        isNull7(nurses.archivedAt),
        isNotNull2(nurses.linkedUserId),
        isNotNull2(nurses.accountEmail)
      )
    );
    return rows2.map((r) => ({
      nurseId: Number(r.nurseId),
      fullName: nurseFullName(r),
      accountEmail: r.accountEmail,
      linkedUserId: r.linkedUserId,
      credentialId: Number(r.credentialId),
      typeName: r.typeName || "PRC Registered Nurse License",
      licenseNumber: r.licenseNumber || "\u2014",
      expiryDate: dateKey(r.expiryDate),
      renewalCycleKey: String(r.renewalCycleKey)
    }));
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare(`
    SELECT n.id as nurseId, n.firstName, n.middleName, n.lastName, n.suffix, n.accountEmail, n.linkedUserId,
           c.id as credentialId, c.licenseNumber, c.expiryDate, c.renewalCycleKey, ct.name as typeName
    FROM nurses n
    INNER JOIN nurseCredentials c ON c.nurseId = n.id
    LEFT JOIN credentialTypes ct ON ct.id = c.credentialTypeId
    WHERE n.archivedAt IS NULL AND n.linkedUserId IS NOT NULL AND n.accountEmail IS NOT NULL
  `).all();
  return rows.map((r) => ({
    nurseId: Number(r.nurseId),
    fullName: nurseFullName(r),
    accountEmail: r.accountEmail,
    linkedUserId: r.linkedUserId,
    credentialId: Number(r.credentialId),
    typeName: r.typeName || "PRC Registered Nurse License",
    licenseNumber: r.licenseNumber || "\u2014",
    expiryDate: dateKey(r.expiryDate),
    renewalCycleKey: String(r.renewalCycleKey)
  }));
}
async function runLicenseExpiryEmailPass(today = todayDate()) {
  const records = await fetchLinkedNursesWithExpiringCredentials();
  let processed = 0;
  let sent = 0;
  let mockSent = 0;
  let failed = 0;
  let skipped = 0;
  for (const record of records) {
    if (!record.accountEmail || !record.expiryDate) {
      skipped++;
      continue;
    }
    const daysLeft = daysUntilExpiry(record.expiryDate, today);
    for (let i = 0; i < EXPIRY_THRESHOLDS.length; i++) {
      const thresh = EXPIRY_THRESHOLDS[i];
      const nextThresh = EXPIRY_THRESHOLDS[i + 1];
      const matches = thresh.days === 0 ? daysLeft <= 0 : daysLeft <= thresh.days && daysLeft > (nextThresh ? nextThresh.days : 0);
      if (!matches) continue;
      processed++;
      const isDup = await isEmailDuplicate({
        nurseId: record.nurseId,
        emailType: "license_expiry",
        referenceId: record.credentialId,
        thresholdKey: `${thresh.key}-${record.renewalCycleKey}`
      });
      if (isDup) {
        skipped++;
        continue;
      }
      const html = renderLicenseExpiryEmail({
        nurseName: record.fullName,
        licenseType: record.typeName,
        licenseNumber: record.licenseNumber,
        expiryDateStr: record.expiryDate,
        daysRemaining: daysLeft,
        thresholdKey: thresh.key,
        actionUrl: `${APP_URL2}/me`
      });
      const subject = daysLeft <= 0 ? `[URGENT] License Expired: ${record.typeName} (${record.licenseNumber})` : daysLeft <= 30 ? `[Action Required] ${record.typeName} expires in ${daysLeft} days` : daysLeft <= 90 ? `Renewal Notice: ${record.typeName} expires in ${daysLeft} days` : daysLeft <= 180 ? `6-Month Renewal Notice: ${record.typeName} expires in ${daysLeft} days` : `1-Year Renewal Notice: ${record.typeName} expires in ${daysLeft} days`;
      const res = await sendEmail({
        to: record.accountEmail,
        subject,
        html,
        nurseId: record.nurseId,
        emailType: "license_expiry",
        referenceId: record.credentialId,
        thresholdKey: `${thresh.key}-${record.renewalCycleKey}`
      });
      if (res.status === "sent") {
        sent++;
      } else if (res.status === "mock_sent") {
        mockSent++;
      } else {
        failed++;
      }
      break;
    }
  }
  return { processed, sent, mockSent, failed, skipped };
}
async function runUpcomingSeminarEmailPass() {
  const db = await getDb();
  let upcomingEvents = [];
  if (db) {
    const in1Day = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const in3Days = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const events = await db.select({
      id: trainingEvents.id,
      startDate: trainingEvents.startDate,
      startTime: trainingEvents.startTime,
      venue: trainingEvents.venue,
      trainingName: trainingCatalog.name
    }).from(trainingEvents).innerJoin(trainingCatalog, eq9(trainingCatalog.id, trainingEvents.trainingId)).where(and7(gte2(trainingEvents.startDate, sql9`${in1Day}::date`), lte3(trainingEvents.startDate, sql9`${in3Days}::date`)));
    upcomingEvents = events.map((e) => ({
      id: e.id,
      startDate: dateKey(e.startDate),
      startTime: e.startTime,
      venue: e.venue,
      trainingName: e.trainingName
    }));
  } else {
    const sqlite = getSqliteDb();
    upcomingEvents = sqlite.prepare(`
      SELECT e.id, e.startDate, e.startTime, e.venue, c.name as trainingName
      FROM trainingEvents e
      INNER JOIN trainingCatalog c ON c.id = e.trainingId
      WHERE date(e.startDate) >= date('now', '+1 day') AND date(e.startDate) <= date('now', '+3 days')
    `).all();
  }
  let processed = 0;
  let sent = 0;
  let mockSent = 0;
  let failed = 0;
  let skipped = 0;
  for (const ev of upcomingEvents) {
    let attendees = [];
    if (db) {
      const rows = await db.select({
        nurseId: nurses.id,
        firstName: nurses.firstName,
        middleName: nurses.middleName,
        lastName: nurses.lastName,
        suffix: nurses.suffix,
        accountEmail: nurses.accountEmail
      }).from(nurseTrainings).innerJoin(nurses, eq9(nurses.id, nurseTrainings.nurseId)).where(
        and7(
          eq9(nurseTrainings.eventId, ev.id),
          isNull7(nurses.archivedAt),
          isNotNull2(nurses.linkedUserId),
          isNotNull2(nurses.accountEmail)
        )
      );
      attendees = rows;
    } else {
      const sqlite = getSqliteDb();
      attendees = sqlite.prepare(`
        SELECT n.id as nurseId, n.firstName, n.middleName, n.lastName, n.suffix, n.accountEmail
        FROM nurseTrainings t
        INNER JOIN nurses n ON n.id = t.nurseId
        WHERE t.eventId = ? AND n.archivedAt IS NULL AND n.linkedUserId IS NOT NULL AND n.accountEmail IS NOT NULL
      `).all(ev.id);
    }
    for (const att of attendees) {
      processed++;
      const isDup = await isEmailDuplicate({
        nurseId: att.nurseId,
        emailType: "seminar_reminder",
        referenceId: ev.id,
        thresholdKey: "48h"
      });
      if (isDup) {
        skipped++;
        continue;
      }
      const html = renderSeminarReminderEmail({
        nurseName: nurseFullName(att),
        seminarTitle: ev.trainingName,
        scheduledDateStr: `${ev.startDate}${ev.startTime ? ` at ${ev.startTime}` : ""}`,
        venue: ev.venue,
        actionUrl: `${APP_URL2}/me`
      });
      const res = await sendEmail({
        to: att.accountEmail,
        subject: `Reminder: ${ev.trainingName} in 48 Hours`,
        html,
        nurseId: att.nurseId,
        emailType: "seminar_reminder",
        referenceId: ev.id,
        thresholdKey: "48h"
      });
      if (res.status === "sent") {
        sent++;
      } else if (res.status === "mock_sent") {
        mockSent++;
      } else {
        failed++;
      }
    }
  }
  return { processed, sent, mockSent, failed, skipped };
}
var EXPIRY_THRESHOLDS, APP_URL2;
var init_dispatcher = __esm({
  "server/email/dispatcher.ts"() {
    "use strict";
    init_db();
    init_localDb();
    init_nursetrack();
    init_schema();
    init_templates();
    init_service();
    EXPIRY_THRESHOLDS = [
      { days: 365, key: "365d" },
      { days: 180, key: "180d" },
      { days: 90, key: "90d" },
      { days: 60, key: "60d" },
      { days: 30, key: "30d" },
      { days: 7, key: "7d" },
      { days: 0, key: "expired" }
    ];
    APP_URL2 = process.env.APP_URL || "http://localhost:3000";
  }
});

// server/scheduled.ts
var scheduled_exports = {};
__export(scheduled_exports, {
  getManilaDateKey: () => getManilaDateKey,
  runDailyReminderJob: () => runDailyReminderJob,
  startDailyReminderScheduler: () => startDailyReminderScheduler
});
function getManilaDateKey() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
  return formatter.format(/* @__PURE__ */ new Date());
}
async function runDailyReminderJob(dateKey2 = getManilaDateKey()) {
  const acquired = await acquireReminderLock();
  if (!acquired) {
    return {
      ok: false,
      dateKey: dateKey2,
      locked: true,
      message: "Reminder job is already running or locked",
      notifications: { created: 0, skippedExisting: 0, expiredCredentials: 0, archivedSkipped: 0 },
      expiryEmails: { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0 },
      trainingOutbox: { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0, superseded: 0 },
      seminarEmails: { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0 }
    };
  }
  try {
    const notifications2 = await runDailyReminders(dateKey2);
    const expiryEmails = await runLicenseExpiryEmailPass(dateKey2);
    const outboxResult = await drainTrainingOutbox();
    const purgedOrphanFiles = await purgeOrphanStoredFiles(2);
    const seminarEmails = { processed: 0, sent: 0, mockSent: 0, failed: 0, skipped: 0 };
    return {
      ok: true,
      dateKey: dateKey2,
      notifications: notifications2,
      expiryEmails,
      trainingOutbox: outboxResult,
      seminarEmails,
      purgedOrphanFiles
    };
  } finally {
    await releaseReminderLock();
  }
}
function msUntilNextRun() {
  const now = /* @__PURE__ */ new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_RUN_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}
function startDailyReminderScheduler() {
  const scheduleNext = () => {
    setTimeout(async () => {
      await runDailyReminderJob();
      scheduleNext();
    }, msUntilNextRun());
  };
  scheduleNext();
}
var DAILY_RUN_HOUR;
var init_scheduled = __esm({
  "server/scheduled.ts"() {
    "use strict";
    init_reminders();
    init_dispatcher();
    init_db();
    init_trainingReminders();
    DAILY_RUN_HOUR = 8;
  }
});

// server/importStaffEmails.ts
var importStaffEmails_exports = {};
__export(importStaffEmails_exports, {
  importStaffEmailsHandler: () => importStaffEmailsHandler
});
import { z as z19 } from "zod";
async function importStaffEmailsHandler(req, res) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "not-authenticated" });
    }
    if (!hasFullAccess(user.email)) {
      return res.status(403).json({ error: "admin-only" });
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid-body", details: parsed.error.flatten() });
    }
    const result = await bulkSetAccountEmailsByLicense(parsed.data.rows);
    res.json({ ok: true, ...result, total: parsed.data.rows.length });
  } catch (error) {
    console.error("[ImportStaffEmails] failed:", error);
    res.status(500).json({ error: String(error) });
  }
}
var bodySchema;
var init_importStaffEmails = __esm({
  "server/importStaffEmails.ts"() {
    "use strict";
    init_adminAccess();
    init_sdk();
    init_db();
    bodySchema = z19.object({
      rows: z19.array(z19.object({ licenseNumber: z19.string(), email: z19.string() })).max(2e3)
    });
  }
});

// server/importStaffRoster.ts
var importStaffRoster_exports = {};
__export(importStaffRoster_exports, {
  importStaffRosterHandler: () => importStaffRosterHandler
});
import { z as z20 } from "zod";
async function importStaffRosterHandler(req, res) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "not-authenticated" });
    }
    if (!hasFullAccess(user.email)) {
      return res.status(403).json({ error: "admin-only" });
    }
    const parsed = bodySchema2.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid-body", details: parsed.error.flatten() });
    }
    const typeIdByName = /* @__PURE__ */ new Map();
    for (const t2 of await listCredentialTypes()) typeIdByName.set(t2.name, t2.id);
    const allExistingNurses = await listNurses();
    const nurseByName = new Map(
      allExistingNurses.map((n) => [`${n.lastName.trim()} ${n.firstName.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, ""), n])
    );
    let created = 0;
    let skipped = 0;
    const errors = [];
    for (const row of parsed.data.rows) {
      try {
        const nameKey = `${row.lastName.trim()} ${row.firstName.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        const existing = await getNurseByEmployeeId(row.licenseNumber) ?? nurseByName.get(nameKey);
        if (existing) {
          if (!existing.accountEmail && row.email) {
            await updateNurse(existing.id, { accountEmail: row.email });
          }
          skipped++;
          continue;
        }
        const typeName = CREDENTIAL_TYPE_BY_STAFF_TYPE[row.staffType];
        let credentialTypeId = typeIdByName.get(typeName);
        if (!credentialTypeId) {
          credentialTypeId = await createCredentialType(typeName);
          typeIdByName.set(typeName, credentialTypeId);
        }
        const nurseId = await createNurse({
          employeeId: row.licenseNumber,
          firstName: row.firstName,
          middleName: row.middleName ?? null,
          lastName: row.lastName,
          staffType: row.staffType,
          employmentStatus: "Active",
          accountEmail: row.email
        });
        await createCredential({
          nurseId,
          credentialTypeId,
          licenseNumber: row.licenseNumber,
          expiryDate: row.expiryDate,
          renewalCycleKey: renewalCycleKey(`import-${nurseId}`)
        });
        created++;
      } catch (rowError) {
        errors.push({ licenseNumber: row.licenseNumber, error: String(rowError) });
      }
    }
    res.json({ ok: true, created, skipped, errors, total: parsed.data.rows.length });
  } catch (error) {
    console.error("[ImportStaffRoster] failed:", error);
    res.status(500).json({ error: String(error) });
  }
}
var rowSchema, bodySchema2, CREDENTIAL_TYPE_BY_STAFF_TYPE;
var init_importStaffRoster = __esm({
  "server/importStaffRoster.ts"() {
    "use strict";
    init_adminAccess();
    init_sdk();
    init_db();
    init_nursetrack();
    init_deduplicate();
    rowSchema = z20.object({
      firstName: z20.string().min(1).max(128),
      middleName: z20.string().max(128).optional(),
      lastName: z20.string().min(1).max(128),
      staffType: z20.enum(["Registered Nurse", "Nursing Attendant"]),
      licenseNumber: z20.string().min(1).max(64),
      expiryDate: z20.string(),
      email: z20.string().email()
    });
    bodySchema2 = z20.object({ rows: z20.array(rowSchema).max(500) });
    CREDENTIAL_TYPE_BY_STAFF_TYPE = {
      "Registered Nurse": CANONICAL_CREDENTIAL_TYPES.RN,
      "Nursing Attendant": CANONICAL_CREDENTIAL_TYPES.NA
    };
  }
});

// server/importStaffAreas.ts
var importStaffAreas_exports = {};
__export(importStaffAreas_exports, {
  importStaffAreasHandler: () => importStaffAreasHandler
});
import { z as z21 } from "zod";
function normTokenSet(s) {
  return s.split(",").join(" ").split(/\s+/).map((t2) => t2.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean).sort().join("|");
}
function rowShortKey(fullName) {
  const [lastPart, ...restParts] = fullName.split(",");
  if (restParts.length === 0) return normTokenSet(fullName);
  const firstToken = restParts.join(",").trim().split(/\s+/)[0] ?? "";
  return normTokenSet(`${firstToken} ${lastPart}`);
}
function areaCode(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function importStaffAreasHandler(req, res) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "not-authenticated" });
    }
    if (!hasFullAccess(user.email)) {
      return res.status(403).json({ error: "admin-only" });
    }
    const parsed = bodySchema3.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid-body", details: parsed.error.flatten() });
    }
    const nurses2 = await listNurses();
    const byFullKey = /* @__PURE__ */ new Map();
    const byShortKey = /* @__PURE__ */ new Map();
    for (const n of nurses2) {
      const full = normTokenSet(`${n.firstName} ${n.middleName ?? ""} ${n.lastName} ${n.suffix ?? ""}`);
      const short = normTokenSet(`${n.firstName} ${n.lastName}`);
      if (!byFullKey.has(full)) byFullKey.set(full, []);
      byFullKey.get(full).push(n);
      if (!byShortKey.has(short)) byShortKey.set(short, []);
      byShortKey.get(short).push(n);
    }
    const areaIdByName = /* @__PURE__ */ new Map();
    for (const a of await listAreas()) areaIdByName.set(a.name, a.id);
    let assigned = 0;
    let alreadySet = 0;
    const notFound = [];
    const ambiguous = [];
    for (const row of parsed.data.rows) {
      const canonical = canonicalAreaInfo(row.areaName);
      const targetAreaName = canonical ? canonical.name : row.areaName;
      const targetAreaCode = canonical ? canonical.code : areaCode(row.areaName);
      let areaId = areaIdByName.get(targetAreaName);
      if (!areaId) {
        areaId = await createArea({ code: targetAreaCode, name: targetAreaName });
        areaIdByName.set(targetAreaName, areaId);
      }
      const fullKey = normTokenSet(row.fullName);
      let candidates = byFullKey.get(fullKey) ?? [];
      if (candidates.length === 0) {
        candidates = byShortKey.get(rowShortKey(row.fullName)) ?? [];
      }
      if (candidates.length === 0) {
        notFound.push(row.fullName);
        continue;
      }
      const uniqueIds = Array.from(new Set(candidates.map((c) => c.id)));
      if (uniqueIds.length > 1) {
        ambiguous.push(row.fullName);
        continue;
      }
      const nurse = candidates[0];
      if (nurse.currentAreaId) {
        alreadySet++;
        continue;
      }
      await updateNurse(nurse.id, { currentAreaId: areaId });
      await createAssignment({
        nurseId: nurse.id,
        areaId,
        startDate: /* @__PURE__ */ new Date(),
        assignmentType: "Permanent Transfer",
        isCurrent: true
      });
      assigned++;
    }
    res.json({ ok: true, assigned, alreadySet, notFound, ambiguous, total: parsed.data.rows.length, areas: Array.from(areaIdByName.keys()) });
  } catch (error) {
    console.error("[ImportStaffAreas] failed:", error);
    res.status(500).json({ error: String(error) });
  }
}
var rowSchema2, bodySchema3;
var init_importStaffAreas = __esm({
  "server/importStaffAreas.ts"() {
    "use strict";
    init_adminAccess();
    init_sdk();
    init_db();
    init_deduplicate();
    rowSchema2 = z21.object({ fullName: z21.string().min(1).max(256), areaName: z21.string().min(1).max(128) });
    bodySchema3 = z21.object({ rows: z21.array(rowSchema2).max(500) });
  }
});

// server/importStaffTrainings.ts
var importStaffTrainings_exports = {};
__export(importStaffTrainings_exports, {
  importStaffTrainingsHandler: () => importStaffTrainingsHandler
});
import { z as z22 } from "zod";
function normTokenSet2(s) {
  return s.split(",").join(" ").split(/\s+/).map((t2) => t2.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean).sort().join("|");
}
function rowShortKey2(fullName) {
  const [lastPart, ...restParts] = fullName.split(",");
  if (restParts.length === 0) return normTokenSet2(fullName);
  const firstToken = restParts.join(",").trim().split(/\s+/)[0] ?? "";
  return normTokenSet2(`${firstToken} ${lastPart}`);
}
function parseBestEffortDate(text2) {
  if (!text2) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text2)) {
    const d = new Date(text2);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const monthMatch = text2.match(new RegExp(`\\b(${MONTHS})\\b`, "i"));
  const yearMatch = text2.match(/\b(20\d{2})\b/);
  if (monthMatch && yearMatch) {
    const afterMonth = text2.slice((monthMatch.index ?? 0) + monthMatch[0].length);
    const dayMatch = afterMonth.match(/\d{1,2}/);
    if (dayMatch) {
      const d = /* @__PURE__ */ new Date(`${monthMatch[0]} ${dayMatch[0]}, ${yearMatch[1]}`);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const slashMatch = text2.match(/^(\d{1,2})\/(\d{1,2})(?:[-,]\d{1,2})*\/(\d{2,4})/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2e3;
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
async function importStaffTrainingsHandler(req, res) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "not-authenticated" });
    }
    if (!hasFullAccess(user.email)) {
      return res.status(403).json({ error: "admin-only" });
    }
    const parsed = bodySchema4.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid-body", details: parsed.error.flatten() });
    }
    const nurses2 = await listNurses();
    const byFullKey = /* @__PURE__ */ new Map();
    const byShortKey = /* @__PURE__ */ new Map();
    for (const n of nurses2) {
      const full = normTokenSet2(`${n.firstName} ${n.middleName ?? ""} ${n.lastName} ${n.suffix ?? ""}`);
      const short = normTokenSet2(`${n.firstName} ${n.lastName}`);
      if (!byFullKey.has(full)) byFullKey.set(full, []);
      byFullKey.get(full).push(n);
      if (!byShortKey.has(short)) byShortKey.set(short, []);
      byShortKey.get(short).push(n);
    }
    const catalogIdByName = /* @__PURE__ */ new Map();
    for (const t2 of await listTrainingCatalog(true)) catalogIdByName.set(t2.name.toLowerCase(), t2.id);
    const existing = await listNurseTrainings();
    const existingKeys = new Set(existing.map((e) => `${e.nurseId}:${e.trainingId}:${e.remarks ?? ""}`));
    let created = 0;
    let skippedDuplicate = 0;
    let notFound = 0;
    let ambiguous = 0;
    const unmatched = [];
    for (const row of parsed.data.rows) {
      const fullKey = normTokenSet2(row.fullName);
      let candidates = byFullKey.get(fullKey) ?? [];
      if (candidates.length === 0) candidates = byShortKey.get(rowShortKey2(row.fullName)) ?? [];
      if (candidates.length === 0) {
        notFound++;
        unmatched.push(row.fullName);
        continue;
      }
      const uniqueIds = Array.from(new Set(candidates.map((c) => c.id)));
      if (uniqueIds.length > 1) {
        ambiguous++;
        unmatched.push(row.fullName);
        continue;
      }
      const nurse = candidates[0];
      const title = row.title.trim();
      let trainingId = catalogIdByName.get(title.toLowerCase());
      if (!trainingId) {
        try {
          trainingId = await createTrainingType({ name: title, kind: "Seminar" });
        } catch {
          const fresh = await listTrainingCatalog(true);
          const match = fresh.find((t2) => t2.name.toLowerCase() === title.toLowerCase());
          if (!match) throw new Error(`Could not create or find training catalog entry for "${title}"`);
          trainingId = match.id;
        }
        catalogIdByName.set(title.toLowerCase(), trainingId);
      }
      const resolvedTrainingId = trainingId;
      const remarks = `${row.quarter}: ${row.dateText ?? ""}`.trim();
      const dedupeKey = `${nurse.id}:${resolvedTrainingId}:${remarks}`;
      if (existingKeys.has(dedupeKey)) {
        skippedDuplicate++;
        continue;
      }
      const completionDate = parseBestEffortDate(row.dateText);
      await createNurseTraining({
        nurseId: nurse.id,
        trainingId: resolvedTrainingId,
        status: "Completed",
        completionDate,
        provider: row.provider,
        remarks
      });
      existingKeys.add(dedupeKey);
      created++;
    }
    res.json({ ok: true, created, skippedDuplicate, notFound, ambiguous, unmatched, total: parsed.data.rows.length });
  } catch (error) {
    console.error("[ImportStaffTrainings] failed:", error);
    res.status(500).json({ error: String(error) });
  }
}
var rowSchema3, bodySchema4, MONTHS;
var init_importStaffTrainings = __esm({
  "server/importStaffTrainings.ts"() {
    "use strict";
    init_adminAccess();
    init_sdk();
    init_db();
    rowSchema3 = z22.object({
      fullName: z22.string().min(1).max(256),
      title: z22.string().min(1).max(512),
      dateText: z22.string().max(256).optional(),
      provider: z22.string().max(128).optional(),
      quarter: z22.string().max(32)
    });
    bodySchema4 = z22.object({ rows: z22.array(rowSchema3).max(1e3) });
    MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  }
});

// server/vercel.ts
import "dotenv/config";
import crypto2 from "crypto";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
init_const();
init_db();
import { parse as parseCookieHeader2 } from "cookie";

// server/_core/cookies.ts
init_const();
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
function getClaimCookieOptions(req) {
  return { ...getSessionCookieOptions(req), maxAge: CLAIM_TTL_MS };
}

// server/_core/oauth.ts
init_sdk();
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
      if (user) {
        await autoLinkNurseByEmail(user.id, userInfo.email);
      }
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/storage.ts
init_env();
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
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);
  if (ENV.s3BucketName) {
    const client = await getClient();
    if (client) {
      try {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new PutObjectCommand({
            Bucket: ENV.s3BucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType
          })
        );
        return { key, url: `/storage/${key}` };
      } catch (err) {
        console.warn("[Storage] S3 PutObject failed, falling back to database storage:", err);
      }
    }
  }
  await saveStoredFile(key, buffer.toString("base64"), contentType, buffer.length);
  return { key, url: `/storage/${key}` };
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
async function storageDelete(relKey) {
  if (!relKey) return;
  const key = normalizeKey(relKey);
  if (ENV.s3BucketName) {
    const client = await getClient();
    if (client) {
      try {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new DeleteObjectCommand({
            Bucket: ENV.s3BucketName,
            Key: key
          })
        );
      } catch (err) {
        console.warn("[Storage] S3 DeleteObject failed:", err);
      }
    }
  }
  await deleteStoredFile(key);
}

// server/_core/storageProxy.ts
init_env();
init_db();
function registerStorageProxy(app) {
  app.get("/storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    try {
      const stored = await getStoredFile(key);
      if (stored) {
        res.setHeader("Content-Type", stored.mimeType || "application/octet-stream");
        res.setHeader("Content-Length", stored.fileSize || Buffer.byteLength(stored.data, "base64"));
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.send(Buffer.from(stored.data, "base64"));
      }
      if (ENV.s3BucketName) {
        const url = await storageGetSignedUrl(key);
        if (url !== `/storage/${key}`) {
          res.set("Cache-Control", "no-store");
          return res.redirect(307, url);
        }
      }
      res.status(404).send("File not found");
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
init_const();

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/trpc.ts
init_adminAccess();
init_const();
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
var staffProcedure = baseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (ctx.user) {
      const nurse = await getNurseByLinkedUserId(ctx.user.id);
      if (nurse) {
        const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
        const nurseEmail = (nurse.accountEmail ?? "").trim().toLowerCase();
        if (userEmail && nurseEmail && userEmail === nurseEmail && !nurse.archivedAt) {
          return next({ ctx: { ...ctx, nurseId: nurse.id, authMode: "google" } });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }
    }
    if (ctx.claimNurseId) {
      return next({ ctx: { ...ctx, nurseId: ctx.claimNurseId, authMode: "claim" } });
    }
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  })
);
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

// server/routers/nurses.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError2 } from "@trpc/server";
init_db();
init_nursetrack();
init_nursetrack();
var dateInput = z2.union([z2.date(), z2.string().datetime()]).transform((d) => d instanceof Date ? d : new Date(d));
var nullableDateInput = z2.union([z2.date(), z2.string().datetime(), z2.null()]).transform((d) => d === null ? null : d instanceof Date ? d : new Date(d)).optional();
var nursesRouter = router({
  // Single round-trip initial load: nurses with areas in one call.
  initial: adminProcedure.query(async () => {
    const [rows, areaRows, licenseMap] = await Promise.all([
      listNurses(),
      listAreas(false),
      getAllNurseLicenseInfos()
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const nurses2 = rows.map((n) => {
      const info = licenseMap.get(n.id) ?? { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null };
      return {
        ...n,
        currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
        licenseStatus: info.status,
        licenseNumber: info.licenseNumber,
        licenseExpiryDate: info.expiryDate,
        licenseDaysRemaining: info.daysRemaining
      };
    });
    return { nurses: nurses2, areas: areaRows };
  }),
  list: adminProcedure.input(z2.object({ archived: z2.boolean().optional(), areaId: z2.number().optional() }).optional()).query(async ({ input }) => {
    const [rows, areaRows, licenseMap] = await Promise.all([
      listNurses({ archived: input?.archived, areaId: input?.areaId }),
      listAreas(false),
      getAllNurseLicenseInfos()
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    return rows.map((n) => {
      const info = licenseMap.get(n.id) ?? { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null };
      return {
        ...n,
        currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
        licenseStatus: info.status,
        licenseNumber: info.licenseNumber,
        licenseExpiryDate: info.expiryDate,
        licenseDaysRemaining: info.daysRemaining
      };
    });
  }),
  search: adminProcedure.input(z2.object({ query: z2.string().min(1) })).query(async ({ input }) => {
    const rows = await searchNurses(input.query);
    const areaRows = await listAreas(false);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    return Promise.all(rows.map(async (n) => {
      const info = await getNurseLicenseInfo(n.id);
      return {
        ...n,
        currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
        licenseStatus: info.status,
        licenseNumber: info.licenseNumber,
        licenseIssueDate: info.issueDate || null,
        licenseExpiryDate: info.expiryDate,
        licenseDaysRemaining: info.daysRemaining
      };
    }));
  }),
  get: adminProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
    const nurse = await getNurseById(input.id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    const areaRows = await listAreas(false);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const info = await getNurseLicenseInfo(nurse.id);
    return {
      ...nurse,
      currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
      licenseStatus: info.status,
      licenseNumber: info.licenseNumber,
      licenseIssueDate: info.issueDate || null,
      licenseExpiryDate: info.expiryDate,
      licenseDaysRemaining: info.daysRemaining
    };
  }),
  profile: adminProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
    const nurseId = Math.floor(input.id);
    const pg = getBatchClient();
    if (pg) {
      const sets = await pg.unsafe(
        [
          `select * from nursetrack.nurses where id = ${nurseId} limit 1`,
          `select * from nursetrack.areas order by "sortOrder"`,
          `select * from nursetrack."credentialTypes"`,
          `select id, name from nursetrack."trainingCatalog" order by name`,
          `select id, "nurseId", "areaId", "startDate"::text as "startDate", "endDate"::text as "endDate", "assignmentType", remarks, "isCurrent"
                 from nursetrack."areaAssignments"
                 where "nurseId" = ${nurseId}
                 order by "startDate" desc`,
          `select id, "nurseId", "credentialTypeId", "licenseNumber", "issuingOrganization", "issueDate"::text as "issueDate", "expiryDate"::text as "expiryDate", "renewalStatus", "verificationStatus", "documentKey", "renewalCycleKey", remarks
                 from nursetrack."nurseCredentials"
                 where "nurseId" = ${nurseId}
                 order by "expiryDate" desc`,
          `select id, "nurseId", "trainingId", "eventId", "participationRole", "completionDate"::text as "completionDate", "expiryDate"::text as "expiryDate", "scheduledDate"::text as "scheduledDate", status, "trainingHours", "cpdUnits", provider, "certificateNumber", "certificateKey", remarks
                 from nursetrack."nurseTrainings"
                 where "nurseId" = ${nurseId}
                 order by "completionDate" desc nulls last, id desc`,
          `select "areaId", "trainingId", required
                 from nursetrack."areaTrainingRequirements"
                where "areaId" in (
                  select coalesce("currentAreaId", -1) from nursetrack.nurses where id = ${nurseId}
                  union
                  select coalesce("areaId", -1) from nursetrack."areaAssignments" where "nurseId" = ${nurseId}
                )`
        ].join(";\n")
      ).simple();
      const [nurseRows, areaRows2, credTypes2, catalog2, rawAssignments2, rawCreds2, rawTrainings2, areaReqs] = sets;
      const nurse2 = nurseRows[0];
      if (!nurse2) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
      const areaById2 = new Map(areaRows2.map((a) => [a.id, a]));
      const credTypeById2 = new Map(credTypes2.map((t2) => [t2.id, t2]));
      const catById2 = new Map(catalog2.map((t2) => [t2.id, t2]));
      const credentials2 = rawCreds2.map((c) => ({
        ...c,
        typeName: credTypeById2.get(c.credentialTypeId)?.name ?? "Unknown",
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
      }));
      const latestCred = rawCreds2[0];
      const licenseStatus = latestCred ? deriveLicenseStatus(dateKey(latestCred.expiryDate)) : null;
      const licenseNumber = latestCred?.licenseNumber ?? null;
      const licenseExpiryDate = latestCred?.expiryDate ? dateKey(latestCred.expiryDate) : null;
      const licenseDaysRemaining = licenseExpiryDate ? daysUntilExpiry(licenseExpiryDate) : null;
      const trainings2 = rawTrainings2.map((r) => ({
        ...r,
        trainingName: catById2.get(r.trainingId)?.name ?? "Unknown"
      }));
      const assignments2 = rawAssignments2.map((a) => {
        const area = areaById2.get(a.areaId) ?? null;
        return {
          ...a,
          area,
          areaName: area?.name ?? "Unknown"
        };
      });
      const effectiveAreaId2 = nurse2.currentAreaId ?? rawAssignments2.find((a) => a.isCurrent)?.areaId ?? null;
      let compliance2 = null;
      if (effectiveAreaId2) {
        const requiredIds = areaReqs.filter((r) => r.areaId === effectiveAreaId2 && r.required).map((r) => r.trainingId);
        const comp = trainingCompliance({
          requiredTrainingIds: requiredIds,
          nurseTrainingRecords: rawTrainings2.map((r) => ({
            trainingId: r.trainingId,
            status: r.status,
            expiryDate: r.expiryDate,
            completionDate: r.completionDate
          }))
        });
        const completedValid = requiredIds.filter((tid) => {
          const recs = rawTrainings2.filter((r) => r.trainingId === tid && r.status === "Completed");
          return recs.some((r) => !r.expiryDate || new Date(r.expiryDate) > /* @__PURE__ */ new Date());
        }).length;
        compliance2 = { compliancePercent: comp, requiredCount: requiredIds.length, completedCount: completedValid };
      }
      return {
        nurse: {
          ...nurse2,
          currentArea: effectiveAreaId2 ? areaById2.get(effectiveAreaId2) ?? null : null,
          licenseStatus,
          licenseNumber,
          licenseExpiryDate,
          licenseDaysRemaining
        },
        assignments: assignments2,
        credentials: credentials2,
        trainings: trainings2,
        compliance: compliance2,
        catalog: catalog2,
        areas: areaRows2
      };
    }
    const nurse = await getNurseById(input.id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    const [areaRows, licenseInfo, rawAssignments, rawCreds, rawTrainings, credTypes, catalog] = await Promise.all([
      listAreas(false),
      getNurseLicenseInfo(nurse.id),
      listAssignmentsForNurse(nurse.id),
      listCredentials({ nurseId: nurse.id }),
      listNurseTrainings({ nurseId: nurse.id }),
      listCredentialTypes(),
      listTrainingCatalog(false)
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const credTypeById = new Map(credTypes.map((t2) => [t2.id, t2]));
    const catById = new Map(catalog.map((t2) => [t2.id, t2]));
    const assignments = rawAssignments.map((a) => {
      const area = areaById.get(a.areaId) ?? null;
      return {
        ...a,
        area,
        areaName: area?.name ?? "Unknown"
      };
    });
    const effectiveAreaId = nurse.currentAreaId ?? rawAssignments.find((a) => a.isCurrent)?.areaId ?? null;
    const credentials = rawCreds.map((c) => ({
      ...c,
      typeName: credTypeById.get(c.credentialTypeId)?.name ?? "Unknown",
      derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
      daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
    }));
    const trainings = rawTrainings.map((r) => ({
      ...r,
      trainingName: catById.get(r.trainingId)?.name ?? "Unknown"
    }));
    let compliance = null;
    if (effectiveAreaId) {
      const requiredIds = await getAreaTrainingRequirementIds(effectiveAreaId);
      const comp = trainingCompliance({
        requiredTrainingIds: requiredIds,
        nurseTrainingRecords: rawTrainings.map((r) => ({
          trainingId: r.trainingId,
          status: r.status,
          expiryDate: r.expiryDate,
          completionDate: r.completionDate
        }))
      });
      const completedValid = requiredIds.filter((tid) => {
        const recs = rawTrainings.filter((r) => r.trainingId === tid && r.status === "Completed");
        return recs.some((r) => !r.expiryDate || new Date(r.expiryDate) > /* @__PURE__ */ new Date());
      }).length;
      compliance = { compliancePercent: comp, requiredCount: requiredIds.length, completedCount: completedValid };
    }
    return {
      nurse: {
        ...nurse,
        currentArea: effectiveAreaId ? areaById.get(effectiveAreaId) ?? null : null,
        licenseStatus: licenseInfo.status,
        licenseNumber: licenseInfo.licenseNumber,
        licenseExpiryDate: licenseInfo.expiryDate,
        licenseDaysRemaining: licenseInfo.daysRemaining
      },
      assignments,
      credentials,
      trainings,
      compliance,
      catalog,
      areas: areaRows
    };
  }),
  create: adminProcedure.input(
    z2.object({
      employeeId: z2.string().min(1).max(64),
      firstName: z2.string().min(1).max(128),
      middleName: z2.string().max(128).optional(),
      lastName: z2.string().min(1).max(128),
      suffix: z2.string().max(32).optional(),
      position: z2.string().max(128).optional(),
      staffType: z2.enum(STAFF_TYPES).optional(),
      dateHired: nullableDateInput,
      employmentStatus: z2.enum([...EMPLOYMENT_STATUSES]),
      currentAreaId: z2.number().optional(),
      accountEmail: z2.string().email().max(320).optional(),
      licenseNumber: z2.string().max(64).optional(),
      licenseIssueDate: nullableDateInput,
      licenseExpiryDate: nullableDateInput
    })
  ).mutation(async ({ ctx, input }) => {
    const { accountEmail, licenseNumber, licenseIssueDate, licenseExpiryDate, ...nurseData } = input;
    if (licenseIssueDate && licenseExpiryDate && licenseIssueDate > licenseExpiryDate) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
    }
    const byId = await getNurseByEmployeeId(input.employeeId);
    if (byId) throw new TRPCError2({ code: "CONFLICT", message: "A nurse with this Employee ID already exists." });
    const id = await createNurse(nurseData);
    await updateNurse(id, { currentAreaId: input.currentAreaId ?? null });
    if (licenseNumber !== void 0 || licenseIssueDate !== void 0 || licenseExpiryDate !== void 0) {
      const licRes = await upsertNursePrcLicense(id, licenseNumber, {
        issueDate: licenseIssueDate,
        expiryDate: licenseExpiryDate
      });
      if (!licRes.ok) throw new TRPCError2({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
    }
    if (accountEmail) {
      const result = await adminSetNurseAccountEmail(id, accountEmail);
      if (!result.ok) throw new TRPCError2({ code: "CONFLICT", message: "That sign-in email is already in use." });
    }
    if (input.currentAreaId) {
      await createAssignment({
        nurseId: id,
        areaId: input.currentAreaId,
        startDate: /* @__PURE__ */ new Date(),
        assignmentType: "Permanent Transfer",
        isCurrent: true
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: id,
      actionType: "nurse.created",
      entityType: "nurse",
      entityId: id,
      summary: `Nurse profile created: ${nurseFullName(input)}`
    });
    return { id };
  }),
  update: adminProcedure.input(
    z2.object({
      id: z2.number(),
      employeeId: z2.string().min(1).max(64).optional(),
      firstName: z2.string().min(1).max(128).optional(),
      middleName: z2.string().max(128).optional().nullable(),
      lastName: z2.string().min(1).max(128).optional(),
      suffix: z2.string().max(32).optional().nullable(),
      position: z2.string().max(128).optional().nullable(),
      staffType: z2.enum(STAFF_TYPES).optional(),
      dateHired: nullableDateInput,
      employmentStatus: z2.enum([...EMPLOYMENT_STATUSES]).optional(),
      currentAreaId: z2.number().optional(),
      accountEmail: z2.union([z2.string().email().max(320), z2.literal("")]).optional(),
      licenseNumber: z2.string().max(64).optional().nullable(),
      licenseIssueDate: nullableDateInput,
      licenseExpiryDate: nullableDateInput
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, employeeId, accountEmail, licenseNumber, licenseIssueDate, licenseExpiryDate, ...rest } = input;
    if (licenseIssueDate && licenseExpiryDate && licenseIssueDate > licenseExpiryDate) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
    }
    const nurse = await getNurseById(id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    if (employeeId !== void 0 && employeeId !== nurse.employeeId) {
      const taken = await getNurseByEmployeeId(employeeId);
      if (taken) throw new TRPCError2({ code: "CONFLICT", message: "A nurse with this Employee ID already exists." });
    }
    await updateNurse(id, { ...rest, ...employeeId ? { employeeId } : {} });
    if (licenseNumber !== void 0 || licenseIssueDate !== void 0 || licenseExpiryDate !== void 0) {
      const licRes = await upsertNursePrcLicense(id, licenseNumber, {
        issueDate: licenseIssueDate,
        expiryDate: licenseExpiryDate
      });
      if (!licRes.ok) throw new TRPCError2({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
    }
    if (accountEmail !== void 0) {
      const result = await adminSetNurseAccountEmail(id, accountEmail === "" ? null : accountEmail);
      if (!result.ok) throw new TRPCError2({ code: "CONFLICT", message: "That sign-in email is already in use." });
    }
    if (input.currentAreaId !== void 0 && input.currentAreaId !== nurse.currentAreaId) {
      await clearCurrentAssignmentsForNurse(id);
      if (input.currentAreaId) {
        await createAssignment({
          nurseId: id,
          areaId: input.currentAreaId,
          startDate: /* @__PURE__ */ new Date(),
          assignmentType: "Permanent Transfer",
          remarks: "Updated via nurse profile edit",
          isCurrent: true
        });
      }
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: id,
      actionType: "nurse.updated",
      entityType: "nurse",
      entityId: id,
      summary: `Nurse profile updated: ${nurseFullName({ ...nurse, ...input })}`
    });
    return { success: true };
  }),
  archive: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    if (nurse.archivedAt) throw new TRPCError2({ code: "BAD_REQUEST", message: "Nurse is already archived." });
    await updateNurse(input.id, { archivedAt: /* @__PURE__ */ new Date(), employmentStatus: "Archived" });
    await clearCurrentAssignmentsForNurse(input.id);
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.id,
      actionType: "nurse.archived",
      entityType: "nurse",
      entityId: input.id,
      summary: `Nurse archived: ${nurseFullName(nurse)}`
    });
    return { success: true };
  }),
  restore: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    if (!nurse.archivedAt) throw new TRPCError2({ code: "BAD_REQUEST", message: "Nurse is not archived." });
    await updateNurse(input.id, { archivedAt: null, employmentStatus: nurse.employmentStatus === "Archived" ? "Active" : nurse.employmentStatus });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.id,
      actionType: "nurse.restored",
      entityType: "nurse",
      entityId: input.id,
      summary: `Nurse restored: ${nurseFullName(nurse)}`
    });
    return { success: true };
  }),
  delete: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.id);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    const fullName = nurseFullName(nurse);
    await deleteNurse(input.id);
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "nurse.deleted",
      entityType: "nurse",
      entityId: input.id,
      summary: `Nurse record permanently deleted: ${fullName} (${nurse.employeeId})`
    });
    return { success: true };
  }),
  uploadPhoto: adminProcedure.input(
    z2.object({
      nurseId: z2.number(),
      fileBase64: z2.string(),
      fileName: z2.string().max(200),
      mimeType: z2.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    const mimeCheck = validateMime(input.mimeType, "photo");
    if (!mimeCheck.ok) throw new TRPCError2({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError2({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const oldKey = nurse.profilePhotoKey;
    const key = storageKey("profile-photos", input.nurseId, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    await updateNurse(input.nurseId, { profilePhotoKey: storedKey });
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.nurseId,
      actionType: "nurse.photo.updated",
      entityType: "nurse",
      entityId: input.nurseId,
      summary: `Profile photo replaced for ${nurseFullName(nurse)}`
    });
    return { url };
  }),
  getAssignments: adminProcedure.input(z2.object({ nurseId: z2.number() })).query(async ({ input }) => {
    const rows = await listAssignmentsForNurse(input.nurseId);
    const areaRows = await listAreas();
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    return rows.map((a) => ({ ...a, area: areaById.get(a.areaId) ?? null }));
  }),
  changeArea: adminProcedure.input(
    z2.object({
      nurseId: z2.number(),
      newAreaId: z2.number(),
      effectiveDate: z2.date(),
      assignmentType: z2.enum([...ASSIGNMENT_TYPES]),
      remarks: z2.string().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    const assignments = await listAssignmentsForNurse(input.nurseId);
    const current = assignments.find((a) => a.isCurrent);
    if (!current) throw new TRPCError2({ code: "BAD_REQUEST", message: "Nurse has no current assignment." });
    if (current.areaId === input.newAreaId) throw new TRPCError2({ code: "BAD_REQUEST", message: "Nurse is already in that area." });
    const effective = new Date(
      input.effectiveDate.getFullYear(),
      input.effectiveDate.getMonth(),
      input.effectiveDate.getDate()
    );
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    await closeAssignment(current.id, new Date(effective.getTime() - 864e5));
    await createAssignment({
      nurseId: input.nurseId,
      areaId: input.newAreaId,
      startDate: effective,
      assignmentType: input.assignmentType,
      remarks: input.remarks ?? void 0,
      isCurrent: effective <= today
    });
    if (effective <= today) {
      await updateNurse(input.nurseId, { currentAreaId: input.newAreaId });
    }
    const oldAreaName = current.areaId ? (await getAreaById(current.areaId))?.name : "Unassigned";
    const newAreaName = (await getAreaById(input.newAreaId))?.name ?? "Unknown";
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.nurseId,
      actionType: "nurse.area.changed",
      entityType: "areaAssignment",
      summary: `Area changed from ${oldAreaName} to ${newAreaName} effective ${effective.toLocaleDateString("en-CA")} (${input.assignmentType})`,
      metadata: {
        nurseId: input.nurseId,
        oldAreaId: current.areaId,
        newAreaId: input.newAreaId,
        effectiveDate: effective.toLocaleDateString("en-CA"),
        assignmentType: input.assignmentType
      }
    });
    if (nurse.accountEmail) {
      (async () => {
        try {
          const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_service(), service_exports));
          const { renderProfileUpdateEmail: renderProfileUpdateEmail2 } = await Promise.resolve().then(() => (init_templates(), templates_exports));
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          const html = renderProfileUpdateEmail2({
            nurseName: nurseFullName(nurse),
            updateTitle: "Unit / Area Assignment Changed",
            details: `Your assignment has been updated from ${oldAreaName} to ${newAreaName} (${input.assignmentType}) effective ${effective.toLocaleDateString("en-CA")}.`,
            actionUrl: `${appUrl}/me`
          });
          await sendEmail2({
            to: nurse.accountEmail,
            subject: `Assignment Update: Transferred to ${newAreaName}`,
            html,
            nurseId: nurse.id,
            emailType: "profile_update"
          });
        } catch (err) {
          console.error("[Email:AreaChange] Failed to dispatch email:", err);
        }
      })();
    }
    return { success: true };
  }),
  backfillAssignment: adminProcedure.input(
    z2.object({
      nurseId: z2.number(),
      areaId: z2.number(),
      startDate: z2.date(),
      endDate: nullableDateInput,
      assignmentType: z2.enum([...ASSIGNMENT_TYPES]).optional(),
      remarks: z2.string().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found" });
    await createAssignment({
      nurseId: input.nurseId,
      areaId: input.areaId,
      startDate: input.startDate,
      endDate: input.endDate ?? void 0,
      assignmentType: input.assignmentType ?? void 0,
      remarks: input.remarks ?? void 0,
      isCurrent: false
    });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.nurseId,
      actionType: "nurse.assignment.backfilled",
      entityType: "areaAssignment",
      summary: `Historical assignment backfilled: ${input.assignmentType ?? "Other"} (${input.startDate.toISOString().slice(0, 10)})`
    });
    return { success: true };
  }),
  getEmployeeById: adminProcedure.input(z2.object({ employeeId: z2.string().min(1).max(64) })).query(async ({ input }) => {
    return await getNurseByEmployeeId(input.employeeId);
  }),
  sendDirectNotice: adminProcedure.input(
    z2.object({
      nurseId: z2.number().int().positive(),
      subject: z2.string().min(1).max(256),
      message: z2.string().min(1).max(2e3)
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError2({ code: "NOT_FOUND", message: "Nurse not found." });
    if (!nurse.accountEmail) {
      throw new TRPCError2({
        code: "BAD_REQUEST",
        message: "This staff member does not have a linked email address yet."
      });
    }
    const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_service(), service_exports));
    const { renderDirectNoticeEmail: renderDirectNoticeEmail2 } = await Promise.resolve().then(() => (init_templates(), templates_exports));
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const html = renderDirectNoticeEmail2({
      nurseName: nurseFullName(nurse),
      subject: input.subject,
      message: input.message,
      actionUrl: `${appUrl}/me`
    });
    const res = await sendEmail2({
      to: nurse.accountEmail,
      subject: input.subject,
      html,
      nurseId: nurse.id,
      emailType: "manual_notice"
    });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: nurse.id,
      actionType: "nurse.notice.sent",
      entityType: "nurse",
      entityId: nurse.id,
      summary: `Direct email notice sent to ${nurseFullName(nurse)}: "${input.subject}"`
    });
    return res;
  })
});

// server/routers/credentials.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
init_db();
init_nursetrack();
var nullableDateInput2 = z3.union([z3.date(), z3.string().datetime(), z3.null()]).transform((d) => d === null ? null : d instanceof Date ? d : new Date(d)).optional();
var credentialsRouter = router({
  listTypes: adminProcedure.query(() => listCredentialTypes()),
  createType: adminProcedure.input(z3.object({ name: z3.string().min(1).max(128), issuingOrganizationDefault: z3.string().max(200).optional() })).mutation(async ({ input }) => {
    const id = await createCredentialType(input.name, input.issuingOrganizationDefault);
    return { id };
  }),
  updateType: adminProcedure.input(z3.object({ id: z3.number(), name: z3.string().min(1).max(128).optional(), issuingOrganizationDefault: z3.string().max(200).optional().nullable(), active: z3.boolean().optional() })).mutation(async ({ input }) => {
    await updateCredentialType(input.id, { ...input, issuingOrganizationDefault: input.issuingOrganizationDefault ?? void 0 });
    return { success: true };
  }),
  // Single round-trip initial load merging credentials + nurses + types
  initial: adminProcedure.query(async () => {
    const pg = getBatchClient();
    if (pg) {
      const sets = await pg.unsafe(
        [
          `select id, "nurseId", "credentialTypeId", "licenseNumber", "issuingOrganization",
                    "issueDate"::text as "issueDate", "expiryDate"::text as "expiryDate",
                    "renewalStatus", "verificationStatus", "documentKey", remarks
               from nursetrack."nurseCredentials"
              order by "expiryDate" asc`,
          `select id, "employeeId", "firstName", "middleName", "lastName", suffix, position, "currentAreaId", "archivedAt"
               from nursetrack.nurses
              where "archivedAt" is null`,
          `select * from nursetrack."credentialTypes" order by name`
        ].join(";\n")
      ).simple();
      const [rawCreds, activeNurses2, types2] = sets;
      const activeNurseIds2 = new Set(activeNurses2.map((n) => n.id));
      const nurseById2 = new Map(activeNurses2.map((n) => [n.id, n]));
      const typeById2 = new Map(types2.map((t2) => [t2.id, t2]));
      const activeCreds2 = rawCreds.filter((c) => activeNurseIds2.has(c.nurseId));
      return {
        credentials: activeCreds2.map((c) => ({
          ...c,
          nurse: nurseById2.get(c.nurseId),
          typeName: typeById2.get(c.credentialTypeId)?.name ?? "Unknown",
          derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
          daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
        })),
        nurses: activeNurses2,
        types: types2
      };
    }
    const [credentials, nurses2, types] = await Promise.all([
      listCredentials(),
      listNurses(),
      listCredentialTypes()
    ]);
    const activeNurses = nurses2.filter((n) => !n.archivedAt);
    const activeNurseIds = new Set(activeNurses.map((n) => n.id));
    const activeCreds = credentials.filter((c) => activeNurseIds.has(c.nurseId));
    const nurseById = new Map(nurses2.map((n) => [n.id, n]));
    const typeById = new Map(types.map((t2) => [t2.id, t2]));
    return {
      credentials: activeCreds.map((c) => ({
        ...c,
        nurse: nurseById.get(c.nurseId),
        typeName: typeById.get(c.credentialTypeId)?.name ?? "Unknown",
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
      })),
      nurses: activeNurses,
      types
    };
  }),
  list: adminProcedure.query(async () => {
    const rows = await listCredentials();
    const nurses2 = await listNurses();
    const nurseById = new Map(nurses2.map((n) => [n.id, n]));
    const types = await listCredentialTypes();
    const typeById = new Map(types.map((t2) => [t2.id, t2]));
    return rows.map((c) => {
      const nurse = nurseById.get(c.nurseId);
      const typeName = typeById.get(c.credentialTypeId)?.name ?? "Unknown";
      return {
        ...c,
        nurse,
        typeName,
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
      };
    });
  }),
  listForNurse: adminProcedure.input(z3.object({ nurseId: z3.number() })).query(async ({ input }) => {
    const rows = await listCredentials({ nurseId: input.nurseId });
    const types = await listCredentialTypes();
    const typeById = new Map(types.map((t2) => [t2.id, t2]));
    return rows.map((c) => ({
      ...c,
      typeName: typeById.get(c.credentialTypeId)?.name ?? "Unknown",
      derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
      daysRemaining: daysUntilExpiry(dateKey(c.expiryDate))
    }));
  }),
  create: adminProcedure.input(
    z3.object({
      nurseId: z3.number(),
      credentialTypeId: z3.number(),
      licenseNumber: z3.string().max(64).optional(),
      issuingOrganization: z3.string().max(128).optional(),
      issueDate: nullableDateInput2,
      expiryDate: z3.date(),
      renewalStatus: z3.enum(["Not Started", "Renewal In Progress", "Submitted", "Renewed"]).optional(),
      verificationStatus: z3.enum(["Unverified", "Pending Verification", "Verified"]).optional(),
      documentKey: z3.string().optional(),
      remarks: z3.string().max(2e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError3({ code: "NOT_FOUND", message: "Nurse not found" });
    const id = await createCredential({
      ...input,
      renewalStatus: input.renewalStatus ?? "Not Started",
      verificationStatus: input.verificationStatus ?? "Unverified",
      renewalCycleKey: renewalCycleKey(`new-${Date.now()}`)
    });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.nurseId,
      actionType: "license.created",
      entityType: "credential",
      entityId: id,
      summary: `License added for ${nurseFullName(nurse)} (expires ${dateKey(input.expiryDate)})`
    });
    return { id };
  }),
  update: adminProcedure.input(
    z3.object({
      id: z3.number(),
      licenseNumber: z3.string().max(64).optional(),
      issuingOrganization: z3.string().max(128).optional(),
      issueDate: nullableDateInput2,
      expiryDate: z3.date().optional(),
      renewalStatus: z3.enum(["Not Started", "Renewal In Progress", "Submitted", "Renewed"]).optional(),
      verificationStatus: z3.enum(["Unverified", "Pending Verification", "Verified"]).optional(),
      remarks: z3.string().max(2e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const cred = (await listCredentials()).find((c) => c.id === id);
    if (!cred) throw new TRPCError3({ code: "NOT_FOUND", message: "License not found" });
    const patch = {};
    if (rest.licenseNumber !== void 0) patch.licenseNumber = rest.licenseNumber;
    if (rest.issuingOrganization !== void 0) patch.issuingOrganization = rest.issuingOrganization;
    if (rest.issueDate !== void 0) patch.issueDate = rest.issueDate;
    if (rest.expiryDate !== void 0) {
      patch.expiryDate = rest.expiryDate;
      patch.renewalCycleKey = renewalCycleKey(`${id}-${rest.expiryDate.toISOString()}`);
    }
    if (rest.renewalStatus !== void 0) patch.renewalStatus = rest.renewalStatus;
    if (rest.verificationStatus !== void 0) patch.verificationStatus = rest.verificationStatus;
    if (rest.remarks !== void 0) patch.remarks = rest.remarks;
    await updateCredential(id, patch);
    const nurse = await getNurseById(cred.nurseId);
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: cred.nurseId,
      actionType: "license.updated",
      entityType: "credential",
      entityId: id,
      summary: nurse ? `License updated for ${nurseFullName(nurse)}` : `License #${id} updated`
    });
    return { success: true };
  }),
  uploadDocument: adminProcedure.input(
    z3.object({
      credentialId: z3.number(),
      fileBase64: z3.string(),
      fileName: z3.string().max(200),
      mimeType: z3.string(),
      confirmedFields: z3.object({
        licenseNumber: z3.string().trim().max(64).optional().nullable(),
        issueDate: z3.union([z3.string(), z3.date()]).optional().nullable(),
        expiryDate: z3.union([z3.string(), z3.date()]).optional().nullable()
      }).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const all = await listCredentials();
    const cred = all.find((c) => c.id === input.credentialId);
    if (!cred) throw new TRPCError3({ code: "NOT_FOUND", message: "License not found" });
    const mimeCheck = validateMime(input.mimeType, "document");
    if (!mimeCheck.ok) throw new TRPCError3({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError3({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const patch = {};
    const parseDateVal = (val) => {
      if (val === void 0) return void 0;
      if (val === null || val === "") return null;
      if (val instanceof Date) {
        if (isNaN(val.getTime())) throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid date." });
        return val;
      }
      const str2 = String(val).trim();
      const m = str2.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) {
        const y = parseInt(m[1], 10);
        const mon = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);
        if (y < 1950 || y > 2100 || mon < 1 || mon > 12) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid date range." });
        }
        const daysInMonth = new Date(Date.UTC(y, mon, 0)).getUTCDate();
        if (day < 1 || day > daysInMonth) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid calendar date." });
        }
        return /* @__PURE__ */ new Date(`${m[1]}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
      }
      const d = new Date(str2);
      if (isNaN(d.getTime())) throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid date." });
      return d;
    };
    let parsedIssue;
    let parsedExpiry;
    if (input.confirmedFields) {
      if (input.confirmedFields.licenseNumber !== void 0) {
        const normPrc = input.confirmedFields.licenseNumber ? input.confirmedFields.licenseNumber.trim() : null;
        if (normPrc) {
          const matchingNurseIds = await findNurseIdsByLicenseNumber(normPrc);
          if (matchingNurseIds.some((id) => id !== cred.nurseId)) {
            throw new TRPCError3({
              code: "CONFLICT",
              message: "Another nurse is already registered with this PRC License Number."
            });
          }
        }
        patch.licenseNumber = normPrc;
      }
      if (input.confirmedFields.issueDate !== void 0) {
        parsedIssue = parseDateVal(input.confirmedFields.issueDate);
        patch.issueDate = parsedIssue ?? null;
      }
      if (input.confirmedFields.expiryDate !== void 0) {
        parsedExpiry = parseDateVal(input.confirmedFields.expiryDate);
        if (parsedExpiry) {
          patch.expiryDate = parsedExpiry;
          const existingExpiryStr = cred.expiryDate ? cred.expiryDate instanceof Date ? cred.expiryDate.toISOString().slice(0, 10) : String(cred.expiryDate).slice(0, 10) : null;
          const newExpiryStr = parsedExpiry.toISOString().slice(0, 10);
          if (newExpiryStr !== existingExpiryStr) {
            patch.renewalCycleKey = renewalCycleKey(`${cred.id}-${parsedExpiry.toISOString()}`);
          }
        }
      }
      const effIssue = parsedIssue !== void 0 ? parsedIssue : cred.issueDate ? new Date(cred.issueDate) : null;
      const effExpiry = parsedExpiry !== void 0 ? parsedExpiry : cred.expiryDate ? new Date(cred.expiryDate) : null;
      if (effIssue && effExpiry && effIssue > effExpiry) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
      }
    }
    const credTypes = await listCredentialTypes(true);
    const credType = credTypes.find((t2) => t2.id === cred.credentialTypeId);
    const isPrc = credType ? credType.name.toLowerCase().includes("prc") : false;
    if (isPrc) {
      patch.verificationStatus = "Pending Verification";
    }
    const oldKey = cred.documentKey;
    const key = storageKey("license-documents", cred.nurseId, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    patch.documentKey = storedKey;
    await updateCredential(input.credentialId, patch);
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: cred.nurseId,
      actionType: "license.document.uploaded",
      entityType: "credential",
      entityId: input.credentialId,
      summary: `License document uploaded for license #${input.credentialId}${input.confirmedFields ? " with reviewed fields" : ""}`
    });
    return { url };
  }),
  markRenewed: adminProcedure.input(
    z3.object({
      credentialId: z3.number(),
      newIssueDate: z3.date(),
      newExpiryDate: z3.date(),
      newLicenseNumber: z3.string().max(64).optional(),
      newIssuingOrganization: z3.string().max(128).optional(),
      documentKey: z3.string().optional(),
      remarks: z3.string().max(2e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const cred = (await listCredentials()).find((c) => c.id === input.credentialId);
    if (!cred) throw new TRPCError3({ code: "NOT_FOUND", message: "License not found" });
    await updateCredential(input.credentialId, { renewalStatus: "Renewed" });
    await markReminderExpiredByCredential(input.credentialId);
    const nurse = await getNurseById(cred.nurseId);
    const newId = await createCredential({
      nurseId: cred.nurseId,
      credentialTypeId: cred.credentialTypeId,
      licenseNumber: input.newLicenseNumber ?? cred.licenseNumber ?? void 0,
      issuingOrganization: input.newIssuingOrganization ?? cred.issuingOrganization ?? void 0,
      issueDate: input.newIssueDate,
      expiryDate: input.newExpiryDate,
      renewalStatus: "Not Started",
      verificationStatus: cred.verificationStatus,
      documentKey: input.documentKey ?? void 0,
      renewalCycleKey: renewalCycleKey(`new-${Date.now()}`),
      remarks: input.remarks ?? void 0
    });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: cred.nurseId,
      actionType: "license.renewed",
      entityType: "credential",
      entityId: input.credentialId,
      summary: nurse ? `License renewed for ${nurseFullName(nurse)} \u2014 new cycle expiring ${dateKey(input.newExpiryDate)} (old record #${input.credentialId} preserved)` : `License renewed \u2014 new cycle #${newId}`
    });
    return { id: newId };
  })
});

// server/routers/trainings.ts
import { z as z4 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
init_db();
init_nursetrack();
init_trainingReminders();
var nullableDateInput3 = z4.union([z4.date(), z4.string().datetime(), z4.null()]).transform((d) => d === null ? null : d instanceof Date ? d : new Date(d)).optional();
var trainingsRouter = router({
  // Single round-trip initial load: catalog + records in one call (same enriched shape as listRecords).
  initial: adminProcedure.query(async () => {
    const [catalog, rows, nurses2] = await Promise.all([listTrainingCatalog(true), listNurseTrainings(), listNurses()]);
    const nurseById = new Map(nurses2.map((n) => [n.id, n]));
    const catById = new Map(catalog.map((t2) => [t2.id, t2]));
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const records = rows.map((r) => {
      const nurse = nurseById.get(r.nurseId);
      const item = catById.get(r.trainingId);
      let derivedStatus = r.status;
      if (r.status === "Scheduled" && r.scheduledDate && new Date(r.scheduledDate) < today) derivedStatus = "Scheduled";
      if (r.status === "Completed" && r.expiryDate && new Date(r.expiryDate) < today) derivedStatus = "Expired";
      return { ...r, nurse, trainingName: item?.name ?? "Unknown", trainingItem: item ?? null, derivedStatus };
    });
    return { catalog, records };
  }),
  listCatalog: adminProcedure.query(() => listTrainingCatalog(true)),
  createCatalogItem: adminProcedure.input(
    z4.object({
      name: z4.string().min(1).max(128),
      category: z4.string().max(64).optional(),
      kind: z4.enum(TRAINING_KINDS).optional(),
      renewalRequired: z4.boolean().optional(),
      defaultValidityMonths: z4.number().int().positive().max(600).optional()
    })
  ).mutation(async ({ input }) => {
    const id = await createTrainingType(input);
    return { id };
  }),
  updateCatalogItem: adminProcedure.input(
    z4.object({
      id: z4.number(),
      name: z4.string().min(1).max(128).optional(),
      category: z4.string().max(64).optional().nullable(),
      kind: z4.enum(TRAINING_KINDS).optional(),
      renewalRequired: z4.boolean().optional(),
      defaultValidityMonths: z4.number().int().positive().max(600).optional().nullable(),
      active: z4.boolean().optional()
    })
  ).mutation(async ({ input }) => {
    const { id, ...rest } = input;
    await updateTrainingType(id, {
      ...rest,
      category: rest.category ?? void 0,
      defaultValidityMonths: rest.defaultValidityMonths ?? void 0
    });
    return { success: true };
  }),
  deleteCatalogItem: adminProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteTrainingCatalogItem(input.id);
    if (!deleted) throw new TRPCError4({ code: "NOT_FOUND", message: "Training catalog item not found." });
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "training.catalog.deleted",
      entityType: "trainingCatalog",
      entityId: input.id,
      summary: `${deleted.catalog.kind} "${deleted.catalog.name}" permanently deleted, including ${deleted.eventsDeleted} seminar event(s) and ${deleted.attendanceDeleted} attendance record(s)`
    });
    return {
      success: true,
      eventsDeleted: deleted.eventsDeleted,
      attendanceDeleted: deleted.attendanceDeleted
    };
  }),
  listRecords: adminProcedure.query(async () => {
    const rows = await listNurseTrainings();
    const nurses2 = await listNurses();
    const nurseById = new Map(nurses2.map((n) => [n.id, n]));
    const catalog = await listTrainingCatalog(true);
    const catById = new Map(catalog.map((t2) => [t2.id, t2]));
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return rows.map((r) => {
      const nurse = nurseById.get(r.nurseId);
      const item = catById.get(r.trainingId);
      let derivedStatus = r.status;
      if (r.status === "Scheduled" && r.scheduledDate && new Date(r.scheduledDate) < today) derivedStatus = "Scheduled";
      if (r.status === "Completed" && r.expiryDate && new Date(r.expiryDate) < today) derivedStatus = "Expired";
      return { ...r, nurse, trainingName: item?.name ?? "Unknown", trainingItem: item ?? null, derivedStatus };
    });
  }),
  listForNurse: adminProcedure.input(z4.object({ nurseId: z4.number() })).query(async ({ input }) => {
    const rows = await listNurseTrainings({ nurseId: input.nurseId });
    const catalog = await listTrainingCatalog(true);
    const catById = new Map(catalog.map((t2) => [t2.id, t2]));
    return rows.map((r) => ({ ...r, trainingName: catById.get(r.trainingId)?.name ?? "Unknown" }));
  }),
  checkConflict: adminProcedure.input(
    z4.object({
      nurseId: z4.number(),
      startDate: z4.string(),
      endDate: z4.string().optional().nullable(),
      startTime: z4.string().optional().nullable(),
      endTime: z4.string().optional().nullable(),
      excludeAssignmentId: z4.number().optional().nullable()
    })
  ).query(async ({ input }) => {
    return checkTrainingConflicts(
      input.nurseId,
      input.startDate,
      input.endDate,
      input.startTime,
      input.endTime,
      input.excludeAssignmentId
    );
  }),
  createRecord: adminProcedure.input(
    z4.object({
      nurseId: z4.number(),
      trainingId: z4.number(),
      eventId: z4.number().optional(),
      participationRole: z4.enum(PARTICIPATION_ROLES).optional(),
      provider: z4.string().max(128).optional(),
      status: z4.enum(["Scheduled", "Completed", "Expired", "Cancelled"]).optional(),
      scheduledDate: nullableDateInput3,
      completionDate: nullableDateInput3,
      expiryDate: nullableDateInput3,
      trainingHours: z4.number().int().positive().optional(),
      cpdUnits: z4.number().int().positive().optional(),
      certificateNumber: z4.string().max(64).optional(),
      certificateKey: z4.string().optional(),
      remarks: z4.string().max(2e3).optional(),
      conflictOverrideReason: z4.string().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError4({ code: "NOT_FOUND", message: "Nurse not found" });
    const status = input.status ?? "Scheduled";
    const scheduledDateStr = input.scheduledDate ? input.scheduledDate.toISOString().slice(0, 10) : null;
    if (status === "Scheduled" && scheduledDateStr) {
      const conflictRes = await checkTrainingConflicts(input.nurseId, scheduledDateStr);
      if (conflictRes.hasConflict && !conflictRes.warningOnly) {
        if (!input.conflictOverrideReason || input.conflictOverrideReason.trim().length === 0) {
          throw new TRPCError4({
            code: "CONFLICT",
            message: `Scheduling conflict detected with: ${conflictRes.conflicts.map((c) => c.trainingName).join(", ")}. Override reason is required to proceed.`
          });
        }
      }
    }
    const id = await createNurseTraining({
      ...input,
      status,
      scheduleVersion: 1,
      staffResponse: "Pending",
      evidenceRequired: true,
      conflictOverrideReason: input.conflictOverrideReason ?? null,
      conflictOverrideBy: input.conflictOverrideReason ? ctx.user.id : null
    });
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: input.nurseId,
      actionType: "training.created",
      entityType: "nurseTraining",
      entityId: id,
      summary: `Training record added for ${nurseFullName(nurse)}`
    });
    if (status === "Scheduled" && scheduledDateStr) {
      try {
        const noticeItem = await enqueueTrainingNotice({
          assignmentId: id,
          scheduleVersion: 1,
          noticeKind: "assigned",
          recipientNurseId: input.nurseId,
          actorUserId: ctx.user.id
        });
        await createMilestonesForAssignment({
          assignmentId: id,
          scheduleVersion: 1,
          startDateStr: scheduledDateStr,
          recipientNurseId: input.nurseId
        });
        if (noticeItem?.id) {
          await dispatchSingleOutboxItem(noticeItem.id).catch(() => {
          });
        }
      } catch (noticeErr) {
        console.warn("[Trainings] Failed to enqueue training notice:", noticeErr);
      }
    }
    return { id };
  }),
  updateRecord: adminProcedure.input(
    z4.object({
      id: z4.number(),
      status: z4.enum(["Scheduled", "Completed", "Expired", "Cancelled"]).optional(),
      participationRole: z4.enum(PARTICIPATION_ROLES).optional(),
      scheduledDate: nullableDateInput3,
      completionDate: nullableDateInput3,
      expiryDate: nullableDateInput3,
      provider: z4.string().max(128).optional(),
      trainingHours: z4.number().int().positive().nullable().optional(),
      cpdUnits: z4.number().int().positive().nullable().optional(),
      certificateNumber: z4.string().max(64).optional(),
      remarks: z4.string().max(2e3).optional(),
      conflictOverrideReason: z4.string().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const rows = await listNurseTrainings();
    const record = rows.find((r) => r.id === id);
    if (!record) throw new TRPCError4({ code: "NOT_FOUND", message: "Training record not found" });
    const oldDateStr = record.scheduledDate ? new Date(record.scheduledDate).toISOString().slice(0, 10) : null;
    const newDateStr = rest.scheduledDate ? rest.scheduledDate.toISOString().slice(0, 10) : oldDateStr;
    const isReschedule = Boolean(oldDateStr && newDateStr && oldDateStr !== newDateStr);
    const isCancellation = Boolean(rest.status === "Cancelled" && record.status !== "Cancelled");
    let newScheduleVersion = record.scheduleVersion ?? 1;
    const updatePayload = { ...rest };
    if (isReschedule) {
      newScheduleVersion += 1;
      updatePayload.scheduleVersion = newScheduleVersion;
      updatePayload.staffResponse = "Pending";
      updatePayload.staffResponseReason = null;
      updatePayload.staffRespondedAt = null;
      updatePayload.staffResponseVersion = null;
    }
    if (rest.conflictOverrideReason) {
      updatePayload.conflictOverrideReason = rest.conflictOverrideReason;
      updatePayload.conflictOverrideBy = ctx.user.id;
    }
    await updateNurseTraining(id, updatePayload);
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "training.updated",
      entityType: "nurseTraining",
      entityId: id,
      summary: `Training record #${id} updated${isReschedule ? " (rescheduled)" : isCancellation ? " (cancelled)" : ""}`
    });
    if (isReschedule && newDateStr) {
      try {
        await invalidatePendingOutboxJobs(id, newScheduleVersion);
        const notice = await enqueueTrainingNotice({
          assignmentId: id,
          scheduleVersion: newScheduleVersion,
          noticeKind: "rescheduled",
          recipientNurseId: record.nurseId,
          actorUserId: ctx.user.id
        });
        await createMilestonesForAssignment({
          assignmentId: id,
          scheduleVersion: newScheduleVersion,
          startDateStr: newDateStr,
          recipientNurseId: record.nurseId
        });
        if (notice?.id) {
          await dispatchSingleOutboxItem(notice.id).catch(() => {
          });
        }
      } catch (err) {
        console.warn("[Trainings] Reschedule outbox notice failed:", err);
      }
    } else if (isCancellation) {
      try {
        await invalidatePendingOutboxJobs(id);
        const cancelNotice = await enqueueTrainingNotice({
          assignmentId: id,
          scheduleVersion: record.scheduleVersion ?? 1,
          noticeKind: "cancelled",
          recipientNurseId: record.nurseId,
          actorUserId: ctx.user.id
        });
        if (cancelNotice?.id) {
          await dispatchSingleOutboxItem(cancelNotice.id).catch(() => {
          });
        }
      } catch (err) {
        console.warn("[Trainings] Cancellation outbox notice failed:", err);
      }
    }
    return { success: true };
  }),
  recordAttendance: adminProcedure.input(
    z4.object({
      assignmentId: z4.number().int().positive(),
      attendanceOutcome: z4.enum(["not_recorded", "attended", "missed", "excused"]),
      attendanceNote: z4.string().max(1e3).optional(),
      autoComplete: z4.boolean().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const rows = await listNurseTrainings();
    const record = rows.find((r) => r.id === input.assignmentId);
    if (!record) throw new TRPCError4({ code: "NOT_FOUND", message: "Training record not found" });
    const updateData = {
      attendanceOutcome: input.attendanceOutcome,
      attendanceRecordedAt: /* @__PURE__ */ new Date(),
      attendanceRecordedBy: ctx.user.id,
      attendanceNote: input.attendanceNote ?? null
    };
    if (input.autoComplete && input.attendanceOutcome === "attended") {
      updateData.status = "Completed";
      if (!record.completionDate) {
        updateData.completionDate = record.scheduledDate ?? /* @__PURE__ */ new Date();
      }
    }
    await updateNurseTraining(input.assignmentId, updateData);
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "training.attendance.recorded",
      entityType: "nurseTraining",
      entityId: input.assignmentId,
      summary: `Attendance recorded as ${input.attendanceOutcome} for training record #${input.assignmentId}`
    });
    return { ok: true };
  }),
  reviewEvidence: adminProcedure.input(
    z4.object({
      assignmentId: z4.number().int().positive(),
      decision: z4.enum(["verified", "rejected"]),
      note: z4.string().max(1e3).optional(),
      autoComplete: z4.boolean().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const rows = await listNurseTrainings();
    const record = rows.find((r) => r.id === input.assignmentId);
    if (!record) throw new TRPCError4({ code: "NOT_FOUND", message: "Training record not found" });
    if (input.decision === "rejected" && (!input.note || input.note.trim().length === 0)) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "A reason is required when rejecting evidence." });
    }
    const updateData = {
      evidenceStatus: input.decision === "verified" ? "Verified" : "Rejected",
      evidenceReviewedAt: /* @__PURE__ */ new Date(),
      evidenceReviewedBy: ctx.user.id,
      evidenceReviewNote: input.note ?? null
    };
    if (input.decision === "verified" && input.autoComplete) {
      updateData.status = "Completed";
      if (!record.completionDate) {
        updateData.completionDate = record.scheduledDate ?? /* @__PURE__ */ new Date();
      }
    }
    await updateNurseTraining(input.assignmentId, updateData);
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "training.evidence.reviewed",
      entityType: "nurseTraining",
      entityId: input.assignmentId,
      summary: `Training evidence ${input.decision} for training record #${input.assignmentId}`
    });
    return { ok: true };
  }),
  followUpList: adminProcedure.input(
    z4.object({
      trainingId: z4.number().optional(),
      filter: z4.enum([
        "all",
        "pending_response",
        "cannot_attend",
        "missing_email",
        "delivery_failed",
        "evidence_review",
        "missed"
      ]).optional()
    }).optional()
  ).query(async ({ input }) => {
    const [rows, allNurses, catalog] = await Promise.all([
      listNurseTrainings(),
      listNurses(),
      listTrainingCatalog(true)
    ]);
    const nurseById = new Map(allNurses.map((n) => [n.id, n]));
    const catById = new Map(catalog.map((c) => [c.id, c]));
    let assignments = rows.filter((r) => r.status !== "Cancelled");
    if (input?.trainingId) {
      assignments = assignments.filter((r) => r.trainingId === input.trainingId);
    }
    const items = [];
    for (const a of assignments) {
      const nurse = nurseById.get(a.nurseId);
      if (!nurse) continue;
      const resolved = await resolveTrainingSchedule(a.id);
      if (!resolved) continue;
      const trainingName = catById.get(a.trainingId)?.name || resolved.trainingName;
      const hasEmail = Boolean(nurse.accountEmail);
      const item = {
        assignmentId: a.id,
        nurseId: a.nurseId,
        nurseName: nurseFullName(nurse),
        employeeId: nurse.employeeId,
        accountEmail: nurse.accountEmail,
        hasEmail,
        trainingId: a.trainingId,
        trainingName,
        startDateStr: resolved.startDateStr,
        endDateStr: resolved.endDateStr,
        startTime: resolved.startTime,
        venue: resolved.venue,
        status: a.status,
        scheduleVersion: a.scheduleVersion ?? 1,
        staffResponse: a.staffResponse || "Pending",
        staffResponseReason: a.staffResponseReason,
        attendanceOutcome: a.attendanceOutcome || "not_recorded",
        evidenceRequired: Boolean(a.evidenceRequired),
        evidenceStatus: a.evidenceStatus || "None",
        certificateKey: a.certificateKey
      };
      const filter = input?.filter || "all";
      if (filter === "pending_response" && item.staffResponse !== "Pending") continue;
      if (filter === "cannot_attend" && item.staffResponse !== "Cannot attend") continue;
      if (filter === "missing_email" && item.hasEmail) continue;
      if (filter === "evidence_review" && item.evidenceStatus !== "Submitted") continue;
      if (filter === "missed" && item.attendanceOutcome !== "missed") continue;
      items.push(item);
    }
    const counts = {
      total: assignments.length,
      pendingResponse: assignments.filter((a) => (a.staffResponse || "Pending") === "Pending").length,
      cannotAttend: assignments.filter((a) => a.staffResponse === "Cannot attend").length,
      missingEmail: assignments.filter((a) => !nurseById.get(a.nurseId)?.accountEmail).length,
      evidenceReview: assignments.filter((a) => a.evidenceStatus === "Submitted").length,
      missed: assignments.filter((a) => a.attendanceOutcome === "missed").length
    };
    return { items, counts };
  }),
  deleteRecord: adminProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const record = await deleteNurseTraining(input.id);
    if (!record) throw new TRPCError4({ code: "NOT_FOUND", message: "Training record not found." });
    if (record.certificateKey) {
      await storageDelete(record.certificateKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "training.deleted",
      entityType: "nurseTraining",
      entityId: input.id,
      summary: `Training record #${input.id} permanently deleted`
    });
    return { success: true };
  }),
  uploadCertificate: adminProcedure.input(
    z4.object({
      recordId: z4.number(),
      fileBase64: z4.string(),
      fileName: z4.string().max(200),
      mimeType: z4.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const rows = await listNurseTrainings();
    const record = rows.find((r) => r.id === input.recordId);
    if (!record) throw new TRPCError4({ code: "NOT_FOUND", message: "Training record not found" });
    const mimeCheck = validateMime(input.mimeType, "document");
    if (!mimeCheck.ok) throw new TRPCError4({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError4({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const oldKey = record.certificateKey;
    const key = storageKey("certificates", record.nurseId, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    await updateNurseTraining(input.recordId, { certificateKey: storedKey });
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "training.certificate.uploaded",
      entityType: "nurseTraining",
      entityId: input.recordId,
      summary: `Certificate uploaded for training record #${input.recordId}`
    });
    return { url };
  }),
  getAreaRequirements: adminProcedure.input(z4.object({ areaId: z4.number() })).query(async ({ input }) => {
    return await getAreaTrainingRequirementIds(input.areaId);
  }),
  setAreaRequirement: adminProcedure.input(z4.object({ areaId: z4.number(), trainingId: z4.number(), required: z4.boolean() })).mutation(async ({ input }) => {
    await setAreaTrainingRequirement(input.areaId, input.trainingId, input.required);
    return { success: true };
  }),
  getCompliance: adminProcedure.input(z4.object({ nurseId: z4.number() })).query(async ({ input }) => {
    const nurse = await getNurseById(input.nurseId);
    if (!nurse) throw new TRPCError4({ code: "NOT_FOUND", message: "Nurse not found" });
    if (!nurse.currentAreaId) return { compliancePercent: 100, requiredCount: 0, completedCount: 0 };
    const requiredIds = await getAreaTrainingRequirementIds(nurse.currentAreaId);
    const records = await listNurseTrainings({ nurseId: input.nurseId });
    const compliance = trainingCompliance({
      requiredTrainingIds: requiredIds,
      nurseTrainingRecords: records.map((r) => ({
        trainingId: r.trainingId,
        status: r.status,
        expiryDate: r.expiryDate,
        completionDate: r.completionDate
      }))
    });
    const completedValid = requiredIds.filter((tid) => {
      const recs = records.filter((r) => r.trainingId === tid && r.status === "Completed");
      return recs.some((r) => !r.expiryDate || new Date(r.expiryDate) > /* @__PURE__ */ new Date());
    }).length;
    return { compliancePercent: compliance, requiredCount: requiredIds.length, completedCount: completedValid };
  })
});

// server/routers/calendar.ts
import { z as z5 } from "zod";
init_db();
init_nursetrack();
function dateIso(d) {
  return dateKey(d);
}
var nullableDateInput4 = z5.union([z5.date(), z5.string().datetime(), z5.null()]).transform((d) => d === null ? null : d instanceof Date ? d : new Date(d)).optional();
var calendarRouter = router({
  listEvents: adminProcedure.input(
    z5.object({
      from: z5.date().optional(),
      to: z5.date().optional(),
      includeTypes: z5.array(z5.enum(["license", "training", "areaChange", "custom"])).optional()
    })
  ).query(async ({ input }) => {
    const from = input.from ?? /* @__PURE__ */ new Date("2020-01-01");
    const to = input.to ?? new Date(Date.now() + 365 * 864e5);
    const fromStr = dateKey(from) || "2020-01-01";
    const toStr = dateKey(to) || "2099-12-31";
    const inRange = (d) => Boolean(d && d >= fromStr && d <= toStr);
    const includeTypes = new Set(input.includeTypes ?? ["license", "training", "areaChange", "custom"]);
    const today = todayDate();
    const events = [];
    const pg = getBatchClient();
    if (pg) {
      const queries = [
        `select id, "firstName", "lastName", "currentAreaId", "archivedAt" from nursetrack.nurses where "archivedAt" is null`,
        `select id, name from nursetrack.areas`,
        includeTypes.has("license") ? `select id, "nurseId", "expiryDate"::text as "expiryDate" from nursetrack."nurseCredentials"` : `select 1 where false`,
        includeTypes.has("training") ? `select id, name from nursetrack."trainingCatalog"` : `select 1 where false`,
        includeTypes.has("training") ? `select id, "nurseId", "trainingId", status, "scheduledDate"::text as "scheduledDate", "completionDate"::text as "completionDate", "expiryDate"::text as "expiryDate" from nursetrack."nurseTrainings" where status != 'Cancelled'` : `select 1 where false`,
        includeTypes.has("areaChange") ? `select a.id, a."nurseId", a."startDate"::text as "startDate", a."assignmentType", a."areaId", a."isCurrent"
                 from nursetrack."areaAssignments" a
                 join nursetrack.nurses n on n.id = a."nurseId"
                where n."archivedAt" is null and a."endDate" is null` : `select 1 where false`,
        includeTypes.has("custom") ? `select id, title, "eventDate"::text as "eventDate", "startTime", "endTime", "allDay", "nurseId", "areaId", description
                 from nursetrack."customCalendarEvents"
                where "eventDate" >= '${fromStr}' and "eventDate" <= '${toStr}'` : `select 1 where false`
      ];
      const sets = await pg.unsafe(queries.join(";\n")).simple();
      const [nurseRows, areaRows2, creds, catalogRows2, trainings, assignments, customs] = sets;
      const nurseById2 = new Map(nurseRows.map((n) => [n.id, n]));
      const areaById2 = new Map(areaRows2.map((a) => [a.id, a]));
      const catalogById2 = new Map(catalogRows2.map((c) => [c.id, c]));
      if (includeTypes.has("license")) {
        for (const c of creds) {
          const nurse = nurseById2.get(c.nurseId);
          if (!nurse || nurse.archivedAt) continue;
          const expiryStr = dateIso(c.expiryDate);
          const days = daysUntilExpiry(expiryStr, today);
          if (days < 0) {
            if (inRange(expiryStr)) {
              events.push({
                id: `lic-${c.id}`,
                type: "license",
                subtype: "expired",
                title: `License expired \u2014 ${nurse.firstName} ${nurse.lastName}`,
                date: expiryStr,
                allDay: true,
                severity: "urgent_or_expired",
                nurseId: nurse.id,
                nurseName: `${nurse.firstName} ${nurse.lastName}`,
                areaId: nurse.currentAreaId ?? void 0,
                areaName: nurse.currentAreaId ? areaById2.get(nurse.currentAreaId)?.name : null,
                relatedEntityType: "credential",
                relatedEntityId: c.id
              });
            }
          } else {
            for (const threshold of [365, 180]) {
              if (days <= threshold) {
                const label = threshold === 365 ? "1-year renewal" : "6-month renewal";
                if (inRange(expiryStr)) {
                  events.push({
                    id: `lic-${threshold}-${c.id}`,
                    type: "license",
                    subtype: threshold === 365 ? "reminder1y" : "reminder6m",
                    title: `${label} reminder \u2014 ${nurse.firstName} ${nurse.lastName}`,
                    date: expiryStr,
                    allDay: true,
                    severity: threshold === 365 ? "attention" : "upcoming_renewal",
                    nurseId: nurse.id,
                    nurseName: `${nurse.firstName} ${nurse.lastName}`,
                    areaId: nurse.currentAreaId ?? void 0,
                    areaName: nurse.currentAreaId ? areaById2.get(nurse.currentAreaId)?.name : null,
                    relatedEntityType: "credential",
                    relatedEntityId: c.id
                  });
                }
              }
            }
          }
        }
      }
      if (includeTypes.has("training")) {
        for (const r of trainings) {
          const nurse = nurseById2.get(r.nurseId);
          if (!nurse || nurse.archivedAt) continue;
          if (r.status === "Cancelled") continue;
          const trnDate = r.scheduledDate ? dateIso(r.scheduledDate) : r.completionDate ? dateIso(r.completionDate) : null;
          const cat = catalogById2.get(r.trainingId);
          const catName = cat?.name ? cat.name.length > 40 ? cat.name.slice(0, 37) + "..." : cat.name : "Training";
          if (trnDate && inRange(trnDate)) {
            events.push({
              id: `trn-${r.id}`,
              type: "training",
              subtype: "schedule",
              title: `${catName} \u2014 ${nurse.firstName} ${nurse.lastName}`,
              date: trnDate,
              allDay: true,
              severity: r.status === "Scheduled" ? "informational" : r.status === "Completed" ? "healthy" : "attention",
              nurseId: nurse.id,
              nurseName: `${nurse.firstName} ${nurse.lastName}`,
              areaId: nurse.currentAreaId ?? void 0,
              areaName: nurse.currentAreaId ? areaById2.get(nurse.currentAreaId)?.name : null,
              relatedEntityType: "nurseTraining",
              relatedEntityId: r.id
            });
          }
          if (r.status === "Completed" && r.expiryDate && inRange(dateIso(r.expiryDate))) {
            const days = daysUntilExpiry(dateIso(r.expiryDate), today);
            events.push({
              id: `trne-${r.id}`,
              type: "training",
              subtype: "expiry",
              title: `${catName} expires \u2014 ${nurse.firstName} ${nurse.lastName}${days <= 0 ? " (expired)" : ""}`,
              date: dateIso(r.expiryDate),
              allDay: true,
              severity: days <= 0 ? "urgent_or_expired" : days <= 180 ? "upcoming_renewal" : "attention",
              nurseId: nurse.id,
              nurseName: `${nurse.firstName} ${nurse.lastName}`,
              areaId: nurse.currentAreaId ?? void 0,
              areaName: nurse.currentAreaId ? areaById2.get(nurse.currentAreaId)?.name : null,
              relatedEntityType: "nurseTraining",
              relatedEntityId: r.id
            });
          }
        }
      }
      if (includeTypes.has("areaChange")) {
        for (const a of assignments) {
          const n = nurseById2.get(a.nurseId);
          if (!n || n.archivedAt) continue;
          const startStr = dateKey(a.startDate);
          if (inRange(startStr)) {
            const newArea = areaById2.get(a.areaId);
            const isFuture = startStr > today;
            events.push({
              id: `asgn-${a.id}`,
              type: "areaChange",
              subtype: isFuture ? "transfer-upcoming" : "transfer",
              title: `${a.isCurrent ? "Current area" : "Area change"} \u2014 ${n.firstName} ${n.lastName}${newArea ? ` \u2192 ${newArea.name}` : ""}`,
              date: startStr,
              allDay: true,
              severity: isFuture ? "informational" : "neutral",
              nurseId: n.id,
              nurseName: `${n.firstName} ${n.lastName}`,
              areaId: a.areaId,
              areaName: newArea?.name ?? null,
              relatedEntityType: "areaAssignment",
              relatedEntityId: a.id,
              description: a.assignmentType ?? void 0
            });
          }
        }
      }
      if (includeTypes.has("custom")) {
        for (const c of customs) {
          const nurse = c.nurseId ? nurseById2.get(c.nurseId) : void 0;
          events.push({
            id: `cce-${c.id}`,
            type: "custom",
            subtype: "custom",
            title: c.title,
            date: dateKey(c.eventDate),
            startTime: c.startTime,
            endTime: c.endTime,
            allDay: Boolean(c.allDay),
            severity: "informational",
            nurseId: c.nurseId ?? void 0,
            nurseName: nurse ? `${nurse.firstName} ${nurse.lastName}` : null,
            areaId: c.areaId ?? void 0,
            areaName: c.areaId ? areaById2.get(c.areaId)?.name ?? null : null,
            description: c.description ?? void 0,
            relatedEntityType: "customCalendarEvent",
            relatedEntityId: c.id
          });
        }
      }
      events.sort((a, b) => a.date.localeCompare(b.date));
      return events;
    }
    const nurses2 = await listNurses({ archived: false });
    const nurseById = new Map(nurses2.map((n) => [n.id, n]));
    const areaRows = await listAreas();
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    if (includeTypes.has("license")) {
      const creds = await listCredentials();
      for (const c of creds) {
        const nurse = nurseById.get(c.nurseId);
        if (!nurse || nurse.archivedAt) continue;
        const expiryStr = dateIso(c.expiryDate);
        const days = daysUntilExpiry(expiryStr, today);
        if (days < 0) {
          if (inRange(expiryStr)) {
            events.push({
              id: `lic-${c.id}`,
              type: "license",
              subtype: "expired",
              title: `License expired \u2014 ${nurse.firstName} ${nurse.lastName}`,
              date: expiryStr,
              allDay: true,
              severity: "urgent_or_expired",
              nurseId: nurse.id,
              nurseName: `${nurse.firstName} ${nurse.lastName}`,
              areaId: nurse.currentAreaId ?? void 0,
              areaName: nurse.currentAreaId ? areaById.get(nurse.currentAreaId)?.name : null,
              relatedEntityType: "credential",
              relatedEntityId: c.id
            });
          }
        } else {
          for (const threshold of [365, 180]) {
            if (days <= threshold) {
              const label = threshold === 365 ? "1-year renewal" : "6-month renewal";
              if (inRange(expiryStr)) {
                events.push({
                  id: `lic-${threshold}-${c.id}`,
                  type: "license",
                  subtype: threshold === 365 ? "reminder1y" : "reminder6m",
                  title: `${label} reminder \u2014 ${nurse.firstName} ${nurse.lastName}`,
                  date: expiryStr,
                  allDay: true,
                  severity: threshold === 365 ? "attention" : "upcoming_renewal",
                  nurseId: nurse.id,
                  nurseName: `${nurse.firstName} ${nurse.lastName}`,
                  areaId: nurse.currentAreaId ?? void 0,
                  areaName: nurse.currentAreaId ? areaById.get(nurse.currentAreaId)?.name : null,
                  relatedEntityType: "credential",
                  relatedEntityId: c.id
                });
              }
            }
          }
        }
      }
    }
    const catalogRows = await listTrainingCatalog();
    const catalogById = new Map(catalogRows.map((c) => [c.id, c]));
    if (includeTypes.has("training")) {
      const records = await listNurseTrainings();
      for (const r of records) {
        const nurse = nurseById.get(r.nurseId);
        if (!nurse || nurse.archivedAt) continue;
        if (r.status === "Cancelled") continue;
        const trnDate = r.scheduledDate ? dateIso(r.scheduledDate) : r.completionDate ? dateIso(r.completionDate) : null;
        const cat = catalogById.get(r.trainingId);
        const catName = cat?.name ? cat.name.length > 40 ? cat.name.slice(0, 37) + "..." : cat.name : "Training";
        if (trnDate && inRange(trnDate)) {
          events.push({
            id: `trn-${r.id}`,
            type: "training",
            subtype: "schedule",
            title: `${catName} \u2014 ${nurse.firstName} ${nurse.lastName}`,
            date: trnDate,
            allDay: true,
            severity: r.status === "Scheduled" ? "informational" : r.status === "Completed" ? "healthy" : "attention",
            nurseId: nurse.id,
            nurseName: `${nurse.firstName} ${nurse.lastName}`,
            areaId: nurse.currentAreaId ?? void 0,
            areaName: nurse.currentAreaId ? areaById.get(nurse.currentAreaId)?.name : null,
            relatedEntityType: "nurseTraining",
            relatedEntityId: r.id
          });
        }
        if (r.status === "Completed" && r.expiryDate && inRange(dateIso(r.expiryDate))) {
          const days = daysUntilExpiry(dateIso(r.expiryDate), today);
          events.push({
            id: `trne-${r.id}`,
            type: "training",
            subtype: "expiry",
            title: `${catName} expires \u2014 ${nurse.firstName} ${nurse.lastName}${days <= 0 ? " (expired)" : ""}`,
            date: dateIso(r.expiryDate),
            allDay: true,
            severity: days <= 0 ? "urgent_or_expired" : days <= 180 ? "upcoming_renewal" : "attention",
            nurseId: nurse.id,
            nurseName: `${nurse.firstName} ${nurse.lastName}`,
            areaId: nurse.currentAreaId ?? void 0,
            areaName: nurse.currentAreaId ? areaById.get(nurse.currentAreaId)?.name : null,
            relatedEntityType: "nurseTraining",
            relatedEntityId: r.id
          });
        }
      }
    }
    if (includeTypes.has("areaChange")) {
      const assignments = await listAllActiveAssignments();
      for (const a of assignments) {
        const n = nurseById.get(a.nurseId);
        if (!n || n.archivedAt) continue;
        const startStr = dateKey(a.startDate);
        if (inRange(startStr)) {
          const newArea = areaById.get(a.areaId);
          const isFuture = startStr > today;
          events.push({
            id: `asgn-${a.id}`,
            type: "areaChange",
            subtype: isFuture ? "transfer-upcoming" : "transfer",
            title: `${a.isCurrent ? "Current area" : "Area change"} \u2014 ${n.firstName} ${n.lastName}${newArea ? ` \u2192 ${newArea.name}` : ""}`,
            date: startStr,
            allDay: true,
            severity: isFuture ? "informational" : "neutral",
            nurseId: n.id,
            nurseName: `${n.firstName} ${n.lastName}`,
            areaId: a.areaId,
            areaName: newArea?.name ?? null,
            relatedEntityType: "areaAssignment",
            relatedEntityId: a.id,
            description: a.assignmentType ?? void 0
          });
        }
      }
    }
    if (includeTypes.has("custom")) {
      const customs = await listCustomEvents({ from, to });
      for (const c of customs) {
        const nurse = c.nurseId ? nurseById.get(c.nurseId) : void 0;
        events.push({
          id: `cce-${c.id}`,
          type: "custom",
          subtype: "custom",
          title: c.title,
          date: dateKey(c.eventDate),
          startTime: c.startTime,
          endTime: c.endTime,
          allDay: c.allDay,
          severity: "informational",
          nurseId: c.nurseId ?? void 0,
          nurseName: nurse ? `${nurse.firstName} ${nurse.lastName}` : null,
          areaId: c.areaId ?? void 0,
          areaName: c.areaId ? areaById.get(c.areaId)?.name ?? null : null,
          description: c.description ?? void 0,
          relatedEntityType: "customCalendarEvent",
          relatedEntityId: c.id
        });
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }),
  createCustomEvent: adminProcedure.input(
    z5.object({
      title: z5.string().min(1).max(256),
      eventDate: z5.date(),
      startTime: z5.string().max(8).optional(),
      endTime: z5.string().max(8).optional(),
      allDay: z5.boolean().optional(),
      nurseId: z5.number().optional(),
      areaId: z5.number().optional(),
      description: z5.string().max(5e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const id = await createCustomEvent({
      ...input,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      allDay: input.allDay ?? true,
      nurseId: input.nurseId ?? null,
      areaId: input.areaId ?? null
    });
    return { id };
  }),
  updateCustomEvent: adminProcedure.input(
    z5.object({
      id: z5.number(),
      title: z5.string().min(1).max(256).optional(),
      eventDate: z5.date().optional(),
      startTime: z5.string().max(8).optional(),
      endTime: z5.string().max(8).optional(),
      allDay: z5.boolean().optional(),
      nurseId: z5.number().optional(),
      areaId: z5.number().optional(),
      description: z5.string().max(5e3).optional()
    })
  ).mutation(async ({ input }) => {
    const { id, ...rest } = input;
    await updateCustomEvent(id, { ...rest });
    return { success: true };
  }),
  deleteCustomEvent: adminProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
    await deleteCustomEvent(input.id);
    return { success: true };
  })
});

// server/routers/notifications.ts
import { z as z6 } from "zod";
init_db();
var notificationsRouter = router({
  list: adminProcedure.query(() => listNotifications(100)),
  unreadCount: adminProcedure.query(() => countUnreadNotifications()),
  markRead: adminProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    await markNotificationRead(input.id);
    return { success: true };
  }),
  markAllRead: adminProcedure.mutation(async () => {
    await markAllNotificationsRead();
    return { success: true };
  })
});

// server/routers/dashboard.ts
import { asc as asc2, and as and3, desc as desc3, eq as eq3, isNull as isNull3, sql as sql4 } from "drizzle-orm";
import { z as z7 } from "zod";
init_db();
init_schema();
init_nursetrack();

// server/sqliteHelpers.ts
init_localDb();

// server/reportBuilders.ts
init_nursetrack();
function daysBetween2(start, end, today) {
  const s = (/* @__PURE__ */ new Date(`${start}T00:00:00`)).getTime();
  const e = (/* @__PURE__ */ new Date(`${end ?? today}T00:00:00`)).getTime();
  return e >= s ? Math.floor((e - s) / 864e5) : 0;
}
function buildTrainingCompliance(input) {
  const requiredByArea = /* @__PURE__ */ new Map();
  for (const r of input.requirements) {
    if (!requiredByArea.has(r.areaId)) requiredByArea.set(r.areaId, /* @__PURE__ */ new Set());
    requiredByArea.get(r.areaId).add(r.trainingId);
  }
  const staffByArea = /* @__PURE__ */ new Map();
  for (const n of input.nurses) {
    if (n.currentAreaId == null) continue;
    if (!staffByArea.has(n.currentAreaId)) staffByArea.set(n.currentAreaId, []);
    staffByArea.get(n.currentAreaId).push(n.id);
  }
  const current = /* @__PURE__ */ new Set();
  for (const r of input.completedRecords) {
    const exp = r.expiryDate ? dateKey(r.expiryDate) : "";
    if (!exp || exp > input.today) current.add(`${r.nurseId}:${r.trainingId}`);
  }
  return input.areas.map((area) => {
    const required = Array.from(requiredByArea.get(area.id) ?? []);
    const staff = staffByArea.get(area.id) ?? [];
    let compliant = 0;
    for (const nurseId of staff) {
      for (const trainingId of required) {
        if (current.has(`${nurseId}:${trainingId}`)) compliant++;
      }
    }
    const total = staff.length * required.length;
    return {
      areaName: area.name,
      requiredTrainings: required.length,
      staffCount: staff.length,
      requiredChecks: total,
      compliantChecks: compliant,
      compliancePercent: total > 0 ? Math.round(compliant / total * 100) : 100
    };
  });
}
function buildAreaExposure(rows, today) {
  const groups = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const start = dateKey(r.startDate);
    if (!start) continue;
    const end = r.endDate ? dateKey(r.endDate) || null : null;
    const key = `${r.nurseId}:${r.areaId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        row: {
          nurseId: r.nurseId,
          nurse: nurseFullName(r),
          licenseNumber: r.licenseNumber || r.employeeId,
          areaName: r.areaName,
          firstStart: start,
          lastEnd: "",
          assignments: 0,
          totalDays: 0
        },
        open: false,
        maxEnd: ""
      };
      groups.set(key, g);
    }
    g.row.assignments += 1;
    g.row.totalDays += daysBetween2(start, end, today);
    if (start < g.row.firstStart) g.row.firstStart = start;
    if (end === null) g.open = true;
    else if (end > g.maxEnd) g.maxEnd = end;
  }
  return Array.from(groups.values()).map((g) => ({ ...g.row, lastEnd: g.open ? "Present" : g.maxEnd })).sort((a, b) => a.nurse.localeCompare(b.nurse) || a.areaName.localeCompare(b.areaName));
}

// server/sqliteHelpers.ts
init_nursetrack();
var INACTIVE_STATUS_SQL_LIST2 = INACTIVE_EMPLOYMENT_STATUSES.map((s) => `'${s}'`).join(", ");
function getLocalDashboardInitial() {
  const sqlite = getSqliteDb();
  const today = todayDate();
  const activeRow = sqlite.prepare(`SELECT count(*) as count FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST2})`).get();
  const activeNurses = activeRow.count;
  const creds = sqlite.prepare(`
    SELECT c.expiryDate, n.archivedAt 
    FROM nurseCredentials c 
    INNER JOIN nurses n ON n.id = c.nurseId
  `).all();
  let within1Year = 0;
  let within6Months = 0;
  let expired = 0;
  for (const c of creds) {
    if (c.archivedAt) continue;
    const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
    if (status === "Within 1 Year") within1Year++;
    if (status === "Within 6 Months") within6Months++;
    if (status === "Expired") expired++;
  }
  const trainings = sqlite.prepare(`
    SELECT t.status, t.scheduledDate, t.expiryDate, n.archivedAt
    FROM nurseTrainings t
    INNER JOIN nurses n ON n.id = t.nurseId
  `).all();
  let trainingsAttention = 0;
  for (const t2 of trainings) {
    if (t2.archivedAt) continue;
    if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) trainingsAttention++;
    if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) trainingsAttention++;
  }
  const summary = {
    activeNurses,
    licensesWithin1Year: within1Year,
    licensesWithin6Months: within6Months,
    licensesExpired: expired,
    trainingsAttention
  };
  const areaRows = sqlite.prepare("SELECT * FROM areas ORDER BY sortOrder ASC").all();
  const nurseCounts = sqlite.prepare(`SELECT currentAreaId as areaId, count(*) as count FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST2}) GROUP BY currentAreaId`).all();
  const countByArea = new Map(nurseCounts.map((r) => [r.areaId ?? 0, r.count]));
  const areaSnapshots = areaRows.map((a) => ({
    ...a,
    nurseCount: countByArea.get(a.id) ?? 0,
    licenseAttention: 0,
    trainingAttention: 0,
    samplePhotos: []
  }));
  const credsList = sqlite.prepare(`
    SELECT c.id, c.nurseId, c.expiryDate, c.renewalStatus, n.firstName, n.lastName
    FROM nurseCredentials c
    INNER JOIN nurses n ON n.id = c.nurseId
    WHERE n.archivedAt IS NULL
  `).all();
  const items = [];
  for (const c of credsList) {
    const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
    const days = daysUntilExpiry(dateKey(c.expiryDate), today);
    items.push({
      kind: "license",
      severity: status === "Expired" ? "urgent_or_expired" : status === "Within 6 Months" ? "upcoming_renewal" : "attention",
      title: `${c.firstName} ${c.lastName} \u2014 license ${status === "Expired" ? "expired" : `expires in ${days} days`} (${c.renewalStatus})`,
      date: dateKey(c.expiryDate),
      nurseId: c.nurseId,
      nurseName: `${c.firstName} ${c.lastName}`,
      relatedEntityType: "credential",
      relatedEntityId: c.id
    });
  }
  items.sort((x, y) => {
    const sev = (s) => s === "urgent_or_expired" ? 0 : s === "upcoming_renewal" ? 1 : s === "attention" ? 2 : 3;
    const cmp = sev(x.severity) - sev(y.severity);
    return cmp !== 0 ? cmp : x.date.localeCompare(y.date);
  });
  const now = /* @__PURE__ */ new Date();
  const d30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10);
  const d180 = new Date(now.getTime() + 180 * 864e5).toISOString().slice(0, 10);
  const d365 = new Date(now.getTime() + 365 * 864e5).toISOString().slice(0, 10);
  const actionCenter = {
    urgent: items.filter((i) => i.severity === "urgent_or_expired" || i.severity === "attention" && i.date <= today),
    next30Days: items.filter((i) => i.date > today && i.date <= d30),
    next6Months: items.filter((i) => i.date > d30 && i.date <= d180),
    next1Year: items.filter((i) => i.date > d180 && i.date <= d365)
  };
  const feedRows = sqlite.prepare("SELECT * FROM activityLog ORDER BY createdAt DESC LIMIT 20").all();
  const activityFeed = feedRows.map((r) => ({
    ...r,
    nurse: null
  }));
  const upcomingLicenses = sqlite.prepare(`
    SELECT c.id, c.nurseId, c.expiryDate, (n.firstName || ' ' || n.lastName) as nurseName
    FROM nurseCredentials c
    INNER JOIN nurses n ON n.id = c.nurseId
    WHERE n.archivedAt IS NULL AND date(c.expiryDate) >= date('now')
    ORDER BY date(c.expiryDate) ASC
    LIMIT 10
  `).all();
  const upcoming = {
    upcomingCustoms: [],
    upcomingLicenses: upcomingLicenses.map((r) => ({
      ...r,
      date: dateKey(r.expiryDate),
      daysRemaining: daysUntilExpiry(dateKey(r.expiryDate), today)
    }))
  };
  return { summary, actionCenter, areaSnapshots, activityFeed, upcoming };
}
function getLocalSeminarsList(input) {
  const sqlite = getSqliteDb();
  let sql14 = `
    SELECT e.*, c.id as c_id, c.name as c_name, c.category as c_category, c.kind as c_kind
    FROM trainingEvents e
    INNER JOIN trainingCatalog c ON c.id = e.trainingId
    ORDER BY date(e.startDate) DESC, c.name ASC
  `;
  const rows = sqlite.prepare(sql14).all();
  const records = sqlite.prepare("SELECT eventId, status FROM nurseTrainings WHERE eventId IS NOT NULL").all();
  const counts = /* @__PURE__ */ new Map();
  for (const record of records) {
    const count = counts.get(record.eventId) ?? { total: 0, completed: 0 };
    count.total++;
    if (record.status === "Completed") count.completed++;
    counts.set(record.eventId, count);
  }
  return rows.map((r) => ({
    event: {
      id: r.id,
      trainingId: r.trainingId,
      provider: r.provider,
      venue: r.venue,
      startDate: r.startDate,
      endDate: r.endDate,
      startTime: r.startTime,
      endTime: r.endTime,
      targetStaffType: r.targetStaffType,
      remarks: r.remarks,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    },
    training: {
      id: r.c_id,
      name: r.c_name,
      category: r.c_category,
      kind: r.c_kind
    },
    attendance: counts.get(r.id) ?? { total: 0, completed: 0 }
  }));
}
function getLocalSeminarDetail(eventId) {
  const sqlite = getSqliteDb();
  const eventRow = sqlite.prepare(`
    SELECT e.*, c.id as c_id, c.name as c_name, c.category as c_category, c.kind as c_kind
    FROM trainingEvents e
    INNER JOIN trainingCatalog c ON c.id = e.trainingId
    WHERE e.id = ?
  `).get(eventId);
  if (!eventRow) return null;
  const event = {
    id: eventRow.id,
    trainingId: eventRow.trainingId,
    provider: eventRow.provider,
    venue: eventRow.venue,
    startDate: eventRow.startDate,
    endDate: eventRow.endDate,
    startTime: eventRow.startTime,
    endTime: eventRow.endTime,
    targetStaffType: eventRow.targetStaffType,
    remarks: eventRow.remarks,
    createdAt: eventRow.createdAt,
    updatedAt: eventRow.updatedAt
  };
  const training = {
    id: eventRow.c_id,
    name: eventRow.c_name,
    category: eventRow.c_category,
    kind: eventRow.c_kind
  };
  const records = sqlite.prepare(`
    SELECT t.*, n.firstName, n.middleName, n.lastName, n.suffix, n.staffType, n.currentAreaId, a.name as areaName
    FROM nurseTrainings t
    INNER JOIN nurses n ON n.id = t.nurseId
    LEFT JOIN areas a ON a.id = n.currentAreaId
    WHERE t.eventId = ?
    ORDER BY date(t.completionDate) DESC
  `).all(eventId);
  const attendees = records.map((r) => ({
    ...r,
    staffName: nurseFullName(r),
    staffType: r.staffType,
    areaName: r.areaName ?? "Unassigned"
  }));
  const allRecords = sqlite.prepare(`
    SELECT t.*, n.firstName, n.middleName, n.lastName, n.suffix, n.staffType, n.currentAreaId, a.name as areaName, e.startDate as occStartDate, e.endDate as occEndDate
    FROM nurseTrainings t
    INNER JOIN nurses n ON n.id = t.nurseId
    LEFT JOIN areas a ON a.id = n.currentAreaId
    LEFT JOIN trainingEvents e ON e.id = t.eventId
    WHERE t.trainingId = ?
    ORDER BY date(t.completionDate) DESC
  `).all(training.id);
  const allAttendees = allRecords.map((r) => ({
    ...r,
    staffName: nurseFullName(r),
    staffType: r.staffType,
    areaName: r.areaName ?? "Unassigned",
    occurrenceStartDate: r.occStartDate ?? r.scheduledDate,
    occurrenceEndDate: r.occEndDate ?? r.scheduledDate
  }));
  const staff = sqlite.prepare(`
    SELECT n.*, a.name as areaName
    FROM nurses n
    LEFT JOIN areas a ON a.id = n.currentAreaId
    WHERE n.archivedAt IS NULL AND n.employmentStatus = 'Active'
    ORDER BY n.lastName ASC, n.firstName ASC
  `).all();
  const completedIds = new Set(attendees.filter((a) => a.status === "Completed").map((a) => a.nurseId));
  const missing = staff.filter((p) => event.targetStaffType === "All" || p.staffType === event.targetStaffType).filter((p) => !completedIds.has(p.id)).map((p) => ({
    id: p.id,
    staffName: nurseFullName(p),
    staffType: p.staffType,
    areaName: p.areaName ?? "Unassigned"
  }));
  return { event, training, attendees, allAttendees, missing };
}
function getLocalSeminarMatrix(opts) {
  const sqlite = getSqliteDb();
  let staffSql = "SELECT n.*, a.name as areaName FROM nurses n LEFT JOIN areas a ON a.id = n.currentAreaId WHERE n.archivedAt IS NULL AND n.employmentStatus = 'Active'";
  const staffParams = [];
  if (opts?.staffType && opts.staffType !== "all") {
    staffSql += " AND n.staffType = ?";
    staffParams.push(opts.staffType);
  }
  if (opts?.areaId) {
    staffSql += " AND n.currentAreaId = ?";
    staffParams.push(opts.areaId);
  }
  staffSql += " ORDER BY n.lastName ASC, n.firstName ASC";
  const staff = sqlite.prepare(staffSql).all(...staffParams);
  const events = sqlite.prepare(`
    SELECT e.*, c.id as c_id, c.name as c_name, c.category as c_category, c.kind as c_kind
    FROM trainingEvents e
    INNER JOIN trainingCatalog c ON c.id = e.trainingId
    ORDER BY date(e.startDate) ASC, c.name ASC
  `).all();
  const records = sqlite.prepare("SELECT * FROM nurseTrainings WHERE eventId IS NOT NULL").all();
  return {
    staff: staff.map((p) => ({ id: p.id, name: nurseFullName(p), staffType: p.staffType, areaId: p.currentAreaId })),
    events: events.map((r) => ({
      event: { id: r.id, trainingId: r.trainingId, startDate: r.startDate, endDate: r.endDate },
      training: { id: r.c_id, name: r.c_name, kind: r.c_kind }
    })),
    records
  };
}
function getLocalMonthlySummary(year) {
  const sqlite = getSqliteDb();
  const staff = sqlite.prepare("SELECT * FROM nurses WHERE archivedAt IS NULL AND employmentStatus = 'Active' ORDER BY lastName ASC, firstName ASC").all();
  const records = sqlite.prepare("SELECT nurseId, completionDate FROM nurseTrainings WHERE status = 'Completed' AND completionDate IS NOT NULL").all();
  return staff.map((person) => {
    const months = Array.from({ length: 12 }, () => 0);
    for (const record of records) {
      if (record.nurseId !== person.id) continue;
      const key = dateKey(record.completionDate);
      if (Number(key.slice(0, 4)) === year) {
        const m = Number(key.slice(5, 7)) - 1;
        if (m >= 0 && m < 12) months[m]++;
      }
    }
    return {
      nurseId: person.id,
      staffName: nurseFullName(person),
      months,
      h1: months.slice(0, 6).reduce((a, b) => a + b, 0),
      h2: months.slice(6).reduce((a, b) => a + b, 0)
    };
  });
}
function getLocalQuarterlyLedger(year, quarter) {
  const sqlite = getSqliteDb();
  const startMonth = String((quarter - 1) * 3 + 1).padStart(2, "0");
  const endMonth = String(quarter * 3).padStart(2, "0");
  const from = `${year}-${startMonth}-01`;
  const to = `${year}-${endMonth}-31`;
  const rows = sqlite.prepare(`
    SELECT t.*, n.firstName, n.middleName, n.lastName, n.suffix, c.name as trainingName, c.kind as trainingKind, e.startDate as evStart, e.endDate as evEnd, e.venue as evVenue, e.provider as evProvider
    FROM nurseTrainings t
    INNER JOIN nurses n ON n.id = t.nurseId
    INNER JOIN trainingCatalog c ON c.id = t.trainingId
    LEFT JOIN trainingEvents e ON e.id = t.eventId
    WHERE t.status = 'Completed' AND date(t.completionDate) >= date(?) AND date(t.completionDate) <= date(?)
    ORDER BY date(t.completionDate) ASC, n.lastName ASC
  `).all(from, to);
  return rows.map((r) => ({
    recordId: r.id,
    nurseId: r.nurseId,
    staffName: nurseFullName(r),
    trainingName: r.trainingName,
    kind: r.trainingKind,
    provider: r.evProvider ?? r.provider,
    venue: r.evVenue ?? null,
    startDate: r.evStart ?? dateKey(r.completionDate),
    endDate: r.evEnd ?? dateKey(r.completionDate),
    completionDate: dateKey(r.completionDate),
    participationRole: r.participationRole
  }));
}
function getLocalReportData(type) {
  const sqlite = getSqliteDb();
  const today = todayDate();
  if (type === "licenseStatus") {
    const rows = sqlite.prepare(`
      SELECT n.employeeId, n.firstName, n.middleName, n.lastName, n.suffix, n.currentAreaId, a.name as areaName,
             c.id as credentialId, c.licenseNumber, ct.name as typeName, c.issuingOrganization, c.issueDate, c.expiryDate, c.renewalStatus, c.verificationStatus
      FROM nurseCredentials c
      INNER JOIN nurses n ON n.id = c.nurseId
      INNER JOIN credentialTypes ct ON ct.id = c.credentialTypeId
      LEFT JOIN areas a ON a.id = n.currentAreaId
      WHERE n.archivedAt IS NULL
      ORDER BY n.lastName ASC, n.firstName ASC
    `).all();
    return rows.map((r) => ({
      nurse: nurseFullName(r),
      employeeId: r.employeeId,
      areaName: r.areaName ?? "Unassigned",
      credentialType: r.typeName,
      licenseNumber: r.licenseNumber ?? "\u2014",
      issuingOrganization: r.issuingOrganization ?? "\u2014",
      issueDate: r.issueDate ? String(r.issueDate) : "\u2014",
      expiryDate: dateKey(r.expiryDate),
      daysRemaining: daysUntilExpiry(dateKey(r.expiryDate), today),
      status: deriveLicenseStatus(dateKey(r.expiryDate), today),
      renewalStatus: r.renewalStatus,
      verificationStatus: r.verificationStatus
    }));
  }
  if (type === "licenseDue") {
    const rows = sqlite.prepare(`
      SELECT n.employeeId, n.firstName, n.middleName, n.lastName, n.suffix, n.currentAreaId, a.name as areaName,
             c.id as credentialId, c.licenseNumber, ct.name as typeName, c.issuingOrganization, c.expiryDate, c.renewalStatus
      FROM nurseCredentials c
      INNER JOIN nurses n ON n.id = c.nurseId
      INNER JOIN credentialTypes ct ON ct.id = c.credentialTypeId
      LEFT JOIN areas a ON a.id = n.currentAreaId
      WHERE n.archivedAt IS NULL
      ORDER BY date(c.expiryDate) ASC
    `).all();
    return rows.filter((r) => daysUntilExpiry(dateKey(r.expiryDate), today) <= 365).map((r) => ({
      nurse: nurseFullName(r),
      employeeId: r.employeeId,
      areaName: r.areaName ?? "Unassigned",
      credentialType: r.typeName,
      licenseNumber: r.licenseNumber ?? "\u2014",
      issuingOrganization: r.issuingOrganization ?? "\u2014",
      expiryDate: dateKey(r.expiryDate),
      daysRemaining: daysUntilExpiry(dateKey(r.expiryDate), today),
      status: deriveLicenseStatus(dateKey(r.expiryDate), today),
      renewalStatus: r.renewalStatus
    }));
  }
  if (type === "trainingCompliance") {
    return buildTrainingCompliance({
      areas: sqlite.prepare("SELECT id, name FROM areas WHERE active = 1 ORDER BY sortOrder ASC, name ASC").all(),
      requirements: sqlite.prepare("SELECT areaId, trainingId FROM areaTrainingRequirements WHERE required = 1").all(),
      nurses: sqlite.prepare(`SELECT id, currentAreaId FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST2})`).all(),
      completedRecords: sqlite.prepare("SELECT nurseId, trainingId, expiryDate FROM nurseTrainings WHERE status = 'Completed'").all(),
      today
    });
  }
  if (type === "areaExposure") {
    const rows = sqlite.prepare(`
      SELECT n.id as nurseId, n.employeeId,
             (SELECT c.licenseNumber FROM nurseCredentials c WHERE c.nurseId = n.id ORDER BY date(c.expiryDate) DESC LIMIT 1) as licenseNumber,
             n.firstName, n.middleName, n.lastName, n.suffix,
             asgn.areaId, a.name as areaName, asgn.startDate, asgn.endDate
      FROM areaAssignments asgn
      INNER JOIN nurses n ON n.id = asgn.nurseId
      INNER JOIN areas a ON a.id = asgn.areaId
      WHERE n.archivedAt IS NULL
    `).all();
    return buildAreaExposure(rows, today);
  }
  if (type === "trainingSummary") {
    const rows = sqlite.prepare(`
      SELECT c.name as trainingName, c.category, c.renewalRequired, c.defaultValidityMonths,
             n.firstName, n.middleName, n.lastName, n.suffix,
             t.status, t.scheduledDate, t.completionDate, t.expiryDate, t.trainingHours, t.cpdUnits, t.provider
      FROM nurseTrainings t
      INNER JOIN trainingCatalog c ON c.id = t.trainingId
      INNER JOIN nurses n ON n.id = t.nurseId
      WHERE n.archivedAt IS NULL
      ORDER BY c.name ASC, date(t.completionDate) DESC
    `).all();
    return rows.map((r) => ({
      nurse: nurseFullName(r),
      trainingName: r.trainingName,
      category: r.category ?? "\u2014",
      renewalRequired: r.renewalRequired === 1,
      defaultValidityMonths: r.defaultValidityMonths ?? null,
      status: r.status,
      scheduledDate: r.scheduledDate ? dateKey(r.scheduledDate) : "\u2014",
      completionDate: r.completionDate ? dateKey(r.completionDate) : "\u2014",
      expiryDate: r.expiryDate ? dateKey(r.expiryDate) : "\u2014",
      trainingHours: r.trainingHours ?? null,
      cpdUnits: r.cpdUnits ?? null,
      provider: r.provider ?? "\u2014"
    }));
  }
  if (type === "transferLog") {
    const rows = sqlite.prepare(`
      SELECT n.id as nurseId, n.employeeId,
             (SELECT c.licenseNumber FROM nurseCredentials c WHERE c.nurseId = n.id ORDER BY date(c.expiryDate) DESC LIMIT 1) as licenseNumber,
             n.firstName, n.middleName, n.lastName, n.suffix,
             a.name as areaName, asgn.startDate, asgn.endDate, asgn.assignmentType, asgn.remarks
      FROM areaAssignments asgn
      INNER JOIN nurses n ON n.id = asgn.nurseId
      INNER JOIN areas a ON a.id = asgn.areaId
      ORDER BY date(asgn.startDate) ASC, n.lastName ASC
    `).all();
    return rows.map((r) => ({
      nurse: nurseFullName(r),
      nurseId: r.nurseId,
      licenseNumber: r.licenseNumber || r.employeeId,
      areaName: r.areaName,
      startDate: dateKey(r.startDate),
      endDate: r.endDate ? dateKey(r.endDate) : "Present",
      assignmentType: r.assignmentType ?? "\u2014",
      remarks: r.remarks ?? "\u2014"
    }));
  }
  return [];
}

// server/routers/dashboard.ts
var dashboardRouter = router({
  // Single round-trip initial load: merges the five section queries into one
  // network hop, which matters because each tRPC call costs ~seconds on the
  // hosting layer due to OAuth round-trips.
  initial: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return getLocalDashboardInitial();
    }
    const today = todayDate();
    const pg = getBatchClient();
    if (!pg) throw new Error("Database unavailable");
    const sets = await pg.unsafe(
      [
        `select count(*)::int as count from nursetrack.nurses
             where "archivedAt" is null and not ("employmentStatus" in (${INACTIVE_STATUS_SQL_LIST}))`,
        `select * from nursetrack.areas order by "sortOrder"`,
        `select id, "firstName", "lastName" from nursetrack.nurses where "archivedAt" is null`,
        `select c.id, c."nurseId", c."expiryDate"::text as "expiryDate", c."renewalStatus",
                  n."archivedAt", n."firstName", n."lastName", n."currentAreaId"
             from nursetrack."nurseCredentials" c
             join nursetrack.nurses n on n.id = c."nurseId"`,
        `select t.id, t."nurseId", t.status, t."scheduledDate"::text as "scheduledDate", t."expiryDate"::text as "expiryDate",
                  n."archivedAt", n."firstName", n."lastName", n."currentAreaId"
             from nursetrack."nurseTrainings" t
             join nursetrack.nurses n on n.id = t."nurseId"`,
        `select "currentAreaId" as "areaId", count(*)::int as count from nursetrack.nurses
             where "archivedAt" is null and not ("employmentStatus" in (${INACTIVE_STATUS_SQL_LIST}))
             group by "currentAreaId"`,
        `select "currentAreaId", id, "profilePhotoKey" from nursetrack.nurses
             where "archivedAt" is null and not ("employmentStatus" in (${INACTIVE_STATUS_SQL_LIST}))
             limit 300`,
        `select a.id, a."nurseId", a."startDate"::text as "startDate", a."assignmentType", a."areaId",
                  n."archivedAt", n."firstName", n."lastName"
             from nursetrack."areaAssignments" a
             join nursetrack.nurses n on n.id = a."nurseId"
             where n."archivedAt" is null and a."endDate" is null`,
        `select * from nursetrack."activityLog" order by "createdAt" desc limit 20`,
        `select e.id, e.title, e."eventDate"::text as "eventDate", e."nurseId", e."areaId",
                  concat(n."firstName", ' ', n."lastName") as "nurseName",
                  ar.name as "areaName"
             from nursetrack."customCalendarEvents" e
             left join nursetrack.nurses n on n.id = e."nurseId"
             left join nursetrack.areas ar on ar.id = e."areaId"
             where e."eventDate" >= CURRENT_DATE
             order by e."eventDate" asc
             limit 10`,
        `select c.id, c."nurseId", c."expiryDate"::text as "expiryDate",
                  concat(n."firstName", ' ', n."lastName") as "nurseName",
                  (c."expiryDate" - CURRENT_DATE)::int as "daysRemaining"
             from nursetrack."nurseCredentials" c
             join nursetrack.nurses n on n.id = c."nurseId"
             where n."archivedAt" is null and c."expiryDate" >= CURRENT_DATE
             order by c."expiryDate" asc
             limit 10`
      ].join(";\n")
    ).simple();
    const [
      activeCountRows,
      areaRows,
      nurseRows,
      credsJoined,
      trainingsJoined,
      nurseCounts,
      photoNurses,
      assignments,
      feedRows,
      upcomingCustoms,
      upcomingLicenses
    ] = sets;
    const activeNurses = Number(activeCountRows[0]?.count ?? 0);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const nurseById = new Map(nurseRows.map((n) => [n.id, n]));
    let within1Year = 0;
    let within6Months = 0;
    let expired = 0;
    for (const c of credsJoined) {
      if (c.archivedAt) continue;
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      if (status === "Within 1 Year") within1Year++;
      if (status === "Within 6 Months") within6Months++;
      if (status === "Expired") expired++;
    }
    let trainingsAttention = 0;
    for (const t2 of trainingsJoined) {
      if (t2.archivedAt) continue;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) trainingsAttention++;
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) trainingsAttention++;
    }
    const summary = {
      activeNurses,
      licensesWithin1Year: within1Year,
      licensesWithin6Months: within6Months,
      licensesExpired: expired,
      trainingsAttention
    };
    const countByArea = new Map(nurseCounts.map((r) => [r.areaId ?? 0, Number(r.count)]));
    const attentionByArea = /* @__PURE__ */ new Map();
    for (const c of credsJoined) {
      if (c.archivedAt) continue;
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      if (status !== "Valid" && c.currentAreaId) attentionByArea.set(c.currentAreaId, (attentionByArea.get(c.currentAreaId) ?? 0) + 1);
    }
    const trainingAttentionByArea = /* @__PURE__ */ new Map();
    for (const t2 of trainingsJoined) {
      if (t2.archivedAt) continue;
      let needsAttention = false;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) needsAttention = true;
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) needsAttention = true;
      if (needsAttention && t2.currentAreaId) trainingAttentionByArea.set(t2.currentAreaId, (trainingAttentionByArea.get(t2.currentAreaId) ?? 0) + 1);
    }
    const photosByArea = /* @__PURE__ */ new Map();
    for (const n of photoNurses) {
      if (!n.currentAreaId || !n.profilePhotoKey) continue;
      const arr = photosByArea.get(n.currentAreaId) ?? [];
      if (arr.length < 6) arr.push({ id: n.id, profilePhotoKey: n.profilePhotoKey });
      photosByArea.set(n.currentAreaId, arr);
    }
    const areaSnapshots = areaRows.map((a) => ({
      ...a,
      nurseCount: countByArea.get(a.id) ?? 0,
      licenseAttention: attentionByArea.get(a.id) ?? 0,
      trainingAttention: trainingAttentionByArea.get(a.id) ?? 0,
      samplePhotos: photosByArea.get(a.id) ?? []
    }));
    const items = [];
    for (const c of credsJoined) {
      if (c.archivedAt) continue;
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      const days = daysUntilExpiry(dateKey(c.expiryDate), today);
      items.push({
        kind: "license",
        severity: status === "Expired" ? "urgent_or_expired" : status === "Within 6 Months" ? "upcoming_renewal" : "attention",
        title: `${c.firstName} ${c.lastName} \u2014 license ${status === "Expired" ? "expired" : `expires in ${days} days`} (${c.renewalStatus})`,
        date: dateKey(c.expiryDate),
        nurseId: c.nurseId,
        nurseName: `${c.firstName} ${c.lastName}`,
        relatedEntityType: "credential",
        relatedEntityId: c.id
      });
    }
    for (const t2 of trainingsJoined) {
      if (t2.archivedAt) continue;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) {
        items.push({
          kind: "training",
          severity: "attention",
          title: `${t2.firstName} ${t2.lastName} \u2014 training overdue (was scheduled ${dateKey(t2.scheduledDate)})`,
          date: dateKey(t2.scheduledDate),
          nurseId: t2.nurseId,
          nurseName: `${t2.firstName} ${t2.lastName}`,
          relatedEntityType: "nurseTraining",
          relatedEntityId: t2.id
        });
      }
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) {
        items.push({
          kind: "training",
          severity: daysUntilExpiry(dateKey(t2.expiryDate), today) < -30 ? "upcoming_renewal" : "attention",
          title: `${t2.firstName} ${t2.lastName} \u2014 training certification expired`,
          date: dateKey(t2.expiryDate),
          nurseId: t2.nurseId,
          nurseName: `${t2.firstName} ${t2.lastName}`,
          relatedEntityType: "nurseTraining",
          relatedEntityId: t2.id
        });
      }
    }
    for (const a of assignments) {
      if (dateKey(a.startDate) > today) {
        items.push({
          kind: "transfer",
          severity: "informational",
          title: `${a.firstName} ${a.lastName} \u2014 transferring to ${areaById.get(a.areaId)?.name ?? "an area"} (${a.assignmentType ?? "transfer"})`,
          date: dateKey(a.startDate),
          nurseId: a.nurseId,
          nurseName: `${a.firstName} ${a.lastName}`,
          relatedEntityType: "areaAssignment",
          relatedEntityId: a.id
        });
      }
    }
    items.sort((x, y) => {
      const sev = (s) => s === "urgent_or_expired" ? 0 : s === "upcoming_renewal" ? 1 : s === "attention" ? 2 : 3;
      const cmp = sev(x.severity) - sev(y.severity);
      return cmp !== 0 ? cmp : x.date.localeCompare(y.date);
    });
    const now = /* @__PURE__ */ new Date();
    const d30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10);
    const d180 = new Date(now.getTime() + 180 * 864e5).toISOString().slice(0, 10);
    const d365 = new Date(now.getTime() + 365 * 864e5).toISOString().slice(0, 10);
    const actionCenter = {
      urgent: items.filter((i) => i.severity === "urgent_or_expired" || i.severity === "attention" && i.date <= today),
      next30Days: items.filter((i) => i.date > today && i.date <= d30),
      next6Months: items.filter((i) => i.date > d30 && i.date <= d180),
      next1Year: items.filter((i) => i.date > d180 && i.date <= d365)
    };
    const activityFeed = feedRows.map((r) => ({
      ...r,
      nurse: r.nurseId ? nurseById.get(r.nurseId) ?? null : null
    }));
    const upcoming = {
      upcomingCustoms: upcomingCustoms.map((r) => ({
        ...r,
        date: dateKey(r.eventDate),
        nurseName: r.nurseName ?? null,
        areaName: r.areaName ?? null
      })),
      upcomingLicenses: upcomingLicenses.map((r) => ({
        ...r,
        date: dateKey(r.expiryDate),
        daysRemaining: Number(r.daysRemaining)
      }))
    };
    return { summary, actionCenter, areaSnapshots, activityFeed, upcoming };
  }),
  summary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const today = todayDate();
    const [activeRow] = await db.select({ count: sql4`count(*)` }).from(nurses).where(activeNurseCondition());
    const activeNurses = Number(activeRow?.count ?? 0);
    const creds = await db.select({
      expiryDate: nurseCredentials.expiryDate,
      archivedAt: nurses.archivedAt
    }).from(nurseCredentials).innerJoin(nurses, eq3(nurses.id, nurseCredentials.nurseId));
    let within1Year = 0;
    let within6Months = 0;
    let expired = 0;
    for (const c of creds) {
      if (c.archivedAt) continue;
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      if (status === "Within 1 Year") within1Year++;
      if (status === "Within 6 Months") within6Months++;
      if (status === "Expired") expired++;
    }
    const trainings = await db.select({
      status: nurseTrainings.status,
      scheduledDate: nurseTrainings.scheduledDate,
      expiryDate: nurseTrainings.expiryDate,
      archivedAt: nurses.archivedAt
    }).from(nurseTrainings).innerJoin(nurses, eq3(nurses.id, nurseTrainings.nurseId));
    let trainingsAttention = 0;
    for (const t2 of trainings) {
      if (t2.archivedAt) continue;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) trainingsAttention++;
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) trainingsAttention++;
    }
    return {
      activeNurses,
      licensesWithin1Year: within1Year,
      licensesWithin6Months: within6Months,
      licensesExpired: expired,
      trainingsAttention
    };
  }),
  areaSnapshots: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const today = todayDate();
    const areaRows = await db.select().from(areas).orderBy(areas.sortOrder);
    const activeNurseCond = activeNurseCondition();
    const nurseCounts = await db.select({ areaId: nurses.currentAreaId, count: sql4`count(*)` }).from(nurses).where(activeNurseCond).groupBy(nurses.currentAreaId);
    const countByArea = new Map(nurseCounts.map((r) => [r.areaId ?? 0, Number(r.count)]));
    const photoNurses = await db.select({ currentAreaId: nurses.currentAreaId, id: nurses.id, profilePhotoKey: nurses.profilePhotoKey }).from(nurses).where(activeNurseCond).limit(300);
    const creds = await db.select({ areaId: nurses.currentAreaId, expiryDate: nurseCredentials.expiryDate }).from(nurseCredentials).innerJoin(nurses, eq3(nurses.id, nurseCredentials.nurseId)).where(isNull3(nurses.archivedAt));
    const attentionByArea = /* @__PURE__ */ new Map();
    for (const c of creds) {
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      if (status !== "Valid" && c.areaId) {
        attentionByArea.set(c.areaId, (attentionByArea.get(c.areaId) ?? 0) + 1);
      }
    }
    const trainings = await db.select({
      areaId: nurses.currentAreaId,
      status: nurseTrainings.status,
      scheduledDate: nurseTrainings.scheduledDate,
      expiryDate: nurseTrainings.expiryDate
    }).from(nurseTrainings).innerJoin(nurses, eq3(nurses.id, nurseTrainings.nurseId)).where(isNull3(nurses.archivedAt));
    const trainingAttentionByArea = /* @__PURE__ */ new Map();
    for (const t2 of trainings) {
      let needsAttention = false;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) needsAttention = true;
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) needsAttention = true;
      if (needsAttention && t2.areaId) {
        trainingAttentionByArea.set(t2.areaId, (trainingAttentionByArea.get(t2.areaId) ?? 0) + 1);
      }
    }
    const photosByArea = /* @__PURE__ */ new Map();
    for (const n of photoNurses) {
      if (!n.currentAreaId || !n.profilePhotoKey) continue;
      const arr = photosByArea.get(n.currentAreaId) ?? [];
      if (arr.length < 6) arr.push({ id: n.id, profilePhotoKey: n.profilePhotoKey });
      photosByArea.set(n.currentAreaId, arr);
    }
    return areaRows.map((a) => ({
      ...a,
      nurseCount: countByArea.get(a.id) ?? 0,
      licenseAttention: attentionByArea.get(a.id) ?? 0,
      trainingAttention: trainingAttentionByArea.get(a.id) ?? 0,
      samplePhotos: photosByArea.get(a.id) ?? []
    }));
  }),
  actionCenter: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const today = todayDate();
    const items = [];
    const nurseRows = await db.select({ id: nurses.id, firstName: nurses.firstName, lastName: nurses.lastName }).from(nurses).where(isNull3(nurses.archivedAt));
    const nurseById = new Map(nurseRows.map((n) => [n.id, n]));
    const creds = await db.select({
      id: nurseCredentials.id,
      nurseId: nurseCredentials.nurseId,
      expiryDate: nurseCredentials.expiryDate,
      renewalStatus: nurseCredentials.renewalStatus,
      archivedAt: nurses.archivedAt,
      firstName: nurses.firstName,
      lastName: nurses.lastName
    }).from(nurseCredentials).innerJoin(nurses, eq3(nurses.id, nurseCredentials.nurseId));
    for (const c of creds) {
      if (c.archivedAt) continue;
      const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
      const days = daysUntilExpiry(dateKey(c.expiryDate), today);
      items.push({
        kind: "license",
        severity: status === "Expired" ? "urgent_or_expired" : status === "Within 6 Months" ? "upcoming_renewal" : "attention",
        title: `${c.firstName} ${c.lastName} \u2014 license ${status === "Expired" ? "expired" : `expires in ${days} days`} (${c.renewalStatus})`,
        date: dateKey(c.expiryDate),
        nurseId: c.nurseId,
        nurseName: `${c.firstName} ${c.lastName}`,
        relatedEntityType: "credential",
        relatedEntityId: c.id
      });
    }
    const trainings = await db.select({
      id: nurseTrainings.id,
      nurseId: nurseTrainings.nurseId,
      status: nurseTrainings.status,
      scheduledDate: nurseTrainings.scheduledDate,
      expiryDate: nurseTrainings.expiryDate,
      archivedAt: nurses.archivedAt,
      firstName: nurses.firstName,
      lastName: nurses.lastName
    }).from(nurseTrainings).innerJoin(nurses, eq3(nurses.id, nurseTrainings.nurseId));
    for (const t2 of trainings) {
      if (t2.archivedAt) continue;
      if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) {
        items.push({
          kind: "training",
          severity: "attention",
          title: `${t2.firstName} ${t2.lastName} \u2014 training overdue (was scheduled ${dateKey(t2.scheduledDate)})`,
          date: dateKey(t2.scheduledDate),
          nurseId: t2.nurseId,
          nurseName: `${t2.firstName} ${t2.lastName}`,
          relatedEntityType: "nurseTraining",
          relatedEntityId: t2.id
        });
      }
      if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) {
        items.push({
          kind: "training",
          severity: daysUntilExpiry(dateKey(t2.expiryDate), today) < -30 ? "upcoming_renewal" : "attention",
          title: `${t2.firstName} ${t2.lastName} \u2014 training certification expired`,
          date: dateKey(t2.expiryDate),
          nurseId: t2.nurseId,
          nurseName: `${t2.firstName} ${t2.lastName}`,
          relatedEntityType: "nurseTraining",
          relatedEntityId: t2.id
        });
      }
    }
    const assignments = await db.select({
      id: areaAssignments.id,
      nurseId: areaAssignments.nurseId,
      startDate: areaAssignments.startDate,
      assignmentType: areaAssignments.assignmentType,
      areaId: areaAssignments.areaId,
      archivedAt: nurses.archivedAt,
      firstName: nurses.firstName,
      lastName: nurses.lastName
    }).from(areaAssignments).innerJoin(nurses, eq3(nurses.id, areaAssignments.nurseId)).where(and3(isNull3(nurses.archivedAt), isNull3(areaAssignments.endDate)));
    const areaRows = await db.select().from(areas);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    for (const a of assignments) {
      if (dateKey(a.startDate) > today) {
        items.push({
          kind: "transfer",
          severity: "informational",
          title: `${a.firstName} ${a.lastName} \u2014 transferring to ${areaById.get(a.areaId)?.name ?? "an area"} (${a.assignmentType ?? "transfer"})`,
          date: dateKey(a.startDate),
          nurseId: a.nurseId,
          nurseName: `${a.firstName} ${a.lastName}`,
          relatedEntityType: "areaAssignment",
          relatedEntityId: a.id
        });
      }
    }
    items.sort((x, y) => {
      const sev = (s) => s === "urgent_or_expired" ? 0 : s === "upcoming_renewal" ? 1 : s === "attention" ? 2 : 3;
      const cmp = sev(x.severity) - sev(y.severity);
      return cmp !== 0 ? cmp : x.date.localeCompare(y.date);
    });
    const now = /* @__PURE__ */ new Date();
    const d30 = new Date(now.getTime() + 30 * 864e5).toISOString().slice(0, 10);
    const d180 = new Date(now.getTime() + 180 * 864e5).toISOString().slice(0, 10);
    const d365 = new Date(now.getTime() + 365 * 864e5).toISOString().slice(0, 10);
    return {
      urgent: items.filter((i) => i.severity === "urgent_or_expired" || i.severity === "attention" && i.date <= today),
      next30Days: items.filter((i) => i.date > today && i.date <= d30),
      next6Months: items.filter((i) => i.date > d30 && i.date <= d180),
      next1Year: items.filter((i) => i.date > d180 && i.date <= d365)
    };
  }),
  activityFeed: adminProcedure.input(z7.object({ limit: z7.number().min(1).max(100).optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(activityLog).orderBy(desc3(activityLog.createdAt)).limit(input.limit ?? 50);
    const nurseRows = await db.select({ id: nurses.id, firstName: nurses.firstName, lastName: nurses.lastName }).from(nurses);
    const nurseById = new Map(nurseRows.map((n) => [n.id, n]));
    return rows.map((r) => ({
      ...r,
      nurse: r.nurseId ? nurseById.get(r.nurseId) ?? null : null
    }));
  }),
  upcoming: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const today = todayDate();
    const upcomingCustoms = await db.select({
      id: customCalendarEvents.id,
      title: customCalendarEvents.title,
      eventDate: customCalendarEvents.eventDate,
      nurseId: customCalendarEvents.nurseId,
      areaId: customCalendarEvents.areaId,
      nurseName: sql4`concat(${nurses.firstName}, ' ', ${nurses.lastName})`,
      areaName: areas.name
    }).from(customCalendarEvents).leftJoin(nurses, eq3(nurses.id, customCalendarEvents.nurseId)).leftJoin(areas, eq3(areas.id, customCalendarEvents.areaId)).where(sql4`${customCalendarEvents.eventDate} >= ${today}`).orderBy(asc2(customCalendarEvents.eventDate)).limit(10);
    const upcomingLicenses = await db.select({
      id: nurseCredentials.id,
      nurseId: nurseCredentials.nurseId,
      expiryDate: nurseCredentials.expiryDate,
      nurseName: sql4`concat(${nurses.firstName}, ' ', ${nurses.lastName})`,
      daysRemaining: sql4`(${nurseCredentials.expiryDate} - CURRENT_DATE)`
    }).from(nurseCredentials).innerJoin(nurses, eq3(nurses.id, nurseCredentials.nurseId)).where(and3(isNull3(nurses.archivedAt), sql4`${nurseCredentials.expiryDate} >= CURRENT_DATE`)).orderBy(asc2(nurseCredentials.expiryDate)).limit(10);
    return {
      upcomingCustoms: upcomingCustoms.map((r) => ({
        ...r,
        date: dateKey(r.eventDate),
        nurseName: r.nurseName ?? null,
        areaName: r.areaName ?? null
      })),
      upcomingLicenses: upcomingLicenses.map((r) => ({
        ...r,
        date: dateKey(r.expiryDate),
        daysRemaining: Number(r.daysRemaining)
      }))
    };
  })
});

// server/routers/areas.ts
import { z as z8 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
import { and as and4, eq as eq4, isNull as isNull4, sql as sql5 } from "drizzle-orm";
init_db();
init_schema();
init_schema();
init_nursetrack();
var areasRouter = router({
  list: adminProcedure.query(() => listAreasWithCounts()),
  get: adminProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
    const area = await getAreaById(input.id);
    if (!area) throw new TRPCError5({ code: "NOT_FOUND", message: "Area not found" });
    const staff = await Promise.all(
      (await getAssignmentsForArea(input.id)).map(async (s) => ({
        ...s,
        nurse: { ...s.nurse, licenseNumber: (await getNurseLicenseInfo(s.nurse.id)).licenseNumber }
      }))
    );
    return { ...area, staff };
  }),
  create: adminProcedure.input(
    z8.object({
      code: z8.string().min(1).max(64),
      name: z8.string().min(1).max(128),
      description: z8.string().max(2e3).optional(),
      sortOrder: z8.number().int().min(0).max(999).optional()
    })
  ).mutation(async ({ input }) => {
    const id = await createArea({
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 99,
      active: true
    });
    return { id };
  }),
  update: adminProcedure.input(
    z8.object({
      id: z8.number(),
      code: z8.string().min(1).max(64).optional(),
      name: z8.string().min(1).max(128).optional(),
      description: z8.string().max(2e3).optional().nullable(),
      active: z8.boolean().optional()
    })
  ).mutation(async ({ input }) => {
    const { id, ...rest } = input;
    await updateArea(id, rest);
    return { success: true };
  }),
  deactivate: adminProcedure.input(z8.object({ id: z8.number() })).mutation(async ({ input }) => {
    const staff = await getAssignmentsForArea(input.id);
    if (staff.length > 0) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "Area still has assigned nurses. Reassign them first." });
    }
    await updateArea(input.id, { active: false });
    return { success: true };
  }),
  areaDashboard: adminProcedure.input(z8.object({ id: z8.number() })).query(async ({ input }) => {
    const today = todayDate();
    const area = await getAreaById(input.id);
    if (!area) throw new TRPCError5({ code: "NOT_FOUND", message: "Area not found" });
    const staff = await getAssignmentsForArea(input.id);
    const nurseIds = staff.map((s) => s.nurse.id);
    const db = await getDb();
    if (!db) {
      const durations2 = staff.filter((s) => s.assignment.startDate).map((s) => daysBetween(dateKey(s.assignment.startDate), today));
      return {
        area,
        staffCount: staff.length,
        capacity: null,
        licenseAttention: 0,
        licensesExpired: 0,
        trainingAttention: 0,
        upcomingOutboundTransfers: [],
        avgDurationDays: durations2.length ? Math.round(durations2.reduce((a, b) => a + b, 0) / durations2.length) : 0
      };
    }
    let licenseAttention = 0;
    let expired = 0;
    if (nurseIds.length > 0) {
      const creds = await db.select({ expiryDate: nurseCredentials.expiryDate }).from(nurseCredentials).where(sql5`${nurseCredentials.nurseId} IN (${sql5.join(nurseIds, sql5`, `)})`);
      for (const c of creds) {
        const status = deriveLicenseStatus(dateKey(c.expiryDate), today);
        if (status === "Expired") expired++;
        if (status !== "Valid") licenseAttention++;
      }
    }
    let trainingAttention = 0;
    if (nurseIds.length > 0) {
      const trainings = await db.select({ status: nurseTrainings.status, scheduledDate: nurseTrainings.scheduledDate, expiryDate: nurseTrainings.expiryDate }).from(nurseTrainings).where(sql5`${nurseTrainings.nurseId} IN (${sql5.join(nurseIds, sql5`, `)})`);
      for (const t2 of trainings) {
        if (t2.status === "Scheduled" && t2.scheduledDate && dateKey(t2.scheduledDate) <= today) trainingAttention++;
        if (t2.status === "Completed" && t2.expiryDate && daysUntilExpiry(dateKey(t2.expiryDate), today) <= 0) trainingAttention++;
      }
    }
    const outbound = await db.select({
      nurse: { id: nurses.id, firstName: nurses.firstName, lastName: nurses.lastName },
      startDate: areaAssignments.startDate,
      assignmentType: areaAssignments.assignmentType
    }).from(areaAssignments).innerJoin(nurses, eq4(nurses.id, areaAssignments.nurseId)).where(and4(eq4(areaAssignments.areaId, input.id), isNull4(areaAssignments.endDate), sql5`${areaAssignments.startDate} > ${today}`)).orderBy(sql5`${areaAssignments.startDate} ASC`).limit(10);
    const durations = staff.filter((s) => s.assignment.startDate).map((s) => daysBetween(dateKey(s.assignment.startDate), today));
    return {
      area,
      staffCount: staff.length,
      capacity: null,
      licenseAttention,
      licensesExpired: expired,
      trainingAttention,
      upcomingOutboundTransfers: outbound.map((o) => ({
        nurse: { ...o.nurse, name: `${o.nurse.firstName} ${o.nurse.lastName}` },
        date: dateKey(o.startDate),
        type: o.assignmentType
      })),
      avgDurationDays: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    };
  })
});
async function listAreasWithCounts() {
  const db = await getDb();
  if (!db) {
    const today2 = todayDate();
    const areaRows2 = await listAreas();
    const allNurses = await listNurses({ archived: false });
    const countByArea2 = /* @__PURE__ */ new Map();
    for (const n of allNurses) {
      if (n.currentAreaId && !INACTIVE_EMPLOYMENT_STATUSES.includes(n.employmentStatus)) {
        countByArea2.set(n.currentAreaId, (countByArea2.get(n.currentAreaId) ?? 0) + 1);
      }
    }
    const allCreds = await listCredentials();
    const nurseById = new Map(allNurses.map((n) => [n.id, n]));
    const attentionByArea2 = /* @__PURE__ */ new Map();
    for (const c of allCreds) {
      const nurse = nurseById.get(c.nurseId);
      if (nurse?.currentAreaId && deriveLicenseStatus(dateKey(c.expiryDate), today2) !== "Valid") {
        attentionByArea2.set(nurse.currentAreaId, (attentionByArea2.get(nurse.currentAreaId) ?? 0) + 1);
      }
    }
    return areaRows2.map((a) => ({
      ...a,
      nurseCount: countByArea2.get(a.id) ?? 0,
      licenseAttention: attentionByArea2.get(a.id) ?? 0
    }));
  }
  const today = todayDate();
  const areaRows = await db.select().from(areas).orderBy(areas.sortOrder);
  const nurseCounts = await db.select({ areaId: nurses.currentAreaId, count: sql5`count(*)` }).from(nurses).where(activeNurseCondition()).groupBy(nurses.currentAreaId);
  const countByArea = new Map(nurseCounts.map((r) => [r.areaId ?? 0, Number(r.count)]));
  const creds = await db.select({ areaId: nurses.currentAreaId, expiryDate: nurseCredentials.expiryDate }).from(nurseCredentials).innerJoin(nurses, eq4(nurses.id, nurseCredentials.nurseId)).where(isNull4(nurses.archivedAt));
  const attentionByArea = /* @__PURE__ */ new Map();
  for (const c of creds) {
    if (deriveLicenseStatus(dateKey(c.expiryDate), today) !== "Valid" && c.areaId) {
      attentionByArea.set(c.areaId, (attentionByArea.get(c.areaId) ?? 0) + 1);
    }
  }
  return areaRows.map((a) => ({
    ...a,
    nurseCount: countByArea.get(a.id) ?? 0,
    licenseAttention: attentionByArea.get(a.id) ?? 0
  }));
}

// server/routers/reports.ts
init_nursetrack();
import { asc as asc3, desc as desc4, eq as eq5, isNull as isNull5, sql as sql6 } from "drizzle-orm";
import { z as z9 } from "zod";
init_db();
init_schema();
init_nursetrack();
var reportsRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      const activeCount = await countActiveNurses();
      const areaList = await listAreas();
      return [
        { type: "licenseStatus", label: "License Status Overview", description: "Active license status of all nurses by area", rowHint: activeCount },
        { type: "licenseDue", label: "Licenses Due for Renewal", description: "Licenses expiring within 1 year, sorted by urgency", rowHint: null },
        { type: "trainingCompliance", label: "Training Compliance by Area", description: "Required-training completion per area", rowHint: areaList.length },
        { type: "areaExposure", label: "Area Exposure Report", description: "Total days each nurse spent in each area across all assignments", rowHint: null },
        { type: "trainingSummary", label: "Training Summary", description: "Every training record with category, status, dates, hours, and provider", rowHint: null },
        { type: "transferLog", label: "Transfer Log", description: "Complete history of area transfers, oldest to newest", rowHint: null }
      ];
    }
    const today = todayDate();
    const activeNurseCond = activeNurseCondition();
    const [activeRow] = await db.select({ count: sql6`count(*)` }).from(nurses).where(activeNurseCond);
    const areaCount = (await db.select().from(areas).where(eq5(areas.active, true))).length;
    return [
      { type: "licenseStatus", label: "License Status Overview", description: "Active license status of all nurses by area", rowHint: activeRow?.count ?? 0 },
      { type: "licenseDue", label: "Licenses Due for Renewal", description: "Licenses expiring within 1 year, sorted by urgency", rowHint: null },
      { type: "trainingCompliance", label: "Training Compliance by Area", description: "Required-training completion per area", rowHint: areaCount },
      { type: "areaExposure", label: "Area Exposure Report", description: "Total days each nurse spent in each area across all assignments", rowHint: null },
      { type: "trainingSummary", label: "Training Summary", description: "Every training record with category, status, dates, hours, and provider", rowHint: null },
      { type: "transferLog", label: "Transfer Log", description: "Complete history of area transfers, oldest to newest", rowHint: null }
    ];
  }),
  generate: adminProcedure.input(z9.object({ type: z9.enum(["licenseStatus", "licenseDue", "trainingCompliance", "areaExposure", "trainingSummary", "transferLog"]) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return getLocalReportData(input.type);
    }
    const today = todayDate();
    if (input.type === "licenseStatus") {
      const rows2 = await db.select({
        employeeId: nurses.employeeId,
        firstName: nurses.firstName,
        middleName: nurses.middleName,
        lastName: nurses.lastName,
        currentAreaId: nurses.currentAreaId,
        credentialId: nurseCredentials.id,
        licenseNumber: nurseCredentials.licenseNumber,
        typeName: credentialTypes.name,
        issuingOrganization: nurseCredentials.issuingOrganization,
        issueDate: nurseCredentials.issueDate,
        expiryDate: nurseCredentials.expiryDate,
        renewalStatus: nurseCredentials.renewalStatus,
        verificationStatus: nurseCredentials.verificationStatus,
        archivedAt: nurses.archivedAt
      }).from(nurseCredentials).innerJoin(nurses, eq5(nurses.id, nurseCredentials.nurseId)).innerJoin(credentialTypes, eq5(credentialTypes.id, nurseCredentials.credentialTypeId)).orderBy(asc3(nurses.lastName), asc3(nurses.firstName));
      const areaRows = await db.select().from(areas);
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      return rows2.filter((r) => !r.archivedAt).map((r) => ({
        nurse: nurseFullName(r),
        employeeId: r.employeeId,
        areaName: r.currentAreaId ? areaById.get(r.currentAreaId)?.name ?? "Unknown" : "Unassigned",
        credentialType: r.typeName,
        licenseNumber: r.licenseNumber ?? "\u2014",
        issuingOrganization: r.issuingOrganization ?? "\u2014",
        issueDate: r.issueDate ? String(r.issueDate) : "\u2014",
        expiryDate: dateKey(r.expiryDate),
        daysRemaining: daysUntilExpiry(dateKey(r.expiryDate), today),
        status: deriveLicenseStatus(dateKey(r.expiryDate), today),
        renewalStatus: r.renewalStatus,
        verificationStatus: r.verificationStatus
      }));
    }
    if (input.type === "licenseDue") {
      const rows2 = await db.select({
        firstName: nurses.firstName,
        middleName: nurses.middleName,
        lastName: nurses.lastName,
        employeeId: nurses.employeeId,
        currentAreaId: nurses.currentAreaId,
        typeName: credentialTypes.name,
        licenseNumber: nurseCredentials.licenseNumber,
        issuingOrganization: nurseCredentials.issuingOrganization,
        expiryDate: nurseCredentials.expiryDate,
        renewalStatus: nurseCredentials.renewalStatus,
        archivedAt: nurses.archivedAt
      }).from(nurseCredentials).innerJoin(nurses, eq5(nurses.id, nurseCredentials.nurseId)).innerJoin(credentialTypes, eq5(credentialTypes.id, nurseCredentials.credentialTypeId)).where(sql6`(${nurseCredentials.expiryDate} - CURRENT_DATE) <= 365`).orderBy(sql6`(${nurseCredentials.expiryDate} - CURRENT_DATE) ASC`).limit(300);
      const areaRows = await db.select().from(areas);
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      return rows2.filter((r) => !r.archivedAt).map((r) => ({
        nurse: nurseFullName(r),
        employeeId: r.employeeId,
        areaName: r.currentAreaId ? areaById.get(r.currentAreaId)?.name ?? "Unknown" : "Unassigned",
        credentialType: r.typeName,
        licenseNumber: r.licenseNumber ?? "\u2014",
        issuingOrganization: r.issuingOrganization ?? "\u2014",
        expiryDate: dateKey(r.expiryDate),
        daysRemaining: daysUntilExpiry(dateKey(r.expiryDate), today),
        status: deriveLicenseStatus(dateKey(r.expiryDate), today),
        renewalStatus: r.renewalStatus
      }));
    }
    if (input.type === "trainingCompliance") {
      const [areaRows, requirements, staff, completed] = await Promise.all([
        db.select({ id: areas.id, name: areas.name }).from(areas).where(eq5(areas.active, true)).orderBy(asc3(areas.sortOrder), asc3(areas.name)),
        db.select({ areaId: areaTrainingRequirements.areaId, trainingId: areaTrainingRequirements.trainingId }).from(areaTrainingRequirements).where(eq5(areaTrainingRequirements.required, true)),
        db.select({ id: nurses.id, currentAreaId: nurses.currentAreaId }).from(nurses).where(activeNurseCondition()),
        db.select({ nurseId: nurseTrainings.nurseId, trainingId: nurseTrainings.trainingId, expiryDate: nurseTrainings.expiryDate }).from(nurseTrainings).where(eq5(nurseTrainings.status, "Completed"))
      ]);
      return buildTrainingCompliance({ areas: areaRows, requirements, nurses: staff, completedRecords: completed, today });
    }
    if (input.type === "areaExposure") {
      const rows2 = await db.select({
        nurseId: nurses.id,
        employeeId: nurses.employeeId,
        firstName: nurses.firstName,
        middleName: nurses.middleName,
        lastName: nurses.lastName,
        suffix: nurses.suffix,
        areaId: areaAssignments.areaId,
        areaName: areas.name,
        startDate: areaAssignments.startDate,
        endDate: areaAssignments.endDate
      }).from(areaAssignments).innerJoin(nurses, eq5(nurses.id, areaAssignments.nurseId)).innerJoin(areas, eq5(areas.id, areaAssignments.areaId)).where(isNull5(nurses.archivedAt));
      const licenseByNurse2 = await latestLicenseNumbersByNurse(db, rows2.map((r) => r.nurseId));
      return buildAreaExposure(
        rows2.map((r) => ({ ...r, licenseNumber: licenseByNurse2.get(r.nurseId) ?? null })),
        today
      );
    }
    if (input.type === "trainingSummary") {
      const rows2 = await db.select({
        trainingName: trainingCatalog.name,
        category: trainingCatalog.category,
        renewalRequired: trainingCatalog.renewalRequired,
        defaultValidityMonths: trainingCatalog.defaultValidityMonths,
        recordId: nurseTrainings.id,
        firstName: nurses.firstName,
        middleName: nurses.middleName,
        lastName: nurses.lastName,
        status: nurseTrainings.status,
        scheduledDate: nurseTrainings.scheduledDate,
        completionDate: nurseTrainings.completionDate,
        expiryDate: nurseTrainings.expiryDate,
        trainingHours: nurseTrainings.trainingHours,
        cpdUnits: nurseTrainings.cpdUnits,
        provider: nurseTrainings.provider
      }).from(nurseTrainings).innerJoin(trainingCatalog, eq5(trainingCatalog.id, nurseTrainings.trainingId)).innerJoin(nurses, eq5(nurses.id, nurseTrainings.nurseId)).where(isNull5(nurses.archivedAt)).orderBy(asc3(trainingCatalog.name), desc4(nurseTrainings.scheduledDate));
      return rows2.map((r) => ({
        nurse: nurseFullName(r),
        trainingName: r.trainingName,
        category: r.category ?? "\u2014",
        renewalRequired: r.renewalRequired,
        defaultValidityMonths: r.defaultValidityMonths ?? null,
        status: r.status,
        scheduledDate: r.scheduledDate ? dateKey(r.scheduledDate) : "\u2014",
        completionDate: r.completionDate ? dateKey(r.completionDate) : "\u2014",
        expiryDate: r.expiryDate ? dateKey(r.expiryDate) : "\u2014",
        trainingHours: r.trainingHours ?? null,
        cpdUnits: r.cpdUnits ?? null,
        provider: r.provider ?? "\u2014"
      }));
    }
    const rows = await db.select({
      nurseId: nurses.id,
      employeeId: nurses.employeeId,
      firstName: nurses.firstName,
      middleName: nurses.middleName,
      lastName: nurses.lastName,
      areaName: areas.name,
      startDate: areaAssignments.startDate,
      endDate: areaAssignments.endDate,
      assignmentType: areaAssignments.assignmentType,
      remarks: areaAssignments.remarks,
      archivedAt: nurses.archivedAt
    }).from(areaAssignments).innerJoin(nurses, eq5(nurses.id, areaAssignments.nurseId)).innerJoin(areas, eq5(areas.id, areaAssignments.areaId)).orderBy(asc3(areaAssignments.startDate), asc3(nurses.lastName));
    const licenseByNurse = await latestLicenseNumbersByNurse(db, rows.map((r) => r.nurseId));
    return rows.map((r) => ({
      nurse: nurseFullName(r),
      nurseId: r.nurseId,
      licenseNumber: licenseByNurse.get(r.nurseId) || r.employeeId,
      areaName: r.areaName,
      startDate: dateKey(r.startDate),
      endDate: r.endDate ? dateKey(r.endDate) : "Present",
      assignmentType: r.assignmentType ?? "\u2014",
      remarks: r.remarks ?? "\u2014"
    }));
  })
});
async function latestLicenseNumbersByNurse(db, nurseIds) {
  const uniqueIds = Array.from(new Set(nurseIds));
  if (uniqueIds.length === 0) return /* @__PURE__ */ new Map();
  const rows = await db.select({ nurseId: nurseCredentials.nurseId, licenseNumber: nurseCredentials.licenseNumber, expiryDate: nurseCredentials.expiryDate }).from(nurseCredentials).where(sql6`${nurseCredentials.nurseId} IN (${sql6.join(uniqueIds.map((id) => sql6`${id}`), sql6`, `)})`);
  const latestByNurse = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const existing = latestByNurse.get(r.nurseId);
    if (!existing || dateKey(r.expiryDate) > dateKey(existing.expiryDate)) latestByNurse.set(r.nurseId, r);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [nurseId, r] of Array.from(latestByNurse)) {
    if (r.licenseNumber) result.set(nurseId, r.licenseNumber);
  }
  return result;
}

// server/routers/settings.ts
import { z as z10 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
import { eq as eq10 } from "drizzle-orm";
init_db();
init_localDb();
init_schema();
init_nursetrack();
init_reminders();
init_nursetrack();

// server/seedExcel.ts
init_db();
init_schema();
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { eq as eq7, and as and6 } from "drizzle-orm";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
function parseSafeDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d2 = /* @__PURE__ */ new Date(s.slice(0, 10) + "T00:00:00");
    if (!isNaN(d2.getTime())) return d2;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const d2 = /* @__PURE__ */ new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}T00:00:00`);
    if (!isNaN(d2.getTime())) return d2;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}
var catalogKey = (name) => name.slice(0, 128).trim().toLowerCase();
async function seedExcelDatabase(dataFilePath) {
  const jsonPath = dataFilePath ?? path2.join(__dirname2, "data", "seedData.json");
  if (!fs2.existsSync(jsonPath)) {
    throw new Error(`Seed data file not found at ${jsonPath}.`);
  }
  const raw = fs2.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection is not available. Please set DATABASE_URL.");
  }
  console.log(`[Seed] Starting seed with ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} events...`);
  console.log("[Seed] Ensuring Credential Types...");
  await db.insert(credentialTypes).values({
    name: "PRC Registered Nurse License",
    issuingOrganizationDefault: "Professional Regulation Commission (PRC)",
    active: true
  }).onConflictDoUpdate({ target: credentialTypes.name, set: { active: true } });
  await db.insert(credentialTypes).values({
    name: "TESDA NC II / PRC Attendant Certification",
    issuingOrganizationDefault: "TESDA / DOH / SPMC",
    active: true
  }).onConflictDoUpdate({ target: credentialTypes.name, set: { active: true } });
  const allCredTypes = await db.select().from(credentialTypes);
  const rnCredTypeId = allCredTypes.find((c) => c.name.includes("Nurse"))?.id ?? 1;
  const naCredTypeId = allCredTypes.find((c) => c.name.includes("TESDA") || c.name.includes("Attendant"))?.id ?? rnCredTypeId;
  console.log("[Seed] Seeding Areas...");
  for (const area of data.areas) {
    await db.insert(areas).values({
      code: area.code,
      name: area.name,
      description: area.description,
      sortOrder: area.sortOrder,
      active: true
    }).onConflictDoUpdate({
      target: areas.code,
      set: {
        name: area.name,
        description: area.description,
        sortOrder: area.sortOrder,
        active: true
      }
    });
  }
  const allAreas = await db.select().from(areas);
  const areaByCode = new Map(allAreas.map((a) => [a.code, a]));
  console.log(`[Seed] Seeding ${data.trainingCatalog.length} Training Catalog items...`);
  const seenCatalogNames = /* @__PURE__ */ new Set();
  for (const item of data.trainingCatalog) {
    const safeName = item.name.slice(0, 128).trim();
    const key = catalogKey(item.name);
    if (seenCatalogNames.has(key)) continue;
    seenCatalogNames.add(key);
    await db.insert(trainingCatalog).values({
      name: safeName,
      category: item.category,
      kind: item.kind,
      renewalRequired: item.renewalRequired,
      defaultValidityMonths: item.defaultValidityMonths ?? null,
      active: true
    }).onConflictDoUpdate({
      target: trainingCatalog.name,
      set: {
        category: item.category,
        kind: item.kind,
        renewalRequired: item.renewalRequired,
        defaultValidityMonths: item.defaultValidityMonths ?? null,
        active: true
      }
    });
  }
  const allCatalog = await db.select().from(trainingCatalog);
  const catalogByName = new Map(allCatalog.map((c) => [catalogKey(c.name), c]));
  console.log(`[Seed] Seeding ${data.staff.length} staff members...`);
  const nurseIdByNormName = /* @__PURE__ */ new Map();
  const nurseIdByEmployeeId = /* @__PURE__ */ new Map();
  const allExistingNurses = await db.select().from(nurses);
  const nurseByName = new Map(
    allExistingNurses.map((n) => [`${n.lastName.trim()} ${n.firstName.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, ""), n])
  );
  for (const person of data.staff) {
    const area = areaByCode.get(person.currentAreaCode) ?? allAreas[0];
    const nameKey = `${person.nameInfo.lastName.trim()} ${person.nameInfo.firstName.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = (await db.select().from(nurses).where(eq7(nurses.employeeId, person.employeeId)).limit(1))[0] ?? nurseByName.get(nameKey);
    let nurseId;
    if (existing) {
      nurseId = existing.id;
      await db.update(nurses).set({
        firstName: person.nameInfo.firstName || person.nameInfo.lastName,
        middleName: person.nameInfo.middleName ?? null,
        lastName: person.nameInfo.lastName,
        suffix: person.nameInfo.suffix ?? null,
        position: person.position,
        staffType: person.staffType,
        employmentStatus: person.employmentStatus,
        currentAreaId: area.id
      }).where(eq7(nurses.id, nurseId));
    } else {
      const res = await db.insert(nurses).values({
        employeeId: person.employeeId,
        firstName: person.nameInfo.firstName || person.nameInfo.lastName,
        middleName: person.nameInfo.middleName ?? null,
        lastName: person.nameInfo.lastName,
        suffix: person.nameInfo.suffix ?? null,
        position: person.position,
        staffType: person.staffType,
        employmentStatus: person.employmentStatus,
        currentAreaId: area.id
      }).returning({ id: nurses.id });
      nurseId = Number(res[0].id);
    }
    const normKey = `${person.nameInfo.lastName.toUpperCase()}, ${person.nameInfo.firstName.toUpperCase()}`;
    nurseIdByEmployeeId.set(person.employeeId, nurseId);
    nurseIdByNormName.set(normKey, nurseId);
    nurseIdByNormName.set(person.nameInfo.lastName.toUpperCase(), nurseId);
    const asgns = await db.select().from(areaAssignments).where(eq7(areaAssignments.nurseId, nurseId)).limit(1);
    if (asgns.length === 0) {
      await db.insert(areaAssignments).values({
        nurseId,
        areaId: area.id,
        startDate: /* @__PURE__ */ new Date("2026-01-01T00:00:00"),
        assignmentType: person.employmentStatus === "Rotated" ? "Rotation" : "Permanent Transfer",
        remarks: person.historyNotes || "Imported from NN LDI Database Summary",
        isCurrent: person.employmentStatus === "Active"
      });
    }
    const expiry = parseSafeDate(person.licenseExpiry);
    if (expiry) {
      const credTypeId = person.staffType === "Registered Nurse" ? rnCredTypeId : naCredTypeId;
      const cycleKey = `${nurseId}-${expiry.toISOString().slice(0, 10)}`;
      const existingCred = await db.select().from(nurseCredentials).where(
        and6(eq7(nurseCredentials.nurseId, nurseId), eq7(nurseCredentials.credentialTypeId, credTypeId))
      ).limit(1);
      if (existingCred.length === 0) {
        await db.insert(nurseCredentials).values({
          nurseId,
          credentialTypeId: credTypeId,
          licenseNumber: person.licenseNumber ?? null,
          issuingOrganization: person.staffType === "Registered Nurse" ? "PRC" : "TESDA / SPMC",
          issueDate: /* @__PURE__ */ new Date("2023-01-01T00:00:00"),
          expiryDate: expiry,
          renewalStatus: "Not Started",
          verificationStatus: "Verified",
          renewalCycleKey: cycleKey,
          remarks: person.historyNotes ?? null
        });
      } else {
        await db.update(nurseCredentials).set({
          licenseNumber: person.licenseNumber ?? existingCred[0].licenseNumber,
          expiryDate: expiry,
          renewalCycleKey: cycleKey
        }).where(eq7(nurseCredentials.id, existingCred[0].id));
      }
    }
  }
  console.log(`[Seed] Seeding ${data.events.length} seminar events and attendances...`);
  let totalAttendances = 0;
  for (const ev of data.events) {
    const catalogItem = catalogByName.get(catalogKey(ev.title));
    if (!catalogItem) continue;
    const startDate = parseSafeDate(ev.startDate) || /* @__PURE__ */ new Date("2026-03-15T00:00:00");
    const endDate = parseSafeDate(ev.endDate) || startDate;
    const existingEvents = await db.select().from(trainingEvents).where(
      and6(
        eq7(trainingEvents.trainingId, catalogItem.id),
        eq7(trainingEvents.startDate, startDate)
      )
    ).limit(1);
    let eventId;
    if (existingEvents.length > 0) {
      eventId = existingEvents[0].id;
    } else {
      const eventRes = await db.insert(trainingEvents).values({
        trainingId: catalogItem.id,
        provider: ev.provider,
        venue: ev.venue,
        startDate,
        endDate,
        targetStaffType: "All",
        remarks: `Conducted by ${ev.provider}`
      }).returning({ id: trainingEvents.id });
      eventId = Number(eventRes[0].id);
    }
    for (const att of ev.attendees) {
      let nurseId = att.employeeId && nurseIdByEmployeeId.get(att.employeeId) || nurseIdByNormName.get(att.normName);
      if (!nurseId) {
        const lastNameToken = att.staffName.split(",")[0]?.trim().toUpperCase();
        if (lastNameToken) nurseId = nurseIdByNormName.get(lastNameToken);
      }
      if (!nurseId) continue;
      const completionDate = parseSafeDate(att.completionDate) || startDate;
      const existingTrainings = await db.select().from(nurseTrainings).where(
        and6(
          eq7(nurseTrainings.nurseId, nurseId),
          eq7(nurseTrainings.trainingId, catalogItem.id),
          eq7(nurseTrainings.completionDate, completionDate)
        )
      ).limit(1);
      if (existingTrainings.length === 0) {
        try {
          await db.insert(nurseTrainings).values({
            nurseId,
            trainingId: catalogItem.id,
            eventId,
            status: "Completed",
            completionDate,
            scheduledDate: startDate,
            provider: ev.provider,
            participationRole: att.role,
            remarks: `Attended ${ev.title}`
          });
          totalAttendances++;
        } catch {
        }
      }
    }
  }
  console.log(`[Seed] Seeding ${data.matrixCompletions?.length ?? 0} matrix training completions...`);
  let matrixCompletionsCount = 0;
  for (const mc of data.matrixCompletions ?? []) {
    const catItem = catalogByName.get(mc.trainingTitle.trim().toLowerCase());
    if (!catItem) continue;
    let nurseId = mc.employeeId && nurseIdByEmployeeId.get(mc.employeeId) || nurseIdByNormName.get(mc.staffName.toUpperCase());
    if (!nurseId) {
      const lastNameToken = mc.staffName.split(",")[0]?.trim().toUpperCase();
      if (lastNameToken) nurseId = nurseIdByNormName.get(lastNameToken);
    }
    if (!nurseId) continue;
    const completionDate = parseSafeDate(mc.completionDate) || /* @__PURE__ */ new Date("2026-01-15T00:00:00");
    const existing = await db.select().from(nurseTrainings).where(
      and6(
        eq7(nurseTrainings.nurseId, nurseId),
        eq7(nurseTrainings.trainingId, catItem.id)
      )
    ).limit(1);
    if (existing.length === 0) {
      try {
        await db.insert(nurseTrainings).values({
          nurseId,
          trainingId: catItem.id,
          status: "Completed",
          completionDate,
          scheduledDate: completionDate,
          provider: mc.provider || "SPMC",
          participationRole: mc.role || "Participant",
          remarks: `Completed ${mc.trainingTitle}`
        });
        matrixCompletionsCount++;
      } catch {
      }
    }
  }
  await db.insert(activityLog).values({
    actionType: "system.seed.excel",
    summary: `Synchronized NN LDI Database Summary: ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} seminar events, ${totalAttendances + matrixCompletionsCount} attendance records.`
  });
  console.log(`[Seed] Complete! Seeded ${data.staff.length} staff, ${data.trainingCatalog.length} catalog items, ${data.events.length} events, and ${totalAttendances + matrixCompletionsCount} total attendances/completions.`);
  return {
    staffCount: data.staff.length,
    catalogCount: data.trainingCatalog.length,
    eventCount: data.events.length,
    attendanceCount: totalAttendances + matrixCompletionsCount
  };
}
var entryPath = process.argv[1]?.replace(/\\/g, "/") ?? "";
var isDirectCliInvocation = /(^|\/)seedExcel(\.[cm]?[jt]s)?$/.test(entryPath);
if (isDirectCliInvocation) {
  seedExcelDatabase().then((res) => {
    console.log("Success:", res);
    process.exit(0);
  }).catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}

// server/routers/settings.ts
init_deduplicate();
function normalizeReminderThresholds(value) {
  const parts = value.split(",").map((s) => s.trim()).filter((s) => s !== "");
  if (parts.length === 0) return null;
  const nums = parts.map(Number);
  if (!nums.every((n) => Number.isInteger(n) && n > 0 && n <= 365)) return null;
  return nums.join(",");
}
var settingKey = z10.enum([
  "appTitle",
  "reminderThresholdDays",
  "orgName",
  "contactEmail"
]);
var settingsRouter = router({
  get: adminProcedure.input(z10.object({ key: settingKey })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(appSettings).where(eq10(appSettings.key, input.key)).limit(1);
    return { key: input.key, value: rows[0]?.value ?? null };
  }),
  getAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(appSettings);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      appTitle: byKey.get("appTitle") ?? "SKTI NurseTrack",
      reminderThresholdDays: byKey.get("reminderThresholdDays") ?? "365,180",
      orgName: byKey.get("orgName") ?? "",
      contactEmail: byKey.get("contactEmail") ?? ""
    };
  }),
  // All four settings in one request: every value is validated first, then written in one transaction.
  updateMany: adminProcedure.input(
    z10.object({
      appTitle: z10.string().trim().max(5e3).nullable(),
      orgName: z10.string().trim().max(5e3).nullable(),
      contactEmail: z10.union([z10.string().trim().email().max(320), z10.literal(""), z10.null()]),
      reminderThresholdDays: z10.string().max(5e3)
    })
  ).mutation(async ({ input }) => {
    const thresholds = normalizeReminderThresholds(input.reminderThresholdDays);
    if (!thresholds) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "Thresholds must be positive integers up to 365, separated by commas (e.g. 365,180)." });
    }
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const values = {
      appTitle: input.appTitle || null,
      orgName: input.orgName || null,
      contactEmail: input.contactEmail || null,
      reminderThresholdDays: thresholds
    };
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(values)) {
        await tx.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
      }
    });
    return { success: true };
  }),
  runRemindersNow: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = await db.select().from(appSettings).where(eq10(appSettings.key, "reminderThresholdDays"));
    const raw = rows[0]?.value ?? "365,180";
    const thresholds = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    const results = await runDailyReminders(todayDate(), thresholds.length ? thresholds : [365, 180]);
    return results;
  }),
  syncExcelDatabase: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const results = await seedExcelDatabase();
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "settings.excel.sync",
      summary: `Synced NN LDI Database: ${results.staffCount} staff, ${results.catalogCount} training catalog items, ${results.eventCount} seminar events, ${results.attendanceCount} attendances.`
    });
    return results;
  }),
  deduplicateDatabase: adminProcedure.mutation(async ({ ctx }) => {
    const results = await deduplicateDatabase();
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "settings.deduplicate",
      summary: `Cleaned database duplicates: merged ${results.mergedNursesGroups} nurse groups, removed ${results.deletedDuplicateNurses} duplicate profiles, ${results.deduplicatedTrainings} duplicate trainings, ${results.deduplicatedCredentials} duplicate credentials.`
    });
    return results;
  }),
  previewCsvImport: adminProcedure.input(z10.object({ csv: z10.string().max(5e5) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = parseCsv(input.csv);
    if (rows.length === 0) throw new TRPCError6({ code: "BAD_REQUEST", message: "CSV is empty or has no valid rows." });
    const header = rows[0];
    const expected = ["employeeId", "firstName", "middleName", "lastName", "suffix", "position", "dateHired", "currentArea"];
    const missing = expected.filter((col) => !header.includes(col));
    if (missing.length > 0) {
      throw new TRPCError6({
        code: "BAD_REQUEST",
        message: `Missing columns: ${missing.join(", ")}. Required: ${expected.join(", ")}.`
      });
    }
    const areaRows = await db.select().from(areas).where(eq10(areas.active, true));
    const areaByName = new Map(areaRows.map((a) => [a.name.toLowerCase(), a]));
    const issues = [];
    const preview = [];
    const dataRows = rows.slice(1);
    const seenIds = /* @__PURE__ */ new Set();
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      if (!r.length) continue;
      const byCol = header.map((h, idx) => [h, (r[idx] ?? "").trim()]);
      const get = (col) => byCol.find(([h]) => h === col)?.[1] ?? "";
      const employeeId = get("employeeId");
      const firstName = get("firstName");
      const lastName = get("lastName");
      const suffix = get("suffix");
      if (!employeeId || !firstName || !lastName) {
        preview.push({ row: i + 2, employeeId, name: `${firstName} ${lastName}`, valid: false, note: "Missing required name/ID fields." });
        issues.push(`Row ${i + 2}: missing required fields.`);
        continue;
      }
      if (seenIds.has(employeeId)) {
        preview.push({ row: i + 2, employeeId, name: nurseFullName({ firstName, middleName: get("middleName"), lastName, suffix }), valid: false, note: "Duplicate Employee ID within file." });
        issues.push(`Row ${i + 2}: duplicate Employee ID.`);
        continue;
      }
      const existing = await getNurseByEmployeeId(employeeId);
      if (existing) {
        preview.push({ row: i + 2, employeeId, name: nurseFullName({ firstName, middleName: get("middleName"), lastName, suffix }), valid: false, note: "Employee ID already exists." });
        issues.push(`Row ${i + 2}: Employee ID already exists.`);
        continue;
      }
      seenIds.add(employeeId);
      const areaName = get("currentArea");
      const area = areaByName.get(areaName.toLowerCase());
      if (!area) {
        preview.push({ row: i + 2, employeeId, name: nurseFullName({ firstName, middleName: get("middleName"), lastName, suffix }), valid: false, note: `Area "${areaName}" not found.` });
        issues.push(`Row ${i + 2}: area "${areaName}" not found.`);
        continue;
      }
      preview.push({ row: i + 2, employeeId, name: nurseFullName({ firstName, middleName: get("middleName"), lastName, suffix }), valid: true, note: `\u2192 ${area.name}` });
    }
    return { totalRows: dataRows.length, validRows: preview.filter((p) => p.valid).length, issues: issues.slice(0, 50), preview: preview.slice(0, 200) };
  }),
  executeCsvImport: adminProcedure.input(z10.object({ csv: z10.string().max(5e5), skipInvalid: z10.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const rows = parseCsv(input.csv);
    if (rows.length === 0) throw new TRPCError6({ code: "BAD_REQUEST", message: "CSV is empty." });
    const header = rows[0];
    const get = (r, col) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? (r[idx] ?? "").trim() : "";
    };
    const areaRows = await db.select().from(areas).where(eq10(areas.active, true));
    const areaByName = new Map(areaRows.map((a) => [a.name.toLowerCase(), a]));
    const results = { imported: 0, skipped: 0, errors: [] };
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.length) continue;
      const employeeId = get(r, "employeeId");
      const firstName = get(r, "firstName");
      const lastName = get(r, "lastName");
      if (!employeeId || !firstName || !lastName) {
        results.skipped++;
        continue;
      }
      if (await getNurseByEmployeeId(employeeId)) {
        results.skipped++;
        continue;
      }
      const area = areaByName.get(get(r, "currentArea").toLowerCase());
      if (!area) {
        results.skipped++;
        continue;
      }
      const id = await createNurse({
        employeeId,
        firstName,
        middleName: get(r, "middleName") || null,
        lastName,
        suffix: get(r, "suffix") || null,
        position: get(r, "position") || null,
        dateHired: get(r, "dateHired") ? /* @__PURE__ */ new Date(`${get(r, "dateHired")}T00:00:00`) : null,
        employmentStatus: "Active",
        currentAreaId: area.id
      });
      await createAssignment({ nurseId: id, areaId: area.id, startDate: /* @__PURE__ */ new Date(), assignmentType: "Imported", isCurrent: true });
      results.imported++;
    }
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "settings.csv.import",
      entityType: "nurse",
      summary: `CSV import completed: ${results.imported} imported, ${results.skipped} skipped`
    });
    return results;
  }),
  exportData: adminProcedure.input(z10.object({ entity: z10.enum(["nurses", "credentials", "trainings", "assignments", "all"]) })).query(async ({ input }) => {
    const db = await getDb();
    const out = {};
    if (db) {
      const fetches = [];
      if (input.entity === "nurses" || input.entity === "all") {
        fetches.push(db.select().from(nurses).then((r) => {
          out.nurses = r;
        }));
      }
      if (input.entity === "credentials" || input.entity === "all") {
        fetches.push(db.select().from(nurseCredentials).then((r) => {
          out.nurseCredentials = r;
        }));
      }
      if (input.entity === "trainings" || input.entity === "all") {
        fetches.push(db.select().from(nurseTrainings).then((r) => {
          out.nurseTrainings = r;
        }));
      }
      if (input.entity === "assignments" || input.entity === "all") {
        fetches.push(db.select().from(areaAssignments).then((r) => {
          out.areaAssignments = r;
        }));
      }
      await Promise.all(fetches);
      return out;
    }
    const sqlite = getSqliteDb();
    if (input.entity === "nurses" || input.entity === "all") {
      out.nurses = sqlite.prepare("SELECT * FROM nurses").all();
    }
    if (input.entity === "credentials" || input.entity === "all") {
      out.nurseCredentials = sqlite.prepare("SELECT * FROM nurseCredentials").all();
    }
    if (input.entity === "trainings" || input.entity === "all") {
      out.nurseTrainings = sqlite.prepare("SELECT * FROM nurseTrainings").all();
    }
    if (input.entity === "assignments" || input.entity === "all") {
      out.areaAssignments = sqlite.prepare("SELECT * FROM areaAssignments").all();
    }
    return out;
  }),
  emailStatus: adminProcedure.query(async () => {
    const hasKey = Boolean(process.env.RESEND_API_KEY);
    const fromAddress = process.env.EMAIL_FROM || "SKTI NurseTrack <onboarding@resend.dev>";
    return {
      configured: hasKey,
      mode: hasKey ? "live" : "mock",
      fromAddress
    };
  }),
  sendTestEmail: adminProcedure.input(z10.object({ targetEmail: z10.string().email() })).mutation(async ({ ctx, input }) => {
    const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_service(), service_exports));
    const { renderDirectNoticeEmail: renderDirectNoticeEmail2 } = await Promise.resolve().then(() => (init_templates(), templates_exports));
    const html = renderDirectNoticeEmail2({
      nurseName: ctx.user.name || "Administrator",
      subject: "SKTI NurseTrack \u2014 Test Notification",
      message: "This is a test notification confirming your email dispatch configuration is active and working properly.",
      actionUrl: process.env.APP_URL || "http://localhost:3000"
    });
    const res = await sendEmail2({
      to: input.targetEmail,
      subject: "SKTI NurseTrack \u2014 Email Configuration Test",
      html,
      nurseId: 0,
      emailType: "manual_notice",
      thresholdKey: "test"
    });
    return res;
  }),
  triggerEmailPassNow: adminProcedure.mutation(async () => {
    const { acquireReminderLock: acquireReminderLock2, releaseReminderLock: releaseReminderLock2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const acquired = await acquireReminderLock2();
    if (!acquired) {
      throw new TRPCError6({ code: "CONFLICT", message: "Another email or reminder pass is currently in progress." });
    }
    try {
      const { runLicenseExpiryEmailPass: runLicenseExpiryEmailPass2, runUpcomingSeminarEmailPass: runUpcomingSeminarEmailPass2 } = await Promise.resolve().then(() => (init_dispatcher(), dispatcher_exports));
      const { getManilaDateKey: getManilaDateKey2 } = await Promise.resolve().then(() => (init_scheduled(), scheduled_exports));
      const today = getManilaDateKey2();
      const expiry = await runLicenseExpiryEmailPass2(today);
      const seminars = await runUpcomingSeminarEmailPass2();
      return { expiry, seminars };
    } finally {
      await releaseReminderLock2();
    }
  }),
  listEmailLogs: adminProcedure.input(z10.object({ limit: z10.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    const { listRecentEmailLogs: listRecentEmailLogs2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    return listRecentEmailLogs2(input?.limit ?? 50);
  })
});
function parseCsv(text2) {
  const lines = text2.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  });
}

// server/routers/seminars.ts
init_schema();
init_nursetrack();
import { TRPCError as TRPCError7 } from "@trpc/server";
import { and as and8, asc as asc4, desc as desc5, eq as eq11, gte as gte3, isNull as isNull9, lte as lte4, notInArray } from "drizzle-orm";
import { z as z11 } from "zod";
init_db();
init_localDb();
init_trainingReminders();
var dateString = z11.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Invalid calendar date.");
var dateInput2 = z11.union([z11.date(), dateString]).transform(
  (value) => value instanceof Date ? value : /* @__PURE__ */ new Date(`${value.slice(0, 10)}T00:00:00`)
);
var optionalDateInput = dateInput2.optional();
var attendanceStatuses = ["Scheduled", "Completed", "Expired", "Cancelled"];
var inactiveStatuses = [
  "Archived",
  "Resigned",
  "Retired",
  "Transferred",
  "Rotated"
];
function validateRange(startDate, endDate) {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new TRPCError7({ code: "BAD_REQUEST", message: "Invalid seminar date." });
  }
  if (endDate < startDate) {
    throw new TRPCError7({ code: "BAD_REQUEST", message: "End date cannot be before start date." });
  }
}
var seminarsRouter = router({
  list: adminProcedure.input(z11.object({ from: optionalDateInput, to: optionalDateInput }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return getLocalSeminarsList(input);
    }
    const conditions = [];
    if (input?.from) conditions.push(gte3(trainingEvents.endDate, input.from));
    if (input?.to) conditions.push(lte4(trainingEvents.startDate, input.to));
    const rows = await db.select({ event: trainingEvents, training: trainingCatalog }).from(trainingEvents).innerJoin(trainingCatalog, eq11(trainingCatalog.id, trainingEvents.trainingId)).where(conditions.length ? and8(...conditions) : void 0).orderBy(desc5(trainingEvents.startDate), asc4(trainingCatalog.name));
    const records = await db.select({ eventId: nurseTrainings.eventId, status: nurseTrainings.status }).from(nurseTrainings);
    const counts = /* @__PURE__ */ new Map();
    for (const record of records) {
      if (!record.eventId) continue;
      const count = counts.get(record.eventId) ?? { total: 0, completed: 0 };
      count.total++;
      if (record.status === "Completed") count.completed++;
      counts.set(record.eventId, count);
    }
    return rows.map((row) => ({ ...row, attendance: counts.get(row.event.id) ?? { total: 0, completed: 0 } }));
  }),
  create: adminProcedure.input(z11.object({
    trainingId: z11.number().int().positive(),
    provider: z11.string().max(128).optional(),
    venue: z11.string().max(256).optional(),
    startDate: dateInput2,
    endDate: dateInput2,
    startTime: z11.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    endTime: z11.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    targetStaffType: z11.enum(TARGET_STAFF_TYPES).optional(),
    remarks: z11.string().max(2e3).optional()
  })).mutation(async ({ ctx, input }) => {
    validateRange(input.startDate, input.endDate);
    if (dateKey(input.startDate) === dateKey(input.endDate) && input.startTime && input.endTime && input.endTime < input.startTime) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "End time cannot be before start time." });
    }
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [training] = await db.select().from(trainingCatalog).where(eq11(trainingCatalog.id, input.trainingId)).limit(1);
    if (!training) throw new TRPCError7({ code: "NOT_FOUND", message: "Training catalog item not found." });
    const result = await db.insert(trainingEvents).values({
      ...input,
      provider: input.provider ?? null,
      venue: input.venue ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      targetStaffType: input.targetStaffType ?? "All",
      remarks: input.remarks ?? null
    }).returning({ id: trainingEvents.id });
    const id = Number(result[0].id);
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "seminar.created",
      entityType: "trainingEvent",
      entityId: id,
      summary: `${training.kind} scheduled: ${training.name} (${dateKey(input.startDate)})`
    });
    return { id };
  }),
  update: adminProcedure.input(z11.object({
    id: z11.number().int().positive(),
    provider: z11.string().max(128).optional().nullable(),
    venue: z11.string().max(256).optional().nullable(),
    startDate: dateInput2.optional(),
    endDate: dateInput2.optional(),
    startTime: z11.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
    endTime: z11.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
    targetStaffType: z11.enum(TARGET_STAFF_TYPES).optional(),
    remarks: z11.string().max(2e3).optional().nullable()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      const sqlite = getSqliteDb();
      const existing2 = sqlite.prepare("SELECT * FROM trainingEvents WHERE id = ?").get(input.id);
      if (!existing2) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      const start = input.startDate ? dateKey(input.startDate) : existing2.startDate;
      const end = input.endDate ? dateKey(input.endDate) : existing2.endDate;
      if (start && end && end < start) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "End date cannot be before start date." });
      }
      sqlite.prepare(`
          UPDATE trainingEvents
          SET provider = ?, venue = ?, startDate = ?, endDate = ?, startTime = ?, endTime = ?, targetStaffType = ?, remarks = ?
          WHERE id = ?
        `).run(
        input.provider !== void 0 ? input.provider : existing2.provider,
        input.venue !== void 0 ? input.venue : existing2.venue,
        start,
        end,
        input.startTime !== void 0 ? input.startTime : existing2.startTime,
        input.endTime !== void 0 ? input.endTime : existing2.endTime,
        input.targetStaffType ?? existing2.targetStaffType,
        input.remarks !== void 0 ? input.remarks : existing2.remarks,
        input.id
      );
      return { success: true };
    }
    const [existing] = await db.select().from(trainingEvents).where(eq11(trainingEvents.id, input.id)).limit(1);
    if (!existing) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    validateRange(startDate, endDate);
    const startTime = input.startTime !== void 0 ? input.startTime : existing.startTime;
    const endTime = input.endTime !== void 0 ? input.endTime : existing.endTime;
    if (dateKey(startDate) === dateKey(endDate) && startTime && endTime && endTime < startTime) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "End time cannot be before start time." });
    }
    await db.update(trainingEvents).set({
      provider: input.provider !== void 0 ? input.provider : existing.provider,
      venue: input.venue !== void 0 ? input.venue : existing.venue,
      startDate,
      endDate,
      startTime,
      endTime,
      targetStaffType: input.targetStaffType ?? existing.targetStaffType,
      remarks: input.remarks !== void 0 ? input.remarks : existing.remarks
    }).where(eq11(trainingEvents.id, input.id));
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "seminar.updated",
      entityType: "trainingEvent",
      entityId: input.id,
      summary: `Seminar updated (event #${input.id})`
    });
    return { success: true };
  }),
  deleteEvent: adminProcedure.input(z11.object({ eventId: z11.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteTrainingEvent(input.eventId);
    if (!deleted) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
    await logActivity({
      supervisorId: ctx.user.id,
      actionType: "seminar.deleted",
      entityType: "trainingEvent",
      entityId: input.eventId,
      summary: `${deleted.training.kind} permanently deleted: ${deleted.training.name} (${dateKey(deleted.event.startDate)}), including ${deleted.attendanceDeleted} attendance record(s)`
    });
    return { success: true, attendanceDeleted: deleted.attendanceDeleted };
  }),
  detail: adminProcedure.input(z11.object({ eventId: z11.number().int().positive() })).query(async ({ input }) => {
    const pg = getBatchClient();
    if (pg) {
      const queries = [
        `select te.id, te."trainingId", te.provider, te.venue,
                  te."startDate"::text as "startDate", te."endDate"::text as "endDate",
                  te."startTime", te."endTime", te."targetStaffType", te.remarks,
                  tc.id as "catalogId", tc.name as "catalogName", tc.category as "catalogCategory", tc.kind as "catalogKind"
             from nursetrack."trainingEvents" te
            inner join nursetrack."trainingCatalog" tc on tc.id = te."trainingId"
            where te.id = ${input.eventId}
            limit 1`,
        `select t.id, t."nurseId", t."trainingId", t."eventId", t."participationRole",
                  t."completionDate"::text as "completionDate", t."scheduledDate"::text as "scheduledDate",
                  t.status, t."trainingHours", t."cpdUnits", t.remarks
             from nursetrack."nurseTrainings" t
            where t."eventId" = ${input.eventId}
            order by t."completionDate" desc nulls last`,
        `select t.id, t."nurseId", t."trainingId", t."eventId", t."participationRole",
                  t."completionDate"::text as "completionDate", t."scheduledDate"::text as "scheduledDate",
                  t.status, t."trainingHours", t."cpdUnits", t.remarks
             from nursetrack."nurseTrainings" t
            where t."trainingId" = (select "trainingId" from nursetrack."trainingEvents" where id = ${input.eventId})
            order by t."completionDate" desc nulls last`,
        `select n.id, n."firstName", n."middleName", n."lastName", n.suffix,
                  n."staffType", n."employmentStatus", n."currentAreaId", n."archivedAt"
             from nursetrack.nurses n
            order by n."lastName" asc, n."firstName" asc`,
        `select a.id, a.name from nursetrack.areas a order by a."sortOrder"`,
        `select e.id, e."startDate"::text as "startDate", e."endDate"::text as "endDate"
             from nursetrack."trainingEvents" e
            where e."trainingId" = (select "trainingId" from nursetrack."trainingEvents" where id = ${input.eventId})`
      ];
      const sets = await pg.unsafe(queries.join(";\n")).simple();
      const [selectedRows, records2, allTrainingRecords2, staff2, areaRows2, relatedEvents2] = sets;
      const selected2 = selectedRows[0];
      if (!selected2) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      const staffById2 = new Map(staff2.map((person) => [person.id, person]));
      const areaById2 = new Map(areaRows2.map((area) => [area.id, area]));
      const attendees2 = records2.map((record) => {
        const person = staffById2.get(record.nurseId);
        return {
          ...record,
          staffName: person ? nurseFullName(person) : "Unknown staff",
          staffType: person?.staffType ?? "Registered Nurse",
          areaName: person?.currentAreaId ? areaById2.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned"
        };
      });
      const eventById2 = new Map(relatedEvents2.map((event) => [event.id, event]));
      const allAttendees2 = allTrainingRecords2.map((record) => {
        const person = staffById2.get(record.nurseId);
        const occurrence = record.eventId ? eventById2.get(record.eventId) : void 0;
        return {
          ...record,
          staffName: person ? nurseFullName(person) : "Unknown staff",
          staffType: person?.staffType ?? "Registered Nurse",
          areaName: person?.currentAreaId ? areaById2.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
          occurrenceStartDate: occurrence?.startDate ?? record.scheduledDate,
          occurrenceEndDate: occurrence?.endDate ?? record.scheduledDate
        };
      });
      const completedIds2 = new Set(records2.filter((record) => record.status === "Completed").map((record) => record.nurseId));
      const inactive2 = new Set(inactiveStatuses);
      const missing2 = staff2.filter((person) => !person.archivedAt).filter((person) => !inactive2.has(person.employmentStatus)).filter((person) => selected2.targetStaffType === "All" || person.staffType === selected2.targetStaffType).filter((person) => !completedIds2.has(person.id)).map((person) => ({
        id: person.id,
        staffName: nurseFullName(person),
        staffType: person.staffType,
        areaName: person.currentAreaId ? areaById2.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned"
      }));
      return {
        event: {
          id: selected2.id,
          trainingId: selected2.trainingId,
          provider: selected2.provider,
          venue: selected2.venue,
          startDate: selected2.startDate,
          endDate: selected2.endDate,
          startTime: selected2.startTime,
          endTime: selected2.endTime,
          targetStaffType: selected2.targetStaffType,
          remarks: selected2.remarks
        },
        training: {
          id: selected2.catalogId,
          name: selected2.catalogName,
          category: selected2.catalogCategory,
          kind: selected2.catalogKind
        },
        attendees: attendees2,
        allAttendees: allAttendees2,
        missing: missing2
      };
    }
    const db = await getDb();
    if (!db) {
      const detail = getLocalSeminarDetail(input.eventId);
      if (!detail) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      return detail;
    }
    const [selected] = await db.select({ event: trainingEvents, training: trainingCatalog }).from(trainingEvents).innerJoin(trainingCatalog, eq11(trainingCatalog.id, trainingEvents.trainingId)).where(eq11(trainingEvents.id, input.eventId)).limit(1);
    if (!selected) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
    const [records, allTrainingRecords, staff, areaRows, relatedEvents] = await Promise.all([
      db.select().from(nurseTrainings).where(eq11(nurseTrainings.eventId, input.eventId)).orderBy(desc5(nurseTrainings.completionDate)),
      db.select().from(nurseTrainings).where(eq11(nurseTrainings.trainingId, selected.training.id)).orderBy(desc5(nurseTrainings.completionDate)),
      db.select().from(nurses).orderBy(asc4(nurses.lastName), asc4(nurses.firstName)),
      db.select().from(areas),
      db.select().from(trainingEvents).where(eq11(trainingEvents.trainingId, selected.training.id))
    ]);
    const staffById = new Map(staff.map((person) => [person.id, person]));
    const areaById = new Map(areaRows.map((area) => [area.id, area]));
    const attendees = records.map((record) => {
      const person = staffById.get(record.nurseId);
      return {
        ...record,
        staffName: person ? nurseFullName(person) : "Unknown staff",
        staffType: person?.staffType ?? "Registered Nurse",
        areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned"
      };
    });
    const eventById = new Map(relatedEvents.map((event) => [event.id, event]));
    const allAttendees = allTrainingRecords.map((record) => {
      const person = staffById.get(record.nurseId);
      const occurrence = record.eventId ? eventById.get(record.eventId) : void 0;
      return {
        ...record,
        staffName: person ? nurseFullName(person) : "Unknown staff",
        staffType: person?.staffType ?? "Registered Nurse",
        areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
        occurrenceStartDate: occurrence?.startDate ?? record.scheduledDate,
        occurrenceEndDate: occurrence?.endDate ?? record.scheduledDate
      };
    });
    const completedIds = new Set(records.filter((record) => record.status === "Completed").map((record) => record.nurseId));
    const inactive = new Set(inactiveStatuses);
    const missing = staff.filter((person) => !person.archivedAt).filter((person) => !inactive.has(person.employmentStatus)).filter((person) => selected.event.targetStaffType === "All" || person.staffType === selected.event.targetStaffType).filter((person) => !completedIds.has(person.id)).map((person) => ({
      id: person.id,
      staffName: nurseFullName(person),
      staffType: person.staffType,
      areaName: person.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned"
    }));
    return { ...selected, attendees, allAttendees, missing };
  }),
  addAttendance: adminProcedure.input(z11.object({
    eventId: z11.number().int().positive(),
    nurseId: z11.number().int().positive(),
    status: z11.enum(attendanceStatuses).default("Scheduled"),
    completionDate: optionalDateInput,
    participationRole: z11.enum(PARTICIPATION_ROLES).default("Participant"),
    trainingHours: z11.number().int().positive().optional(),
    cpdUnits: z11.number().int().positive().optional(),
    certificateNumber: z11.string().max(64).optional(),
    expiryDate: optionalDateInput,
    remarks: z11.string().max(2e3).optional(),
    conflictOverrideReason: z11.string().max(1e3).optional()
  }).superRefine((value, ctx) => {
    if ((value.status === "Completed" || value.status === "Expired") && !value.completionDate) {
      ctx.addIssue({ code: z11.ZodIssueCode.custom, path: ["completionDate"], message: "Completion date is required for completed attendance." });
    }
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [event] = await db.select().from(trainingEvents).where(eq11(trainingEvents.id, input.eventId)).limit(1);
    if (!event) throw new TRPCError7({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
    const [person] = await db.select().from(nurses).where(eq11(nurses.id, input.nurseId)).limit(1);
    if (!person) throw new TRPCError7({ code: "NOT_FOUND", message: "Staff member not found." });
    if (person.archivedAt || inactiveStatuses.includes(person.employmentStatus)) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Attendance can only be added for active staff." });
    }
    if (event.targetStaffType !== "All" && event.targetStaffType !== person.staffType) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Staff type does not match this seminar audience." });
    }
    if (input.completionDate && (input.completionDate < /* @__PURE__ */ new Date(`${dateKey(event.startDate)}T00:00:00`) || input.completionDate > /* @__PURE__ */ new Date(`${dateKey(event.endDate)}T23:59:59`))) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Completion date must fall within seminar dates." });
    }
    if (input.completionDate && input.expiryDate && input.expiryDate < input.completionDate) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Expiry date cannot be before completion date." });
    }
    const duplicate = await db.select({ id: nurseTrainings.id }).from(nurseTrainings).where(and8(eq11(nurseTrainings.eventId, input.eventId), eq11(nurseTrainings.nurseId, input.nurseId))).limit(1);
    if (duplicate.length) throw new TRPCError7({ code: "CONFLICT", message: "Staff member is already listed for this seminar." });
    const startDateStr = dateKey(event.startDate);
    const endDateStr = dateKey(event.endDate);
    if (input.status === "Scheduled") {
      const conflictRes = await checkTrainingConflicts(
        input.nurseId,
        startDateStr,
        endDateStr,
        event.startTime,
        event.endTime
      );
      if (conflictRes.hasConflict && !conflictRes.warningOnly) {
        if (!input.conflictOverrideReason || input.conflictOverrideReason.trim().length === 0) {
          throw new TRPCError7({
            code: "CONFLICT",
            message: `Scheduling conflict detected with: ${conflictRes.conflicts.map((c) => c.trainingName).join(", ")}. Override reason is required to proceed.`
          });
        }
      }
    }
    const id = await db.transaction(async (tx) => {
      const result = await tx.insert(nurseTrainings).values({
        nurseId: input.nurseId,
        trainingId: event.trainingId,
        eventId: input.eventId,
        status: input.status,
        completionDate: input.completionDate ?? null,
        scheduledDate: event.startDate,
        provider: event.provider,
        participationRole: input.participationRole,
        trainingHours: input.trainingHours ?? null,
        cpdUnits: input.cpdUnits ?? null,
        certificateNumber: input.certificateNumber ?? null,
        expiryDate: input.expiryDate ?? null,
        remarks: input.remarks ?? null,
        scheduleVersion: 1,
        staffResponse: "Pending",
        evidenceRequired: true,
        conflictOverrideReason: input.conflictOverrideReason ?? null,
        conflictOverrideBy: input.conflictOverrideReason ? ctx.user.id : null
      }).returning({ id: nurseTrainings.id });
      const newId = Number(result[0].id);
      await tx.insert(activityLog).values({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "seminar.attendance.added",
        entityType: "nurseTraining",
        entityId: newId,
        summary: `Seminar attendance added for ${nurseFullName(person)}`
      });
      return newId;
    });
    if (input.status === "Scheduled") {
      try {
        const noticeItem = await enqueueTrainingNotice({
          assignmentId: id,
          scheduleVersion: 1,
          noticeKind: "assigned",
          recipientNurseId: input.nurseId,
          actorUserId: ctx.user.id
        });
        await createMilestonesForAssignment({
          assignmentId: id,
          scheduleVersion: 1,
          startDateStr,
          recipientNurseId: input.nurseId
        });
        if (noticeItem?.id) {
          await dispatchSingleOutboxItem(noticeItem.id).catch(() => {
          });
        }
      } catch (noticeErr) {
        console.warn("[Seminars] Failed to enqueue training notice:", noticeErr);
      }
    }
    return { id };
  }),
  removeAttendance: adminProcedure.input(z11.object({ attendanceId: z11.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const existing = await getNurseTrainingById(input.attendanceId);
    if (!existing) throw new TRPCError7({ code: "NOT_FOUND", message: "Attendance record not found." });
    if (existing.eventId == null) {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "That record is not seminar attendance." });
    }
    const record = await deleteNurseTraining(input.attendanceId);
    if (!record) throw new TRPCError7({ code: "NOT_FOUND", message: "Attendance record not found." });
    if (record.certificateKey) {
      await storageDelete(record.certificateKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user.id,
      nurseId: record.nurseId,
      actionType: "seminar.attendance.deleted",
      entityType: "nurseTraining",
      entityId: input.attendanceId,
      summary: `Seminar attendance record #${input.attendanceId} removed`
    });
    return { success: true };
  }),
  matrix: adminProcedure.input(z11.object({
    from: optionalDateInput,
    to: optionalDateInput,
    staffType: z11.enum(STAFF_TYPES).optional(),
    areaId: z11.number().int().positive().optional()
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return getLocalSeminarMatrix(input);
    }
    const staffConditions = [isNull9(nurses.archivedAt), notInArray(nurses.employmentStatus, inactiveStatuses)];
    if (input?.staffType) staffConditions.push(eq11(nurses.staffType, input.staffType));
    if (input?.areaId) staffConditions.push(eq11(nurses.currentAreaId, input.areaId));
    const eventConditions = [];
    if (input?.from) eventConditions.push(gte3(trainingEvents.endDate, input.from));
    if (input?.to) eventConditions.push(lte4(trainingEvents.startDate, input.to));
    const [staff, events, records] = await Promise.all([
      db.select().from(nurses).where(and8(...staffConditions)).orderBy(asc4(nurses.lastName), asc4(nurses.firstName)),
      db.select({ event: trainingEvents, training: trainingCatalog }).from(trainingEvents).innerJoin(trainingCatalog, eq11(trainingCatalog.id, trainingEvents.trainingId)).where(eventConditions.length ? and8(...eventConditions) : void 0).orderBy(asc4(trainingEvents.startDate), asc4(trainingCatalog.name)),
      db.select().from(nurseTrainings)
    ]);
    const eventIds = new Set(events.map((item) => item.event.id));
    const staffIds = new Set(staff.map((person) => person.id));
    return {
      staff: staff.map((person) => ({ id: person.id, name: nurseFullName(person), staffType: person.staffType, areaId: person.currentAreaId })),
      events,
      records: records.filter((record) => record.eventId && eventIds.has(record.eventId) && staffIds.has(record.nurseId))
    };
  }),
  monthlySummary: adminProcedure.input(z11.object({ year: z11.number().int().min(2e3).max(2100) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return getLocalMonthlySummary(input.year);
    }
    const [records, staff] = await Promise.all([
      db.select().from(nurseTrainings).where(eq11(nurseTrainings.status, "Completed")),
      db.select().from(nurses).where(and8(isNull9(nurses.archivedAt), notInArray(nurses.employmentStatus, inactiveStatuses))).orderBy(asc4(nurses.lastName), asc4(nurses.firstName))
    ]);
    return staff.map((person) => {
      const months = Array.from({ length: 12 }, () => 0);
      for (const record of records) {
        if (record.nurseId !== person.id || !record.completionDate) continue;
        const key = dateKey(record.completionDate);
        if (Number(key.slice(0, 4)) === input.year) months[Number(key.slice(5, 7)) - 1]++;
      }
      return { nurseId: person.id, staffName: nurseFullName(person), months, h1: months.slice(0, 6).reduce((a, b) => a + b, 0), h2: months.slice(6).reduce((a, b) => a + b, 0) };
    });
  }),
  quarterlyLedger: adminProcedure.input(z11.object({ year: z11.number().int().min(2e3).max(2100), quarter: z11.number().int().min(1).max(4) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return getLocalQuarterlyLedger(input.year, input.quarter);
    }
    const startMonth = (input.quarter - 1) * 3;
    const from = new Date(input.year, startMonth, 1);
    const to = new Date(input.year, startMonth + 3, 0);
    const rows = await db.select({ record: nurseTrainings, person: nurses, event: trainingEvents, training: trainingCatalog }).from(nurseTrainings).innerJoin(nurses, eq11(nurses.id, nurseTrainings.nurseId)).leftJoin(trainingEvents, eq11(trainingEvents.id, nurseTrainings.eventId)).innerJoin(trainingCatalog, eq11(trainingCatalog.id, nurseTrainings.trainingId)).where(and8(eq11(nurseTrainings.status, "Completed"), gte3(nurseTrainings.completionDate, from), lte4(nurseTrainings.completionDate, to))).orderBy(asc4(nurseTrainings.completionDate), asc4(nurses.lastName), asc4(trainingCatalog.name));
    return rows.map((row) => ({
      recordId: row.record.id,
      nurseId: row.person.id,
      staffName: nurseFullName(row.person),
      trainingName: row.training.name,
      kind: row.training.kind,
      provider: row.event?.provider ?? row.record.provider,
      venue: row.event?.venue ?? null,
      startDate: row.event ? dateKey(row.event.startDate) : dateKey(row.record.completionDate),
      endDate: row.event ? dateKey(row.event.endDate) : dateKey(row.record.completionDate),
      completionDate: dateKey(row.record.completionDate),
      participationRole: row.record.participationRole
    }));
  })
});

// server/routers/staffAccount.ts
init_const();
import { z as z12 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";

// server/_core/rateLimit.ts
var windows = /* @__PURE__ */ new Map();
function checkRateLimit(key, opts) {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= opts.max;
}

// server/routers/staffAccount.ts
init_sdk();
init_db();

// server/memosDb.ts
init_schema();
init_nursetrack();
init_db();
init_localDb();
import { and as and9, desc as desc6, eq as eq12, inArray as inArray4, isNull as isNull10, not as not5, sql as sql11 } from "drizzle-orm";
var TITLE_MAX = 256;
var BODY_MAX = 8e3;
function sanitizePlainText(value, max) {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}
function assertMemoType(memoType) {
  if (!MEMO_TYPES.includes(memoType)) {
    throw new Error("Memo type must be department, nursing, or hospital.");
  }
  return memoType;
}
function validateAudienceInput(memoType, areaId) {
  if (memoType === "department") {
    if (!areaId || areaId < 1) throw new Error("Department memo requires an area.");
    return;
  }
  if (areaId != null) throw new Error("Nursing and hospital memos cannot target an area.");
}
async function store() {
  const db = await getDb();
  if (db) return { kind: "pg", db };
  return { kind: "sqlite", sqlite: getSqliteDb() };
}
function sqliteAudienceWhere(memoType, areaId) {
  let extra = "";
  const params = [];
  if (memoType === "department") {
    extra = " AND currentAreaId = ?";
    params.push(areaId);
  }
  return {
    sql: `archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST})${extra}`,
    params
  };
}
async function previewAudience(input) {
  const memoType = assertMemoType(input.memoType);
  validateAudienceInput(memoType, input.areaId);
  const audience = await listAudience(memoType, input.areaId);
  let areaName = null;
  if (memoType === "department" && input.areaId) {
    areaName = await getAreaName(input.areaId);
  }
  return {
    count: audience.length,
    areaName,
    sample: audience.slice(0, 8).map((n) => ({ id: n.id, name: nurseFullName(n) }))
  };
}
async function getAreaName(areaId) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db.select({ name: areas.name }).from(areas).where(eq12(areas.id, areaId)).limit(1);
    return rows[0]?.name ?? null;
  }
  const row = s.sqlite.prepare("SELECT name FROM areas WHERE id = ?").get(areaId);
  return row?.name ?? null;
}
async function listAudience(memoType, areaId) {
  const s = await store();
  if (s.kind === "pg") {
    const conds = [isNull10(nurses.archivedAt), not5(inArray4(nurses.employmentStatus, INACTIVE_EMPLOYMENT_STATUSES))];
    if (memoType === "department") conds.push(eq12(nurses.currentAreaId, areaId));
    const rows = await s.db.select({
      id: nurses.id,
      firstName: nurses.firstName,
      lastName: nurses.lastName,
      currentAreaId: nurses.currentAreaId,
      linkedUserId: nurses.linkedUserId,
      staffType: nurses.staffType
    }).from(nurses).where(and9(...conds));
    return rows;
  }
  const where = sqliteAudienceWhere(memoType, areaId);
  return s.sqlite.prepare(
    `SELECT id, firstName, lastName, currentAreaId, linkedUserId, staffType FROM nurses WHERE ${where.sql} ORDER BY lastName, firstName`
  ).all(...where.params);
}
async function createMemo(input) {
  const memoType = assertMemoType(input.memoType);
  validateAudienceInput(memoType, input.areaId);
  const title = sanitizePlainText(input.title, TITLE_MAX);
  const body = sanitizePlainText(input.body, BODY_MAX);
  if (!title) throw new Error("Title is required.");
  if (!body) throw new Error("Body is required.");
  if (memoType === "department") {
    const name = await getAreaName(input.areaId);
    if (!name) throw new Error("Area not found.");
  }
  const audience = await listAudience(memoType, input.areaId);
  const s = await store();
  let memoId;
  if (s.kind === "pg") {
    const inserted = await s.db.insert(memos).values({
      memoType,
      areaId: memoType === "department" ? input.areaId : null,
      title,
      body,
      authorUserId: input.authorUserId,
      status: "sent"
    }).returning({ id: memos.id });
    memoId = inserted[0].id;
    if (audience.length > 0) {
      await s.db.insert(memoRecipients).values(
        audience.map((n) => ({
          memoId,
          nurseId: n.id,
          linkedAtSend: Boolean(n.linkedUserId)
        }))
      );
    }
  } else {
    const result = s.sqlite.prepare(
      `INSERT INTO memos (memoType, areaId, title, body, authorUserId, status) VALUES (?, ?, ?, ?, ?, 'sent')`
    ).run(memoType, memoType === "department" ? input.areaId : null, title, body, input.authorUserId);
    memoId = Number(result.lastInsertRowid);
    const insertR = s.sqlite.prepare(
      `INSERT INTO memoRecipients (memoId, nurseId, linkedAtSend) VALUES (?, ?, ?)`
    );
    const tx = s.sqlite.transaction((rows) => {
      for (const n of rows) insertR.run(memoId, n.id, n.linkedUserId ? 1 : 0);
    });
    tx(audience);
  }
  await logActivity({
    supervisorId: input.authorUserId,
    actionType: "memo.sent",
    entityType: "memo",
    entityId: memoId,
    summary: `Sent ${memoType} memo: "${title}"`
  });
  return { id: memoId };
}
async function listMemos(opts = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const s = await store();
  if (s.kind === "pg") {
    const rows2 = opts.memoType ? await s.db.select().from(memos).where(eq12(memos.memoType, opts.memoType)).orderBy(desc6(memos.sentAt)).limit(limit) : await s.db.select().from(memos).orderBy(desc6(memos.sentAt)).limit(limit);
    const ids2 = rows2.map((r) => r.id);
    const counts2 = await loadReceiptCounts(ids2);
    return rows2.map((r) => ({ ...r, ...counts2.get(r.id) }));
  }
  const typeFilter = opts.memoType ? "WHERE memoType = ?" : "";
  const params = opts.memoType ? [opts.memoType, limit] : [limit];
  const rows = s.sqlite.prepare(`SELECT * FROM memos ${typeFilter} ORDER BY datetime(sentAt) DESC LIMIT ?`).all(...params);
  const ids = rows.map((r) => r.id);
  const counts = await loadReceiptCounts(ids);
  return rows.map((r) => ({ ...r, ...counts.get(r.id) }));
}
async function loadReceiptCounts(memoIds) {
  const empty = { total: 0, read: 0, unread: 0, notLinked: 0 };
  const map = /* @__PURE__ */ new Map();
  for (const id of memoIds) map.set(id, { ...empty });
  if (memoIds.length === 0) return map;
  const s = await store();
  if (s.kind === "pg") {
    const rows2 = await s.db.select({
      memoId: memoRecipients.memoId,
      total: sql11`count(*)`,
      read: sql11`sum(case when ${memoRecipients.readAt} is not null then 1 else 0 end)`,
      notLinked: sql11`sum(case when ${memoRecipients.linkedAtSend} = false then 1 else 0 end)`
    }).from(memoRecipients).where(inArray4(memoRecipients.memoId, memoIds)).groupBy(memoRecipients.memoId);
    for (const r of rows2) {
      const total = Number(r.total);
      const read = Number(r.read);
      const notLinked = Number(r.notLinked);
      map.set(r.memoId, { total, read, unread: total - read, notLinked });
    }
    return map;
  }
  const placeholders = memoIds.map(() => "?").join(",");
  const rows = s.sqlite.prepare(
    `SELECT memoId,
              COUNT(*) as total,
              SUM(CASE WHEN readAt IS NOT NULL THEN 1 ELSE 0 END) as readCount,
              SUM(CASE WHEN linkedAtSend = 0 THEN 1 ELSE 0 END) as notLinked
       FROM memoRecipients WHERE memoId IN (${placeholders}) GROUP BY memoId`
  ).all(...memoIds);
  for (const r of rows) {
    map.set(r.memoId, {
      total: Number(r.total),
      read: Number(r.readCount),
      unread: Number(r.total) - Number(r.readCount),
      notLinked: Number(r.notLinked)
    });
  }
  return map;
}
async function getMemo(id) {
  const s = await store();
  let memo;
  if (s.kind === "pg") {
    const rows = await s.db.select().from(memos).where(eq12(memos.id, id)).limit(1);
    memo = rows[0];
  } else {
    memo = s.sqlite.prepare("SELECT * FROM memos WHERE id = ?").get(id);
  }
  if (!memo) return null;
  const counts = await loadReceiptCounts([id]);
  return { ...memo, ...counts.get(id) };
}
async function listMemoReceipts(memoId) {
  const s = await store();
  if (s.kind === "pg") {
    const rows2 = await s.db.select({
      nurseId: memoRecipients.nurseId,
      linkedAtSend: memoRecipients.linkedAtSend,
      readAt: memoRecipients.readAt,
      firstName: nurses.firstName,
      lastName: nurses.lastName,
      middleName: nurses.middleName,
      suffix: nurses.suffix,
      areaName: areas.name
    }).from(memoRecipients).innerJoin(nurses, eq12(nurses.id, memoRecipients.nurseId)).leftJoin(areas, eq12(areas.id, nurses.currentAreaId)).where(eq12(memoRecipients.memoId, memoId)).orderBy(nurses.lastName, nurses.firstName);
    return rows2.map((r) => ({
      nurseId: r.nurseId,
      name: nurseFullName(r),
      areaName: r.areaName ?? null,
      linkedAtSend: Boolean(r.linkedAtSend),
      readAt: r.readAt
    }));
  }
  const rows = s.sqlite.prepare(
    `SELECT r.nurseId, r.linkedAtSend, r.readAt, n.firstName, n.lastName, n.middleName, n.suffix, a.name as areaName
       FROM memoRecipients r
       INNER JOIN nurses n ON n.id = r.nurseId
       LEFT JOIN areas a ON a.id = n.currentAreaId
       WHERE r.memoId = ?
       ORDER BY n.lastName, n.firstName`
  ).all(memoId);
  return rows.map((r) => ({
    nurseId: r.nurseId,
    name: nurseFullName(r),
    areaName: r.areaName ?? null,
    linkedAtSend: Boolean(r.linkedAtSend),
    readAt: r.readAt ?? null
  }));
}
async function retractMemo(input) {
  const memo = await getMemo(input.memoId);
  if (!memo) throw new Error("Memo not found.");
  if (memo.status === "retracted") return { ok: true };
  const s = await store();
  if (s.kind === "pg") {
    await s.db.update(memos).set({ status: "retracted", retractedAt: /* @__PURE__ */ new Date() }).where(eq12(memos.id, input.memoId));
  } else {
    s.sqlite.prepare("UPDATE memos SET status = 'retracted', retractedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(input.memoId);
  }
  await logActivity({
    supervisorId: input.authorUserId,
    actionType: "memo.retracted",
    entityType: "memo",
    entityId: input.memoId,
    summary: `Retracted memo: "${memo.title}"`
  });
  return { ok: true };
}
async function listFeedForNurse(nurseId) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db.select({
      id: memos.id,
      memoType: memos.memoType,
      title: memos.title,
      body: memos.body,
      sentAt: memos.sentAt,
      areaId: memos.areaId,
      readAt: memoRecipients.readAt
    }).from(memoRecipients).innerJoin(memos, eq12(memos.id, memoRecipients.memoId)).where(and9(eq12(memoRecipients.nurseId, nurseId), eq12(memos.status, "sent"))).orderBy(desc6(memos.sentAt));
    return rows;
  }
  return s.sqlite.prepare(
    `SELECT m.id, m.memoType, m.title, m.body, m.sentAt, m.areaId, r.readAt
       FROM memoRecipients r
       INNER JOIN memos m ON m.id = r.memoId
       WHERE r.nurseId = ? AND m.status = 'sent'
       ORDER BY datetime(m.sentAt) DESC`
  ).all(nurseId);
}
async function countUnreadForNurse(nurseId) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db.select({ count: sql11`count(*)` }).from(memoRecipients).innerJoin(memos, eq12(memos.id, memoRecipients.memoId)).where(and9(eq12(memoRecipients.nurseId, nurseId), eq12(memos.status, "sent"), isNull10(memoRecipients.readAt)));
    return Number(rows[0]?.count ?? 0);
  }
  const row = s.sqlite.prepare(
    `SELECT COUNT(*) as count
       FROM memoRecipients r
       INNER JOIN memos m ON m.id = r.memoId
       WHERE r.nurseId = ? AND m.status = 'sent' AND r.readAt IS NULL`
  ).get(nurseId);
  return Number(row.count);
}
async function markMemoRead(input) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db.select().from(memoRecipients).where(and9(eq12(memoRecipients.memoId, input.memoId), eq12(memoRecipients.nurseId, input.nurseId))).limit(1);
    const existing2 = rows[0];
    if (!existing2) throw new Error("You are not a recipient of this memo.");
    if (existing2.readAt) return { alreadyRead: true, readAt: existing2.readAt };
    const readAt = /* @__PURE__ */ new Date();
    await s.db.update(memoRecipients).set({ readAt }).where(and9(eq12(memoRecipients.memoId, input.memoId), eq12(memoRecipients.nurseId, input.nurseId), isNull10(memoRecipients.readAt)));
    return { alreadyRead: false, readAt };
  }
  const existing = s.sqlite.prepare("SELECT readAt FROM memoRecipients WHERE memoId = ? AND nurseId = ?").get(input.memoId, input.nurseId);
  if (!existing) throw new Error("You are not a recipient of this memo.");
  if (existing.readAt) return { alreadyRead: true, readAt: existing.readAt };
  s.sqlite.prepare("UPDATE memoRecipients SET readAt = CURRENT_TIMESTAMP WHERE memoId = ? AND nurseId = ? AND readAt IS NULL").run(input.memoId, input.nurseId);
  const updated = s.sqlite.prepare("SELECT readAt FROM memoRecipients WHERE memoId = ? AND nurseId = ?").get(input.memoId, input.nurseId);
  return { alreadyRead: false, readAt: updated.readAt };
}

// server/routers/staffAccount.ts
init_nursetrack();
init_trainingReminders();
var GENERIC_CLAIM_ERROR = "No matching staff record, or this profile already has a sign-in email.";
var CLAIM_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1e3 };
var parseDateInput = (val) => {
  if (val === void 0) return void 0;
  if (val === null || val === "") return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) throw new TRPCError8({ code: "BAD_REQUEST", message: "Invalid date." });
    return val;
  }
  const str2 = String(val).trim();
  const m = str2.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (y < 1950 || y > 2100 || mon < 1 || mon > 12) {
      throw new TRPCError8({ code: "BAD_REQUEST", message: "Invalid date range." });
    }
    const daysInMonth = new Date(Date.UTC(y, mon, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
      throw new TRPCError8({ code: "BAD_REQUEST", message: "Invalid calendar date." });
    }
    return /* @__PURE__ */ new Date(`${m[1]}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
  }
  const d = new Date(str2);
  if (isNaN(d.getTime())) throw new TRPCError8({ code: "BAD_REQUEST", message: "Invalid date." });
  return d;
};
var staffAccountRouter = router({
  myLink: staffProcedure.query(async ({ ctx }) => {
    return { linked: true, nurseId: ctx.nurseId, authMode: ctx.authMode };
  }),
  /** First visit: identify by PRC/license number (RN) or employee ID (attendant, no PRC on file). */
  startClaim: publicProcedure.input(z12.object({ identifier: z12.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
    if (!checkRateLimit(`staff-claim:${ip}`, CLAIM_RATE_LIMIT)) {
      throw new TRPCError8({ code: "NOT_FOUND", message: GENERIC_CLAIM_ERROR });
    }
    const result = await claimNurseByIdentifier(input.identifier);
    if (!result.ok) {
      throw new TRPCError8({ code: "NOT_FOUND", message: GENERIC_CLAIM_ERROR });
    }
    const token = await sdk.createClaimToken(result.nurseId);
    ctx.res.cookie(CLAIM_COOKIE_NAME, token, getClaimCookieOptions(ctx.req));
    return { ok: true };
  }),
  /** End of first visit (D3): staff types their Gmail and it's saved at once. */
  saveClaimEmail: staffProcedure.input(z12.object({ email: z12.string().email().max(320) })).mutation(async ({ ctx, input }) => {
    if (ctx.authMode !== "claim") {
      throw new TRPCError8({ code: "FORBIDDEN", message: "Already signed in with Google \u2014 use change email instead." });
    }
    const result = await saveClaimEmail(ctx.nurseId, input.email);
    if (!result.ok) {
      if (result.reason === "already_claimed") {
        throw new TRPCError8({ code: "CONFLICT", message: GENERIC_CLAIM_ERROR });
      }
      throw new TRPCError8({ code: "CONFLICT", message: "That email is already in use." });
    }
    return { ok: true };
  }),
  /** D6: change the sign-in Gmail from an established Google session only. */
  changeEmail: staffProcedure.input(z12.object({ email: z12.string().email().max(320) })).mutation(async ({ ctx, input }) => {
    if (ctx.authMode !== "google") {
      throw new TRPCError8({ code: "FORBIDDEN", message: "Sign in with Google to change your sign-in email." });
    }
    const result = await changeNurseAccountEmail(ctx.nurseId, input.email);
    if (!result.ok) {
      throw new TRPCError8({ code: "CONFLICT", message: "That email is already in use." });
    }
    return { ok: true };
  }),
  myProfile: staffProcedure.query(async ({ ctx }) => {
    const nurseId = Math.floor(ctx.nurseId);
    const pg = getBatchClient();
    if (pg) {
      const sets = await pg.unsafe(
        [
          `select * from nursetrack.nurses where id = ${nurseId} limit 1`,
          `select * from nursetrack.areas order by "sortOrder"`,
          `select * from nursetrack."credentialTypes"`,
          `select * from nursetrack."trainingCatalog" order by name`,
          `select id, "nurseId", "areaId", "startDate"::text as "startDate", "endDate"::text as "endDate", "assignmentType", remarks, "isCurrent"
               from nursetrack."areaAssignments"
               where "nurseId" = ${nurseId}
               order by "startDate" desc`,
          `select id, "nurseId", "credentialTypeId", "licenseNumber", "issuingOrganization", "issueDate"::text as "issueDate", "expiryDate"::text as "expiryDate", "renewalStatus", "verificationStatus", "documentKey", "renewalCycleKey", remarks
               from nursetrack."nurseCredentials"
               where "nurseId" = ${nurseId}
               order by "expiryDate" desc`,
          `select id, "nurseId", "trainingId", "eventId", "participationRole", "completionDate"::text as "completionDate", "expiryDate"::text as "expiryDate", "scheduledDate"::text as "scheduledDate", status, "trainingHours", "cpdUnits", provider, "certificateNumber", "certificateKey", remarks
               from nursetrack."nurseTrainings"
               where "nurseId" = ${nurseId}
               order by "completionDate" desc nulls last, id desc`
        ].join(";\n")
      ).simple();
      const [nurseRows, areaRows2, credTypes, catalog2, rawAssignments, rawCreds, rawTrainings] = sets;
      const nurse2 = nurseRows[0];
      if (!nurse2) {
        throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
      }
      const areaById2 = new Map(areaRows2.map((a) => [a.id, a]));
      const typeById2 = new Map(credTypes.map((t2) => [t2.id, t2.name]));
      const catalogById2 = new Map(catalog2.map((c) => [c.id, c.name]));
      const latestCred = rawCreds[0];
      const expKey = latestCred ? dateKey(latestCred.expiryDate) : null;
      const days = expKey ? daysUntilExpiry(expKey) : null;
      const licenseStatus = latestCred ? latestCred.renewalStatus === "Renewed" ? "Valid" : expKey ? deriveLicenseStatus(expKey) : null : null;
      return {
        ...nurse2,
        currentArea: nurse2.currentAreaId ? areaById2.get(nurse2.currentAreaId) ?? null : null,
        licenseStatus,
        licenseNumber: latestCred?.licenseNumber ?? null,
        licenseExpiryDate: expKey,
        licenseDaysRemaining: days,
        credentials: rawCreds.map((c) => ({
          ...c,
          typeName: typeById2.get(c.credentialTypeId) ?? "Credential / License"
        })),
        trainings: rawTrainings.map((t2) => ({
          ...t2,
          trainingName: catalogById2.get(t2.trainingId) ?? "Training"
        })),
        assignments: rawAssignments.map((a) => {
          const area = areaById2.get(a.areaId) ?? null;
          return {
            ...a,
            area,
            areaName: area?.name ?? "Unknown"
          };
        }),
        authMode: ctx.authMode
      };
    }
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const [areaRows, types, catalog, licenseInfo, credentials, trainings, assignments] = await Promise.all([
      listAreas(false),
      listCredentialTypes(true),
      listTrainingCatalog(true),
      getNurseLicenseInfo(nurse.id),
      listCredentials({ nurseId: nurse.id }),
      listNurseTrainings({ nurseId: nurse.id }),
      listAssignmentsForNurse(nurse.id)
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const typeById = new Map(types.map((t2) => [t2.id, t2.name]));
    const catalogById = new Map(catalog.map((c) => [c.id, c.name]));
    const { status, licenseNumber, expiryDate, daysRemaining } = licenseInfo;
    return {
      ...nurse,
      currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
      licenseStatus: status,
      licenseNumber,
      licenseExpiryDate: expiryDate,
      licenseDaysRemaining: daysRemaining,
      credentials: credentials.map((c) => ({
        ...c,
        typeName: typeById.get(c.credentialTypeId) ?? "Credential / License"
      })),
      trainings: trainings.map((t2) => ({
        ...t2,
        trainingName: catalogById.get(t2.trainingId) ?? "Training"
      })),
      assignments: assignments.map((a) => {
        const area = areaById.get(a.areaId) ?? null;
        return {
          ...a,
          area,
          areaName: area?.name ?? "Unknown"
        };
      }),
      authMode: ctx.authMode
    };
  }),
  updateMyBasicInfo: staffProcedure.input(z12.object({ contactNumber: z12.string().max(32).optional() })).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    await updateNurse(nurse.id, { contactNumber: input.contactNumber ?? null });
    return { ok: true };
  }),
  updateMyPrcLicense: staffProcedure.input(
    z12.object({
      licenseNumber: z12.string().trim().max(64).nullable().optional(),
      issueDate: z12.union([z12.string(), z12.date()]).nullable().optional(),
      expiryDate: z12.union([z12.string(), z12.date()]).nullable().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const parsedIssue = parseDateInput(input.issueDate);
    const parsedExpiry = parseDateInput(input.expiryDate);
    if (parsedIssue && parsedExpiry && parsedIssue > parsedExpiry) {
      throw new TRPCError8({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
    }
    const licResult = await upsertNursePrcLicense(nurse.id, input.licenseNumber ?? null, {
      issueDate: parsedIssue,
      expiryDate: parsedExpiry
    });
    if (!licResult.ok) {
      throw new TRPCError8({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
    }
    await logActivity({
      supervisorId: ctx.user?.id ?? null,
      nurseId: nurse.id,
      actionType: "nurse.updated",
      entityType: "nurse",
      entityId: nurse.id,
      summary: `PRC License updated (No: ${input.licenseNumber || "none"}, Exp: ${parsedExpiry ? parsedExpiry.toISOString().slice(0, 10) : "none"}) by ${nurseFullName(nurse)} (self-service)`
    });
    return { ok: true };
  }),
  uploadMyPhoto: staffProcedure.input(z12.object({ fileBase64: z12.string(), fileName: z12.string().max(200), mimeType: z12.string() })).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const mimeCheck = validateMime(input.mimeType, "photo");
    if (!mimeCheck.ok) throw new TRPCError8({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError8({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const oldKey = nurse.profilePhotoKey;
    const key = storageKey("profile-photos", nurse.id, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    await updateNurse(nurse.id, { profilePhotoKey: storedKey });
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user?.id ?? null,
      nurseId: nurse.id,
      actionType: "nurse.photo.updated",
      entityType: "nurse",
      entityId: nurse.id,
      summary: `Profile photo updated by ${nurseFullName(nurse)} (self-service)`
    });
    return { url };
  }),
  listCatalog: staffProcedure.query(async () => {
    return listTrainingCatalog(false);
  }),
  uploadCredentialDocument: staffProcedure.input(
    z12.object({
      credentialId: z12.number(),
      fileBase64: z12.string(),
      fileName: z12.string().max(200),
      mimeType: z12.string(),
      confirmedFields: z12.object({
        licenseNumber: z12.string().trim().max(64).optional().nullable(),
        issueDate: z12.union([z12.string(), z12.date()]).optional().nullable(),
        expiryDate: z12.union([z12.string(), z12.date()]).optional().nullable()
      }).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const allCreds = await listCredentials({ nurseId: nurse.id });
    const cred = allCreds.find((c) => c.id === input.credentialId);
    if (!cred) throw new TRPCError8({ code: "NOT_FOUND", message: "Credential record not found on your profile." });
    const mimeCheck = validateMime(input.mimeType, "document");
    if (!mimeCheck.ok) throw new TRPCError8({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError8({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const patch = {};
    let parsedIssue;
    let parsedExpiry;
    if (input.confirmedFields) {
      if (input.confirmedFields.licenseNumber !== void 0) {
        const normPrc = input.confirmedFields.licenseNumber ? input.confirmedFields.licenseNumber.trim() : null;
        if (normPrc) {
          const matchingNurseIds = await findNurseIdsByLicenseNumber(normPrc);
          if (matchingNurseIds.some((id) => id !== nurse.id)) {
            throw new TRPCError8({
              code: "CONFLICT",
              message: "Another nurse is already registered with this PRC License Number."
            });
          }
        }
        patch.licenseNumber = normPrc;
      }
      if (input.confirmedFields.issueDate !== void 0) {
        parsedIssue = parseDateInput(input.confirmedFields.issueDate);
        patch.issueDate = parsedIssue ?? null;
      }
      if (input.confirmedFields.expiryDate !== void 0) {
        parsedExpiry = parseDateInput(input.confirmedFields.expiryDate);
        if (parsedExpiry) {
          patch.expiryDate = parsedExpiry;
          const existingExpiryStr = cred.expiryDate ? cred.expiryDate instanceof Date ? cred.expiryDate.toISOString().slice(0, 10) : String(cred.expiryDate).slice(0, 10) : null;
          const newExpiryStr = parsedExpiry.toISOString().slice(0, 10);
          if (newExpiryStr !== existingExpiryStr) {
            patch.renewalCycleKey = renewalCycleKey(`${cred.id}-${parsedExpiry.toISOString()}`);
          }
        }
      }
      const effIssue = parsedIssue !== void 0 ? parsedIssue : cred.issueDate ? new Date(cred.issueDate) : null;
      const effExpiry = parsedExpiry !== void 0 ? parsedExpiry : cred.expiryDate ? new Date(cred.expiryDate) : null;
      if (effIssue && effExpiry && effIssue > effExpiry) {
        throw new TRPCError8({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
      }
    }
    const credTypes = await listCredentialTypes(true);
    const credType = credTypes.find((t2) => t2.id === cred.credentialTypeId);
    const isPrc = credType ? credType.name.toLowerCase().includes("prc") : false;
    if (isPrc) {
      patch.verificationStatus = "Pending Verification";
    }
    const oldKey = cred.documentKey;
    const key = storageKey("license-documents", nurse.id, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    patch.documentKey = storedKey;
    await updateCredential(input.credentialId, patch);
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user?.id ?? null,
      nurseId: nurse.id,
      actionType: "license.document.uploaded",
      entityType: "credential",
      entityId: input.credentialId,
      summary: `License/credential document uploaded by ${nurseFullName(nurse)} (self-service)${input.confirmedFields ? " with reviewed fields" : ""}`
    });
    return { url };
  }),
  addTrainingRecord: staffProcedure.input(
    z12.object({
      trainingId: z12.number(),
      provider: z12.string().max(128).optional(),
      completionDate: z12.string().min(1),
      trainingHours: z12.number().int().positive().optional(),
      cpdUnits: z12.number().int().positive().optional(),
      certificateNumber: z12.string().max(64).optional(),
      remarks: z12.string().max(2e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const id = await createNurseTraining({
      nurseId: nurse.id,
      trainingId: input.trainingId,
      provider: input.provider || void 0,
      status: "Completed",
      completionDate: new Date(input.completionDate),
      trainingHours: input.trainingHours || void 0,
      cpdUnits: input.cpdUnits || void 0,
      certificateNumber: input.certificateNumber || void 0,
      remarks: input.remarks || void 0
    });
    await logActivity({
      supervisorId: ctx.user?.id ?? null,
      nurseId: nurse.id,
      actionType: "training.created",
      entityType: "nurseTraining",
      entityId: id,
      summary: `Training completion submitted by ${nurseFullName(nurse)} (self-service)`
    });
    return { id };
  }),
  uploadTrainingCertificate: staffProcedure.input(
    z12.object({
      recordId: z12.number(),
      fileBase64: z12.string(),
      fileName: z12.string().max(200),
      mimeType: z12.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const nurse = await getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError8({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
    const trainings = await listNurseTrainings({ nurseId: nurse.id });
    const record = trainings.find((t2) => t2.id === input.recordId);
    if (!record) throw new TRPCError8({ code: "NOT_FOUND", message: "Training record not found on your profile." });
    const mimeCheck = validateMime(input.mimeType, "document");
    if (!mimeCheck.ok) throw new TRPCError8({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError8({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const oldKey = record.certificateKey;
    const key = storageKey("certificates", nurse.id, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    await updateNurseTraining(input.recordId, { certificateKey: storedKey });
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: ctx.user?.id ?? null,
      nurseId: nurse.id,
      actionType: "training.certificate.uploaded",
      entityType: "nurseTraining",
      entityId: input.recordId,
      summary: `Training certificate uploaded by ${nurseFullName(nurse)} (self-service)`
    });
    return { url };
  }),
  myTrainingCalendar: staffProcedure.input(
    z12.object({
      startDate: z12.string().optional(),
      endDate: z12.string().optional(),
      status: z12.string().optional()
    }).optional()
  ).query(async ({ ctx, input }) => {
    const assignments = await listResolvedTrainingSchedules(ctx.nurseId);
    const results = [];
    for (const resolved of assignments) {
      if (input?.status && input.status !== "all" && resolved.status !== input.status) continue;
      if (input?.startDate && resolved.startDateStr && resolved.startDateStr < input.startDate) continue;
      if (input?.endDate && resolved.startDateStr && resolved.startDateStr > input.endDate) continue;
      results.push({
        assignmentId: resolved.assignmentId,
        trainingId: resolved.trainingId,
        trainingName: resolved.trainingName,
        startDateStr: resolved.startDateStr,
        endDateStr: resolved.endDateStr,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
        venue: resolved.venue,
        status: resolved.status,
        scheduleVersion: resolved.scheduleVersion,
        staffResponse: resolved.staffResponse,
        staffResponseReason: resolved.staffResponseReason,
        attendanceOutcome: resolved.attendanceOutcome,
        evidenceRequired: resolved.evidenceRequired,
        evidenceStatus: resolved.evidenceStatus,
        instructions: resolved.remarks
      });
    }
    return results;
  }),
  myTrainingDetail: staffProcedure.input(z12.object({ assignmentId: z12.number().int().positive() })).query(async ({ ctx, input }) => {
    const resolved = await resolveTrainingSchedule(input.assignmentId);
    if (!resolved || resolved.nurseId !== ctx.nurseId) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
    }
    return resolved;
  }),
  respondToTraining: staffProcedure.input(
    z12.object({
      assignmentId: z12.number().int().positive(),
      scheduleVersion: z12.number().int().positive(),
      response: z12.enum(["confirmed", "cannot_attend"]),
      reason: z12.string().max(1e3).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const resolved = await resolveTrainingSchedule(input.assignmentId);
    if (!resolved || resolved.nurseId !== ctx.nurseId) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
    }
    if (resolved.scheduleVersion !== input.scheduleVersion) {
      throw new TRPCError8({
        code: "CONFLICT",
        message: "The training schedule was updated by supervisor. Please review the current schedule."
      });
    }
    if (input.response === "cannot_attend" && (!input.reason || input.reason.trim().length === 0)) {
      throw new TRPCError8({
        code: "BAD_REQUEST",
        message: "A reason is required when indicating you cannot attend (1 to 1000 characters)."
      });
    }
    const responseValue = input.response === "cannot_attend" ? "Cannot attend" : "Confirmed";
    await updateNurseTraining(input.assignmentId, {
      staffResponse: responseValue,
      staffResponseReason: input.response === "cannot_attend" ? input.reason.trim() : null,
      staffRespondedAt: /* @__PURE__ */ new Date(),
      staffResponseVersion: input.scheduleVersion
    });
    await logActivity({
      supervisorId: null,
      nurseId: ctx.nurseId,
      actionType: "training.response",
      entityType: "nurseTraining",
      entityId: input.assignmentId,
      summary: `Staff response: ${responseValue}${input.reason ? ` - ${input.reason.trim()}` : ""}`
    });
    return { ok: true };
  }),
  submitTrainingEvidence: staffProcedure.input(
    z12.object({
      assignmentId: z12.number().int().positive(),
      fileBase64: z12.string(),
      fileName: z12.string().max(200),
      mimeType: z12.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const resolved = await resolveTrainingSchedule(input.assignmentId);
    if (!resolved || resolved.nurseId !== ctx.nurseId) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
    }
    const mimeCheck = validateMime(input.mimeType, "document");
    if (!mimeCheck.ok) throw new TRPCError8({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new TRPCError8({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    const oldKey = resolved.certificateKey;
    const key = storageKey("certificates", ctx.nurseId, sanitizeFilename(input.fileName));
    const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
    await updateNurseTraining(input.assignmentId, {
      certificateKey: storedKey,
      evidenceStatus: "Submitted",
      evidenceSubmittedAt: /* @__PURE__ */ new Date()
    });
    if (oldKey && oldKey !== storedKey) {
      await storageDelete(oldKey).catch(() => {
      });
    }
    await logActivity({
      supervisorId: null,
      nurseId: ctx.nurseId,
      actionType: "training.evidence.submitted",
      entityType: "nurseTraining",
      entityId: input.assignmentId,
      summary: `Training completion evidence submitted for ${resolved.trainingName}`
    });
    return { ok: true, url };
  }),
  myMemoFeed: staffProcedure.query(async ({ ctx }) => {
    return listFeedForNurse(ctx.nurseId);
  }),
  unreadMemoCount: staffProcedure.query(async ({ ctx }) => {
    return countUnreadForNurse(ctx.nurseId);
  }),
  markMemoRead: staffProcedure.input(z12.object({ memoId: z12.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await markMemoRead({ memoId: input.memoId, nurseId: ctx.nurseId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark memo as read.";
      throw new TRPCError8({ code: "BAD_REQUEST", message });
    }
  })
});

// server/routers/staffFeed.ts
import { z as z13 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";

// server/staffFeed.ts
init_db();
init_localDb();
init_schema();
import { eq as eq13, and as and10, desc as desc7, isNull as isNull11, sql as sql12, inArray as inArray5 } from "drizzle-orm";
async function createStaffMessage(input) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > 160) throw new Error("Title must be between 1 and 160 characters");
  if (!body || body.length > 5e3) throw new Error("Body must be between 1 and 5000 characters");
  const uniqueRecipients = Array.from(new Set(input.recipientNurseIds.filter((id) => typeof id === "number" && id > 0)));
  if (uniqueRecipients.length === 0) throw new Error("At least one recipient nurse is required");
  const db = await getDb();
  if (db) {
    const [msg] = await db.insert(staffMessages).values({
      senderUserId: input.senderUserId,
      title,
      body,
      revision: 1
    }).returning();
    const recipientRows = uniqueRecipients.map((nurseId) => ({
      messageId: msg.id,
      nurseId
    }));
    await db.insert(staffMessageRecipients).values(recipientRows);
    return msg;
  }
  const sqlite = getSqliteDb();
  const res = sqlite.prepare("INSERT INTO staffMessages (senderUserId, title, body, revision) VALUES (?, ?, ?, 1)").run(input.senderUserId, title, body);
  const msgId = Number(res.lastInsertRowid);
  const insRecipient = sqlite.prepare("INSERT OR IGNORE INTO staffMessageRecipients (messageId, nurseId) VALUES (?, ?)");
  const insertMany = sqlite.transaction((rIds) => {
    for (const rId of rIds) {
      insRecipient.run(msgId, rId);
    }
  });
  insertMany(uniqueRecipients);
  return sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(msgId);
}
async function listSentStaffMessages(limit = 50) {
  const db = await getDb();
  if (db) {
    const messages = await db.select({
      id: staffMessages.id,
      senderUserId: staffMessages.senderUserId,
      title: staffMessages.title,
      body: staffMessages.body,
      revision: staffMessages.revision,
      archivedAt: staffMessages.archivedAt,
      createdAt: staffMessages.createdAt,
      updatedAt: staffMessages.updatedAt,
      senderName: users.name
    }).from(staffMessages).leftJoin(users, eq13(users.id, staffMessages.senderUserId)).orderBy(desc7(staffMessages.createdAt)).limit(limit);
    if (messages.length === 0) return [];
    const msgIds = messages.map((m) => m.id);
    const recips = await db.select({
      messageId: staffMessageRecipients.messageId,
      nurseId: staffMessageRecipients.nurseId,
      readAt: staffMessageRecipients.readAt,
      lastReadRevision: staffMessageRecipients.lastReadRevision
    }).from(staffMessageRecipients).where(inArray5(staffMessageRecipients.messageId, msgIds));
    const acks = await db.select({
      messageId: staffMessageAcknowledgments.messageId,
      revision: staffMessageAcknowledgments.revision
    }).from(staffMessageAcknowledgments).where(inArray5(staffMessageAcknowledgments.messageId, msgIds));
    return messages.map((m) => {
      const mRecips = recips.filter((r) => r.messageId === m.id);
      const mAcks = acks.filter((a) => a.messageId === m.id && a.revision === m.revision);
      const readCount = mRecips.filter((r) => r.readAt != null && (r.lastReadRevision ?? 0) >= m.revision).length;
      return {
        ...m,
        recipientCount: mRecips.length,
        readCount,
        ackCount: mAcks.length
      };
    });
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare(
    `SELECT m.*, u.name as senderName,
       (SELECT count(*) FROM staffMessageRecipients r WHERE r.messageId = m.id) as recipientCount,
       (SELECT count(*) FROM staffMessageRecipients r WHERE r.messageId = m.id AND r.readAt IS NOT NULL AND r.lastReadRevision >= m.revision) as readCount,
       (SELECT count(*) FROM staffMessageAcknowledgments a WHERE a.messageId = m.id AND a.revision = m.revision) as ackCount
       FROM staffMessages m
       LEFT JOIN users u ON u.id = m.senderUserId
       ORDER BY datetime(m.createdAt) DESC LIMIT ?`
  ).all(limit);
  return rows;
}
async function getStaffMessageDetail(messageId) {
  const db = await getDb();
  if (db) {
    const [msg2] = await db.select({
      id: staffMessages.id,
      senderUserId: staffMessages.senderUserId,
      title: staffMessages.title,
      body: staffMessages.body,
      revision: staffMessages.revision,
      archivedAt: staffMessages.archivedAt,
      createdAt: staffMessages.createdAt,
      updatedAt: staffMessages.updatedAt,
      senderName: users.name
    }).from(staffMessages).leftJoin(users, eq13(users.id, staffMessages.senderUserId)).where(eq13(staffMessages.id, messageId));
    if (!msg2) return null;
    const recipients2 = await db.select({
      nurseId: staffMessageRecipients.nurseId,
      readAt: staffMessageRecipients.readAt,
      lastReadRevision: staffMessageRecipients.lastReadRevision,
      employeeId: nurses.employeeId,
      firstName: nurses.firstName,
      lastName: nurses.lastName
    }).from(staffMessageRecipients).innerJoin(nurses, eq13(nurses.id, staffMessageRecipients.nurseId)).where(eq13(staffMessageRecipients.messageId, messageId));
    const acks = await db.select({
      nurseId: staffMessageAcknowledgments.nurseId,
      revision: staffMessageAcknowledgments.revision,
      acknowledgedAt: staffMessageAcknowledgments.acknowledgedAt
    }).from(staffMessageAcknowledgments).where(eq13(staffMessageAcknowledgments.messageId, messageId));
    const ackMap = new Map(acks.map((a) => [`${a.nurseId}:${a.revision}`, a.acknowledgedAt]));
    return {
      ...msg2,
      recipients: recipients2.map((r) => ({
        ...r,
        isRead: r.readAt != null && (r.lastReadRevision ?? 0) >= msg2.revision,
        acknowledgedAt: ackMap.get(`${r.nurseId}:${msg2.revision}`) ?? null
      }))
    };
  }
  const sqlite = getSqliteDb();
  const msg = sqlite.prepare(
    `SELECT m.*, u.name as senderName FROM staffMessages m LEFT JOIN users u ON u.id = m.senderUserId WHERE m.id = ?`
  ).get(messageId);
  if (!msg) return null;
  const recipients = sqlite.prepare(
    `SELECT r.nurseId, r.readAt, r.lastReadRevision, n.employeeId, n.firstName, n.lastName,
       (SELECT a.acknowledgedAt FROM staffMessageAcknowledgments a WHERE a.messageId = r.messageId AND a.nurseId = r.nurseId AND a.revision = ?) as acknowledgedAt
       FROM staffMessageRecipients r
       INNER JOIN nurses n ON n.id = r.nurseId
       WHERE r.messageId = ?`
  ).all(msg.revision, messageId);
  return {
    ...msg,
    recipients: recipients.map((r) => ({
      ...r,
      isRead: r.readAt != null && (r.lastReadRevision ?? 0) >= msg.revision
    }))
  };
}
async function updateStaffMessage(messageId, title, body) {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle || trimmedTitle.length > 160) throw new Error("Title must be between 1 and 160 characters");
  if (!trimmedBody || trimmedBody.length > 5e3) throw new Error("Body must be between 1 and 5000 characters");
  const db = await getDb();
  if (db) {
    const [msg2] = await db.select().from(staffMessages).where(eq13(staffMessages.id, messageId));
    if (!msg2) throw new Error("Message not found");
    const [updated] = await db.update(staffMessages).set({
      title: trimmedTitle,
      body: trimmedBody,
      revision: msg2.revision + 1,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq13(staffMessages.id, messageId)).returning();
    return updated;
  }
  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(messageId);
  if (!msg) throw new Error("Message not found");
  sqlite.prepare("UPDATE staffMessages SET title = ?, body = ?, revision = revision + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(trimmedTitle, trimmedBody, messageId);
  return sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(messageId);
}
async function archiveStaffMessage(messageId) {
  const db = await getDb();
  if (db) {
    await db.update(staffMessages).set({ archivedAt: /* @__PURE__ */ new Date() }).where(eq13(staffMessages.id, messageId));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE staffMessages SET archivedAt = CURRENT_TIMESTAMP WHERE id = ?").run(messageId);
}
async function listNurseFeed(nurseId, limit = 50) {
  const db = await getDb();
  if (db) {
    const rows2 = await db.select({
      id: staffMessages.id,
      title: staffMessages.title,
      body: staffMessages.body,
      revision: staffMessages.revision,
      createdAt: staffMessages.createdAt,
      updatedAt: staffMessages.updatedAt,
      senderName: users.name,
      readAt: staffMessageRecipients.readAt,
      lastReadRevision: staffMessageRecipients.lastReadRevision
    }).from(staffMessageRecipients).innerJoin(staffMessages, eq13(staffMessages.id, staffMessageRecipients.messageId)).leftJoin(users, eq13(users.id, staffMessages.senderUserId)).where(and10(eq13(staffMessageRecipients.nurseId, nurseId), isNull11(staffMessages.archivedAt))).orderBy(desc7(staffMessages.createdAt)).limit(limit);
    if (rows2.length === 0) return [];
    const msgIds = rows2.map((r) => r.id);
    const acks = await db.select({
      messageId: staffMessageAcknowledgments.messageId,
      revision: staffMessageAcknowledgments.revision,
      acknowledgedAt: staffMessageAcknowledgments.acknowledgedAt
    }).from(staffMessageAcknowledgments).where(and10(eq13(staffMessageAcknowledgments.nurseId, nurseId), inArray5(staffMessageAcknowledgments.messageId, msgIds)));
    const ackMap = new Map(acks.map((a) => [`${a.messageId}:${a.revision}`, a.acknowledgedAt]));
    return rows2.map((r) => {
      const isRead = r.readAt != null && (r.lastReadRevision ?? 0) >= r.revision;
      const acknowledgedAt = ackMap.get(`${r.id}:${r.revision}`) ?? null;
      return {
        ...r,
        isRead,
        isUnread: !isRead,
        isEdited: r.revision > 1,
        acknowledgedAt
      };
    });
  }
  const sqlite = getSqliteDb();
  const rows = sqlite.prepare(
    `SELECT m.id, m.title, m.body, m.revision, m.createdAt, m.updatedAt, u.name as senderName,
       r.readAt, r.lastReadRevision,
       (SELECT a.acknowledgedAt FROM staffMessageAcknowledgments a WHERE a.messageId = m.id AND a.nurseId = ? AND a.revision = m.revision) as acknowledgedAt
       FROM staffMessageRecipients r
       INNER JOIN staffMessages m ON m.id = r.messageId
       LEFT JOIN users u ON u.id = m.senderUserId
       WHERE r.nurseId = ? AND m.archivedAt IS NULL
       ORDER BY datetime(m.createdAt) DESC LIMIT ?`
  ).all(nurseId, nurseId, limit);
  return rows.map((r) => {
    const isRead = r.readAt != null && (r.lastReadRevision ?? 0) >= r.revision;
    return {
      ...r,
      isRead,
      isUnread: !isRead,
      isEdited: r.revision > 1
    };
  });
}
async function countUnreadNurseMessages(nurseId) {
  const db = await getDb();
  if (db) {
    const rows = await db.select({ count: sql12`count(*)` }).from(staffMessageRecipients).innerJoin(staffMessages, eq13(staffMessages.id, staffMessageRecipients.messageId)).where(
      and10(
        eq13(staffMessageRecipients.nurseId, nurseId),
        isNull11(staffMessages.archivedAt),
        sql12`(${staffMessageRecipients.readAt} IS NULL OR ${staffMessageRecipients.lastReadRevision} < ${staffMessages.revision})`
      )
    );
    return Number(rows[0]?.count ?? 0);
  }
  const sqlite = getSqliteDb();
  const row = sqlite.prepare(
    `SELECT count(*) as cnt FROM staffMessageRecipients r
       INNER JOIN staffMessages m ON m.id = r.messageId
       WHERE r.nurseId = ? AND m.archivedAt IS NULL AND (r.readAt IS NULL OR r.lastReadRevision < m.revision)`
  ).get(nurseId);
  return row?.cnt ?? 0;
}
async function markNurseMessageRead(nurseId, messageId) {
  const db = await getDb();
  if (db) {
    const [msg2] = await db.select().from(staffMessages).where(eq13(staffMessages.id, messageId));
    if (!msg2) return;
    await db.update(staffMessageRecipients).set({
      readAt: /* @__PURE__ */ new Date(),
      lastReadRevision: msg2.revision
    }).where(and10(eq13(staffMessageRecipients.messageId, messageId), eq13(staffMessageRecipients.nurseId, nurseId)));
    return;
  }
  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT revision FROM staffMessages WHERE id = ?").get(messageId);
  if (!msg) return;
  sqlite.prepare("UPDATE staffMessageRecipients SET readAt = CURRENT_TIMESTAMP, lastReadRevision = ? WHERE messageId = ? AND nurseId = ?").run(msg.revision, messageId, nurseId);
}
async function acknowledgeNurseMessage(nurseId, messageId, revision) {
  const db = await getDb();
  if (db) {
    const [msg2] = await db.select().from(staffMessages).where(eq13(staffMessages.id, messageId));
    if (!msg2) throw new Error("Message not found");
    if (msg2.revision !== revision) {
      throw new Error(`Message was updated to revision ${msg2.revision}. Please review the updated content before acknowledging.`);
    }
    const [recipient2] = await db.select().from(staffMessageRecipients).where(and10(eq13(staffMessageRecipients.messageId, messageId), eq13(staffMessageRecipients.nurseId, nurseId)));
    if (!recipient2) throw new Error("You are not a recipient of this message");
    await db.insert(staffMessageAcknowledgments).values({
      messageId,
      nurseId,
      revision
    }).onConflictDoNothing();
    await db.update(staffMessageRecipients).set({
      readAt: /* @__PURE__ */ new Date(),
      lastReadRevision: msg2.revision
    }).where(and10(eq13(staffMessageRecipients.messageId, messageId), eq13(staffMessageRecipients.nurseId, nurseId)));
    return { success: true, messageId, revision };
  }
  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT revision FROM staffMessages WHERE id = ?").get(messageId);
  if (!msg) throw new Error("Message not found");
  if (msg.revision !== revision) {
    throw new Error(`Message was updated to revision ${msg.revision}. Please review the updated content before acknowledging.`);
  }
  const recipient = sqlite.prepare("SELECT * FROM staffMessageRecipients WHERE messageId = ? AND nurseId = ?").get(messageId, nurseId);
  if (!recipient) throw new Error("You are not a recipient of this message");
  sqlite.prepare("INSERT OR IGNORE INTO staffMessageAcknowledgments (messageId, nurseId, revision) VALUES (?, ?, ?)").run(messageId, nurseId, revision);
  sqlite.prepare("UPDATE staffMessageRecipients SET readAt = CURRENT_TIMESTAMP, lastReadRevision = ? WHERE messageId = ? AND nurseId = ?").run(msg.revision, messageId, nurseId);
  return { success: true, messageId, revision };
}

// server/routers/staffFeed.ts
init_trainingReminders();
init_db();
init_localDb();
init_schema();
import { desc as desc8, eq as eq14 } from "drizzle-orm";
var staffFeedRouter = router({
  // --- SUPERVISOR PROCEDURES (adminProcedure) ---
  createMessage: adminProcedure.input(
    z13.object({
      title: z13.string().min(1).max(160),
      body: z13.string().min(1).max(5e3),
      recipientNurseIds: z13.array(z13.number().int().positive()).min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      const msg = await createStaffMessage({
        senderUserId: ctx.user.id,
        title: input.title,
        body: input.body,
        recipientNurseIds: input.recipientNurseIds
      });
      return { ok: true, message: msg };
    } catch (err) {
      throw new TRPCError9({ code: "BAD_REQUEST", message: err.message || "Failed to create message" });
    }
  }),
  listSentMessages: adminProcedure.input(z13.object({ limit: z13.number().int().positive().max(100).optional() }).optional()).query(async ({ input }) => {
    return listSentStaffMessages(input?.limit ?? 50);
  }),
  getMessageDetail: adminProcedure.input(z13.object({ id: z13.number().int().positive() })).query(async ({ input }) => {
    const msg = await getStaffMessageDetail(input.id);
    if (!msg) throw new TRPCError9({ code: "NOT_FOUND", message: "Message not found" });
    return msg;
  }),
  updateMessage: adminProcedure.input(
    z13.object({
      id: z13.number().int().positive(),
      title: z13.string().min(1).max(160),
      body: z13.string().min(1).max(5e3)
    })
  ).mutation(async ({ input }) => {
    try {
      const updated = await updateStaffMessage(input.id, input.title, input.body);
      return { ok: true, message: updated };
    } catch (err) {
      throw new TRPCError9({ code: "BAD_REQUEST", message: err.message || "Failed to update message" });
    }
  }),
  archiveMessage: adminProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ input }) => {
    await archiveStaffMessage(input.id);
    return { ok: true };
  }),
  retryOutbox: adminProcedure.input(z13.object({ itemId: z13.number().int().positive() })).mutation(async ({ input }) => {
    try {
      const res = await retryFailedOutboxItem(input.itemId);
      return { ok: res.ok, status: res.status, error: res.error };
    } catch (err) {
      throw new TRPCError9({ code: "BAD_REQUEST", message: err.message || "Failed to retry delivery" });
    }
  }),
  // --- NURSE STAFF PROCEDURES (staffProcedure, scoped to ctx.nurseId) ---
  myFeed: staffProcedure.input(z13.object({ limit: z13.number().int().positive().max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    return listNurseFeed(ctx.nurseId, input?.limit ?? 50);
  }),
  unreadCount: staffProcedure.query(async ({ ctx }) => {
    const count = await countUnreadNurseMessages(ctx.nurseId);
    return { count };
  }),
  markRead: staffProcedure.input(z13.object({ messageId: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await markNurseMessageRead(ctx.nurseId, input.messageId);
    return { ok: true };
  }),
  acknowledge: staffProcedure.input(
    z13.object({
      messageId: z13.number().int().positive(),
      revision: z13.number().int().positive()
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      await acknowledgeNurseMessage(ctx.nurseId, input.messageId, input.revision);
      return { ok: true };
    } catch (err) {
      if (err.message?.includes("newer revision")) {
        throw new TRPCError9({
          code: "CONFLICT",
          message: "This message was updated by supervisor. Please read the latest version before acknowledging."
        });
      }
      throw new TRPCError9({ code: "BAD_REQUEST", message: err.message || "Failed to acknowledge message" });
    }
  }),
  myActivity: staffProcedure.input(z13.object({ limit: z13.number().int().positive().max(50).optional() }).optional()).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 20;
    const db = await getDb();
    if (db) {
      return db.select().from(trainingActivity).where(eq14(trainingActivity.nurseId, ctx.nurseId)).orderBy(desc8(trainingActivity.createdAt)).limit(limit);
    }
    const sqlite = getSqliteDb();
    return sqlite.prepare("SELECT * FROM trainingActivity WHERE nurseId = ? ORDER BY datetime(createdAt) DESC LIMIT ?").all(ctx.nurseId, limit);
  })
});

// server/routers/smartImport.ts
import { z as z15 } from "zod";
import { TRPCError as TRPCError10 } from "@trpc/server";
import { nanoid } from "nanoid";
init_db();
init_nursetrack();

// shared/smartImport.ts
var SMART_IMPORT_KINDS = ["nurse", "credential", "training", "areaAssignment", "calendarEvent"];
var REFERENCE_FIELDS = {
  areaName: "area",
  credentialTypeName: "credentialType",
  trainingName: "training"
};
var SMART_IMPORT_FIELDS = {
  nurse: {
    employeeId: { label: "Employee ID", type: "text" },
    firstName: { label: "First Name", type: "text" },
    middleName: { label: "Middle Name", type: "text" },
    lastName: { label: "Last Name", type: "text" },
    suffix: { label: "Suffix", type: "text" },
    position: { label: "Position", type: "text" },
    contactNumber: { label: "Contact Number", type: "text" },
    staffType: { label: "Staff Type", type: "select", options: ["Registered Nurse", "Nursing Attendant"] },
    dateHired: { label: "Date Hired", type: "date" },
    employmentStatus: {
      label: "Employment Status",
      type: "select",
      options: ["Active", "On Leave", "Temporary Assignment", "Transferred", "Rotated", "Resigned", "Retired", "Archived"]
    },
    areaName: { label: "Current Area", type: "text" }
  },
  credential: {
    credentialTypeName: { label: "Credential Type", type: "text" },
    licenseNumber: { label: "License Number", type: "text" },
    issuingOrganization: { label: "Issuing Organization", type: "text" },
    issueDate: { label: "Issue Date", type: "date" },
    expiryDate: { label: "Expiry Date", type: "date" },
    renewalStatus: { label: "Renewal Status", type: "select", options: ["Not Started", "Renewal In Progress", "Submitted", "Renewed"] },
    verificationStatus: { label: "Verification Status", type: "select", options: ["Unverified", "Pending Verification", "Verified"] },
    remarks: { label: "Remarks", type: "text" }
  },
  training: {
    trainingName: { label: "Training / Seminar", type: "text" },
    participationRole: { label: "Role", type: "select", options: ["Participant", "Speaker", "Facilitator", "Preceptor"] },
    provider: { label: "Provider", type: "text" },
    status: { label: "Status", type: "select", options: ["Scheduled", "Completed", "Expired", "Cancelled"] },
    scheduledDate: { label: "Scheduled Date", type: "date" },
    completionDate: { label: "Completion Date", type: "date" },
    expiryDate: { label: "Expiry Date", type: "date" },
    trainingHours: { label: "Training Hours", type: "number" },
    cpdUnits: { label: "CPD Units", type: "number" },
    certificateNumber: { label: "Certificate Number", type: "text" },
    remarks: { label: "Remarks", type: "text" }
  },
  areaAssignment: {
    areaName: { label: "Area", type: "text" },
    startDate: { label: "Start Date", type: "date" },
    endDate: { label: "End Date", type: "date" },
    assignmentType: { label: "Assignment Type", type: "text" },
    remarks: { label: "Remarks", type: "text" }
  },
  calendarEvent: {
    title: { label: "Title", type: "text" },
    eventDate: { label: "Date", type: "date" },
    startTime: { label: "Start Time", type: "text" },
    endTime: { label: "End Time", type: "text" },
    allDay: { label: "All Day", type: "boolean" },
    areaName: { label: "Area", type: "text" },
    description: { label: "Description", type: "text" }
  }
};
var SMART_IMPORT_MAX_ROWS = 200;
var SMART_IMPORT_DRAFT_TTL_MS = 15 * 60 * 1e3;

// server/_core/fileExtraction.ts
import * as XLSX from "exceljs";
var MIN_PDF_TEXT_LENGTH = 20;
async function extractText(buffer, mimeType, fileName) {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return extractPdf(buffer);
  }
  if (mimeType.startsWith("image/")) {
    return extractImage(buffer);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel" || /\.(xlsx|xls)$/i.test(fileName)) {
    return extractSpreadsheet(buffer);
  }
  if (mimeType === "text/csv" || mimeType === "application/csv" || fileName.toLowerCase().endsWith(".csv")) {
    return { text: buffer.toString("utf-8"), method: "spreadsheet" };
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.toLowerCase().endsWith(".docx")) {
    return extractDocx(buffer);
  }
  return { text: buffer.toString("utf-8"), method: "plain" };
}
async function extractPdf(buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text2 = (result.text ?? "").trim();
    if (text2.length >= MIN_PDF_TEXT_LENGTH) {
      return { text: text2, method: "pdf-text" };
    }
    throw new Error(
      "This PDF has no extractable text layer (likely a scanned document). Export/print it as a JPG or PNG image and upload that instead so it can be read with OCR."
    );
  } finally {
    await parser.destroy();
  }
}
async function extractImage(buffer) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text: text2 }
    } = await worker.recognize(buffer);
    return { text: text2.trim(), method: "ocr" };
  } finally {
    await worker.terminate();
  }
}
async function extractSpreadsheet(buffer) {
  const workbook = new XLSX.Workbook();
  await workbook.xlsx.load(buffer);
  const lines = [];
  for (const sheet of workbook.worksheets) {
    lines.push(`Sheet: ${sheet.name}`);
    const headerRow = sheet.getRow(1);
    const headers = headerRow.values;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = typeof headers[colNumber] === "string" ? headers[colNumber] : `col${colNumber}`;
        const value = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : String(cell.value ?? "").trim();
        if (value) cells.push(`${header}=${value}`);
      });
      if (cells.length) lines.push(`Row ${rowNumber}: ${cells.join(", ")}`);
    });
  }
  return { text: lines.join("\n"), method: "spreadsheet" };
}
async function extractDocx(buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value.trim(), method: "docx" };
}

// server/_core/aiExtraction.ts
import { z as z14 } from "zod";
init_nursetrack();
init_env();
var fieldValueSchema = z14.object({
  value: z14.union([z14.string(), z14.number(), z14.boolean(), z14.null()]).nullable(),
  confidence: z14.number().min(0).max(1)
});
var aiRowSchema = z14.object({
  kind: z14.enum(SMART_IMPORT_KINDS),
  nurseEmployeeIdGuess: z14.string().nullable().optional(),
  nurseNameGuess: z14.string().nullable().optional(),
  fields: z14.record(z14.string(), fieldValueSchema),
  sourceExcerpt: z14.string().default("")
});
var aiResponseSchema = z14.object({ rows: z14.array(aiRowSchema) });
function buildPrompt(text2, context) {
  const fieldSchemaDoc = SMART_IMPORT_KINDS.map((kind) => {
    const fields = SMART_IMPORT_FIELDS[kind];
    const fieldDocs = Object.entries(fields).map(([key, def]) => `    - ${key} (${def.type}${def.options ? `, one of: ${def.options.join(" | ")}` : ""}): ${def.label}`).join("\n");
    return `  "${kind}":
${fieldDocs}`;
  }).join("\n");
  return `You extract structured nurse-roster records from a document for a hospital nurse-tracking system. Today's date is ${todayDate()}.

Record kinds and their fields:
${fieldSchemaDoc}

Existing nurses (employeeId \u2014 full name), match against these when the document refers to a nurse:
${context.existingNurses.map((n) => `${n.employeeId} \u2014 ${n.name}`).join("\n") || "(none yet)"}

Existing areas: ${context.existingAreas.join(", ") || "(none yet)"}
Existing credential types: ${context.existingCredentialTypes.join(", ") || "(none yet)"}
Existing training/seminar/LDI catalog names: ${context.existingTrainingCatalog.join(", ") || "(none yet)"}

Document text:
"""
${text2.slice(0, 4e4)}
"""

Extract every distinct record you can find (e.g. a roster spreadsheet may contain one "nurse" row per line; a single certificate produces one "credential" or "training" row; a schedule sheet may produce "calendarEvent" rows). Do not invent data that is not present in the text. For dates, output ISO "YYYY-MM-DD". For enum fields, use exactly one of the listed options or leave the value null if unclear.

For every extracted value, include a confidence score 0-1 (1 = read verbatim and unambiguous, lower = inferred or unclear text).

For each row, also guess which existing nurse it belongs to via nurseEmployeeIdGuess (exact employeeId if visible in the text) and/or nurseNameGuess (the person's full name as written). Leave both null for a "nurse" row that looks like a brand-new hire not in the existing list, or for a "calendarEvent" row with no specific nurse.

Include a short sourceExcerpt (<=200 chars) of the raw text this row came from, for a human reviewer to cross-check.

Return at most ${SMART_IMPORT_MAX_ROWS} rows. Respond with ONLY a JSON object: { "rows": [ { "kind": ..., "nurseEmployeeIdGuess": ..., "nurseNameGuess": ..., "fields": { "<fieldKey>": { "value": ..., "confidence": ... }, ... }, "sourceExcerpt": ... }, ... ] }`;
}
async function extractRecordsWithAi(text2, context) {
  if (!ENV.openRouterApiKey) {
    throw new Error("Smart Import is not configured: OPENROUTER_API_KEY is missing.");
  }
  if (!text2.trim()) {
    throw new Error("No readable text was found in this file.");
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openRouterApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ENV.openRouterModel,
      messages: [{ role: "user", content: buildPrompt(text2, context) }],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`AI extraction request failed (${response.status}): ${errText || response.statusText}`);
  }
  const json2 = await response.json();
  const content = json2.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI extraction returned an empty response.");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI extraction returned malformed JSON.");
  }
  const result = aiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("AI extraction returned an unexpected shape.");
  }
  return result.data.rows.slice(0, SMART_IMPORT_MAX_ROWS);
}

// server/_core/entityResolve.ts
init_nursetrack();
function normalize(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function resolveByName(query, items, nameOf) {
  if (!query || !query.trim()) return { item: null, confidence: 0 };
  const q = normalize(query);
  for (const item of items) {
    if (normalize(nameOf(item)) === q) return { item, confidence: 1 };
  }
  let best = null;
  let bestLen = 0;
  for (const item of items) {
    const n = normalize(nameOf(item));
    if ((n.includes(q) || q.includes(n)) && n.length > bestLen) {
      best = item;
      bestLen = n.length;
    }
  }
  if (best) return { item: best, confidence: 0.6 };
  return { item: null, confidence: 0 };
}
function resolveNurse(employeeIdGuess, nameGuess, nurses2) {
  if (employeeIdGuess && employeeIdGuess.trim()) {
    const q = normalize(employeeIdGuess);
    const match = nurses2.find((n) => normalize(n.employeeId) === q);
    if (match) return { nurseId: match.id, confidence: 1 };
  }
  const { item, confidence } = resolveByName(nameGuess, nurses2, nurseFullName);
  return { nurseId: item ? item.id : null, confidence: item ? confidence * 0.85 : 0 };
}

// server/routers/smartImport.ts
var fieldValueSchema2 = z15.object({
  value: z15.union([z15.string(), z15.number(), z15.boolean(), z15.null()]).nullable(),
  confidence: z15.number(),
  refId: z15.number().nullable().optional()
});
var rowInputSchema = z15.object({
  rowId: z15.string(),
  kind: z15.enum(SMART_IMPORT_KINDS),
  action: z15.enum(["create", "update"]),
  nurseId: z15.number().nullable(),
  nurseMatchConfidence: z15.number(),
  nurseNameGuess: z15.string(),
  fields: z15.record(z15.string(), fieldValueSchema2),
  sourceExcerpt: z15.string(),
  include: z15.boolean()
});
var drafts = /* @__PURE__ */ new Map();
function sweepExpired() {
  const now = Date.now();
  for (const [id, d] of Array.from(drafts)) if (d.expiresAt < now) drafts.delete(id);
}
var smartImportRouter = router({
  analyze: adminProcedure.input(z15.object({ fileBase64: z15.string(), fileName: z15.string().max(200), mimeType: z15.string() })).mutation(async ({ ctx, input }) => {
    const mimeCheck = validateMime(input.mimeType, "smartImport");
    if (!mimeCheck.ok) throw new TRPCError10({ code: "BAD_REQUEST", message: mimeCheck.error });
    const buffer = Buffer.from(input.fileBase64, "base64");
    if (buffer.length > MAX_FILE_BYTES) throw new TRPCError10({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
    let extracted;
    try {
      extracted = await extractText(buffer, input.mimeType, input.fileName);
    } catch (err) {
      throw new TRPCError10({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Could not read this file." });
    }
    const [nurses2, areas2, credentialTypes2, trainingCatalog2] = await Promise.all([
      listNurses(),
      listAreas(false),
      listCredentialTypes(false),
      listTrainingCatalog(false)
    ]);
    let aiRows;
    try {
      aiRows = await extractRecordsWithAi(extracted.text, {
        existingNurses: nurses2.map((n) => ({ employeeId: n.employeeId, name: nurseFullName(n) })),
        existingAreas: areas2.map((a) => a.name),
        existingCredentialTypes: credentialTypes2.map((t2) => t2.name),
        existingTrainingCatalog: trainingCatalog2.map((t2) => t2.name)
      });
    } catch (err) {
      throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "AI extraction failed." });
    }
    const rows = aiRows.map((r) => {
      const { nurseId, confidence: nurseMatchConfidence } = resolveNurse(r.nurseEmployeeIdGuess, r.nurseNameGuess, nurses2);
      const fields = {};
      for (const [key, fv] of Object.entries(r.fields)) {
        const refKind = REFERENCE_FIELDS[key];
        if (refKind && typeof fv.value === "string") {
          const list = refKind === "area" ? areas2 : refKind === "credentialType" ? credentialTypes2 : trainingCatalog2;
          const { item, confidence: matchConfidence } = resolveByName(fv.value, list, (x) => x.name);
          fields[key] = { value: fv.value, confidence: Math.min(fv.confidence, item ? matchConfidence : 0.3), refId: item ? item.id : null };
        } else {
          fields[key] = { value: fv.value, confidence: fv.confidence };
        }
      }
      return {
        rowId: nanoid(10),
        kind: r.kind,
        action: r.kind === "nurse" && nurseId !== null ? "update" : "create",
        nurseId,
        nurseMatchConfidence,
        nurseNameGuess: r.nurseNameGuess ?? "",
        fields,
        sourceExcerpt: r.sourceExcerpt.slice(0, 200),
        include: true
      };
    });
    let sourceDocumentKey = "";
    try {
      const key = `nursetrack/smart-import/${Date.now()}-${sanitizeFilename(input.fileName)}`;
      await storagePut(key, buffer, input.mimeType);
      sourceDocumentKey = key;
    } catch (err) {
      console.error("[SmartImport] source file storage failed, continuing without it:", err instanceof Error ? err.message : err);
    }
    const draftId = nanoid(16);
    sweepExpired();
    drafts.set(draftId, { supervisorId: ctx.user.id, sourceDocumentKey, expiresAt: Date.now() + SMART_IMPORT_DRAFT_TTL_MS });
    return { draftId, rows, fileName: input.fileName };
  }),
  commit: adminProcedure.input(z15.object({ draftId: z15.string(), rows: z15.array(rowInputSchema) })).mutation(async ({ ctx, input }) => {
    sweepExpired();
    const draft = drafts.get(input.draftId);
    if (!draft || draft.supervisorId !== ctx.user.id) {
      throw new TRPCError10({ code: "NOT_FOUND", message: "This import session has expired. Please re-upload the file." });
    }
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    for (const row of input.rows) {
      if (!row.include) {
        skipped++;
        continue;
      }
      try {
        if (row.kind === "nurse") await commitNurse(row, ctx.user.id);
        else if (row.kind === "credential") await commitCredential(row, ctx.user.id, draft.sourceDocumentKey);
        else if (row.kind === "training") await commitTraining(row, ctx.user.id, draft.sourceDocumentKey);
        else if (row.kind === "areaAssignment") await commitAreaAssignment(row, ctx.user.id);
        else if (row.kind === "calendarEvent") await commitCalendarEvent(row, ctx.user.id);
        if (row.action === "update") updated++;
        else created++;
      } catch (err) {
        errors.push(`${row.kind} row (${row.nurseNameGuess || row.sourceExcerpt.slice(0, 40)}): ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    drafts.delete(input.draftId);
    return { created, updated, skipped, errors };
  })
});
function str(row, key) {
  const v = row.fields[key]?.value;
  return typeof v === "string" && v.trim() ? v.trim() : void 0;
}
function num(row, key) {
  const v = row.fields[key]?.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  return void 0;
}
function bool(row, key) {
  const v = row.fields[key]?.value;
  return typeof v === "boolean" ? v : void 0;
}
function dateVal(row, key) {
  const v = str(row, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return void 0;
  return parseLocalDate(v.slice(0, 10));
}
function refId(row, key) {
  return row.fields[key]?.refId ?? null;
}
function enumVal(row, key, options) {
  const v = str(row, key);
  return v && options.includes(v) ? v : void 0;
}
async function commitNurse(row, supervisorId) {
  const employeeId = str(row, "employeeId");
  const firstName = str(row, "firstName");
  const lastName = str(row, "lastName");
  const middleName = str(row, "middleName");
  const suffix = str(row, "suffix");
  const currentAreaId = refId(row, "areaName") ?? void 0;
  if (row.action === "update" && row.nurseId) {
    const existing = await getNurseById(row.nurseId);
    if (!existing) throw new Error("Nurse no longer exists.");
    await updateNurse(row.nurseId, {
      employeeId,
      firstName,
      lastName,
      middleName,
      suffix,
      position: str(row, "position"),
      contactNumber: str(row, "contactNumber"),
      staffType: enumVal(row, "staffType", STAFF_TYPES),
      dateHired: dateVal(row, "dateHired"),
      employmentStatus: enumVal(row, "employmentStatus", EMPLOYMENT_STATUSES),
      currentAreaId
    });
    await logActivity({
      supervisorId,
      nurseId: row.nurseId,
      actionType: "smartImport.nurse.updated",
      entityType: "nurse",
      entityId: row.nurseId,
      summary: `Smart Import updated profile for ${nurseFullName(existing)}`
    });
    return;
  }
  if (!employeeId || !firstName || !lastName) {
    throw new Error("Employee ID, first name and last name are required to create a nurse.");
  }
  const dupe = await getNurseByEmployeeId(employeeId);
  if (dupe) throw new Error(`Employee ID ${employeeId} already exists.`);
  const id = await createNurse({
    employeeId,
    firstName,
    lastName,
    middleName,
    suffix,
    position: str(row, "position"),
    contactNumber: str(row, "contactNumber"),
    staffType: enumVal(row, "staffType", STAFF_TYPES),
    dateHired: dateVal(row, "dateHired"),
    employmentStatus: enumVal(row, "employmentStatus", EMPLOYMENT_STATUSES) ?? "Active"
  });
  if (currentAreaId) {
    await updateNurse(id, { currentAreaId });
    await createAssignment({ nurseId: id, areaId: currentAreaId, startDate: /* @__PURE__ */ new Date(), assignmentType: "Permanent Transfer", isCurrent: true });
  }
  await logActivity({
    supervisorId,
    nurseId: id,
    actionType: "smartImport.nurse.created",
    entityType: "nurse",
    entityId: id,
    summary: `Smart Import created nurse profile: ${nurseFullName({ firstName, middleName, lastName, suffix })}`
  });
}
async function commitCredential(row, supervisorId, documentKey) {
  if (!row.nurseId) throw new Error("No matching nurse selected.");
  const credentialTypeId = refId(row, "credentialTypeName");
  if (!credentialTypeId) throw new Error("No matching credential type selected.");
  const expiryDate = dateVal(row, "expiryDate");
  if (!expiryDate) throw new Error("Expiry date is required.");
  const nurse = await getNurseById(row.nurseId);
  if (!nurse) throw new Error("Nurse no longer exists.");
  const id = await createCredential({
    nurseId: row.nurseId,
    credentialTypeId,
    licenseNumber: str(row, "licenseNumber"),
    issuingOrganization: str(row, "issuingOrganization"),
    issueDate: dateVal(row, "issueDate"),
    expiryDate,
    renewalStatus: enumVal(row, "renewalStatus", RENEWAL_STATUSES) ?? "Not Started",
    verificationStatus: enumVal(row, "verificationStatus", VERIFICATION_STATUSES) ?? "Unverified",
    documentKey: documentKey || void 0,
    renewalCycleKey: renewalCycleKey(`smart-import-${Date.now()}`),
    remarks: str(row, "remarks")
  });
  await logActivity({
    supervisorId,
    nurseId: row.nurseId,
    actionType: "smartImport.license.created",
    entityType: "credential",
    entityId: id,
    summary: `Smart Import added a license for ${nurseFullName(nurse)}`
  });
}
async function commitTraining(row, supervisorId, certificateKey) {
  if (!row.nurseId) throw new Error("No matching nurse selected.");
  const trainingId = refId(row, "trainingName");
  if (!trainingId) throw new Error("No matching training/seminar selected.");
  const nurse = await getNurseById(row.nurseId);
  if (!nurse) throw new Error("Nurse no longer exists.");
  const completionDate = dateVal(row, "completionDate");
  const id = await createNurseTraining({
    nurseId: row.nurseId,
    trainingId,
    participationRole: enumVal(row, "participationRole", PARTICIPATION_ROLES) ?? "Participant",
    provider: str(row, "provider"),
    status: enumVal(row, "status", TRAINING_STATUSES) ?? (completionDate ? "Completed" : "Scheduled"),
    scheduledDate: dateVal(row, "scheduledDate"),
    completionDate,
    expiryDate: dateVal(row, "expiryDate"),
    trainingHours: num(row, "trainingHours"),
    cpdUnits: num(row, "cpdUnits"),
    certificateNumber: str(row, "certificateNumber"),
    certificateKey: certificateKey || void 0,
    remarks: str(row, "remarks")
  });
  await logActivity({
    supervisorId,
    nurseId: row.nurseId,
    actionType: "smartImport.training.created",
    entityType: "nurseTraining",
    entityId: id,
    summary: `Smart Import added a training record for ${nurseFullName(nurse)}`
  });
}
async function commitAreaAssignment(row, supervisorId) {
  if (!row.nurseId) throw new Error("No matching nurse selected.");
  const areaId = refId(row, "areaName");
  if (!areaId) throw new Error("No matching area selected.");
  const startDate = dateVal(row, "startDate");
  if (!startDate) throw new Error("Start date is required.");
  const nurse = await getNurseById(row.nurseId);
  if (!nurse) throw new Error("Nurse no longer exists.");
  await createAssignment({
    nurseId: row.nurseId,
    areaId,
    startDate,
    endDate: dateVal(row, "endDate"),
    assignmentType: str(row, "assignmentType"),
    remarks: str(row, "remarks"),
    isCurrent: false
  });
  await logActivity({
    supervisorId,
    nurseId: row.nurseId,
    actionType: "smartImport.assignment.created",
    entityType: "areaAssignment",
    summary: `Smart Import backfilled an area assignment for ${nurseFullName(nurse)}`
  });
}
async function commitCalendarEvent(row, supervisorId) {
  const title = str(row, "title");
  const eventDate = dateVal(row, "eventDate");
  if (!title || !eventDate) throw new Error("Title and date are required.");
  const id = await createCustomEvent({
    title,
    eventDate,
    startTime: str(row, "startTime"),
    endTime: str(row, "endTime"),
    allDay: bool(row, "allDay") ?? true,
    nurseId: row.nurseId ?? void 0,
    areaId: refId(row, "areaName") ?? void 0,
    description: str(row, "description")
  });
  await logActivity({
    supervisorId,
    nurseId: row.nurseId,
    actionType: "smartImport.calendarEvent.created",
    entityType: "customEvent",
    entityId: id,
    summary: `Smart Import created calendar event: ${title}`
  });
}

// server/routers/aiInsights.ts
import { z as z16 } from "zod";
import { TRPCError as TRPCError11 } from "@trpc/server";

// server/_core/aiInsights.ts
init_db();
init_nursetrack();
var INSIGHTS_TIMEOUT_MS = 5e3;
var INSIGHTS_UNAVAILABLE_MESSAGE = "The insights report service is not available. Try again later.";
var InsightsServiceError = class extends Error {
};
async function buildInsightsDigest(today) {
  const [nurses2, areas2, credentials, trainingRecords, credentialTypes2, trainingCatalog2, requirements] = await Promise.all([
    listNurses(),
    listAreas(false),
    listCredentials(),
    listNurseTrainings(),
    listCredentialTypes(false),
    listTrainingCatalog(false),
    listRequiredTrainings()
  ]);
  const inactive = new Set(INACTIVE_EMPLOYMENT_STATUSES);
  const active = nurses2.filter((n) => !n.archivedAt && !inactive.has(n.employmentStatus));
  const areaName = new Map(areas2.map((a) => [a.id, a.name]));
  const areaOf = (areaId) => areaId ? areaName.get(areaId) ?? "Unassigned" : "Unassigned";
  const person = new Map(active.map((n) => [n.id, { name: nurseFullName(n), area: areaOf(n.currentAreaId) }]));
  const credentialName = new Map(credentialTypes2.map((t2) => [t2.id, t2.name]));
  const trainingName = new Map(trainingCatalog2.map((t2) => [t2.id, t2.name]));
  const latest = /* @__PURE__ */ new Map();
  for (const c of credentials) {
    if (!person.has(c.nurseId)) continue;
    const prev = latest.get(c.nurseId);
    if (!prev || dateKey(c.expiryDate) > dateKey(prev.expiryDate)) latest.set(c.nurseId, c);
  }
  const licenses = Array.from(latest.values()).flatMap((c) => {
    const expiry = dateKey(c.expiryDate);
    if (!expiry) return [];
    const p = person.get(c.nurseId);
    return [{ ...p, credential: credentialName.get(c.credentialTypeId) ?? "License", expiry_date: expiry, renewed: c.renewalStatus === "Renewed" }];
  });
  const trainings = trainingRecords.flatMap((t2) => {
    const p = person.get(t2.nurseId);
    const date2 = dateKey(t2.scheduledDate);
    if (!p || t2.status !== "Scheduled" || !date2) return [];
    return [{ ...p, training: trainingName.get(t2.trainingId) ?? "Training", date: date2 }];
  });
  const coverage = buildTrainingCompliance({
    areas: areas2,
    requirements,
    nurses: active,
    completedRecords: trainingRecords.filter((t2) => t2.status === "Completed"),
    today
  }).map((row) => ({ area: row.areaName, required_checks: row.requiredChecks, compliant_checks: row.compliantChecks }));
  return {
    today_manila: today,
    areas: areas2.map((a) => ({ name: a.name })),
    staff: Array.from(person.values()),
    licenses,
    trainings,
    coverage
  };
}
async function requestInsightsReport(digest, options = {}) {
  const serviceUrl = options.serviceUrl ?? process.env.INQUIRY_SERVICE_URL ?? "http://127.0.0.1:5005";
  const secret = options.secret ?? process.env.INQUIRY_SERVICE_SECRET;
  const doFetch = options.fetchImpl ?? fetch;
  const headers = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  let response;
  try {
    response = await doFetch(`${serviceUrl}/api/insights/report`, {
      method: "POST",
      headers,
      body: JSON.stringify({ digest }),
      signal: AbortSignal.timeout(options.timeoutMs ?? INSIGHTS_TIMEOUT_MS)
    });
  } catch (err) {
    console.warn("[Insights] report service unreachable:", err instanceof Error ? err.message : err);
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    console.warn(`[Insights] report service returned non-JSON (HTTP ${response.status})`);
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }
  if (!response.ok || !body?.success || !Array.isArray(body.sections)) {
    console.warn(`[Insights] report service error (HTTP ${response.status}):`, body?.error ?? "no sections");
    throw new InsightsServiceError(INSIGHTS_UNAVAILABLE_MESSAGE);
  }
  return {
    generatedFor: String(body.generated_for ?? digest.today_manila),
    sections: body.sections.map((s) => ({
      code: String(s.code),
      title: String(s.title),
      lines: Array.isArray(s.lines) ? s.lines.map(String) : []
    })),
    text: String(body.text ?? "")
  };
}
async function generateInsightsReport(today) {
  return requestInsightsReport(await buildInsightsDigest(today));
}

// server/routers/aiInsights.ts
init_scheduled();
var aiInsightsRouter = router({
  generateReport: adminProcedure.mutation(async () => {
    try {
      const report = await generateInsightsReport(getManilaDateKey());
      return { ...report, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    } catch (err) {
      if (err instanceof InsightsServiceError) {
        throw new TRPCError11({ code: "SERVICE_UNAVAILABLE", message: err.message });
      }
      console.error("[Insights] report failed:", err);
      throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "The insights report could not be created. Try again later." });
    }
  }),
  chat: adminProcedure.input(
    z16.object({
      question: z16.string().min(1).max(1e3),
      history: z16.array(z16.object({ role: z16.enum(["user", "assistant"]), content: z16.string() })).max(20).optional()
    })
  ).mutation(async ({ input }) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const secret = process.env.INQUIRY_SERVICE_SECRET;
    const headers = { "Content-Type": "application/json" };
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: input.question, context: { is_authorized: true } }),
        signal: AbortSignal.timeout(4e3)
      });
      if (resp.ok) {
        const data = await resp.json();
        return { answer: data.answer };
      }
    } catch {
    }
    return {
      answer: "SPMC Kidney Transplant Institute (SKTI) General Inquiries: For questions regarding services, hours, location, requirements, or fees, please contact the SPMC SKTI Information Desk directly at (082) 227-2731 (local 4128/4129)."
    };
  })
});

// server/routers/inquiry.ts
import { z as z17 } from "zod";
init_db();
init_schema();
init_nursetrack();
init_localDb();
import { and as and11, asc as asc5, eq as eq15, isNull as isNull12, sql as sql13 } from "drizzle-orm";
var FALLBACK_TOPICS = [
  { id: "needs_attention", name: "Needs Attention", short_desc: "Expiring & overdue records" },
  { id: "find_staff", name: "Find Staff", short_desc: "Nurses & attendants" },
  { id: "license_status", name: "License Status", short_desc: "Expiry & renewal" },
  { id: "training_followup", name: "Training Follow-up", short_desc: "Pending & missing evidence" },
  { id: "upcoming_seminars", name: "Upcoming Seminars", short_desc: "Seminars & LDI" },
  { id: "area_assignments", name: "Area Assignments", short_desc: "Staff by clinical unit" },
  { id: "calendar", name: "Calendar", short_desc: "Events & scheduled training" },
  { id: "reports", name: "Reports", short_desc: "Choose & export reports" }
];
var SERVICE_UNAVAILABLE_ANSWER = "NurseTrack inquiry service is currently unavailable. For assistance with staff assignments, license registry, or training schedules, please open the respective dashboard module or contact the SKTI Nursing Office at (082) 227-2731 (local 4135).";
function getTodayManila(date2 = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date2);
}
function needsDatabaseContext(question, topicId) {
  const tId = topicId?.trim().toLowerCase();
  const validTaskIds = [
    "needs_attention",
    "find_staff",
    "license_status",
    "training_followup",
    "upcoming_seminars",
    "area_assignments",
    "calendar",
    "reports",
    "trainings",
    "areas"
  ];
  if (tId && validTaskIds.includes(tId)) return true;
  if (!question) return false;
  const q = question.toLowerCase();
  const triggers = [
    "attention",
    "urgent",
    "alert",
    "alerts",
    "overdue",
    "staff",
    "nurse",
    "nurses",
    "attendant",
    "license",
    "licenses",
    "prc",
    "renewal",
    "followup",
    "certificate",
    "certificates",
    "evidence",
    "seminar",
    "seminars",
    "workshop",
    "area",
    "areas",
    "unit",
    "units",
    "ward",
    "calendar",
    "event",
    "events",
    "today",
    "report",
    "reports",
    "export",
    "excel"
  ];
  return triggers.some((t2) => q.includes(t2));
}
function withTimeout(promise, ms, errorMsg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}
function detectTargetTopic(question, topicId) {
  if (topicId) return topicId.trim().toLowerCase();
  if (!question) return "needs_attention";
  const q = question.toLowerCase();
  if (q.includes("attention") || q.includes("urgent") || q.includes("alert") || q.includes("overdue")) {
    return "needs_attention";
  }
  if (q.includes("find") || q.includes("search") || q.includes("who is") || q.includes("staff") || q.includes("nurse") || q.includes("attendant")) {
    return "find_staff";
  }
  if (q.includes("license") || q.includes("prc") || q.includes("credential")) {
    return "license_status";
  }
  if (q.includes("followup") || q.includes("follow-up") || q.includes("evidence") || q.includes("missing certificate")) {
    return "training_followup";
  }
  if (q.includes("seminar") || q.includes("workshop") || q.includes("ldi")) {
    return "upcoming_seminars";
  }
  if (q.includes("area") || q.includes("unit") || q.includes("ward") || q.includes("station")) {
    return "area_assignments";
  }
  if (q.includes("calendar") || q.includes("today") || q.includes("this week") || q.includes("scheduled")) {
    return "calendar";
  }
  if (q.includes("report") || q.includes("export") || q.includes("excel")) {
    return "reports";
  }
  return "needs_attention";
}
async function getAreaCountsSummary(isAuthorized = false) {
  try {
    const fetchAreas = async () => {
      const dbConn = await getDb();
      if (dbConn) {
        const areaRows = await dbConn.select().from(areas).where(eq15(areas.active, true)).orderBy(areas.sortOrder);
        const countMap = /* @__PURE__ */ new Map();
        let total = 0;
        if (isAuthorized) {
          const nurseCounts = await dbConn.select({ areaId: nurses.currentAreaId, count: sql13`count(*)::int` }).from(nurses).where(activeNurseCondition()).groupBy(nurses.currentAreaId);
          for (const c of nurseCounts) {
            if (c.areaId !== null && c.areaId !== void 0) {
              const cnt = Number(c.count);
              countMap.set(c.areaId, cnt);
              total += cnt;
            }
          }
        }
        return {
          status: "success",
          areas: areaRows.map((a) => ({
            id: a.id,
            name: a.name,
            ...isAuthorized ? { staffCount: countMap.get(a.id) ?? 0 } : {}
          })),
          ...isAuthorized ? { totalStaff: total } : {}
        };
      }
      const sqlite = getSqliteDb();
      if (sqlite) {
        const areaRows = sqlite.prepare("SELECT id, name, sortOrder FROM areas WHERE active = 1 ORDER BY sortOrder").all();
        const countMap = /* @__PURE__ */ new Map();
        let total = 0;
        if (isAuthorized) {
          const countRows = sqlite.prepare(
            `SELECT currentAreaId as areaId, COUNT(*) as count FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST}) GROUP BY currentAreaId`
          ).all();
          for (const c of countRows) {
            if (c.areaId !== null && c.areaId !== void 0) {
              const cnt = Number(c.count);
              countMap.set(Number(c.areaId), cnt);
              total += cnt;
            }
          }
        }
        return {
          status: "success",
          areas: areaRows.map((a) => ({
            id: a.id,
            name: a.name,
            ...isAuthorized ? { staffCount: countMap.get(a.id) ?? 0 } : {}
          })),
          ...isAuthorized ? { totalStaff: total } : {}
        };
      }
      return { status: "success", areas: [] };
    };
    return await withTimeout(fetchAreas(), 3e3, "Area database query timed out");
  } catch {
    return { status: "failed", areas: [] };
  }
}
async function getAlertsSummary(todayManila) {
  try {
    const fetchAlerts = async () => {
      const dbConn = await getDb();
      let topItems = [];
      let licenseUrgent = 0;
      let trainingUrgent = 0;
      if (dbConn) {
        const creds = await dbConn.select({
          id: nurseCredentials.id,
          expiryDate: nurseCredentials.expiryDate,
          renewalStatus: nurseCredentials.renewalStatus,
          firstName: nurses.firstName,
          lastName: nurses.lastName
        }).from(nurseCredentials).innerJoin(nurses, eq15(nurseCredentials.nurseId, nurses.id)).where(isNull12(nurses.archivedAt));
        for (const c of creds) {
          const d = dateKey(c.expiryDate);
          const status = deriveLicenseStatus(d, todayManila);
          const days = daysUntilExpiry(d, todayManila);
          if (status === "Expired" || status === "Within 6 Months") {
            licenseUrgent++;
            if (topItems.length < 4) {
              topItems.push({
                title: `${c.firstName} ${c.lastName} \u2014 license ${status === "Expired" ? "expired" : `expires in ${days}d`} (${c.renewalStatus || "Not Started"})`,
                severity: status === "Expired" ? "urgent" : "attention"
              });
            }
          }
        }
        const trainings = await dbConn.select({
          id: nurseTrainings.id,
          scheduledDate: nurseTrainings.scheduledDate,
          expiryDate: nurseTrainings.expiryDate,
          status: nurseTrainings.status,
          trainingName: trainingCatalog.name,
          firstName: nurses.firstName,
          lastName: nurses.lastName
        }).from(nurseTrainings).innerJoin(nurses, eq15(nurseTrainings.nurseId, nurses.id)).innerJoin(trainingCatalog, eq15(nurseTrainings.trainingId, trainingCatalog.id)).where(isNull12(nurses.archivedAt));
        for (const t2 of trainings) {
          const schedDate = dateKey(t2.scheduledDate);
          const expDate = dateKey(t2.expiryDate);
          let urgent = false;
          let label = "";
          if (t2.status === "Scheduled" && schedDate && schedDate <= todayManila) {
            urgent = true;
            label = `${t2.firstName} ${t2.lastName} \u2014 overdue training ${t2.trainingName} (was ${schedDate})`;
          } else if (t2.status === "Completed" && expDate && daysUntilExpiry(expDate, todayManila) <= 0) {
            urgent = true;
            label = `${t2.firstName} ${t2.lastName} \u2014 certification expired for ${t2.trainingName}`;
          }
          if (urgent) {
            trainingUrgent++;
            if (topItems.length < 6) {
              topItems.push({ title: label, severity: "attention" });
            }
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const credRows = sqlite.prepare(
            `SELECT nc.id, nc.expiryDate, nc.renewalStatus, n.firstName, n.lastName
             FROM nurseCredentials nc
             JOIN nurses n ON nc.nurseId = n.id
             WHERE n.archivedAt IS NULL`
          ).all();
          for (const c of credRows) {
            const d = dateKey(c.expiryDate);
            const status = deriveLicenseStatus(d, todayManila);
            const days = daysUntilExpiry(d, todayManila);
            if (status === "Expired" || status === "Within 6 Months") {
              licenseUrgent++;
              if (topItems.length < 4) {
                topItems.push({
                  title: `${c.firstName} ${c.lastName} \u2014 license ${status === "Expired" ? "expired" : `expires in ${days}d`}`,
                  severity: status === "Expired" ? "urgent" : "attention"
                });
              }
            }
          }
          const trainRows = sqlite.prepare(
            `SELECT nt.id, nt.scheduledDate, nt.expiryDate, nt.status, tc.name as trainingName, n.firstName, n.lastName
             FROM nurseTrainings nt
             JOIN nurses n ON nt.nurseId = n.id
             JOIN trainingCatalog tc ON nt.trainingId = tc.id
             WHERE n.archivedAt IS NULL`
          ).all();
          for (const t2 of trainRows) {
            const schedDate = dateKey(t2.scheduledDate);
            const expDate = dateKey(t2.expiryDate);
            if (t2.status === "Scheduled" && schedDate && schedDate <= todayManila) {
              trainingUrgent++;
              if (topItems.length < 6) {
                topItems.push({
                  title: `${t2.firstName} ${t2.lastName} \u2014 overdue training ${t2.trainingName} (${schedDate})`,
                  severity: "attention"
                });
              }
            } else if (t2.status === "Completed" && expDate && daysUntilExpiry(expDate, todayManila) <= 0) {
              trainingUrgent++;
              if (topItems.length < 6) {
                topItems.push({
                  title: `${t2.firstName} ${t2.lastName} \u2014 cert expired for ${t2.trainingName}`,
                  severity: "attention"
                });
              }
            }
          }
        }
      }
      return {
        status: "success",
        alerts: {
          total: licenseUrgent + trainingUrgent,
          licenseUrgent,
          trainingUrgent,
          topItems
        }
      };
    };
    return await withTimeout(fetchAlerts(), 3e3, "Alerts database query timed out");
  } catch {
    return { status: "failed" };
  }
}
async function getStaffSummaryOrSearch(isAuthorized, queryTerm) {
  if (!isAuthorized) {
    return { status: "success" };
  }
  try {
    const fetchStaff = async () => {
      const qClean = queryTerm?.trim().toLowerCase();
      const cleanedSearch = qClean ? qClean.replace(/^(find|search|look up|who is)\s+(nurse|staff|attendant)?\s*/i, "").trim() : "";
      const dbConn = await getDb();
      if (dbConn) {
        const activeCondition = and11(isNull12(nurses.archivedAt), activeNurseCondition());
        if (cleanedSearch && cleanedSearch.length >= 2) {
          const matched = await dbConn.select({
            id: nurses.id,
            firstName: nurses.firstName,
            lastName: nurses.lastName,
            staffType: nurses.staffType,
            employeeId: nurses.employeeId,
            areaName: areas.name
          }).from(nurses).leftJoin(areas, eq15(nurses.currentAreaId, areas.id)).where(
            and11(
              activeCondition,
              sql13`lower(${nurses.firstName} || ' ' || ${nurses.lastName}) LIKE ${`%${cleanedSearch}%`} OR lower(${nurses.employeeId}) LIKE ${`%${cleanedSearch}%`}`
            )
          ).limit(5);
          return {
            status: "success",
            matchedStaff: matched.map((m) => ({
              name: nurseFullName(m),
              staffType: m.staffType || "Staff",
              areaName: m.areaName || void 0
            }))
          };
        }
        const allActive = await dbConn.select({ staffType: nurses.staffType }).from(nurses).where(activeCondition);
        const rnCount = allActive.filter((n) => n.staffType === "Registered Nurse").length;
        const naCount = allActive.filter((n) => n.staffType === "Nursing Attendant").length;
        return {
          status: "success",
          staffSummary: {
            total: allActive.length,
            rnCount,
            naCount
          }
        };
      }
      const sqlite = getSqliteDb();
      if (sqlite) {
        if (cleanedSearch && cleanedSearch.length >= 2) {
          const matched = sqlite.prepare(
            `SELECT n.id, n.firstName, n.lastName, n.staffType, n.employeeId, a.name as areaName
             FROM nurses n
             LEFT JOIN areas a ON n.currentAreaId = a.id
             WHERE n.archivedAt IS NULL AND (lower(n.firstName || ' ' || n.lastName) LIKE ? OR lower(n.employeeId) LIKE ?)
             LIMIT 5`
          ).all(`%${cleanedSearch}%`, `%${cleanedSearch}%`);
          return {
            status: "success",
            matchedStaff: matched.map((m) => ({
              name: nurseFullName(m),
              staffType: m.staffType || "Staff",
              areaName: m.areaName || void 0
            }))
          };
        }
        const counts = sqlite.prepare(
          `SELECT staffType, COUNT(*) as count FROM nurses WHERE archivedAt IS NULL GROUP BY staffType`
        ).all();
        let rnCount = 0;
        let naCount = 0;
        let total = 0;
        for (const c of counts) {
          const cnt = Number(c.count);
          total += cnt;
          if (c.staffType === "Registered Nurse") rnCount += cnt;
          if (c.staffType === "Nursing Attendant") naCount += cnt;
        }
        return {
          status: "success",
          staffSummary: { total, rnCount, naCount }
        };
      }
      return { status: "success" };
    };
    return await withTimeout(fetchStaff(), 3e3, "Staff database query timed out");
  } catch {
    return { status: "failed" };
  }
}
async function getLicensesSummary(todayManila) {
  try {
    const fetchLicenses = async () => {
      const dbConn = await getDb();
      let expired = 0;
      let within6Months = 0;
      let within1Year = 0;
      let valid = 0;
      let total = 0;
      const urgentItems = [];
      if (dbConn) {
        const rows = await dbConn.select({
          id: nurseCredentials.id,
          expiryDate: nurseCredentials.expiryDate,
          firstName: nurses.firstName,
          lastName: nurses.lastName
        }).from(nurseCredentials).innerJoin(nurses, eq15(nurseCredentials.nurseId, nurses.id)).where(isNull12(nurses.archivedAt));
        total = rows.length;
        for (const r of rows) {
          const d = dateKey(r.expiryDate);
          const status = deriveLicenseStatus(d, todayManila);
          const days = daysUntilExpiry(d, todayManila);
          if (status === "Expired") {
            expired++;
            if (urgentItems.length < 5) {
              urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: "Expired" });
            }
          } else if (status === "Within 6 Months") {
            within6Months++;
            if (urgentItems.length < 5) {
              urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: `expires in ${days} days` });
            }
          } else if (status === "Within 1 Year") {
            within1Year++;
          } else {
            valid++;
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT nc.id, nc.expiryDate, n.firstName, n.lastName
             FROM nurseCredentials nc
             JOIN nurses n ON nc.nurseId = n.id
             WHERE n.archivedAt IS NULL`
          ).all();
          total = rows.length;
          for (const r of rows) {
            const d = dateKey(r.expiryDate);
            const status = deriveLicenseStatus(d, todayManila);
            const days = daysUntilExpiry(d, todayManila);
            if (status === "Expired") {
              expired++;
              if (urgentItems.length < 5) {
                urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: "Expired" });
              }
            } else if (status === "Within 6 Months") {
              within6Months++;
              if (urgentItems.length < 5) {
                urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: `expires in ${days} days` });
              }
            } else if (status === "Within 1 Year") {
              within1Year++;
            } else {
              valid++;
            }
          }
        }
      }
      return {
        status: "success",
        licenses: {
          expired,
          within6Months,
          within1Year,
          valid,
          total,
          urgentItems
        }
      };
    };
    return await withTimeout(fetchLicenses(), 3e3, "License database query timed out");
  } catch {
    return { status: "failed" };
  }
}
async function getTrainingFollowupSummary() {
  try {
    const fetchFollowup = async () => {
      const dbConn = await getDb();
      let total = 0;
      let pendingResponse = 0;
      let cannotAttend = 0;
      let missingEmail = 0;
      let evidenceReview = 0;
      let missed = 0;
      if (dbConn) {
        const rows = await dbConn.select({
          id: nurseTrainings.id,
          status: nurseTrainings.status,
          staffResponse: nurseTrainings.staffResponse,
          evidenceStatus: nurseTrainings.evidenceStatus,
          attendanceOutcome: nurseTrainings.attendanceOutcome,
          accountEmail: nurses.accountEmail
        }).from(nurseTrainings).innerJoin(nurses, eq15(nurseTrainings.nurseId, nurses.id)).where(and11(isNull12(nurses.archivedAt), sql13`${nurseTrainings.status} != 'Cancelled'`));
        total = rows.length;
        for (const r of rows) {
          if (!r.staffResponse || r.staffResponse === "Pending") pendingResponse++;
          if (r.staffResponse === "Cannot attend") cannotAttend++;
          if (!r.accountEmail) missingEmail++;
          if (r.evidenceStatus === "Submitted") evidenceReview++;
          if (r.attendanceOutcome === "Missed") missed++;
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT nt.id, nt.status, nt.staffResponse, nt.evidenceStatus, nt.attendanceOutcome, n.accountEmail
             FROM nurseTrainings nt
             JOIN nurses n ON nt.nurseId = n.id
             WHERE n.archivedAt IS NULL AND nt.status != 'Cancelled'`
          ).all();
          total = rows.length;
          for (const r of rows) {
            if (!r.staffResponse || r.staffResponse === "Pending") pendingResponse++;
            if (r.staffResponse === "Cannot attend") cannotAttend++;
            if (!r.accountEmail) missingEmail++;
            if (r.evidenceStatus === "Submitted") evidenceReview++;
            if (r.attendanceOutcome === "Missed" || r.attendanceOutcome === "missed") missed++;
          }
        }
      }
      return {
        status: "success",
        followup: {
          counts: {
            total,
            pendingResponse,
            cannotAttend,
            missingEmail,
            evidenceReview,
            missed
          }
        }
      };
    };
    return await withTimeout(fetchFollowup(), 3e3, "Training follow-up query timed out");
  } catch {
    return { status: "failed" };
  }
}
async function getUpcomingSeminarsSummary(todayManila) {
  try {
    const fetchSeminars = async () => {
      const dbConn = await getDb();
      if (dbConn) {
        const rows = await dbConn.select({
          id: trainingEvents.id,
          venue: trainingEvents.venue,
          startDate: trainingEvents.startDate,
          endDate: trainingEvents.endDate,
          title: trainingCatalog.name
        }).from(trainingEvents).innerJoin(trainingCatalog, eq15(trainingCatalog.id, trainingEvents.trainingId)).where(sql13`(${trainingEvents.endDate} >= (${todayManila})::date OR ${trainingEvents.startDate} >= (${todayManila})::date)`).orderBy(asc5(trainingEvents.startDate)).limit(5);
        const eventIds = rows.map((r) => r.id);
        const countMap = /* @__PURE__ */ new Map();
        if (eventIds.length > 0) {
          const counts = await dbConn.select({ eventId: nurseTrainings.eventId, count: sql13`count(*)::int` }).from(nurseTrainings).where(sql13`${nurseTrainings.eventId} IN (${sql13.join(eventIds.map((id) => sql13`${id}`), sql13`, `)})`).groupBy(nurseTrainings.eventId);
          for (const c of counts) {
            if (c.eventId) countMap.set(c.eventId, Number(c.count));
          }
        }
        return {
          status: "success",
          seminars: rows.map((r) => ({
            id: r.id,
            title: r.title,
            dateStr: dateKey(r.startDate),
            venue: r.venue || void 0,
            enrolledCount: countMap.get(r.id) ?? 0
          }))
        };
      }
      const sqlite = getSqliteDb();
      if (sqlite) {
        const rows = sqlite.prepare(
          `SELECT te.id, te.venue, te.startDate, te.endDate, tc.name as title
           FROM trainingEvents te
           JOIN trainingCatalog tc ON te.trainingId = tc.id
           WHERE te.endDate >= ? OR te.startDate >= ?
           ORDER BY te.startDate ASC
           LIMIT 5`
        ).all(todayManila, todayManila);
        return {
          status: "success",
          seminars: rows.map((r) => ({
            id: r.id,
            title: r.title,
            dateStr: dateKey(r.startDate),
            venue: r.venue || void 0,
            enrolledCount: 0
          }))
        };
      }
      return { status: "success", seminars: [] };
    };
    return await withTimeout(fetchSeminars(), 3e3, "Seminars query timed out");
  } catch {
    return { status: "failed", seminars: [] };
  }
}
async function getCalendarSummary(todayManila) {
  try {
    const fetchCalendar = async () => {
      const todayDateObj = /* @__PURE__ */ new Date(`${todayManila}T00:00:00`);
      const weekEndDateObj = new Date(todayDateObj.getTime() + 7 * 864e5);
      const weekEndStr = getTodayManila(weekEndDateObj);
      const dbConn = await getDb();
      const todayEvents = [];
      const weekEvents = [];
      if (dbConn) {
        const seminars = await dbConn.select({ title: trainingCatalog.name, startDate: trainingEvents.startDate, venue: trainingEvents.venue }).from(trainingEvents).innerJoin(trainingCatalog, eq15(trainingEvents.trainingId, trainingCatalog.id)).where(sql13`(${trainingEvents.startDate} >= (${todayManila})::date AND ${trainingEvents.startDate} <= (${weekEndStr})::date)`).limit(10);
        for (const s of seminars) {
          const d = dateKey(s.startDate);
          if (d === todayManila) {
            todayEvents.push({ title: `Seminar: ${s.title}${s.venue ? ` @ ${s.venue}` : ""}` });
          } else {
            weekEvents.push({ title: `Seminar: ${s.title}`, date: d });
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT tc.name as title, te.startDate, te.venue
             FROM trainingEvents te
             JOIN trainingCatalog tc ON te.trainingId = tc.id
             WHERE te.startDate >= ? AND te.startDate <= ?
             LIMIT 10`
          ).all(todayManila, weekEndStr);
          for (const s of rows) {
            const d = dateKey(s.startDate);
            if (d === todayManila) {
              todayEvents.push({ title: `Seminar: ${s.title}${s.venue ? ` @ ${s.venue}` : ""}` });
            } else {
              weekEvents.push({ title: `Seminar: ${s.title}`, date: d });
            }
          }
        }
      }
      return {
        status: "success",
        calendar: {
          todayEvents,
          weekEvents
        }
      };
    };
    return await withTimeout(fetchCalendar(), 3e3, "Calendar query timed out");
  } catch {
    return { status: "failed" };
  }
}
var inquiryRouter = router({
  topics: publicProcedure.query(async () => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const headers = {};
    if (process.env.INQUIRY_SERVICE_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry/topics`, {
        headers,
        signal: AbortSignal.timeout(3e3)
      });
      if (resp.ok) {
        const data = await resp.json();
        return { topics: data.topics || FALLBACK_TOPICS };
      }
    } catch {
    }
    return { topics: FALLBACK_TOPICS };
  }),
  chat: publicProcedure.input(
    z17.object({
      question: z17.string().max(1e3).optional().default(""),
      topicId: z17.string().max(100).optional().nullable(),
      history: z17.array(
        z17.object({
          role: z17.enum(["user", "assistant"]),
          content: z17.string()
        })
      ).max(30).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const isAuthorized = Boolean(ctx.user);
    const todayManila = getTodayManila();
    let liveContext = null;
    let dbReadSucceeded = false;
    let dbReadAttempted = false;
    if (needsDatabaseContext(input.question, input.topicId)) {
      dbReadAttempted = true;
      const target2 = detectTargetTopic(input.question, input.topicId);
      liveContext = {
        today_manila: todayManila,
        is_authorized: isAuthorized
      };
      if (target2 === "needs_attention") {
        const res = await getAlertsSummary(todayManila);
        liveContext.alerts_status = res.status;
        liveContext.alerts_summary = res.alerts;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "find_staff") {
        const res = await getStaffSummaryOrSearch(isAuthorized, input.question);
        liveContext.staff_status = res.status;
        liveContext.staff_summary = res.staffSummary;
        liveContext.matched_staff = res.matchedStaff;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "license_status") {
        const res = await getLicensesSummary(todayManila);
        liveContext.licenses_status = res.status;
        liveContext.licenses_summary = res.licenses;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "training_followup") {
        const res = await getTrainingFollowupSummary();
        liveContext.followup_status = res.status;
        liveContext.followup_summary = res.followup;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "upcoming_seminars" || target2 === "trainings") {
        const res = await getUpcomingSeminarsSummary(todayManila);
        liveContext.seminars_status = res.status;
        liveContext.seminar_events = res.seminars;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "area_assignments" || target2 === "areas") {
        const res = await getAreaCountsSummary(isAuthorized);
        liveContext.areas_status = res.status;
        liveContext.active_areas = res.areas;
        liveContext.total_active_staff = res.totalStaff;
        dbReadSucceeded = res.status === "success";
      } else if (target2 === "calendar") {
        const res = await getCalendarSummary(todayManila);
        liveContext.calendar_status = res.status;
        liveContext.calendar_summary = res.calendar;
        dbReadSucceeded = res.status === "success";
      } else {
        dbReadSucceeded = true;
      }
    }
    const headers = { "Content-Type": "application/json" };
    if (process.env.INQUIRY_SERVICE_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: input.question || "",
          topic_id: input.topicId || void 0,
          history: input.history || [],
          context: liveContext || void 0
        }),
        signal: AbortSignal.timeout(5e3)
      });
      if (resp.ok) {
        const json2 = await resp.json();
        return {
          success: Boolean(json2.success ?? true),
          answer: json2.answer || "",
          topic_id: json2.topic_id ?? null,
          title: json2.title || "NurseTrack Assistant",
          match_type: json2.match_type || "UNKNOWN",
          related_topics: json2.related_topics || [],
          candidate_topics: json2.candidate_topics || [],
          contact_snippet: json2.contact_snippet,
          live_synced: dbReadAttempted ? dbReadSucceeded : false,
          action_links: json2.action_links || []
        };
      }
    } catch {
    }
    const target = detectTargetTopic(input.question, input.topicId);
    if (!isAuthorized && ["needs_attention", "find_staff", "license_status", "training_followup"].includes(target)) {
      return {
        success: true,
        answer: "Supervisor authentication required to view internal staff and compliance records. Please sign in to NurseTrack.",
        topic_id: target,
        title: "Authentication Required",
        match_type: "UNAUTHORIZED",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== target),
        candidate_topics: [],
        live_synced: false,
        action_links: [{ label: "Supervisor Sign In", url: "/dashboard" }]
      };
    }
    if (target === "needs_attention") {
      const alerts = liveContext?.alerts_summary;
      const ans = alerts ? `NurseTrack Action Center: ${alerts.total} item(s) need attention (${alerts.licenseUrgent} expiring/expired licenses, ${alerts.trainingUrgent} overdue trainings).` : "Action Center: Expiring licenses, overdue trainings, and unassigned staff require supervisor review.";
      return {
        success: true,
        answer: ans,
        topic_id: "needs_attention",
        title: "Needs Attention",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "needs_attention"),
        candidate_topics: [],
        live_synced: Boolean(liveContext?.alerts_status === "success"),
        action_links: [{ label: "Open Dashboard Action Center", url: "/dashboard" }]
      };
    }
    if (target === "license_status") {
      const l = liveContext?.licenses_summary;
      const ans = l ? `PRC License Compliance: ${l.expired} expired, ${l.within6Months} expiring within 6 months, ${l.valid} valid (${l.total} total active credentials).` : "PRC License Registry: Monitors licenses against hospital compliance thresholds.";
      return {
        success: true,
        answer: ans,
        topic_id: "license_status",
        title: "License Status",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "license_status"),
        candidate_topics: [],
        live_synced: Boolean(liveContext?.licenses_status === "success"),
        action_links: [{ label: "Open License Registry", url: "/licenses" }]
      };
    }
    if (target === "training_followup") {
      const f = liveContext?.followup_summary?.counts;
      const ans = f ? `Training Follow-up: ${f.pendingResponse} pending staff response, ${f.evidenceReview} certificates uploaded, ${f.cannotAttend} cannot attend.` : "Training Follow-up: Review submitted certificates and attendance outcomes.";
      return {
        success: true,
        answer: ans,
        topic_id: "training_followup",
        title: "Training Follow-up",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "training_followup"),
        candidate_topics: [],
        live_synced: Boolean(liveContext?.followup_status === "success"),
        action_links: [{ label: "Open Training Follow-up", url: "/trainings" }]
      };
    }
    if (target === "upcoming_seminars" || target === "trainings") {
      const s = liveContext?.seminar_events || [];
      const ans = s.length > 0 ? `Upcoming Seminars:
${s.map((ev) => `\u2022 ${ev.title} \u2014 ${ev.dateStr}${ev.venue ? ` @ ${ev.venue}` : ""}`).join("\n")}` : "Upcoming Seminars: There are currently no upcoming hospital seminars or workshops scheduled in the database.";
      return {
        success: true,
        answer: ans,
        topic_id: "upcoming_seminars",
        title: "Upcoming Seminars",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "upcoming_seminars"),
        candidate_topics: [],
        live_synced: Boolean(liveContext?.seminars_status === "success"),
        action_links: [{ label: "Open Seminar Schedule", url: "/seminars" }]
      };
    }
    if (target === "area_assignments" || target === "areas") {
      const areaList = liveContext?.active_areas || [];
      let ans = "SPMC SKTI Clinical Units & Areas (Live Database):\n\n";
      if (areaList.length > 0) {
        ans += areaList.map((a) => {
          const countStr = isAuthorized && a.staffCount !== void 0 ? ` (${a.staffCount} active staff assigned)` : "";
          return `\u2022 ${a.name}${countStr}`;
        }).join("\n");
        if (isAuthorized && liveContext?.total_active_staff !== void 0) {
          ans += `

Total Active Staff Tracked: ${liveContext.total_active_staff}`;
        }
      } else {
        ans += "No active clinical areas currently found in the system.";
      }
      return {
        success: true,
        answer: ans,
        topic_id: "area_assignments",
        title: "Area Assignments",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "area_assignments"),
        candidate_topics: [],
        live_synced: Boolean(liveContext?.areas_status === "success"),
        action_links: [{ label: "Manage Clinical Units", url: "/areas" }]
      };
    }
    if (target === "calendar") {
      return {
        success: true,
        answer: "Master Calendar displays hospital operational events across daily, weekly, and monthly views.",
        topic_id: "calendar",
        title: "Calendar",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "calendar"),
        candidate_topics: [],
        live_synced: true,
        action_links: [{ label: "Open Master Calendar", url: "/calendar" }]
      };
    }
    if (target === "reports") {
      return {
        success: true,
        answer: "NurseTrack includes 6 verified compliance reports: License Status, Expiring & Due Licenses, Training Compliance, Area Exposure, Training Summary, and Area Transfer Log. All exportable to Excel (.xlsx).",
        topic_id: "reports",
        title: "Reports",
        match_type: "EXACT_TOPIC",
        related_topics: FALLBACK_TOPICS.filter((t2) => t2.id !== "reports"),
        candidate_topics: [],
        live_synced: true,
        action_links: [{ label: "Open Reports & Exports", url: "/reports" }]
      };
    }
    return {
      success: false,
      answer: SERVICE_UNAVAILABLE_ANSWER,
      topic_id: null,
      title: "Service Unavailable",
      match_type: "SERVICE_UNAVAILABLE",
      related_topics: FALLBACK_TOPICS,
      candidate_topics: FALLBACK_TOPICS,
      contact_snippet: "SKTI Nursing Office: (082) 227-2731 local 4135",
      live_synced: false,
      action_links: [{ label: "Open Dashboard", url: "/dashboard" }]
    };
  })
});

// server/routers/memos.ts
import { z as z18 } from "zod";
import { TRPCError as TRPCError12 } from "@trpc/server";
init_nursetrack();
var memoTypeSchema = z18.enum(MEMO_TYPES);
function asTrpc(err) {
  const message = err instanceof Error ? err.message : "Memo request failed.";
  if (/not found/i.test(message)) throw new TRPCError12({ code: "NOT_FOUND", message });
  throw new TRPCError12({ code: "BAD_REQUEST", message });
}
var memosRouter = router({
  previewAudience: adminProcedure.input(z18.object({ memoType: memoTypeSchema, areaId: z18.number().int().positive().optional() })).query(async ({ input }) => {
    try {
      return await previewAudience(input);
    } catch (err) {
      asTrpc(err);
    }
  }),
  create: adminProcedure.input(
    z18.object({
      memoType: memoTypeSchema,
      areaId: z18.number().int().positive().optional(),
      title: z18.string().min(1).max(256),
      body: z18.string().min(1).max(8e3)
    })
  ).mutation(async ({ ctx, input }) => {
    try {
      return await createMemo({ ...input, authorUserId: ctx.user.id });
    } catch (err) {
      asTrpc(err);
    }
  }),
  list: adminProcedure.input(z18.object({ memoType: memoTypeSchema.optional(), limit: z18.number().int().min(1).max(100).optional() }).optional()).query(async ({ input }) => listMemos(input ?? {})),
  get: adminProcedure.input(z18.object({ id: z18.number().int().positive() })).query(async ({ input }) => {
    const memo = await getMemo(input.id);
    if (!memo) throw new TRPCError12({ code: "NOT_FOUND", message: "Memo not found." });
    return memo;
  }),
  receipts: adminProcedure.input(z18.object({ id: z18.number().int().positive() })).query(async ({ input }) => listMemoReceipts(input.id)),
  retract: adminProcedure.input(z18.object({ id: z18.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await retractMemo({ memoId: input.id, authorUserId: ctx.user.id });
    } catch (err) {
      asTrpc(err);
    }
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  inquiry: inquiryRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(CLAIM_COOKIE_NAME, { ...getClaimCookieOptions(ctx.req), maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  nurses: nursesRouter,
  credentials: credentialsRouter,
  trainings: trainingsRouter,
  calendar: calendarRouter,
  notifications: notificationsRouter,
  dashboard: dashboardRouter,
  areas: areasRouter,
  reports: reportsRouter,
  settings: settingsRouter,
  seminars: seminarsRouter,
  staffAccount: staffAccountRouter,
  staffFeed: staffFeedRouter,
  smartImport: smartImportRouter,
  aiInsights: aiInsightsRouter,
  memos: memosRouter
});

// server/_core/context.ts
init_const();
init_sdk();
import { parse as parseCookieHeader3 } from "cookie";
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  let claimNurseId = null;
  try {
    const cookies = parseCookieHeader3(opts.req.headers.cookie ?? "");
    claimNurseId = await sdk.verifyClaimToken(cookies[CLAIM_COOKIE_NAME]);
  } catch (error) {
    claimNurseId = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
    claimNurseId
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
  app.post("/api/admin/import-staff-emails", async (req, res) => {
    const { importStaffEmailsHandler: importStaffEmailsHandler2 } = await Promise.resolve().then(() => (init_importStaffEmails(), importStaffEmails_exports));
    return importStaffEmailsHandler2(req, res);
  });
  app.post("/api/admin/import-staff-roster", async (req, res) => {
    const { importStaffRosterHandler: importStaffRosterHandler2 } = await Promise.resolve().then(() => (init_importStaffRoster(), importStaffRoster_exports));
    return importStaffRosterHandler2(req, res);
  });
  app.post("/api/admin/import-staff-areas", async (req, res) => {
    const { importStaffAreasHandler: importStaffAreasHandler2 } = await Promise.resolve().then(() => (init_importStaffAreas(), importStaffAreas_exports));
    return importStaffAreasHandler2(req, res);
  });
  app.post("/api/admin/import-staff-trainings", async (req, res) => {
    const { importStaffTrainingsHandler: importStaffTrainingsHandler2 } = await Promise.resolve().then(() => (init_importStaffTrainings(), importStaffTrainings_exports));
    return importStaffTrainingsHandler2(req, res);
  });
  app.post("/api/inquiry", async (req, res) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const headers = { "Content-Type": "application/json" };
    if (process.env.INQUIRY_SERVICE_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(5e3)
      });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    } catch {
      return res.status(503).json({
        success: false,
        answer: "Inquiry service is currently unavailable. Please contact SPMC SKTI directly at (082) 227-2731 (local 4128/4129).",
        match_type: "SERVICE_UNAVAILABLE"
      });
    }
  });
  app.get("/api/inquiry/topics", async (_req, res) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const headers = {};
    if (process.env.INQUIRY_SERVICE_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry/topics`, {
        headers,
        signal: AbortSignal.timeout(3e3)
      });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    } catch {
      return res.status(503).json({ success: false, error: "Inquiry service unavailable" });
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
