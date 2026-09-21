import { and, desc, eq, inArray, isNull, not, sql } from "drizzle-orm";
import { areas, memoRecipients, memos, nurses } from "../drizzle/schema";
import { INACTIVE_EMPLOYMENT_STATUSES, MEMO_TYPES, nurseFullName, type MemoType } from "../shared/nursetrack";
import { getDb, INACTIVE_STATUS_SQL_LIST, logActivity } from "./db";
import { getSqliteDb } from "./localDb";

const TITLE_MAX = 256;
const BODY_MAX = 8000;

export type AudienceNurse = {
  id: number;
  firstName: string;
  lastName: string;
  currentAreaId: number | null;
  linkedUserId: number | null;
  staffType: string;
};

function sanitizePlainText(value: string, max: number): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

function assertMemoType(memoType: string): MemoType {
  if (!(MEMO_TYPES as readonly string[]).includes(memoType)) {
    throw new Error("Memo type must be department, nursing, or hospital.");
  }
  return memoType as MemoType;
}

function validateAudienceInput(memoType: MemoType, areaId?: number) {
  if (memoType === "department") {
    if (!areaId || areaId < 1) throw new Error("Department memo requires an area.");
    return;
  }
  if (areaId != null) throw new Error("Nursing and hospital memos cannot target an area.");
}

async function store() {
  const db = await getDb();
  if (db) return { kind: "pg" as const, db };
  return { kind: "sqlite" as const, sqlite: getSqliteDb() };
}

function sqliteAudienceWhere(memoType: MemoType, areaId?: number): { sql: string; params: number[] } {
  let extra = "";
  const params: number[] = [];
  if (memoType === "department") {
    extra = " AND currentAreaId = ?";
    params.push(areaId as number);
  }
  return {
    sql: `archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST})${extra}`,
    params,
  };
}

export async function previewAudience(input: { memoType: MemoType; areaId?: number }): Promise<{
  count: number;
  areaName: string | null;
  sample: { id: number; name: string }[];
}> {
  const memoType = assertMemoType(input.memoType);
  validateAudienceInput(memoType, input.areaId);
  const audience = await listAudience(memoType, input.areaId);
  let areaName: string | null = null;
  if (memoType === "department" && input.areaId) {
    areaName = await getAreaName(input.areaId);
  }
  return {
    count: audience.length,
    areaName,
    sample: audience.slice(0, 8).map((n) => ({ id: n.id, name: nurseFullName(n) })),
  };
}

async function getAreaName(areaId: number): Promise<string | null> {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db.select({ name: areas.name }).from(areas).where(eq(areas.id, areaId)).limit(1);
    return rows[0]?.name ?? null;
  }
  const row = s.sqlite.prepare("SELECT name FROM areas WHERE id = ?").get(areaId) as { name: string } | undefined;
  return row?.name ?? null;
}

async function listAudience(memoType: MemoType, areaId?: number): Promise<AudienceNurse[]> {
  const s = await store();
  if (s.kind === "pg") {
    const conds = [isNull(nurses.archivedAt), not(inArray(nurses.employmentStatus, INACTIVE_EMPLOYMENT_STATUSES as any))];
    if (memoType === "department") conds.push(eq(nurses.currentAreaId, areaId as number));
    const rows = await s.db
      .select({
        id: nurses.id,
        firstName: nurses.firstName,
        lastName: nurses.lastName,
        currentAreaId: nurses.currentAreaId,
        linkedUserId: nurses.linkedUserId,
        staffType: nurses.staffType,
      })
      .from(nurses)
      .where(and(...conds));
    return rows;
  }
  const where = sqliteAudienceWhere(memoType, areaId);
  return s.sqlite
    .prepare(
      `SELECT id, firstName, lastName, currentAreaId, linkedUserId, staffType FROM nurses WHERE ${where.sql} ORDER BY lastName, firstName`,
    )
    .all(...where.params) as AudienceNurse[];
}

