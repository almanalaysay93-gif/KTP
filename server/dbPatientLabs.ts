import { execute, fail, labFlag, query } from "./dbClinical";
import { todayDate } from "../shared/ktp";

export type PatientLabInput = {
  patientId: number;
  serviceDate: string;
  note?: string;
  items: { labTestId: number; value: string }[];
};

export type PatientLabMetadata = { ip?: string; userAgent?: string };

const identifier = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2147483647;

function validate(input: PatientLabInput): PatientLabInput {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      key => !["patientId", "serviceDate", "note", "items"].includes(key)
    )
  ) {
    fail("Unknown input field");
  }
  if (!identifier(input.patientId)) fail("Invalid identifier");
  const date = input.serviceDate;
  const parsed =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00Z`)
      : new Date(NaN);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < "1900-01-01"
  ) {
    fail("Use a valid calendar date");
  }
  if (date > todayDate()) fail("Date cannot be in the future");
  if (input.note !== undefined && typeof input.note !== "string")
    fail("Expected a string");
  const note = input.note?.trim();
  if (note !== undefined && note.length > 1000) fail("Invalid text length");
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 100
  ) {
    fail("Invalid result count");
  }
  const seen = new Set<number>();
  const items = input.items.map(item => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some(key => !["labTestId", "value"].includes(key))
    ) {
      fail("Unknown input field");
    }
    if (!identifier(item.labTestId)) fail("Invalid identifier");
    if (seen.has(item.labTestId)) fail("Each lab test may occur once");
    seen.add(item.labTestId);
    if (typeof item.value !== "string") fail("Expected a string");
    const value = item.value.trim();
    if (value.length < 1 || value.length > 100) fail("Invalid text length");
    return { labTestId: item.labTestId, value };
  });
  return { patientId: input.patientId, serviceDate: date, note, items };
}

/** Save a separate, unverified patient report and its audit, or save nothing. */
export async function submitPatientLab(
  raw: PatientLabInput,
  actor: number,
  metadata: PatientLabMetadata = {}
): Promise<{ success: true; recordId: number }> {
  const input = validate(raw);
  if (!identifier(actor)) fail("Invalid identifier");
  const note = input.note
    ? `[Patient Upload] ${input.note} — Pending clinical verification`
    : "[Patient Upload] Pending clinical verification";
  // SQLite serializes the entire generator via execute's immediate transaction.
  // PostgreSQL locks the patient and catalog rows for the same write lifetime.
  const postgres = Boolean(process.env.DATABASE_URL);
  return execute(function* () {
    const [patient] = yield query(
      `SELECT id FROM patients WHERE id = ?${postgres ? " FOR UPDATE" : ""}`,
      input.patientId
    );
    if (!patient) fail("Patient not found", "NOT_FOUND");
    const [record] = yield query(
      `INSERT INTO "serviceRecords" ("patientId", "serviceType", label, status, "dueDate", "serviceDate", phase, note)
        VALUES (?, 'Laboratory', 'Patient self-uploaded lab report', 'Done', ?, ?, NULL, ?) RETURNING id`,
      input.patientId,
      input.serviceDate,
      input.serviceDate,
      note
    );
    for (const item of input.items) {
      const [test] = yield query(
        `SELECT low, high FROM "labTests" WHERE id = ? AND active = true${postgres ? " FOR SHARE" : ""}`,
        item.labTestId
      );
      if (!test) fail("Lab test not found", "NOT_FOUND");
      yield query(
        `INSERT INTO "labResults" ("serviceRecordId", "labTestId", value, "lowSnapshot", "highSnapshot", flag)
          VALUES (?, ?, ?, ?, ?, ?)`,
        record.id,
        item.labTestId,
        item.value,
        test.low,
        test.high,
        labFlag(item.value, test.low, test.high)
      );
    }
    yield query(
      `INSERT INTO "activityLog" ("actorUserId", "patientId", action, details, "ipAddress", "userAgent")
        VALUES (?, ?, 'PATIENT_UPLOAD_LAB', ?, ?, ?)`,
      actor,
      input.patientId,
      JSON.stringify({
        serviceDate: input.serviceDate,
        testCount: input.items.length,
      }),
      metadata.ip ?? null,
      metadata.userAgent ?? null
    );
    return { success: true as const, recordId: Number(record.id) };
  });
}
