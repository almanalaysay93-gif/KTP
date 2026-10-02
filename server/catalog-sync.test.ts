import { createRequire } from "module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { BASELINE_SQL } from "./baselineSql";
import { CHECKLIST_CATALOG, CHECKLIST_SPLITS, LAB_CATALOG, syncCatalog } from "./clinicalCatalog";

type Row = Record<string, any>;
type Run = (sql: string, args?: unknown[]) => Promise<Row[]>;

// Runs syncCatalog against one database and returns the statements that it sent.
async function sync(run: Run) {
  const sent: string[] = [];
  const program = syncCatalog();
  let step = program.next();
  while (!step.done) {
    sent.push(step.value.sql);
    step = program.next(await run(step.value.sql, step.value.args));
  }
  return sent;
}

// The catalog before the split: two lab tests, two panels, and two items that are not panels.
async function seedFirstCatalog(run: Run) {
  await run(`INSERT INTO "labTests" (name, unit, "sortOrder", active) VALUES ('Hemoglobin', 'g/L', 1, true), ('Creatinine', 'umol/L', 4, true)`);
  await run(`INSERT INTO "checklistCatalog" (name, category, phase, "appliesTo", "asIndicated", "sortOrder", active) VALUES
    ('Creatinine, BUN, uric acid', 'Lab', 1, 'Both', false, 14, true),
    ('HIV', 'Lab', 1, 'Both', false, 23, true),
    ('Repeat urinalysis and CBC', 'Lab', 3, 'Both', false, 61, true),
    ('Cardiology', 'Clearance', NULL, 'Both', false, 70, true)`);
  const items = await run('SELECT id, name FROM "checklistCatalog"');
  const id = (name: string) => items.find(item => item.name === name)!.id;
  await run(`INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate", note) VALUES
    (7, ${id("Creatinine, BUN, uric acid")}, 'Done', '2026-09-02', 'Outside laboratory'),
    (8, ${id("Creatinine, BUN, uric acid")}, 'NA', NULL, NULL),
    (7, ${id("HIV")}, 'Done', '2026-09-03', NULL)`);
}

const catalog = (run: Run) => run('SELECT name, phase, "sortOrder" FROM "checklistCatalog" WHERE active = true ORDER BY "sortOrder"');
const progress = (run: Run) => run(`SELECT p."patientId", c.name, p.status, CAST(p."doneDate" AS TEXT) AS "doneDate", p.note
  FROM "patientChecklist" p JOIN "checklistCatalog" c ON c.id = p."catalogId" WHERE c.active = true ORDER BY p."patientId", c."sortOrder"`);

function suite(name: string, open: () => Promise<{ run: Run; close: () => Promise<void> }>) {
  describe(`catalog sync on ${name}`, () => {
    it("fills an empty database with single tests and no panels", async () => {
      const { run, close } = await open();
      await sync(run);
      const tests = await run('SELECT id, name FROM "labTests" ORDER BY id');
      expect(tests.map(test => test.name)).toEqual(LAB_CATALOG.map(test => test[0]));
      expect(tests.slice(0, 15).map(test => test.id)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
      const items = await catalog(run);
      expect(items).toHaveLength(CHECKLIST_CATALOG.length);
      expect(items.filter(item => CHECKLIST_SPLITS[item.name])).toEqual([]);
      expect(items.filter(item => item.phase === 1).map(item => item.name)).toEqual(expect.arrayContaining(["Hemoglobin", "Uric acid", "Magnesium", "HIV"]));
      await close();
    });
    it("replaces each panel of the first catalog with its tests and keeps patient progress", async () => {
      const { run, close } = await open();
      await seedFirstCatalog(run);
      await sync(run);
      const tests = await run('SELECT id, name FROM "labTests" ORDER BY id');
      expect(tests.slice(0, 2).map(test => [test.id, test.name])).toEqual([[1, "Hemoglobin"], [2, "Creatinine"]]);
      expect(tests.map(test => test.name).sort()).toEqual(LAB_CATALOG.map(test => test[0]).sort());
      expect((await catalog(run)).map(item => [item.name, item.phase, item.sortOrder])).toEqual([
        ["Creatinine", 1, 141], ["BUN", 1, 142], ["Uric acid", 1, 143], ["HIV", 1, 230],
        ["Repeat urinalysis", 3, 611], ["Repeat CBC", 3, 612], ["Cardiology", null, 700],
      ]);
      const expected = [
        { patientId: 7, name: "Creatinine", status: "Done", doneDate: "2026-09-02", note: "Outside laboratory" },
        { patientId: 7, name: "BUN", status: "Done", doneDate: "2026-09-02", note: "Outside laboratory" },
        { patientId: 7, name: "Uric acid", status: "Done", doneDate: "2026-09-02", note: "Outside laboratory" },
        { patientId: 7, name: "HIV", status: "Done", doneDate: "2026-09-03", note: null },
        { patientId: 8, name: "Creatinine", status: "NA", doneDate: null, note: null },
        { patientId: 8, name: "BUN", status: "NA", doneDate: null, note: null },
        { patientId: 8, name: "Uric acid", status: "NA", doneDate: null, note: null },
      ];
      expect(await progress(run)).toEqual(expected);
      // The panel rows stay in the database, inactive, with their progress.
      expect(await run('SELECT name FROM "checklistCatalog" WHERE active = false ORDER BY name')).toEqual([{ name: "Creatinine, BUN, uric acid" }, { name: "Repeat urinalysis and CBC" }]);
      const second = await sync(run);
      expect(second.every(sql => sql.trimStart().startsWith("SELECT"))).toBe(true);
      expect(await progress(run)).toEqual(expected);
      expect(await catalog(run)).toHaveLength(7);
      await close();
    });
  });
}

const databases: PGlite[] = [];
afterAll(async () => { for (const database of databases) await database.close(); });
suite("PostgreSQL", async () => {
  const pg = new PGlite();
  databases.push(pg);
  await pg.exec("CREATE SCHEMA ktp");
  await pg.exec(BASELINE_SQL);
  await pg.exec("SET search_path TO ktp, public");
  return {
    run: async (sql, args = []) => {
      let parameter = 0;
      return (await pg.query<Row>(sql.replace(/\?/g, () => `$${++parameter}`), args)).rows;
    },
    close: async () => {},
  };
});

let Database: typeof import("better-sqlite3");
beforeAll(() => { Database = createRequire(import.meta.url)("better-sqlite3"); });
suite("SQLite", async () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE labTests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, unit TEXT NOT NULL, low TEXT, high TEXT, active INTEGER DEFAULT 1 NOT NULL, sortOrder INTEGER DEFAULT 99 NOT NULL);
    CREATE TABLE checklistCatalog (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, phase INTEGER, appliesTo TEXT DEFAULT 'Both' NOT NULL, asIndicated INTEGER DEFAULT 0 NOT NULL, sortOrder INTEGER DEFAULT 99 NOT NULL, active INTEGER DEFAULT 1 NOT NULL);
    CREATE TABLE patientChecklist (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER NOT NULL, catalogId INTEGER NOT NULL, status TEXT DEFAULT 'Pending' NOT NULL, doneDate TEXT, note TEXT, UNIQUE(patientId, catalogId));
  `);
  return {
    run: async (sql, args = []) => {
      const statement = db.prepare(sql);
      return statement.reader ? (statement.all(...args) as Row[]) : (statement.run(...args), []);
    },
    close: async () => { db.close(); },
  };
});
