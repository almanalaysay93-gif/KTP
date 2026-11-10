import { DONOR_STAGES, MOCK_ANCHOR, RECIPIENT_STAGES, dayIso, mockPatientsFromEnv, type MockSqlClient } from "./mockPatients";

/**
 * Checklist rows for mock patients, consistent with each patient's stage:
 * every requirement of an earlier stage is Done (dated inside that stage), the current stage is
 * part-way through, later stages are Pending. As-indicated items are NA unless they apply
 * (OB-Gyn and pregnancy test for women). Runs after the catalog sync, inside its transaction.
 *
 * gateStage() is the same mapping scripts/phase_gate.py uses to block stage advances.
 */
export type CatalogRow = { id: number; name: string; category: string; phase: number | null; appliesTo: string; asIndicated: number | boolean };

export function gateStage(item: CatalogRow, patientType: string): string | null {
  if (item.appliesTo !== "Both" && item.appliesTo !== patientType) return null;
  if (item.phase !== null && item.phase !== undefined) return `Phase${item.phase}`;
  if (item.category === "Clearance") return "Clearances";
  if (item.category !== "Milestone") return null;
  const name = item.name.toLowerCase();
  if (name.includes("orientation") || name.includes("initial nephrology")) return "Orientation";
  if (name.includes("htec")) return "Phase2";
  if (name.includes("cdte")) return "Clearances";
  if (name.includes("philhealth")) return "PhilHealthZ";
  return null;
}

const FEMALE_ONLY = /pregnan|ob-gyn/i;

function seededUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export async function seedMockChecklistPg(tx: MockSqlClient, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const patients = mockPatientsFromEnv(env);
  if (patients.length === 0) return 0;
  const catalog: CatalogRow[] = [...await tx.unsafe(
    `SELECT "id", "name", "category", "phase", "appliesTo", "asIndicated" FROM "ktp"."checklistCatalog" WHERE "active"`,
  )].map((r: any) => ({ ...r, id: Number(r.id), phase: r.phase === null ? null : Number(r.phase) }));
  // Only patients with no checklist yet, so staff edits survive restarts.
  const fresh = new Map<string, number>(
    [...await tx.unsafe(
      `SELECT p."id", p."hrn" FROM "ktp"."patients" p
       WHERE p."hrn" LIKE 'KTP-MOCK-%' AND NOT EXISTS (SELECT 1 FROM "ktp"."patientChecklist" c WHERE c."patientId" = p."id")`,
    )].map((r: any) => [String(r.hrn), Number(r.id)]),
  );
  let inserted = 0;
  for (const p of patients) {
    const patientId = fresh.get(p.hrn);
    if (patientId === undefined) continue;
    const stages: readonly string[] = p.patientType === "Donor" ? DONOR_STAGES : RECIPIENT_STAGES;
    const current = stages.indexOf(p.stage);
    const ids: number[] = [], statuses: string[] = [], dates: (string | null)[] = [];
    for (const item of catalog) {
      const stage = gateStage(item, p.patientType);
      if (stage === null) continue;
      const index = stages.indexOf(stage);
      if (index < 0) continue;
      const indicated = Boolean(Number(item.asIndicated)) && !(FEMALE_ONLY.test(item.name) && p.sex === "F");
      const notForSex = FEMALE_ONLY.test(item.name) && p.sex === "M";
      const roll = seededUnit(`${p.hrn}:${item.id}`);
      let status = "Pending";
      if (notForSex || (indicated && index <= current)) status = "NA";
      else if (index < current || (index === current && roll < 0.45)) status = "Done";
      let doneDate: string | null = null;
      if (status === "Done") {
        const start = Date.parse(p.stageStarts[index]!);
        const end = index < current ? Date.parse(p.stageStarts[index + 1]!) - 86_400_000 : Math.min(MOCK_ANCHOR, start + 30 * 86_400_000);
        doneDate = dayIso(start + Math.floor(roll * Math.max(0, end - start)));
      }
      ids.push(item.id); statuses.push(status); dates.push(doneDate);
    }
    if (ids.length === 0) continue;
    await tx.unsafe(
      `INSERT INTO "ktp"."patientChecklist" ("patientId", "catalogId", "status", "doneDate")
       SELECT $1, c, s, CAST(d AS date) FROM unnest($2::int[], $3::text[], $4::text[]) AS t(c, s, d)
       ON CONFLICT ("patientId", "catalogId") DO NOTHING`,
      [patientId, ids, statuses, dates],
    );
    inserted += ids.length;
  }
  if (inserted > 0) console.log(`[Database] Mock checklist rows ready: ${inserted}`);
  return inserted;
}
