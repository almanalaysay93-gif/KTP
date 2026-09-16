-- Nurse portal: supervisor feed, training calendar, and email reminders (Phase 1 migration).
-- Additive schema expansion for staffMessages, staffMessageRecipients,
-- staffMessageAcknowledgments, trainingOutbox, trainingActivity, and nurseTrainings fields.

-- 1. Extend nurseTrainings with schedule version, response, attendance outcome, and evidence fields
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "scheduleVersion" integer DEFAULT 1 NOT NULL;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "staffResponse" varchar(32) DEFAULT 'Pending' NOT NULL;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "staffResponseReason" text;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "staffRespondedAt" timestamp;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "staffResponseVersion" integer;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "attendanceOutcome" varchar(32) DEFAULT 'Not recorded' NOT NULL;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "attendanceRecordedAt" timestamp;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "attendanceRecordedBy" integer;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "attendanceNote" text;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceStatus" varchar(32) DEFAULT 'None' NOT NULL;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceRequired" boolean DEFAULT false NOT NULL;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceSubmittedAt" timestamp;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceReviewedAt" timestamp;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceReviewedBy" integer;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "evidenceReviewNote" text;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "conflictOverrideReason" text;
ALTER TABLE nursetrack."nurseTrainings" ADD COLUMN IF NOT EXISTS "conflictOverrideBy" integer;

-- 2. Staff supervisor messages
CREATE TABLE IF NOT EXISTS nursetrack."staffMessages" (
  "id" serial PRIMARY KEY,
  "senderUserId" integer NOT NULL,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "archivedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_created ON nursetrack."staffMessages" ("createdAt");

-- 3. Staff message recipients and per-nurse read state
CREATE TABLE IF NOT EXISTS nursetrack."staffMessageRecipients" (
  "id" serial PRIMARY KEY,
  "messageId" integer NOT NULL,
  "nurseId" integer NOT NULL,
  "readAt" timestamp,
  "lastReadRevision" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_msg_recipient ON nursetrack."staffMessageRecipients" ("messageId", "nurseId");
CREATE INDEX IF NOT EXISTS idx_msg_recip_nurse ON nursetrack."staffMessageRecipients" ("nurseId");

-- 4. Staff message acknowledgments per revision
CREATE TABLE IF NOT EXISTS nursetrack."staffMessageAcknowledgments" (
  "id" serial PRIMARY KEY,
  "messageId" integer NOT NULL,
  "nurseId" integer NOT NULL,
  "revision" integer NOT NULL,
  "acknowledgedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_msg_ack ON nursetrack."staffMessageAcknowledgments" ("messageId", "nurseId", "revision");
CREATE INDEX IF NOT EXISTS idx_msg_ack_nurse ON nursetrack."staffMessageAcknowledgments" ("nurseId");

-- 5. Training outbox for milestone reminders and immediate notices
CREATE TABLE IF NOT EXISTS nursetrack."trainingOutbox" (
  "id" serial PRIMARY KEY,
  "assignmentId" integer NOT NULL,
  "scheduleVersion" integer NOT NULL,
  "noticeKind" varchar(32) NOT NULL,
  "thresholdDays" integer,
  "dueDate" date,
  "recipientNurseId" integer NOT NULL,
  "recipientEmail" varchar(320),
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lastAttemptAt" timestamp,
  "claimedAt" timestamp,
  "providerMessageId" text,
  "errorDetail" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_status_due ON nursetrack."trainingOutbox" ("status", "dueDate");
CREATE INDEX IF NOT EXISTS idx_outbox_assignment ON nursetrack."trainingOutbox" ("assignmentId", "scheduleVersion");
CREATE UNIQUE INDEX IF NOT EXISTS uniq_outbox_milestone ON nursetrack."trainingOutbox" ("assignmentId", "scheduleVersion", "noticeKind");

-- 6. In-app training activity feed items
CREATE TABLE IF NOT EXISTS nursetrack."trainingActivity" (
  "id" serial PRIMARY KEY,
  "nurseId" integer NOT NULL,
  "assignmentId" integer NOT NULL,
  "activityType" varchar(32) NOT NULL,
  "title" varchar(256) NOT NULL,
  "message" text,
  "readAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tact_nurse ON nursetrack."trainingActivity" ("nurseId");
CREATE INDEX IF NOT EXISTS idx_tact_assignment ON nursetrack."trainingActivity" ("assignmentId");
