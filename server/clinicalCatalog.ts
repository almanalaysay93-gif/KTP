// Existing KTP catalogs shared by PostgreSQL and SQLite. No clinical reference ranges are assumed.
export const LAB_CATALOG = [
      ["Hemoglobin", "g/L", 1],
      ["WBC", "x10^9/L", 2],
      ["Platelets", "x10^9/L", 3],
      ["Creatinine", "umol/L", 4],
      ["BUN", "mmol/L", 5],
      ["FBS", "mmol/L", 6],
      ["Sodium", "mmol/L", 7],
      ["Potassium", "mmol/L", 8],
      ["ALT (SGPT)", "U/L", 9],
      ["Tacrolimus trough", "ng/mL", 10],
      ["Total cholesterol", "mmol/L", 11],
      ["Triglycerides", "mmol/L", 12],
      ["HDL", "mmol/L", 13],
      ["LDL", "mmol/L", 14],
      ["CMV PCR", "IU/mL", 15],
      // Tests of the work-up panels. New tests go at the end: the lab document parser uses the IDs of the first 15.
      ["Bleeding time", "min", 16],
      ["Clotting time", "min", 17],
      ["PT/INR", "INR", 18],
      ["aPTT", "s", 19],
      ["HbA1c", "%", 20],
      ["Uric acid", "umol/L", 21],
      ["AST (SGOT)", "U/L", 22],
      ["ALP", "U/L", 23],
      ["Calcium", "mmol/L", 24],
      ["Phosphorus", "mmol/L", 25],
      ["Magnesium", "mmol/L", 26],
      ["Albumin", "g/L", 27],
      ["Total protein", "g/L", 28],
      ["iPTH", "pmol/L", 29],
    ] as const;

type ChecklistRow = [name: string, category: string, phase: number | null, appliesTo: string, asIndicated: number, sortOrder: number];
/** Panels of the first catalog and the single tests that replace each one. Each test is one checklist item. */
export const CHECKLIST_SPLITS: Record<string, string[]> = {
  "CBC with differential": ["Hemoglobin", "WBC", "Platelets"],
  "BT, CT, PT/INR, aPTT": ["Bleeding time", "Clotting time", "PT/INR", "aPTT"],
  "FBS and HbA1c": ["FBS", "HbA1c"],
  "Creatinine, BUN, uric acid": ["Creatinine", "BUN", "Uric acid"],
  "SGPT, SGOT, ALP": ["ALT (SGPT)", "AST (SGOT)", "ALP"],
  "Na, K, Ca, phosphorus, Mg": ["Sodium", "Potassium", "Calcium", "Phosphorus", "Magnesium"],
  "Lipid profile": ["Total cholesterol", "Triglycerides", "HDL", "LDL"],
  "Albumin and total protein": ["Albumin", "Total protein"],
  "Repeat urinalysis and CBC": ["Repeat urinalysis", "Repeat CBC"],
};
// The first catalog, with panels. CHECKLIST_CATALOG below is this list with each panel split into its tests.
const PANEL_CATALOG: ChecklistRow[] = [
      // Milestones
      ["Pre-transplant orientation", "Milestone", null, "Both", 0, 1],
      ["Initial nephrology assessment", "Milestone", null, "Both", 0, 2],
      ["HTEC evaluation and approval", "Milestone", null, "Both", 0, 3],
      ["CDTE and risk stratification", "Milestone", null, "Recipient", 0, 4],
      ["PhilHealth Z Package qualification and application", "Milestone", null, "Recipient", 0, 5],

      // Phase 1 labs
      ["CBC with differential", "Lab", 1, "Both", 0, 10],
      ["Blood typing ABO and Rh", "Lab", 1, "Both", 0, 11],
      ["BT, CT, PT/INR, aPTT", "Lab", 1, "Both", 0, 12],
      ["FBS and HbA1c", "Lab", 1, "Both", 0, 13],
      ["Creatinine, BUN, uric acid", "Lab", 1, "Both", 0, 14],
      ["SGPT, SGOT, ALP", "Lab", 1, "Both", 0, 15],
      ["Na, K, Ca, phosphorus, Mg", "Lab", 1, "Both", 0, 16],
      ["Lipid profile", "Lab", 1, "Both", 0, 17],
      ["Albumin and total protein", "Lab", 1, "Both", 0, 18],
      ["iPTH", "Lab", 1, "Both", 0, 19],
      ["Hepatitis B markers", "Lab", 1, "Both", 0, 20],
      ["Anti-HCV", "Lab", 1, "Both", 0, 21],
      ["TPPA/VDRL/RPR", "Lab", 1, "Both", 0, 22],
      ["HIV", "Lab", 1, "Both", 0, 23],
      ["Malaria (BSMP)", "Lab", 1, "Both", 0, 24],
      ["CMV IgG", "Lab", 1, "Both", 0, 25],
      ["EBV IgG", "Lab", 1, "Both", 0, 26],
      ["Varicella IgG", "Lab", 1, "Both", 0, 27],
      ["TB Quantiferon", "Lab", 1, "Both", 0, 28],
      ["Throat swab GS and C/S", "Lab", 1, "Both", 0, 29],
      ["Urinalysis with microscopy", "Lab", 1, "Both", 0, 30],
      ["Urine C/S", "Lab", 1, "Both", 0, 31],
      ["UACR or 24-hour urine protein and creatinine", "Lab", 1, "Both", 0, 32],
      ["Fecalysis with occult blood or FIT", "Lab", 1, "Both", 0, 33],
      ["Pregnancy test", "Lab", 1, "Both", 1, 34],

      // Phase 1 imaging
      ["Chest X-ray PA", "Imaging", 1, "Both", 0, 40],
      ["12-lead ECG", "Imaging", 1, "Both", 0, 41],
      ["Whole abdomen ultrasound", "Imaging", 1, "Both", 0, 42],
      ["2D echo with Doppler", "Imaging", 1, "Both", 0, 43],

      // Phase 2
      ["HLA typing class I and II", "Lab", 2, "Both", 0, 50],
      ["PRA screening class I, II, MICA", "Lab", 2, "Recipient", 0, 51],
      ["Single antigen bead / DSA", "Lab", 2, "Recipient", 0, 52],
      ["T and B cell crossmatch", "Lab", 2, "Recipient", 0, 53],
      ["Renal CT angiography with 3D reconstruction", "Imaging", 2, "Donor", 0, 54],
      ["Nuclear GFR scan (split function)", "Imaging", 2, "Donor", 0, 55],
      ["Aorto-iliac duplex ultrasound", "Imaging", 2, "Donor", 0, 56],

      // Phase 3
      ["Repeat chest X-ray", "Imaging", 3, "Both", 0, 60],
      ["Repeat urinalysis and CBC", "Lab", 3, "Both", 0, 61],
      ["RT-PCR on admission day", "Lab", 3, "Both", 0, 62],
      ["Pre-transplant HD or PD session", "Clearance", 3, "Recipient", 1, 63],

      // Clearances
      ["Cardiology", "Clearance", null, "Both", 0, 70],
      ["Infectious disease", "Clearance", null, "Both", 0, 71],
      ["Dental", "Clearance", null, "Both", 0, 72],
      ["Neuropsychiatric", "Clearance", null, "Both", 0, 73],
      ["Endocrinology", "Clearance", null, "Both", 0, 74],
      ["Donor advocate", "Clearance", null, "Donor", 0, 75],
      ["Gastroenterology or hepatology", "Clearance", null, "Both", 1, 76],
      ["Pulmonology", "Clearance", null, "Both", 1, 77],
      ["Urology", "Clearance", null, "Both", 1, 78],
      ["OB-Gyn with Pap smear or mammogram", "Clearance", null, "Both", 1, 79],
    ];
