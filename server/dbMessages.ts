import { TRPCError } from "@trpc/server";
import { getBatchClient, getDb } from "./db";
import { getSqliteDb } from "./localDb";

type Row = Record<string, any>;
type Query = { sql: string; args: unknown[] };
type Program<T> = Generator<Query, T, Row[]>;
const query = (sql: string, ...args: unknown[]): Query => ({ sql, args });

async function execute<T>(make: () => Program<T>): Promise<T> {
  if (!process.env.DATABASE_URL) {
    const db = getSqliteDb();
    return db.transaction(() => {
      const program = make();
      let step = program.next();
      while (!step.done) {
        const statement = db.prepare(step.value.sql);
        const rows = statement.reader
          ? statement.all(...step.value.args)
          : (statement.run(...step.value.args), []);
        step = program.next(rows as Row[]);
      }
      return step.value;
    }).immediate();
  }
  if (!await getDb()) throw new Error("Database unavailable");
  const client = getBatchClient()!;
  return (await client.begin(async (transaction: any) => {
    const program = make();
    let step = program.next();
    while (!step.done) {
      let parameter = 0;
      const sql = step.value.sql.replace(/\?/g, () => `$${++parameter}`);
      const rows = await transaction.unsafe(sql, step.value.args as any[]);
      step = program.next([...rows]);
    }
    return step.value;
  })) as unknown as T;
}

export interface AdminBroadcastMessage {
  id: number;
  senderUserId: number;
  subject: string;
  body: string;
  targetType: string;
  targetStage: string | null;
  targetPatientId: number | null;
  createdAt: string;
  recipientCount: number;
  readCount: number;
  acknowledgedCount: number;
}

export interface PatientMessageItem {
  id: number;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

export async function createBroadcastMessage(input: {
  senderUserId: number;
  subject: string;
  body: string;
  targetType: "All" | "Recipient" | "Donor" | "Stage" | "Specific";
  targetStage?: string;
  targetPatientId?: number;
}): Promise<{ id: number; recipientCount: number }> {
  return execute(function* () {
    let patientSql = "SELECT id FROM patients WHERE status = 'Active'";
    const patientArgs: unknown[] = [];

    if (input.targetType === "Recipient") {
      patientSql += " AND \"patientType\" = ?";
      patientArgs.push("Recipient");
    } else if (input.targetType === "Donor") {
      patientSql += " AND \"patientType\" = ?";
      patientArgs.push("Donor");
    } else if (input.targetType === "Stage" && input.targetStage) {
      patientSql += " AND stage = ?";
      patientArgs.push(input.targetStage);
    } else if (input.targetType === "Specific" && input.targetPatientId) {
      patientSql += " AND id = ?";
      patientArgs.push(input.targetPatientId);
    }

    const recipients = yield query(patientSql, ...patientArgs);
    if (!recipients.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active patients match the chosen broadcast target",
      });
    }

    const [msg] = yield query(
      `INSERT INTO messages ("senderUserId", subject, body, "targetType", "targetStage", "targetPatientId")
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      input.senderUserId,
      input.subject,
      input.body,
      input.targetType,
      input.targetStage ?? null,
      input.targetPatientId ?? null
    );

    const messageId = msg.id as number;

    for (const p of recipients) {
      yield query(
        'INSERT INTO "messageRecipients" ("messageId", "patientId") VALUES (?, ?)',
        messageId,
        p.id
      );
      yield query(
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

export async function listAdminMessages(): Promise<AdminBroadcastMessage[]> {
  return execute(function* () {
    const rows = yield query(`
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
      acknowledgedCount: Number(r.acknowledgedCount || 0),
    }));
  });
}

export async function listPatientMessages(patientId: number): Promise<PatientMessageItem[]> {
  return execute(function* () {
    const rows = yield query(
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
      acknowledgedAt: r.acknowledgedAt ? String(r.acknowledgedAt) : null,
    }));
  });
}

export async function acknowledgePatientMessage(
  patientId: number,
  messageId: number
): Promise<{ success: boolean }> {
  return execute(function* () {
    yield query(
      'UPDATE "messageRecipients" SET "readAt" = CURRENT_TIMESTAMP WHERE "messageId" = ? AND "patientId" = ? AND "readAt" IS NULL',
      messageId,
      patientId
    );
    yield query(
      'INSERT INTO "messageAcknowledgments" ("messageId", "patientId") VALUES (?, ?)',
      messageId,
      patientId
    );
    return { success: true };
  });
}
