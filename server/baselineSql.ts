export const BASELINE_SQL = `
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
	"accountEmail" varchar(320),
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
