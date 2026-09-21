import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const localState = vi.hoisted(() => ({ sqlite: null as Database.Database | null }));

vi.mock("./localDb", () => ({
  getSqliteDb: () => {
    if (!localState.sqlite) throw new Error("Test database is not ready.");
    return localState.sqlite;
  },
}));

import {
  countUnreadForNurse,
  createMemo,
  listFeedForNurse,
  listMemoReceipts,
  markMemoRead,
  previewAudience,
  retractMemo,
} from "./memosDb";

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
  localState.sqlite = new Database(":memory:");
  localState.sqlite.exec(`
    CREATE TABLE areas (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE nurses (
      id INTEGER PRIMARY KEY,
      employeeId TEXT NOT NULL,
      firstName TEXT NOT NULL,
      middleName TEXT,
      lastName TEXT NOT NULL,
      suffix TEXT,
      staffType TEXT NOT NULL,
      employmentStatus TEXT NOT NULL,
      currentAreaId INTEGER,
      archivedAt TEXT,
      linkedUserId INTEGER
    );
    CREATE TABLE memos (
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
    CREATE TABLE memoRecipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memoId INTEGER NOT NULL,
      nurseId INTEGER NOT NULL,
      linkedAtSend INTEGER NOT NULL,
      readAt TEXT
    );
    CREATE TABLE activityLog (
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
  `);
});

beforeEach(() => {
  const sqlite = localState.sqlite!;
  sqlite.exec("DELETE FROM memoRecipients; DELETE FROM memos; DELETE FROM activityLog; DELETE FROM nurses; DELETE FROM areas;");
  sqlite.prepare("INSERT INTO areas (id, code, name, active) VALUES (1, 'ICU', 'SKTI ICU', 1), (2, 'PAY', 'SKTI PAY', 1)").run();
  sqlite.prepare(`
    INSERT INTO nurses (id, employeeId, firstName, lastName, staffType, employmentStatus, currentAreaId, archivedAt, linkedUserId)
    VALUES
      (1, 'E1', 'Ana', 'Icu', 'Registered Nurse', 'Active', 1, NULL, 101),
      (2, 'E2', 'Ben', 'IcuNa', 'Nursing Attendant', 'Active', 1, NULL, NULL),
      (3, 'E3', 'Cara', 'Pay', 'Registered Nurse', 'Active', 2, NULL, 103),
      (4, 'E4', 'Dan', 'None', 'Registered Nurse', 'Active', NULL, NULL, 104),
      (5, 'E5', 'Eve', 'Gone', 'Registered Nurse', 'Resigned', 1, NULL, 105),
      (6, 'E6', 'Fay', 'Arch', 'Nursing Attendant', 'Active', 1, '2026-01-01', 106)
  `).run();
});

afterAll(() => {
  localState.sqlite?.close();
  localState.sqlite = null;
  vi.unstubAllEnvs();
});

describe("memo audience", () => {
  it("limits department memos to the selected current area", async () => {
    const preview = await previewAudience({ memoType: "department", areaId: 1 });
    expect(preview.count).toBe(2);
    expect(preview.sample.map((n) => n.id).sort()).toEqual([1, 2]);

    const memo = await createMemo({
      memoType: "department",
      areaId: 1,
      title: "ICU huddle",
      body: "Report at 0700.",
      authorUserId: 9,
    });
    const receipts = await listMemoReceipts(memo.id);
    expect(receipts.map((r) => r.nurseId).sort()).toEqual([1, 2]);
    expect(receipts.find((r) => r.nurseId === 1)?.linkedAtSend).toBe(true);
    expect(receipts.find((r) => r.nurseId === 2)?.linkedAtSend).toBe(false);
  });

  it("excludes unassigned nurses from department memos", async () => {
    const preview = await previewAudience({ memoType: "department", areaId: 1 });
    expect(preview.sample.some((n) => n.id === 4)).toBe(false);
  });

  it("includes RN and NA for nursing and hospital memos", async () => {
    const nursing = await previewAudience({ memoType: "nursing" });
    const hospital = await previewAudience({ memoType: "hospital" });
    expect(nursing.count).toBe(4);
    expect(hospital.count).toBe(4);
    expect(nursing.sample.map((n) => n.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it("excludes archived and resigned nurses", async () => {
    const hospital = await previewAudience({ memoType: "hospital" });
    expect(hospital.sample.some((n) => n.id === 5 || n.id === 6)).toBe(false);
  });
});

describe("staff memo feed", () => {
  it("returns only that nurse's sent memos", async () => {
    const icu = await createMemo({
      memoType: "department",
      areaId: 1,
      title: "ICU only",
      body: "Stay on unit.",
      authorUserId: 9,
    });
    await createMemo({
      memoType: "hospital",
      title: "All staff",
      body: "Holiday coverage.",
      authorUserId: 9,
    });

    const anaFeed = await listFeedForNurse(1);
    const caraFeed = await listFeedForNurse(3);
    expect(anaFeed.map((m) => m.title).sort()).toEqual(["All staff", "ICU only"]);
    expect(caraFeed.map((m) => m.title)).toEqual(["All staff"]);
    expect(anaFeed.find((m) => m.id === icu.id)?.memoType).toBe("department");
  });

  it("rejects marking another nurse's receipt", async () => {
    const memo = await createMemo({
      memoType: "department",
      areaId: 1,
      title: "ICU only",
      body: "Stay on unit.",
      authorUserId: 9,
    });
    await expect(markMemoRead({ memoId: memo.id, nurseId: 3 })).rejects.toThrow(/not a recipient/i);
  });

  it("hides retracted memos from the feed and keeps receipts", async () => {
    const memo = await createMemo({
      memoType: "hospital",
      title: "Recall this",
      body: "Wrong date.",
      authorUserId: 9,
    });
    await retractMemo({ memoId: memo.id, authorUserId: 9 });
    expect(await listFeedForNurse(1)).toEqual([]);
    expect(await listMemoReceipts(memo.id)).toHaveLength(4);
  });

  it("sets readAt once and does not reset it", async () => {
    const memo = await createMemo({
      memoType: "hospital",
      title: "Read me",
      body: "Please read.",
      authorUserId: 9,
    });
    expect(await countUnreadForNurse(1)).toBe(1);
    const first = await markMemoRead({ memoId: memo.id, nurseId: 1 });
    expect(first.alreadyRead).toBe(false);
    expect(first.readAt).toBeTruthy();
    expect(await countUnreadForNurse(1)).toBe(0);
    const second = await markMemoRead({ memoId: memo.id, nurseId: 1 });
    expect(second.alreadyRead).toBe(true);
    expect(second.readAt).toBe(first.readAt);
  });
});
