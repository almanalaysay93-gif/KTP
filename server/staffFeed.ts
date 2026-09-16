import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { getSqliteDb } from "./localDb";
import { staffMessages, staffMessageRecipients, staffMessageAcknowledgments, nurses, users } from "../drizzle/schema";

export interface CreateMessageInput {
  senderUserId: number;
  title: string;
  body: string;
  recipientNurseIds: number[];
}

export async function createStaffMessage(input: CreateMessageInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > 160) throw new Error("Title must be between 1 and 160 characters");
  if (!body || body.length > 5000) throw new Error("Body must be between 1 and 5000 characters");
  const uniqueRecipients = Array.from(new Set(input.recipientNurseIds.filter((id) => typeof id === "number" && id > 0)));
  if (uniqueRecipients.length === 0) throw new Error("At least one recipient nurse is required");

  const db = await getDb();
  if (db) {
    const [msg] = await db
      .insert(staffMessages)
      .values({
        senderUserId: input.senderUserId,
        title,
        body,
        revision: 1,
      })
      .returning();

    const recipientRows = uniqueRecipients.map((nurseId) => ({
      messageId: msg.id,
      nurseId,
    }));
    await db.insert(staffMessageRecipients).values(recipientRows);
    return msg;
  }

  const sqlite = getSqliteDb();
  const res = sqlite
    .prepare("INSERT INTO staffMessages (senderUserId, title, body, revision) VALUES (?, ?, ?, 1)")
    .run(input.senderUserId, title, body);
  const msgId = Number(res.lastInsertRowid);

  const insRecipient = sqlite.prepare("INSERT OR IGNORE INTO staffMessageRecipients (messageId, nurseId) VALUES (?, ?)");
  const insertMany = sqlite.transaction((rIds: number[]) => {
    for (const rId of rIds) {
      insRecipient.run(msgId, rId);
    }
  });
  insertMany(uniqueRecipients);

  return sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(msgId) as any;
}

export async function listSentStaffMessages(limit = 50) {
  const db = await getDb();
  if (db) {
    const messages = await db
      .select({
        id: staffMessages.id,
        senderUserId: staffMessages.senderUserId,
        title: staffMessages.title,
        body: staffMessages.body,
        revision: staffMessages.revision,
        archivedAt: staffMessages.archivedAt,
        createdAt: staffMessages.createdAt,
        updatedAt: staffMessages.updatedAt,
        senderName: users.name,
      })
      .from(staffMessages)
      .leftJoin(users, eq(users.id, staffMessages.senderUserId))
      .orderBy(desc(staffMessages.createdAt))
      .limit(limit);

    if (messages.length === 0) return [];
    const msgIds = messages.map((m) => m.id);

    const recips = await db
      .select({
        messageId: staffMessageRecipients.messageId,
        nurseId: staffMessageRecipients.nurseId,
        readAt: staffMessageRecipients.readAt,
        lastReadRevision: staffMessageRecipients.lastReadRevision,
      })
      .from(staffMessageRecipients)
      .where(inArray(staffMessageRecipients.messageId, msgIds));

    const acks = await db
      .select({
        messageId: staffMessageAcknowledgments.messageId,
        revision: staffMessageAcknowledgments.revision,
      })
      .from(staffMessageAcknowledgments)
      .where(inArray(staffMessageAcknowledgments.messageId, msgIds));

    return messages.map((m) => {
      const mRecips = recips.filter((r) => r.messageId === m.id);
      const mAcks = acks.filter((a) => a.messageId === m.id && a.revision === m.revision);
      const readCount = mRecips.filter((r) => r.readAt != null && (r.lastReadRevision ?? 0) >= m.revision).length;
      return {
        ...m,
        recipientCount: mRecips.length,
        readCount,
        ackCount: mAcks.length,
      };
    });
  }

  const sqlite = getSqliteDb();
  const rows = sqlite
    .prepare(
      `SELECT m.*, u.name as senderName,
       (SELECT count(*) FROM staffMessageRecipients r WHERE r.messageId = m.id) as recipientCount,
       (SELECT count(*) FROM staffMessageRecipients r WHERE r.messageId = m.id AND r.readAt IS NOT NULL AND r.lastReadRevision >= m.revision) as readCount,
       (SELECT count(*) FROM staffMessageAcknowledgments a WHERE a.messageId = m.id AND a.revision = m.revision) as ackCount
       FROM staffMessages m
       LEFT JOIN users u ON u.id = m.senderUserId
       ORDER BY datetime(m.createdAt) DESC LIMIT ?`
    )
    .all(limit) as any[];
  return rows;
}

