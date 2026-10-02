import type { ClinicalLabResult } from "../../../../../server/dbClinical";

/**
 * Normal reference values for KTP laboratory catalog and workup checklist items.
 * Standardized to Philippine hospital and clinical nephrology guidelines.
 * Each key is the exact name of one lab test or one checklist item.
 */
export const LAB_NORMAL_VALUES: Record<string, string> = {
  // Catalog laboratory tests
  "Hemoglobin": "120 - 160 g/L (12.0 - 16.0 g/dL)",
  "WBC": "4.5 - 11.0 x10^9/L (4,500 - 11,000 /uL)",
  "Platelets": "150 - 450 x10^9/L (150,000 - 450,000 /uL)",
  "Creatinine": "60 - 115 umol/L (0.6 - 1.2 mg/dL)",
  "BUN": "2.5 - 7.1 mmol/L (7 - 20 mg/dL)",
  "FBS": "3.9 - 5.6 mmol/L (70 - 99 mg/dL)",
  "Sodium": "135 - 145 mmol/L (135 - 145 mEq/L)",
  "Potassium": "3.5 - 5.0 mmol/L (3.5 - 5.0 mEq/L)",
  "ALT (SGPT)": "0 - 45 U/L",
  "Tacrolimus trough": "5.0 - 15.0 ng/mL (Target per post-KT protocol)",
  "Total cholesterol": "< 5.20 mmol/L (< 200 mg/dL)",
  "Triglycerides": "< 1.70 mmol/L (< 150 mg/dL)",
  "HDL": "> 1.00 mmol/L (> 40 mg/dL)",
  "LDL": "< 2.60 mmol/L (< 100 mg/dL)",
  "CMV PCR": "< 137 IU/mL (Undetected)",

  // Single tests of the work-up panels
  "PT/INR": "INR 0.8 - 1.2",
  "aPTT": "25 - 35 s",
  "HbA1c": "< 5.7%",
  "Uric acid": "200 - 420 umol/L",
  "AST (SGOT)": "0 - 35 U/L",
  "ALP": "30 - 120 U/L",
  "Calcium": "2.15 - 2.55 mmol/L",
  "Phosphorus": "0.8 - 1.45 mmol/L",
  "Albumin": "35 - 50 g/L",
  "Total protein": "60 - 80 g/L",
  "iPTH": "1.6 - 6.9 pmol/L (15 - 65 pg/mL)",

  // Checklist workup lab requirements
  "Blood typing ABO and Rh": "Documented ABO and Rh typing",
  "Hepatitis B markers": "HBsAg Non-reactive, Anti-HBs documented",
  "Anti-HCV": "Non-reactive",
  "TPPA/VDRL/RPR": "Non-reactive",
  "HIV": "Non-reactive (HIV 1 and 2)",
  "Malaria (BSMP)": "Negative for malarial parasites",
  "CMV IgG": "Baseline titer documented",
  "EBV IgG": "Baseline titer documented",
  "Varicella IgG": "Documented immunity or titer",
  "TB Quantiferon": "Negative (IGRA)",
  "Throat swab GS and C/S": "Normal respiratory flora / No pathogens",
  "Urinalysis with microscopy": "Protein Neg, Glucose Neg, RBC 0-2, WBC 0-5 /hpf",
  "Urine C/S": "No growth (< 10^4 CFU/mL)",
  "UACR or 24-hour urine protein and creatinine": "UACR < 30 mg/g, 24h protein < 150 mg/day",
  "Fecalysis with occult blood or FIT": "Negative for occult blood, ova, parasites",
  "Pregnancy test": "Negative (females of reproductive potential)",

  // Phase 2 immunological testing
  "HLA typing class I and II": "Class I (A, B, C) and Class II (DR, DQ, DP) typing",
  "PRA screening class I, II, MICA": "Class I and II PRA < 20% (ideal: 0% unsensitized)",
  "Single antigen bead / DSA": "No donor-specific anti-HLA antibodies detected",
  "T and B cell crossmatch": "Negative T-cell and B-cell CDC and flow crossmatch",

  // Phase 3 testing
  "Repeat urinalysis": "Normal urinalysis",
  "Repeat CBC": "CBC within baseline",
  "RT-PCR on admission day": "SARS-CoV-2 Negative",
};

const NORMAL_BY_NAME = new Map(
  Object.entries(LAB_NORMAL_VALUES).map(([name, value]) => [
    name.toLowerCase(),
    value,
  ])
);

/**
 * Retrieve the normal reference values for a requirement or test name.
 * The name must be the full name: a part of a name gives no value.
 */
export function getNormalValue(name: string): string | null {
  return NORMAL_BY_NAME.get(name.toLowerCase().trim()) ?? null;
}

/**
 * The lab results of one checklist item, newest first: results of the test
 * with the same name, entered for the same work-up phase.
 */
export function resultsForItem(
  item: { name: string; phase: number | null },
  labResults: ClinicalLabResult[]
): ClinicalLabResult[] {
  if (item.phase === null) return [];
  return labResults.filter(
    result =>
      result.testName === item.name && result.phase === `Phase${item.phase}`
  );
}
