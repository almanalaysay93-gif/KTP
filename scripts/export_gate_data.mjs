// Exports patients, the checklist catalog and checklist progress to JSON for scripts/phase_gate.py.
// Usage: PG_URL=postgres://... node scripts/export_gate_data.mjs <out.json>
// Read-only: runs SELECTs only. The output holds patient names; keep it out of the repository.
import postgres from "postgres";
import { writeFile } from "node:fs/promises";

const url = process.env.PG_URL;
const out = process.argv[2];
if (!url || !out) {
  console.error("Usage: PG_URL=<postgres url> node scripts/export_gate_data.mjs <out.json>");
  process.exit(2);
}

const sql = postgres(url, { max: 1 });
try {
  const patients = await sql`
    SELECT "id", "hrn", "patientType", "firstName", "lastName", "sex", "birthDate"::text AS "birthDate",
           "contactNumber", "nephrologistId", "fellowId", "stage", "riskCategory",
           "surgeryDate"::text AS "surgeryDate", "linkedRecipientId", "status",
           "consentAcceptedAt"::text AS "consentAcceptedAt"
    FROM "ktp"."patients" ORDER BY "id"`;
  const catalog = await sql`
    SELECT "id", "name", "category", "phase", "appliesTo", "asIndicated"
    FROM "ktp"."checklistCatalog" WHERE "active" ORDER BY "sortOrder", "id"`;
  const checklist = await sql`
    SELECT "patientId", "catalogId", "status", "doneDate"::text AS "doneDate" FROM "ktp"."patientChecklist"`;
  await writeFile(out, JSON.stringify({ patients, catalog, checklist }, null, 1));
  console.log(`exported ${patients.length} patients, ${catalog.length} catalog items, ${checklist.length} checklist rows`);
} catch (error) {
  console.error("export failed:", error.code ?? "", error.message);
  process.exitCode = 2;
} finally {
  await sql.end();
}