export async function getStaffMessageDetail(messageId: number) {
  const db = await getDb();
  if (db) {
    const [msg] = await db
      .select({
        id: staffMessages.id,
        senderUserId: staffMessages.senderUserId,
        title: staffMessages.title,
        body: staffMessages.body,
        revision: staffMessages.revision,
        archivedAt: staffMessages.archivedAt,
        createdAt: staffMessages.createdAt,
        updatedAt: staffMessages.updatedAt,
        senderName: users.name,
      })
      .from(staffMessages)
      .leftJoin(users, eq(users.id, staffMessages.senderUserId))
      .where(eq(staffMessages.id, messageId));

    if (!msg) return null;

    const recipients = await db
      .select({
        nurseId: staffMessageRecipients.nurseId,
        readAt: staffMessageRecipients.readAt,
        lastReadRevision: staffMessageRecipients.lastReadRevision,
        employeeId: nurses.employeeId,
        firstName: nurses.firstName,
        lastName: nurses.lastName,
      })
      .from(staffMessageRecipients)
      .innerJoin(nurses, eq(nurses.id, staffMessageRecipients.nurseId))
      .where(eq(staffMessageRecipients.messageId, messageId));

    const acks = await db
      .select({
        nurseId: staffMessageAcknowledgments.nurseId,
        revision: staffMessageAcknowledgments.revision,
        acknowledgedAt: staffMessageAcknowledgments.acknowledgedAt,
      })
      .from(staffMessageAcknowledgments)
      .where(eq(staffMessageAcknowledgments.messageId, messageId));

    const ackMap = new Map(acks.map((a) => [`${a.nurseId}:${a.revision}`, a.acknowledgedAt]));

    return {
      ...msg,
      recipients: recipients.map((r) => ({
        ...r,
        isRead: r.readAt != null && (r.lastReadRevision ?? 0) >= msg.revision,
        acknowledgedAt: ackMap.get(`${r.nurseId}:${msg.revision}`) ?? null,
      })),
    };
  }

  const sqlite = getSqliteDb();
  const msg = sqlite
    .prepare(
      `SELECT m.*, u.name as senderName FROM staffMessages m LEFT JOIN users u ON u.id = m.senderUserId WHERE m.id = ?`
    )
    .get(messageId) as any;
  if (!msg) return null;

  const recipients = sqlite
    .prepare(
      `SELECT r.nurseId, r.readAt, r.lastReadRevision, n.employeeId, n.firstName, n.lastName,
       (SELECT a.acknowledgedAt FROM staffMessageAcknowledgments a WHERE a.messageId = r.messageId AND a.nurseId = r.nurseId AND a.revision = ?) as acknowledgedAt
       FROM staffMessageRecipients r
       INNER JOIN nurses n ON n.id = r.nurseId
       WHERE r.messageId = ?`
    )
    .all(msg.revision, messageId) as any[];

  return {
    ...msg,
    recipients: recipients.map((r) => ({
      ...r,
      isRead: r.readAt != null && (r.lastReadRevision ?? 0) >= msg.revision,
    })),
  };
}

