import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import { allowPatientWithoutEmail, getSqliteDb } from "./localDb";
import { readPatientFile } from "./patientImportRoute";
import { patientImportRouter } from "./routers/patientImport";
import { patientsRouter } from "./routers/patients";
import type { TrpcContext } from "./_core/context";

const ctx = (email: string | null): TrpcContext => ({
  user: email ? { id: 9992, email, name: "Fixture", openId: "import-fixture", role: "admin", loginMethod: "test", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
  req: { headers: {}, protocol: "http" } as TrpcContext["req"], res: {} as TrpcContext["res"],
});
const admin = patientImportRouter.createCaller(ctx("almanalaysay93@gmail.com"));
type Reader = { success: boolean; source: string; rows: Record<string, any>[]; unmappedColumns: string[]; message?: string; error?: string };
const read = (name: string, data: Buffer | string) => readPatientFile(name, Buffer.from(data).toString("base64")) as Promise<Reader>;

const recipient = { hrn: "IMPORT-TEST-1", patientType: "Recipient", firstName: "Synthetic", lastName: "Recipient", accountEmail: "import1@example.invalid", stage: "PostKT", surgeryDate: "2026-08-01", sex: "M", birthDate: "1980-03-04" };
const donor = { hrn: "IMPORT-TEST-2", patientType: "Donor", firstName: "Synthetic", lastName: "Donor", accountEmail: "import2@example.invalid", stage: "Phase2", linkedRecipientHrn: "IMPORT-TEST-1" };
const saved = () => getSqliteDb().prepare("SELECT * FROM patients WHERE hrn LIKE 'IMPORT-TEST-%' ORDER BY hrn").all() as Record<string, any>[];

beforeEach(() => {
  const db = getSqliteDb();
  db.prepare("DELETE FROM activityLog WHERE action = 'IMPORT_PATIENT'").run();
  db.prepare("DELETE FROM patients WHERE hrn LIKE 'IMPORT-TEST-%'").run();
});

describe("patient list reader (Python)", () => {
  it("reads an Excel list: title rows, one name column, Excel dates, and guesses with warnings", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Patients");
    sheet.addRow(["Organ Transplant Services: patient list"]);
    sheet.addRow([]);
    sheet.addRow(["HRN", "Patient Name", "Type", "Sex", "DOB", "Gmail", "Stage", "Transplant Date", "Recipient HRN", "Mobile", "Ward"]);
    sheet.addRow([1029482, "DELA CRUZ, JUAN P. JR", "Recipient", "Male", new Date(Date.UTC(1980, 2, 4)), "Juan.DelaCruz@Gmail.com", "Post KT", "15-Jan-2026", "", "0917 123 4567", "3A"]);
    sheet.addRow(["00-333-444", "Santos, Maria Clara", "D", "F", "12/25/1985", "maria.santos@gmail.com", "Phase 2", "", 1029482, "", ""]);
    sheet.addRow(["00-555-666", "Reyes, Ana", "", "F", "03/04/1990", "", "post transplant", "", "", "", ""]);
    sheet.addRow([]);
    const result = await read("patients.xlsx", Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(result).toMatchObject({ success: true, source: "excel", unmappedColumns: ["Ward"], message: "3 patients found." });
    expect(result.rows[0]).toMatchObject({
      row: 4, hrn: "1029482", lastName: "Dela Cruz", firstName: "Juan", middleName: "P", suffix: "Jr.", patientType: "Recipient",
      sex: "M", birthDate: "1980-03-04", accountEmail: "juan.delacruz@gmail.com", stage: "PostKT", surgeryDate: "2026-01-15",
      contactNumber: "0917 123 4567", warnings: [],
    });
    expect(result.rows[1]).toMatchObject({ hrn: "00-333-444", lastName: "Santos", firstName: "Maria Clara", middleName: "", patientType: "Donor", birthDate: "1985-12-25", stage: "Phase2", linkedRecipientHrn: "1029482", warnings: [] });
    expect(result.rows[2]).toMatchObject({ patientType: "", birthDate: "1990-03-04", stage: "PostKT", accountEmail: "" });
    expect(result.rows[2].warnings).toEqual(["Birth date 03/04/1990 was read as month/day/year."]);
  });
  it("reads CSV, a text table, and a text form", async () => {
    const csv = await read("list.csv", "HRN;Last Name;First Name;Email;Phase\nA-1001;Cruz;Pedro;pedro@example.invalid;Clearances\n");
    expect(csv.rows).toMatchObject([{ hrn: "A-1001", lastName: "Cruz", firstName: "Pedro", accountEmail: "pedro@example.invalid", stage: "Clearances" }]);
    const table = await read("photo.txt", "HRN        Name                 Type        Gmail\n00-777     Lim, Jose            Recipient   jose@example.invalid\n00-888     Tan, Rosa M.         Donor       rosa@example.invalid\n");
    expect(table.rows.map(row => [row.hrn, row.lastName, row.firstName, row.middleName, row.patientType])).toEqual([["00-777", "Lim", "Jose", "", "Recipient"], ["00-888", "Tan", "Rosa", "M", "Donor"]]);
    const form = await read("form.txt", "Patient enrolment\nHRN: 00-999\nLast name: Uy\nFirst name: Carla\nDate of birth: 5 Jan 1975\nGmail: carla@example.invalid\nStage: Phase 1\n");
    expect(form.rows).toMatchObject([{ hrn: "00-999", lastName: "Uy", firstName: "Carla", birthDate: "1975-01-05", stage: "Phase1" }]);
  });
  it("gives a message, not a crash, for a file with no list and for a file type that it does not read", async () => {
    expect(await read("notes.txt", "Meeting notes\nNothing here.\n")).toMatchObject({ success: true, rows: [], message: expect.stringContaining("No patient was found") });
    expect(await read("list.docx", "x")).toMatchObject({ success: false, rows: [], error: expect.stringContaining("is not read") });
    expect(await read("broken.xlsx", "this is not a workbook")).toMatchObject({ success: false, rows: [], error: expect.stringContaining("Could not read the file") });
  });
});

describe("patient import check and save", () => {
  it("rejects access for a user who is not an admin", async () => {
    for (const email of [null, "patient@example.invalid"]) {
      const caller = patientImportRouter.createCaller(ctx(email));
      await expect(caller.check({ rows: [recipient] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.commit({ rows: [recipient] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("reports each wrong value of a row and writes nothing", async () => {
    const [bad, noStage, duplicateA, duplicateB, loneDonor] = await admin.check({ rows: [
      { hrn: "", patientType: "Patient", firstName: "", lastName: "X", accountEmail: "not-an-email", stage: "PostKT", birthDate: "2999-01-01", sex: "X", followupMonths: 7 },
      { ...recipient, hrn: "IMPORT-TEST-3", accountEmail: "import3@example.invalid", stage: "", surgeryDate: "", nephrologist: "Dr. Nobody" },
      { ...recipient, hrn: "IMPORT-TEST-4", accountEmail: "same@example.invalid" },
      { ...recipient, hrn: "import-test-4", accountEmail: "SAME@example.invalid" },
      { ...donor, linkedRecipientHrn: "NOT-THERE" },
    ] });
    expect(bad.errors).toEqual([
      "HRN is missing.", "Type must be Recipient or Donor.", "First name is missing.", "Gmail account is not a valid e-mail address.",
      "Sex must be M or F.", "Birth date is in the future.", "Surgery date is necessary for stage PostKT.", "Follow-up interval must be 1, 2, or 3 months.",
    ]);
    expect(noStage).toEqual({ errors: [], warnings: ["No stage. Orientation is used.", 'Nephrologist "Dr. Nobody" is not in the doctor list. The field stays empty.'] });
    expect(duplicateA.errors).toEqual(["HRN IMPORT-TEST-4 occurs more than one time in this list.", "Gmail account occurs more than one time in this list."]);
    expect(duplicateB.errors).toHaveLength(2);
    expect(loneDonor.errors).toEqual(["Linked recipient HRN NOT-THERE is not a recipient in the registry or in this list."]);
    expect(saved()).toHaveLength(0);
  });
  it("saves a recipient and its donor from one list, links them, and logs each patient", async () => {
    const doctor = getSqliteDb().prepare("SELECT id, name FROM doctors WHERE role = 'Nephrologist' AND active = 1 LIMIT 1").get() as { id: number; name: string };
    // The donor is first in the list. The save must still link it to the recipient of the same list.
    const result = await admin.commit({ fileName: "patients.xlsx", rows: [donor, { ...recipient, nephrologist: doctor.name.toUpperCase(), riskCategory: "High", followupMonths: "2" }] });
    expect(result.count).toBe(2);
    const [first, second] = saved();
    expect(first).toMatchObject({ hrn: "IMPORT-TEST-1", patientType: "Recipient", stage: "PostKT", surgeryDate: "2026-08-01", birthDate: "1980-03-04", sex: "M", nephrologistId: doctor.id, riskCategory: "High", followupMonths: 2, status: "Active", linkedRecipientId: null });
    expect(second).toMatchObject({ hrn: "IMPORT-TEST-2", patientType: "Donor", stage: "Phase2", linkedRecipientId: first.id, followupMonths: 1, riskCategory: null });
    const logs = getSqliteDb().prepare("SELECT patientId, details FROM activityLog WHERE action = 'IMPORT_PATIENT' ORDER BY patientId").all() as { patientId: number; details: string }[];
    expect(logs.map(log => log.patientId)).toEqual([first.id, second.id]);
    expect(JSON.parse(logs[0].details)).toMatchObject({ hrn: "IMPORT-TEST-1", file: "patients.xlsx" });
    // A second import of the same list is refused.
    const again = await admin.check({ rows: [recipient] });
    expect(again[0].errors).toEqual(["HRN IMPORT-TEST-1 is already enrolled.", "Gmail account is already enrolled."]);
  });
  it("saves patients with no Gmail account, with a note that they have no portal access", async () => {
    const rows = [{ ...recipient, accountEmail: "" }, { ...recipient, hrn: "IMPORT-TEST-5", accountEmail: null }];
    expect(await admin.check({ rows })).toEqual([
      { errors: [], warnings: ["No Gmail account. The patient cannot sign in to the patient portal."] },
      { errors: [], warnings: ["No Gmail account. The patient cannot sign in to the patient portal."] },
    ]);
    expect(await admin.commit({ rows })).toMatchObject({ count: 2 });
    expect(saved().map(row => [row.hrn, row.accountEmail])).toEqual([["IMPORT-TEST-1", null], ["IMPORT-TEST-5", null]]);
    // A list with a Gmail account that is enrolled is still refused.
    getSqliteDb().prepare("UPDATE patients SET accountEmail = ? WHERE hrn = ?").run("taken@example.invalid", "IMPORT-TEST-1");
    const [taken] = await admin.check({ rows: [{ ...recipient, hrn: "IMPORT-TEST-6", accountEmail: "Taken@example.invalid" }] });
    expect(taken.errors).toEqual(["Gmail account is already enrolled."]);
  });
  it("saves no patient when one row of the list is wrong", async () => {
    await expect(admin.commit({ rows: [recipient, { ...donor, lastName: "" }] })).rejects.toThrow("No patient was saved. Patient 2 (HRN IMPORT-TEST-2): Last name is missing.");
    expect(saved()).toHaveLength(0);
    expect(getSqliteDb().prepare("SELECT count(*) AS n FROM activityLog WHERE action = 'IMPORT_PATIENT'").get()).toMatchObject({ n: 0 });
  });
});

describe("patient with no Gmail account", () => {
  const patients = patientsRouter.createCaller(ctx("almanalaysay93@gmail.com"));
  const base = { patientType: "Recipient" as const, firstName: "Synthetic", lastName: "NoEmail", stage: "Phase1" };
  it("enrols two patients with no Gmail account, and an update of another field keeps a saved Gmail account", async () => {
    const first = await patients.create({ ...base, hrn: "IMPORT-TEST-7" });
    const second = await patients.create({ ...base, hrn: "IMPORT-TEST-8", accountEmail: "" });
    const third = await patients.create({ ...base, hrn: "IMPORT-TEST-9", accountEmail: "keep@example.invalid" });
    expect([first.accountEmail, second.accountEmail, third.accountEmail]).toEqual([null, null, "keep@example.invalid"]);
    expect((await patients.update({ id: third.id, data: { contactNumber: "0917 000 0000" } }))?.accountEmail).toBe("keep@example.invalid");
    expect((await patients.update({ id: third.id, data: { accountEmail: "" } }))?.accountEmail).toBeNull();
    expect((await patients.update({ id: first.id, data: { accountEmail: "new@example.invalid" } }))?.accountEmail).toBe("new@example.invalid");
    await expect(patients.create({ ...base, hrn: "IMPORT-TEST-10", accountEmail: "NEW@example.invalid" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(patients.create({ ...base, hrn: "IMPORT-TEST-10", accountEmail: "not-an-email" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("makes the Gmail column optional in a database of the older form and keeps rows and indexes", () => {
    const Database = createRequire(import.meta.url)("better-sqlite3");
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, hrn TEXT NOT NULL UNIQUE, firstName TEXT NOT NULL,
      accountEmail TEXT NOT NULL, linkedUserId INTEGER UNIQUE, status TEXT DEFAULT 'Active' NOT NULL);
      CREATE UNIQUE INDEX patients_email_lower_idx ON patients (lower(accountEmail));
      INSERT INTO patients (hrn, firstName, accountEmail) VALUES ('OLD-1', 'Synthetic', 'Old@example.invalid');`);
    expect(() => db.prepare("INSERT INTO patients (hrn, firstName) VALUES ('OLD-2', 'Synthetic')").run()).toThrow(/NOT NULL/);
    allowPatientWithoutEmail(db);
    allowPatientWithoutEmail(db);
    db.prepare("INSERT INTO patients (hrn, firstName) VALUES ('OLD-2', 'Synthetic')").run();
    db.prepare("INSERT INTO patients (hrn, firstName) VALUES ('OLD-3', 'Synthetic')").run();
    expect(db.prepare("SELECT id, hrn, accountEmail, status FROM patients ORDER BY id").all()).toEqual([
      { id: 1, hrn: "OLD-1", accountEmail: "Old@example.invalid", status: "Active" },
      { id: 2, hrn: "OLD-2", accountEmail: null, status: "Active" },
      { id: 3, hrn: "OLD-3", accountEmail: null, status: "Active" },
    ]);
    expect(() => db.prepare("INSERT INTO patients (hrn, firstName, accountEmail) VALUES ('OLD-4', 'Synthetic', 'OLD@example.invalid')").run()).toThrow(/UNIQUE/);
    expect(() => db.prepare("INSERT INTO patients (hrn, firstName) VALUES ('OLD-1', 'Synthetic')").run()).toThrow(/UNIQUE/);
    db.close();
  });
});
