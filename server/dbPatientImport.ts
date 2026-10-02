import { hasFullAccess } from "./adminAccess";
import { execute, fail, query, type Program } from "./dbClinical";
import { PATIENT_STATUSES, isValidStageForPatientType, todayDate } from "../shared/ktp";

/*
 * Import of a patient list. The file reader (scripts/patient_list_reader.py) gives rows of text.
 * checkImportRows tells the user what is wrong with each row. commitImportRows saves all rows
 * in one transaction, or none. The two functions use the same rules as the Enroll patient form.
 */

/** One patient as the file reader, or the review form, gives it. All values are text. */
export type ImportRow = Partial<Record<
  | "hrn" | "patientType" | "firstName" | "middleName" | "lastName" | "suffix" | "sex" | "birthDate"
  | "contactNumber" | "accountEmail" | "stage" | "riskCategory" | "surgeryDate" | "status"
  | "nephrologist" | "fellow" | "linkedRecipientHrn",
  string | null
>> & { followupMonths?: number | string | null };

export type CheckedRow = { errors: string[]; warnings: string[] };
type Plan = CheckedRow & {
  hrn: string;
  patientType: string;
  linkedRecipientHrn: string;
  /** Column values in the order of INSERT_COLUMNS, without linkedRecipientId. */
  values: unknown[];
};

const INSERT_COLUMNS = [
  "hrn", "patientType", "firstName", "middleName", "lastName", "suffix", "sex", "birthDate", "contactNumber",
  "accountEmail", "nephrologistId", "fellowId", "stage", "riskCategory", "surgeryDate", "followupMonths", "status",
  "linkedRecipientId",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (value: unknown) => String(value ?? "").trim();
const key = (value: string) => value.toLowerCase();
/** Doctor names match with no title, no punctuation, and no letter case. */
const doctorKey = (name: string) => name.toLowerCase().replace(/\bdr\b\.?|\bmd\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function dateError(value: string, label: string, pastOnly: boolean): string | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "1900-01-01")
    return `${label} must be a date in the form YYYY-MM-DD.`;
  return pastOnly && value > todayDate() ? `${label} is in the future.` : null;
}

function* planRows(rows: ImportRow[]): Program<Plan[]> {
  const saved = yield query('SELECT id, hrn, lower("accountEmail") AS email, "patientType" FROM patients');
  const doctors = yield query('SELECT id, name, role FROM doctors WHERE active = true');
  const savedByHrn = new Map(saved.map(row => [key(String(row.hrn)), row]));
  const savedEmails = new Set(saved.filter(row => row.email).map(row => String(row.email)));
  const count = (values: string[]) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>());
  const hrnCount = count(rows.map(row => key(text(row.hrn))));
  const emailCount = count(rows.map(row => key(text(row.accountEmail))).filter(Boolean));
  const typeInFile = new Map(rows.map(row => [key(text(row.hrn)), text(row.patientType)]));

  return rows.map(row => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const hrn = text(row.hrn), patientType = text(row.patientType), email = key(text(row.accountEmail));
    const stage = text(row.stage) || "Orientation";
    const birthDate = text(row.birthDate), surgeryDate = text(row.surgeryDate);
    const sex = text(row.sex).toUpperCase(), risk = text(row.riskCategory), status = text(row.status) || "Active";
    const followup = text(row.followupMonths) === "" ? 1 : Number(row.followupMonths);
    const linkedRecipientHrn = text(row.linkedRecipientHrn);

    if (!hrn) errors.push("HRN is missing.");
    else if (hrn.length > 64) errors.push("HRN is longer than 64 characters.");
    else if (savedByHrn.has(key(hrn))) errors.push(`HRN ${hrn} is already enrolled.`);
    else if ((hrnCount.get(key(hrn)) ?? 0) > 1) errors.push(`HRN ${hrn} occurs more than one time in this list.`);

    if (patientType !== "Recipient" && patientType !== "Donor") errors.push("Type must be Recipient or Donor.");
    if (!text(row.firstName)) errors.push("First name is missing.");
    if (!text(row.lastName)) errors.push("Last name is missing.");
    for (const [label, value, limit] of [["First name", row.firstName, 128], ["Middle name", row.middleName, 128], ["Last name", row.lastName, 128], ["Suffix", row.suffix, 32], ["Contact number", row.contactNumber, 32]] as const)
      if (text(value).length > limit) errors.push(`${label} is longer than ${limit} characters.`);

    if (!email) warnings.push("No Gmail account. The patient cannot sign in to the patient portal.");
    else if (!EMAIL.test(email) || email.length > 320) errors.push("Gmail account is not a valid e-mail address.");
    else if (hasFullAccess(email)) errors.push("Gmail account is on the admin list. A patient cannot use it.");
    else if (savedEmails.has(email)) errors.push("Gmail account is already enrolled.");
    else if ((emailCount.get(email) ?? 0) > 1) errors.push("Gmail account occurs more than one time in this list.");

    if (!text(row.stage)) warnings.push("No stage. Orientation is used.");
    if ((patientType === "Recipient" || patientType === "Donor") && !isValidStageForPatientType(stage, patientType))
      errors.push(`Stage "${stage}" is not a stage of a ${patientType.toLowerCase()}.`);
    if (sex && sex !== "M" && sex !== "F") errors.push("Sex must be M or F.");
    if (birthDate) { const error = dateError(birthDate, "Birth date", true); if (error) errors.push(error); }
    if (surgeryDate) { const error = dateError(surgeryDate, "Surgery date", false); if (error) errors.push(error); }
    else if (stage === "PostKT" || stage === "PostDonation") errors.push(`Surgery date is necessary for stage ${stage}.`);
    if (risk && risk !== "StandardLow" && risk !== "High") errors.push("Risk must be StandardLow or High.");
    if (!Number.isInteger(followup) || followup < 1 || followup > 3) errors.push("Follow-up interval must be 1, 2, or 3 months.");
    if (!(PATIENT_STATUSES as readonly string[]).includes(status)) errors.push(`Status must be one of: ${PATIENT_STATUSES.join(", ")}.`);

    if (patientType === "Donor") {
      const recipient = savedByHrn.get(key(linkedRecipientHrn));
      if (!linkedRecipientHrn) errors.push("A donor needs the HRN of the linked recipient.");
      else if (key(linkedRecipientHrn) === key(hrn)) errors.push("A donor cannot be linked to the same HRN.");
      else if (recipient ? recipient.patientType !== "Recipient" : typeInFile.get(key(linkedRecipientHrn)) !== "Recipient")
        errors.push(`Linked recipient HRN ${linkedRecipientHrn} is not a recipient in the registry or in this list.`);
    }

    const doctorId = (name: string, role: "Nephrologist" | "Fellow") => {
      if (!name) return null;
      const found = doctors.find(doctor => doctor.role === role && doctorKey(String(doctor.name)) === doctorKey(name));
      if (!found) warnings.push(`${role} "${name}" is not in the doctor list. The field stays empty.`);
      return found ? Number(found.id) : null;
    };
    const nephrologistId = doctorId(text(row.nephrologist), "Nephrologist");
    const fellowId = doctorId(text(row.fellow), "Fellow");

    return {
      errors, warnings, hrn, patientType, linkedRecipientHrn,
      values: [hrn, patientType, text(row.firstName), text(row.middleName) || null, text(row.lastName), text(row.suffix) || null,
        sex || null, birthDate || null, text(row.contactNumber) || null, email || null, nephrologistId, fellowId, stage,
        patientType === "Recipient" ? risk || null : null, surgeryDate || null, followup, status],
    };
  });
}