/** Sort order of the split catalog: ten times the first order, plus the position of a test in its panel. */
export const CHECKLIST_CATALOG: ChecklistRow[] = PANEL_CATALOG.flatMap(([name, category, phase, appliesTo, asIndicated, sort]): ChecklistRow[] =>
  CHECKLIST_SPLITS[name]
    ? CHECKLIST_SPLITS[name].map((test, index) => [test, category, phase, appliesTo, asIndicated, sort * 10 + index + 1])
    : [[name, category, phase, appliesTo, asIndicated, sort * 10]]);

type Row = Record<string, any>;
type Query = { sql: string; args: unknown[] };
const query = (sql: string, ...args: unknown[]): Query => ({ sql, args });
const flag = (value: unknown) => (value ? "true" : "false");

/**
 * Brings the catalogs of a database to the current lists. An empty database gets the full lists.
 * A database with the first catalog gets the added lab tests, and each active panel is replaced
 * by its tests: the patient progress of the panel is copied to each test, then the panel is set
 * inactive. A second run changes nothing. PostgreSQL and SQLite run the same statements.
 */
export function* syncCatalog(): Generator<Query, void, Row[]> {
  const tests = new Set((yield query('SELECT name FROM "labTests"')).map(row => row.name));
  for (const [name, unit, sort] of LAB_CATALOG) {
    if (!tests.has(name)) yield query('INSERT INTO "labTests" (name, unit, "sortOrder", active) VALUES (?, ?, ?, true)', name, unit, sort);
  }
  const insertItem = (row: ChecklistRow) => query(
    `INSERT INTO "checklistCatalog" (name, category, phase, "appliesTo", "asIndicated", "sortOrder", active) VALUES (?, ?, ?, ?, ${flag(row[4])}, ?, true) RETURNING id`,
    row[0], row[1], row[2], row[3], row[5]);
  const items = yield query('SELECT * FROM "checklistCatalog"');
  if (items.length === 0) {
    for (const row of CHECKLIST_CATALOG) yield insertItem(row);
    return;
  }
  const panels = items.filter(item => item.active && CHECKLIST_SPLITS[item.name]);
  if (panels.length === 0) return;
  yield query('UPDATE "checklistCatalog" SET "sortOrder" = "sortOrder" * 10');
  for (const panel of panels) {
    for (const [index, name] of CHECKLIST_SPLITS[panel.name].entries()) {
      let [item] = yield query('SELECT id FROM "checklistCatalog" WHERE name = ? AND phase = ? AND active = true', name, panel.phase);
      if (!item) [item] = yield insertItem([name, panel.category, panel.phase, panel.appliesTo, panel.asIndicated ? 1 : 0, panel.sortOrder * 10 + index + 1]);
      yield query(`INSERT INTO "patientChecklist" ("patientId", "catalogId", status, "doneDate", note)
        SELECT "patientId", ?, status, "doneDate", note FROM "patientChecklist" WHERE "catalogId" = ?
        ON CONFLICT ("patientId", "catalogId") DO NOTHING`, item.id, panel.id);
    }
    yield query('UPDATE "checklistCatalog" SET active = false WHERE id = ?', panel.id);
  }
}