export async function createMemo(input: {
  memoType: MemoType;
  areaId?: number;
  title: string;
  body: string;
  authorUserId: number;
}): Promise<{ id: number }> {
  const memoType = assertMemoType(input.memoType);
  validateAudienceInput(memoType, input.areaId);
  const title = sanitizePlainText(input.title, TITLE_MAX);
  const body = sanitizePlainText(input.body, BODY_MAX);
  if (!title) throw new Error("Title is required.");
  if (!body) throw new Error("Body is required.");
  if (memoType === "department") {
    const name = await getAreaName(input.areaId as number);
    if (!name) throw new Error("Area not found.");
  }

  const audience = await listAudience(memoType, input.areaId);
  const s = await store();
  let memoId: number;

  if (s.kind === "pg") {
    const inserted = await s.db
      .insert(memos)
      .values({
        memoType,
        areaId: memoType === "department" ? input.areaId : null,
        title,
        body,
        authorUserId: input.authorUserId,
        status: "sent",
      })
      .returning({ id: memos.id });
    memoId = inserted[0].id;
    if (audience.length > 0) {
      await s.db.insert(memoRecipients).values(
        audience.map((n) => ({
          memoId,
          nurseId: n.id,
          linkedAtSend: Boolean(n.linkedUserId),
        })),
      );
    }
  } else {
    const result = s.sqlite
      .prepare(
        `INSERT INTO memos (memoType, areaId, title, body, authorUserId, status) VALUES (?, ?, ?, ?, ?, 'sent')`,
      )
      .run(memoType, memoType === "department" ? input.areaId : null, title, body, input.authorUserId);
    memoId = Number(result.lastInsertRowid);
    const insertR = s.sqlite.prepare(
      `INSERT INTO memoRecipients (memoId, nurseId, linkedAtSend) VALUES (?, ?, ?)`,
    );
    const tx = s.sqlite.transaction((rows: AudienceNurse[]) => {
      for (const n of rows) insertR.run(memoId, n.id, n.linkedUserId ? 1 : 0);
    });
    tx(audience);
  }

  await logActivity({
    supervisorId: input.authorUserId,
    actionType: "memo.sent",
    entityType: "memo",
    entityId: memoId,
    summary: `Sent ${memoType} memo: "${title}"`,
  });
  return { id: memoId };
}

export async function listMemos(opts: { memoType?: MemoType; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const s = await store();
  if (s.kind === "pg") {
    const rows = opts.memoType
      ? await s.db.select().from(memos).where(eq(memos.memoType, opts.memoType)).orderBy(desc(memos.sentAt)).limit(limit)
      : await s.db.select().from(memos).orderBy(desc(memos.sentAt)).limit(limit);
    const ids = rows.map((r) => r.id);
    const counts = await loadReceiptCounts(ids);
    return rows.map((r) => ({ ...r, ...counts.get(r.id)! }));
  }
  const typeFilter = opts.memoType ? "WHERE memoType = ?" : "";
  const params = opts.memoType ? [opts.memoType, limit] : [limit];
  const rows = s.sqlite
    .prepare(`SELECT * FROM memos ${typeFilter} ORDER BY datetime(sentAt) DESC LIMIT ?`)
    .all(...params) as any[];
  const ids = rows.map((r) => r.id);
  const counts = await loadReceiptCounts(ids);
  return rows.map((r) => ({ ...r, ...counts.get(r.id)! }));
}

async function loadReceiptCounts(memoIds: number[]) {
  const empty = { total: 0, read: 0, unread: 0, notLinked: 0 };
  const map = new Map<number, typeof empty>();
  for (const id of memoIds) map.set(id, { ...empty });
  if (memoIds.length === 0) return map;
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db
      .select({
        memoId: memoRecipients.memoId,
        total: sql<number>`count(*)`,
        read: sql<number>`sum(case when ${memoRecipients.readAt} is not null then 1 else 0 end)`,
        notLinked: sql<number>`sum(case when ${memoRecipients.linkedAtSend} = false then 1 else 0 end)`,
      })
      .from(memoRecipients)
      .where(inArray(memoRecipients.memoId, memoIds))
      .groupBy(memoRecipients.memoId);
    for (const r of rows) {
      const total = Number(r.total);
      const read = Number(r.read);
      const notLinked = Number(r.notLinked);
      map.set(r.memoId, { total, read, unread: total - read, notLinked });
    }
    return map;
  }
  const placeholders = memoIds.map(() => "?").join(",");
  const rows = s.sqlite
    .prepare(
      `SELECT memoId,
              COUNT(*) as total,
              SUM(CASE WHEN readAt IS NOT NULL THEN 1 ELSE 0 END) as readCount,
              SUM(CASE WHEN linkedAtSend = 0 THEN 1 ELSE 0 END) as notLinked
       FROM memoRecipients WHERE memoId IN (${placeholders}) GROUP BY memoId`,
    )
    .all(...memoIds) as { memoId: number; total: number; readCount: number; notLinked: number }[];
  for (const r of rows) {
    map.set(r.memoId, {
      total: Number(r.total),
      read: Number(r.readCount),
      unread: Number(r.total) - Number(r.readCount),
      notLinked: Number(r.notLinked),
    });
  }
  return map;
}

