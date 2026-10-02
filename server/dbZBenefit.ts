import { execute, fail, query, type Program, type Row } from "./dbClinical";
import type { ServiceType } from "../shared/ktp";

/*
 * Save of the Z Benefit dates that a nurse transcribes on the Z Benefit page. The page shows four
 * values for each service type. This module writes a changed value to the service records of the
 * Tracker, so the Z Benefit page and the Tracker always show the same data.
 *
 * Rules for one service type:
 * - Date done. Medicines: the date of the first claim, so it sets the first completed record.
 *   Other types: a date after the newest completed record is a new record (the earliest planned
 *   record is completed, or a record is made). An earlier date corrects the newest completed record.
 * - Claim due date and claim filed date: set on the record that the page shows for the claim.
 * - Next due date: moves the earliest planned record, or makes one.
 * All changes of one save are one transaction.
 */

export type ZBenefitEntry = {
  serviceType: ServiceType;
  /** Not sent: no change. */
  doneDate?: string;
  nextDue?: string;
  /** Null removes the claim due date. */
  claimDue?: string | null;
  claimFiled?: string;
};

const LABEL: Record<ServiceType, string> = {
  Meds: "Medicines claim",
  Laboratory: "Laboratory",
  Tacro: "Tacrolimus test",
  XrayUsd: "X-ray and ultrasound",
};
const NAME: Record<ServiceType, string> = {
  Meds: "Medicines",
  Laboratory: "Laboratory",
  Tacro: "Tacrolimus test",
  XrayUsd: "X-ray and USD",
};
const day = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : null);
const REASON = "Z Benefit record";

function* change(actor: number, patientId: number, record: Row, fields: Record<string, string | null>): Program<void> {
  const before = Object.fromEntries(Object.keys(fields).map(field => [field, field === "status" ? record[field] : day(record[field])]));
  const sets = Object.keys(fields).map(field => `"${field}" = ?`).join(", ");
  yield query(`UPDATE "serviceRecords" SET ${sets}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ? AND "patientId" = ?`, ...Object.values(fields), record.id, patientId);
  yield query('INSERT INTO "recordRevisions" ("entityType", "entityId", "before", "after", reason, "userId") VALUES (?, ?, ?, ?, ?, ?)',
    "serviceRecord", record.id, JSON.stringify(before), JSON.stringify(fields), REASON, actor);
  Object.assign(record, fields);
}

export async function saveZBenefit(input: { patientId: number; entries: ZBenefitEntry[] }, actor: number) {
  return execute(function* () {
    const [patient] = yield query('SELECT id, "patientType" FROM patients WHERE id = ?', input.patientId);
    if (!patient) fail("Patient not found", "NOT_FOUND");
    if (patient.patientType !== "Recipient") fail("The Z Benefit record is for a recipient");
    let changes = 0;

    for (const entry of input.entries) {
      const type = entry.serviceType;
      const records = yield query(`SELECT * FROM "serviceRecords" WHERE "patientId" = ? AND "serviceType" = ? AND status <> 'Superseded' ORDER BY id`, input.patientId, type);
      const done = records.filter(record => record.status === "Done").sort((a, b) => String(day(a.serviceDate)).localeCompare(String(day(b.serviceDate))));
      const planned = records.filter(record => record.status === "Planned").sort((a, b) => String(day(a.dueDate)).localeCompare(String(day(b.dueDate))));
      const insert = function* (status: "Planned" | "Done", dueDate: string, serviceDate: string | null): Program<Row> {
        const [row] = yield query(`INSERT INTO "serviceRecords" ("patientId", "serviceType", label, status, "dueDate", "serviceDate") VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
          input.patientId, type, LABEL[type], status, dueDate, serviceDate);
        return row;
      };
      // The record that the page shows for the claim: the earliest claim deadline with no filed claim, or the newest completed record.
      const open = done.filter(record => !record.claimFiledDate);
      let claimRecord: Row | undefined =
        open.filter(record => record.claimDeadline).sort((a, b) => String(day(a.claimDeadline)).localeCompare(String(day(b.claimDeadline))))[0] ?? open[open.length - 1];

      if (entry.doneDate) {
        const target = type === "Meds" ? done[0] : done[done.length - 1];
        const newer = target && type !== "Meds" && entry.doneDate > day(target.serviceDate)!;
        if (target && !newer) {
          if (target.claimFiledDate && day(target.claimFiledDate)! < entry.doneDate) fail(`${NAME[type]}: the date cannot be after the date that the claim was filed.`);
          if (day(target.serviceDate) !== entry.doneDate) {
            yield* change(actor, input.patientId, target, { serviceDate: entry.doneDate });
            changes++;
          }
          if (!target.claimFiledDate) claimRecord = target;
        } else {
          // A new completed service. The earliest planned record is the one that was due.
          const next = planned.shift();
          if (next) {
            yield* change(actor, input.patientId, next, { status: "Done", serviceDate: entry.doneDate });
            claimRecord = next;
          } else claimRecord = yield* insert("Done", entry.doneDate, entry.doneDate);
          changes++;
        }
      }

      if (entry.claimDue !== undefined || entry.claimFiled) {
        if (!claimRecord) return fail(`${NAME[type]}: enter the date of the service before the claim dates.`);
        const serviceDate = day(claimRecord.serviceDate)!;
        if (entry.claimDue !== undefined) {
          if (entry.claimDue && entry.claimDue < serviceDate) fail(`${NAME[type]}: the claim due date cannot be before the service date.`);
          yield* change(actor, input.patientId, claimRecord, { claimDeadline: entry.claimDue });
          changes++;
        }
        if (entry.claimFiled) {
          if (entry.claimFiled < serviceDate) fail(`${NAME[type]}: the claim filed date cannot be before the service date.`);
          yield* change(actor, input.patientId, claimRecord, { claimFiledDate: entry.claimFiled });
          changes++;
        }
      }

      if (entry.nextDue) {
        if (planned[0]) {
          if (day(planned[0].dueDate) !== entry.nextDue) {
            yield* change(actor, input.patientId, planned[0], { dueDate: entry.nextDue });
            changes++;
          }
        } else {
          yield* insert("Planned", entry.nextDue, null);
          changes++;
        }
      }
    }

    if (changes === 0) fail("No change to save");
    yield query('INSERT INTO "activityLog" ("actorUserId", "patientId", action, details) VALUES (?, ?, ?, ?)',
      actor, input.patientId, "clinical.zbenefit.update", JSON.stringify({ entries: input.entries }));
    return { changes };
  });
}