/** What is wrong with each row. Reads the registry and writes nothing. */
export async function checkImportRows(rows: ImportRow[]): Promise<CheckedRow[]> {
  return execute(function* () {
    return (yield* planRows(rows)).map(({ errors, warnings }) => ({ errors, warnings }));
  });
}

/** Saves all rows, recipients first so that a donor in the list can link to a recipient in the list. */
export async function commitImportRows(rows: ImportRow[], actor: number, fileName: string) {
  return execute(function* () {
    const plans = yield* planRows(rows);
    const bad = plans.flatMap((plan, index) => plan.errors.map(error => `Patient ${index + 1}${plan.hrn ? ` (HRN ${plan.hrn})` : ""}: ${error}`));
    if (bad.length) fail(`No patient was saved. ${bad.slice(0, 5).join(" ")}${bad.length > 5 ? ` And ${bad.length - 5} more.` : ""}`);

    const recipients = yield query(`SELECT id, hrn FROM patients WHERE "patientType" = 'Recipient'`);
    const recipientId = new Map(recipients.map(row => [key(String(row.hrn)), Number(row.id)]));
    const columns = INSERT_COLUMNS.map(column => `"${column}"`).join(", ");
    const marks = INSERT_COLUMNS.map(() => "?").join(", ");
    const ids: number[] = [];
    for (const plan of [...plans].sort((a, b) => Number(a.patientType === "Donor") - Number(b.patientType === "Donor"))) {
      const linked = plan.patientType === "Donor" ? recipientId.get(key(plan.linkedRecipientHrn)) ?? fail(`Linked recipient HRN ${plan.linkedRecipientHrn} was not found.`) : null;
      const [row] = yield query(`INSERT INTO patients (${columns}) VALUES (${marks}) RETURNING id`, ...plan.values, linked);
      const id = Number(row.id);
      if (plan.patientType === "Recipient") recipientId.set(key(plan.hrn), id);
      yield query('INSERT INTO "activityLog" ("actorUserId", "patientId", action, details) VALUES (?, ?, ?, ?)',
        actor, id, "IMPORT_PATIENT", JSON.stringify({ hrn: plan.hrn, type: plan.patientType, file: fileName }));
      ids.push(id);
    }
    return { count: ids.length, ids };
  });
}