export async function updateStaffMessage(messageId: number, title: string, body: string) {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle || trimmedTitle.length > 160) throw new Error("Title must be between 1 and 160 characters");
  if (!trimmedBody || trimmedBody.length > 5000) throw new Error("Body must be between 1 and 5000 characters");

  const db = await getDb();
  if (db) {
    const [msg] = await db.select().from(staffMessages).where(eq(staffMessages.id, messageId));
    if (!msg) throw new Error("Message not found");
    const [updated] = await db
      .update(staffMessages)
      .set({
        title: trimmedTitle,
        body: trimmedBody,
        revision: msg.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(staffMessages.id, messageId))
      .returning();
    return updated;
  }

  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(messageId) as any;
  if (!msg) throw new Error("Message not found");
  sqlite
    .prepare("UPDATE staffMessages SET title = ?, body = ?, revision = revision + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
    .run(trimmedTitle, trimmedBody, messageId);
  return sqlite.prepare("SELECT * FROM staffMessages WHERE id = ?").get(messageId) as any;
}

export async function archiveStaffMessage(messageId: number) {
  const db = await getDb();
  if (db) {
    await db.update(staffMessages).set({ archivedAt: new Date() }).where(eq(staffMessages.id, messageId));
    return;
  }
  const sqlite = getSqliteDb();
  sqlite.prepare("UPDATE staffMessages SET archivedAt = CURRENT_TIMESTAMP WHERE id = ?").run(messageId);
}

export async function listNurseFeed(nurseId: number, limit = 50) {
  const db = await getDb();
  if (db) {
    const rows = await db
      .select({
        id: staffMessages.id,
        title: staffMessages.title,
        body: staffMessages.body,
        revision: staffMessages.revision,
        createdAt: staffMessages.createdAt,
        updatedAt: staffMessages.updatedAt,
        senderName: users.name,
        readAt: staffMessageRecipients.readAt,
        lastReadRevision: staffMessageRecipients.lastReadRevision,
      })
      .from(staffMessageRecipients)
      .innerJoin(staffMessages, eq(staffMessages.id, staffMessageRecipients.messageId))
      .leftJoin(users, eq(users.id, staffMessages.senderUserId))
      .where(and(eq(staffMessageRecipients.nurseId, nurseId), isNull(staffMessages.archivedAt)))
      .orderBy(desc(staffMessages.createdAt))
      .limit(limit);

    if (rows.length === 0) return [];
    const msgIds = rows.map((r) => r.id);

    const acks = await db
      .select({
        messageId: staffMessageAcknowledgments.messageId,
        revision: staffMessageAcknowledgments.revision,
        acknowledgedAt: staffMessageAcknowledgments.acknowledgedAt,
      })
      .from(staffMessageAcknowledgments)
      .where(and(eq(staffMessageAcknowledgments.nurseId, nurseId), inArray(staffMessageAcknowledgments.messageId, msgIds)));

    const ackMap = new Map(acks.map((a) => [`${a.messageId}:${a.revision}`, a.acknowledgedAt]));

    return rows.map((r) => {
      const isRead = r.readAt != null && (r.lastReadRevision ?? 0) >= r.revision;
      const acknowledgedAt = ackMap.get(`${r.id}:${r.revision}`) ?? null;
      return {
        ...r,
        isRead,
        isUnread: !isRead,
        isEdited: r.revision > 1,
        acknowledgedAt,
      };
    });
  }

  const sqlite = getSqliteDb();
  const rows = sqlite
    .prepare(
      `SELECT m.id, m.title, m.body, m.revision, m.createdAt, m.updatedAt, u.name as senderName,
       r.readAt, r.lastReadRevision,
       (SELECT a.acknowledgedAt FROM staffMessageAcknowledgments a WHERE a.messageId = m.id AND a.nurseId = ? AND a.revision = m.revision) as acknowledgedAt
       FROM staffMessageRecipients r
       INNER JOIN staffMessages m ON m.id = r.messageId
       LEFT JOIN users u ON u.id = m.senderUserId
       WHERE r.nurseId = ? AND m.archivedAt IS NULL
       ORDER BY datetime(m.createdAt) DESC LIMIT ?`
    )
    .all(nurseId, nurseId, limit) as any[];

  return rows.map((r) => {
    const isRead = r.readAt != null && (r.lastReadRevision ?? 0) >= r.revision;
    return {
      ...r,
      isRead,
      isUnread: !isRead,
      isEdited: r.revision > 1,
    };
  });
}

export async function countUnreadNurseMessages(nurseId: number): Promise<number> {
  const db = await getDb();
  if (db) {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(staffMessageRecipients)
      .innerJoin(staffMessages, eq(staffMessages.id, staffMessageRecipients.messageId))
      .where(
        and(
          eq(staffMessageRecipients.nurseId, nurseId),
          isNull(staffMessages.archivedAt),
          sql`(${staffMessageRecipients.readAt} IS NULL OR ${staffMessageRecipients.lastReadRevision} < ${staffMessages.revision})`
        )
      );
    return Number(rows[0]?.count ?? 0);
  }

  const sqlite = getSqliteDb();
  const row = sqlite
    .prepare(
      `SELECT count(*) as cnt FROM staffMessageRecipients r
       INNER JOIN staffMessages m ON m.id = r.messageId
       WHERE r.nurseId = ? AND m.archivedAt IS NULL AND (r.readAt IS NULL OR r.lastReadRevision < m.revision)`
    )
    .get(nurseId) as { cnt: number };
  return row?.cnt ?? 0;
}

export async function markNurseMessageRead(nurseId: number, messageId: number) {
  const db = await getDb();
  if (db) {
    const [msg] = await db.select().from(staffMessages).where(eq(staffMessages.id, messageId));
    if (!msg) return;
    await db
      .update(staffMessageRecipients)
      .set({
        readAt: new Date(),
        lastReadRevision: msg.revision,
      })
      .where(and(eq(staffMessageRecipients.messageId, messageId), eq(staffMessageRecipients.nurseId, nurseId)));
    return;
  }

  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT revision FROM staffMessages WHERE id = ?").get(messageId) as any;
  if (!msg) return;
  sqlite
    .prepare("UPDATE staffMessageRecipients SET readAt = CURRENT_TIMESTAMP, lastReadRevision = ? WHERE messageId = ? AND nurseId = ?")
    .run(msg.revision, messageId, nurseId);
}

export async function acknowledgeNurseMessage(nurseId: number, messageId: number, revision: number) {
  const db = await getDb();
  if (db) {
    const [msg] = await db.select().from(staffMessages).where(eq(staffMessages.id, messageId));
    if (!msg) throw new Error("Message not found");
    if (msg.revision !== revision) {
      throw new Error(`Message was updated to revision ${msg.revision}. Please review the updated content before acknowledging.`);
    }

    const [recipient] = await db
      .select()
      .from(staffMessageRecipients)
      .where(and(eq(staffMessageRecipients.messageId, messageId), eq(staffMessageRecipients.nurseId, nurseId)));
    if (!recipient) throw new Error("You are not a recipient of this message");

    await db
      .insert(staffMessageAcknowledgments)
      .values({
        messageId,
        nurseId,
        revision,
      })
      .onConflictDoNothing();

    await db
      .update(staffMessageRecipients)
      .set({
        readAt: new Date(),
        lastReadRevision: msg.revision,
      })
      .where(and(eq(staffMessageRecipients.messageId, messageId), eq(staffMessageRecipients.nurseId, nurseId)));

    return { success: true, messageId, revision };
  }

  const sqlite = getSqliteDb();
  const msg = sqlite.prepare("SELECT revision FROM staffMessages WHERE id = ?").get(messageId) as any;
  if (!msg) throw new Error("Message not found");
  if (msg.revision !== revision) {
    throw new Error(`Message was updated to revision ${msg.revision}. Please review the updated content before acknowledging.`);
  }

  const recipient = sqlite
    .prepare("SELECT * FROM staffMessageRecipients WHERE messageId = ? AND nurseId = ?")
    .get(messageId, nurseId);
  if (!recipient) throw new Error("You are not a recipient of this message");

  sqlite
    .prepare("INSERT OR IGNORE INTO staffMessageAcknowledgments (messageId, nurseId, revision) VALUES (?, ?, ?)")
    .run(messageId, nurseId, revision);

  sqlite
    .prepare("UPDATE staffMessageRecipients SET readAt = CURRENT_TIMESTAMP, lastReadRevision = ? WHERE messageId = ? AND nurseId = ?")
    .run(msg.revision, messageId, nurseId);

  return { success: true, messageId, revision };
}
