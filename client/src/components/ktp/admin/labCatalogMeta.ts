import type { ClinicalLabResult } from "../../../../../server/dbClinical";

/**
 * Normal reference values for KTP laboratory catalog and workup checklist items.
 * Standardized to Philippine hospital and clinical nephrology guidelines.
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

  // Checklist workup lab requirements
  "CBC with differential": "Hgb 120-160 g/L, WBC 4.5-11.0, Plt 150-450",
  "Blood typing ABO and Rh": "Documented ABO and Rh typing",
  "BT, CT, PT/INR, aPTT": "INR 0.8-1.2, aPTT 25-35s, normal coagulation",
  "FBS and HbA1c": "FBS 3.9-5.6 mmol/L, HbA1c < 5.7%",
  "Creatinine, BUN, uric acid": "Crea 60-115 umol/L, BUN 2.5-7.1 mmol/L, UA 200-420",
  "SGPT, SGOT, ALP": "ALT/SGPT 0-45 U/L, AST/SGOT 0-35 U/L, ALP 30-120 U/L",
  "Na, K, Ca, phosphorus, Mg": "Na 135-145, K 3.5-5.0, Ca 2.15-2.55, P 0.8-1.45 mmol/L",
  "Lipid profile": "Chol < 5.2, Trig < 1.7, HDL > 1.0, LDL < 2.6 mmol/L",
  "Albumin and total protein": "Albumin 35-50 g/L, Total Protein 60-80 g/L",
  "iPTH": "1.6 - 6.9 pmol/L (15 - 65 pg/mL)",
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
  "Repeat urinalysis and CBC": "Normal urinalysis, CBC within baseline",
  "RT-PCR on admission day": "SARS-CoV-2 Negative",
};

/**
 * Retrieve the normal reference values for a given requirement or test name.
 */
export function getNormalValue(name: string): string | null {
  if (LAB_NORMAL_VALUES[name]) {
    return LAB_NORMAL_VALUES[name];
  }
  const clean = name.toLowerCase().trim();
  for (const [key, value] of Object.entries(LAB_NORMAL_VALUES)) {
    if (key.toLowerCase().trim() === clean || clean.includes(key.toLowerCase())) {
      return value;
    }
  }
  return null;
}

/**
 * Find the latest recorded patient lab result matching a checklist requirement.
 */
export function findLatestMatchingResult(
  itemName: string,
  labResults: ClinicalLabResult[]
): ClinicalLabResult | null {
  if (!labResults || labResults.length === 0) return null;

  const lower = itemName.toLowerCase();
  for (const res of labResults) {
    const testLower = res.testName.toLowerCase();
    if (lower.includes(testLower) || testLower.includes(lower)) {
      return res;
    }
  }
  return null;
}