export async function getMemo(id: number) {
  const s = await store();
  let memo: any;
  if (s.kind === "pg") {
    const rows = await s.db.select().from(memos).where(eq(memos.id, id)).limit(1);
    memo = rows[0];
  } else {
    memo = s.sqlite.prepare("SELECT * FROM memos WHERE id = ?").get(id);
  }
  if (!memo) return null;
  const counts = await loadReceiptCounts([id]);
  return { ...memo, ...counts.get(id)! };
}

export async function listMemoReceipts(memoId: number) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db
      .select({
        nurseId: memoRecipients.nurseId,
        linkedAtSend: memoRecipients.linkedAtSend,
        readAt: memoRecipients.readAt,
        firstName: nurses.firstName,
        lastName: nurses.lastName,
        middleName: nurses.middleName,
        suffix: nurses.suffix,
        areaName: areas.name,
      })
      .from(memoRecipients)
      .innerJoin(nurses, eq(nurses.id, memoRecipients.nurseId))
      .leftJoin(areas, eq(areas.id, nurses.currentAreaId))
      .where(eq(memoRecipients.memoId, memoId))
      .orderBy(nurses.lastName, nurses.firstName);
    return rows.map((r) => ({
      nurseId: r.nurseId,
      name: nurseFullName(r),
      areaName: r.areaName ?? null,
      linkedAtSend: Boolean(r.linkedAtSend),
      readAt: r.readAt,
    }));
  }
  const rows = s.sqlite
    .prepare(
      `SELECT r.nurseId, r.linkedAtSend, r.readAt, n.firstName, n.lastName, n.middleName, n.suffix, a.name as areaName
       FROM memoRecipients r
       INNER JOIN nurses n ON n.id = r.nurseId
       LEFT JOIN areas a ON a.id = n.currentAreaId
       WHERE r.memoId = ?
       ORDER BY n.lastName, n.firstName`,
    )
    .all(memoId) as any[];
  return rows.map((r) => ({
    nurseId: r.nurseId,
    name: nurseFullName(r),
    areaName: r.areaName ?? null,
    linkedAtSend: Boolean(r.linkedAtSend),
    readAt: r.readAt ?? null,
  }));
}

