/*
 * Preview copies of the scheduling rules the dialogs prefill with (spec 6.1, 6.3). The real rule
 * lives in one pure function in `shared/` later; this mirror keeps the preview honest.
 */
import {
  LAB_TESTS,
  addDays,
  diffDays,
  type LabFlag,
  type LabTest,
  type Patient,
  type ServiceRecord,
} from "@/pages/preview/mock";
import { addMonths, fmtDate } from "./format";

export interface NextDueSuggestion {
  date: string;
  hint: string;
}

/** Guide tiers for post-KT Laboratory and Tacro, else dueDate + repeatEveryDays, else nothing. */
export function suggestNextDue(patient: Patient, record: ServiceRecord): NextDueSuggestion | null {
  const guide =
    record.source === "Guide" &&
    (record.serviceType === "Laboratory" || record.serviceType === "Tacro") &&
    patient.patientType === "Recipient" &&
    patient.surgeryDate;
  if (guide && patient.surgeryDate) {
    const days = diffDays(record.dueDate, patient.surgeryDate);
    let date: string;
    let rule: string;
    if (days <= 30) {
      date = addDays(record.dueDate, 7);
      rule = "month 1, every 7 days";
    } else if (days <= 60) {
      date = addDays(record.dueDate, 14);
      rule = "month 2, every 14 days";
    } else if (days <= 365) {
      date = addMonths(record.dueDate, 1);
      rule = "months 3 to 12, every month";
    } else {
      date = addMonths(record.dueDate, patient.followupMonths);
      rule = `after year 1, every ${patient.followupMonths} ${patient.followupMonths === 1 ? "month" : "months"}`;
    }
    return { date, hint: `Suggested from the transplant date: ${fmtDate(date)}. Rule: ${rule}. You can change it.` };
  }
  if (record.repeatEveryDays) {
    return {
      date: addDays(record.dueDate, record.repeatEveryDays),
      hint: `Prefilled: due date plus ${record.repeatEveryDays} days. You can change it.`,
    };
  }
  return null;
}

/** Lab tests recorded with a service: creatinine on a Laboratory panel, the trough on a Tacro test. */
export function testsFor(record: ServiceRecord): LabTest[] {
  if (record.serviceType === "Tacro") return LAB_TESTS.filter((t) => t.id === "lt-tacrolimus");
  if (record.serviceType === "Laboratory" && record.label === "Monthly panel") {
    return LAB_TESTS.filter((t) => t.id === "lt-creatinine");
  }
  return [];
}

export function flagOf(value: number, test: Pick<LabTest, "low" | "high">): LabFlag | null {
  if (test.low === null && test.high === null) return null;
  if (test.low !== null && value < test.low) return "Low";
  if (test.high !== null && value > test.high) return "High";
  return "Normal";
}

/** "53 to 106" (never a dash). */
export function rangeText(test: Pick<LabTest, "low" | "high">): string {
  if (test.low === null && test.high === null) return "No range";
  if (test.low === null) return `up to ${test.high}`;
  if (test.high === null) return `${test.low} and up`;
  return `${test.low} to ${test.high}`;
}
