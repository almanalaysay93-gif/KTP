CREATE TABLE IF NOT EXISTS nursetrack."memos" (
  "id" serial PRIMARY KEY,
  "memoType" varchar(32) NOT NULL,
  "areaId" integer,
  "title" varchar(256) NOT NULL,
  "body" text NOT NULL,
  "authorUserId" integer NOT NULL,
  "status" varchar(16) DEFAULT 'sent' NOT NULL,
  "sentAt" timestamp DEFAULT now() NOT NULL,
  "retractedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_memos_sent" ON nursetrack."memos" ("sentAt");
CREATE INDEX IF NOT EXISTS "idx_memos_type" ON nursetrack."memos" ("memoType");

CREATE TABLE IF NOT EXISTS nursetrack."memoRecipients" (
  "id" serial PRIMARY KEY,
  "memoId" integer NOT NULL,
  "nurseId" integer NOT NULL,
  "linkedAtSend" boolean DEFAULT false NOT NULL,
  "readAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_memo_nurse" ON nursetrack."memoRecipients" ("memoId", "nurseId");
CREATE INDEX IF NOT EXISTS "idx_memo_rcp_nurse" ON nursetrack."memoRecipients" ("nurseId");
CREATE INDEX IF NOT EXISTS "idx_memo_rcp_memo" ON nursetrack."memoRecipients" ("memoId");