export async function retractMemo(input: { memoId: number; authorUserId: number }) {
  const memo = await getMemo(input.memoId);
  if (!memo) throw new Error("Memo not found.");
  if (memo.status === "retracted") return { ok: true as const };
  const s = await store();
  if (s.kind === "pg") {
    await s.db.update(memos).set({ status: "retracted", retractedAt: new Date() }).where(eq(memos.id, input.memoId));
  } else {
    s.sqlite
      .prepare("UPDATE memos SET status = 'retracted', retractedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
      .run(input.memoId);
  }
  await logActivity({
    supervisorId: input.authorUserId,
    actionType: "memo.retracted",
    entityType: "memo",
    entityId: input.memoId,
    summary: `Retracted memo: "${memo.title}"`,
  });
  return { ok: true as const };
}

export async function listFeedForNurse(nurseId: number) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db
      .select({
        id: memos.id,
        memoType: memos.memoType,
        title: memos.title,
        body: memos.body,
        sentAt: memos.sentAt,
        areaId: memos.areaId,
        readAt: memoRecipients.readAt,
      })
      .from(memoRecipients)
      .innerJoin(memos, eq(memos.id, memoRecipients.memoId))
      .where(and(eq(memoRecipients.nurseId, nurseId), eq(memos.status, "sent")))
      .orderBy(desc(memos.sentAt));
    return rows;
  }
  return s.sqlite
    .prepare(
      `SELECT m.id, m.memoType, m.title, m.body, m.sentAt, m.areaId, r.readAt
       FROM memoRecipients r
       INNER JOIN memos m ON m.id = r.memoId
       WHERE r.nurseId = ? AND m.status = 'sent'
       ORDER BY datetime(m.sentAt) DESC`,
    )
    .all(nurseId) as any[];
}

export async function countUnreadForNurse(nurseId: number): Promise<number> {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db
      .select({ count: sql<number>`count(*)` })
      .from(memoRecipients)
      .innerJoin(memos, eq(memos.id, memoRecipients.memoId))
      .where(and(eq(memoRecipients.nurseId, nurseId), eq(memos.status, "sent"), isNull(memoRecipients.readAt)));
    return Number(rows[0]?.count ?? 0);
  }
  const row = s.sqlite
    .prepare(
      `SELECT COUNT(*) as count
       FROM memoRecipients r
       INNER JOIN memos m ON m.id = r.memoId
       WHERE r.nurseId = ? AND m.status = 'sent' AND r.readAt IS NULL`,
    )
    .get(nurseId) as { count: number };
  return Number(row.count);
}

export async function markMemoRead(input: { memoId: number; nurseId: number }) {
  const s = await store();
  if (s.kind === "pg") {
    const rows = await s.db
      .select()
      .from(memoRecipients)
      .where(and(eq(memoRecipients.memoId, input.memoId), eq(memoRecipients.nurseId, input.nurseId)))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new Error("You are not a recipient of this memo.");
    if (existing.readAt) return { alreadyRead: true, readAt: existing.readAt };
    const readAt = new Date();
    await s.db
      .update(memoRecipients)
      .set({ readAt })
      .where(and(eq(memoRecipients.memoId, input.memoId), eq(memoRecipients.nurseId, input.nurseId), isNull(memoRecipients.readAt)));
    return { alreadyRead: false, readAt };
  }
  const existing = s.sqlite
    .prepare("SELECT readAt FROM memoRecipients WHERE memoId = ? AND nurseId = ?")
    .get(input.memoId, input.nurseId) as { readAt: string | null } | undefined;
  if (!existing) throw new Error("You are not a recipient of this memo.");
  if (existing.readAt) return { alreadyRead: true, readAt: existing.readAt };
  s.sqlite
    .prepare("UPDATE memoRecipients SET readAt = CURRENT_TIMESTAMP WHERE memoId = ? AND nurseId = ? AND readAt IS NULL")
    .run(input.memoId, input.nurseId);
  const updated = s.sqlite
    .prepare("SELECT readAt FROM memoRecipients WHERE memoId = ? AND nurseId = ?")
    .get(input.memoId, input.nurseId) as { readAt: string };
  return { alreadyRead: false, readAt: updated.readAt };
}
