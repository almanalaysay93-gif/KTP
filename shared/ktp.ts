/**
 * Shared domain logic, constants, and validation for KTP (Kidney Transplant Patient Tracker).
 */

export const RECIPIENT_STAGES = [
  "Orientation",
  "Phase1",
  "Phase2",
  "Clearances",
  "PhilHealthZ",
  "Phase3",
  "PostKT",
] as const;
export type RecipientStage = (typeof RECIPIENT_STAGES)[number];

export const DONOR_STAGES = [
  "Orientation",
  "Phase1",
  "Phase2",
  "Clearances",
  "Phase3",
  "PostDonation",
] as const;
export type DonorStage = (typeof DONOR_STAGES)[number];

export type PatientStage = RecipientStage | DonorStage;

export const PATIENT_TYPES = ["Recipient", "Donor"] as const;
export type PatientType = (typeof PATIENT_TYPES)[number];

export const PATIENT_STATUSES = ["Active", "Inactive", "Deceased", "Transferred"] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const DOCTOR_ROLES = ["Nephrologist", "Fellow"] as const;
export type DoctorRole = (typeof DOCTOR_ROLES)[number];

export const SERVICE_TYPES = ["Meds", "Laboratory", "Tacro", "XrayUsd"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_STATUSES = ["Planned", "Done", "Superseded"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_SOURCES = ["Manual", "Guide"] as const;
export type ServiceSource = (typeof SERVICE_SOURCES)[number];

export const REPEAT_REASONS = [
  "Hemolyzed",
  "Clotted",
  "WrongTroughTiming",
  "LabError",
  "DoctorRequest",
  "Other",
] as const;
export type RepeatReason = (typeof REPEAT_REASONS)[number];

export const APPOINTMENT_KINDS = [
  "FollowUp",
  "Biopsy",
  "Workup",
  "Clearance",
  "Other",
] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export const APPOINTMENT_RESPONSES = [
  "Pending",
  "Confirmed",
  "RescheduleRequested",
] as const;
export type AppointmentResponse = (typeof APPOINTMENT_RESPONSES)[number];

export const CHECKLIST_CATEGORIES = [
  "Lab",
  "Imaging",
  "Clearance",
  "Milestone",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export const CHECKLIST_APPLIES_TO = ["Recipient", "Donor", "Both"] as const;
export type ChecklistAppliesTo = (typeof CHECKLIST_APPLIES_TO)[number];

export const CHECKLIST_STATUSES = ["Pending", "Done", "NA"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const LAB_FLAGS = ["Low", "Normal", "High"] as const;
export type LabFlag = (typeof LAB_FLAGS)[number];

export const RISK_CATEGORIES = ["StandardLow", "High"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export type ClaimStatus = "Filed" | "Overdue" | "DueSoon" | "Open" | "None";

/** Safely extract a YYYY-MM-DD key from a Date object or date string */
export function dateKey(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  const key = dateKey(value);
  if (key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date(NaN) : value;
  return new Date(value);
}

/** Check if a stage is valid for the given patient type */
export function isValidStageForPatientType(stage: string, patientType: PatientType): boolean {
  if (patientType === "Recipient") {
    return (RECIPIENT_STAGES as readonly string[]).includes(stage);
  }
  if (patientType === "Donor") {
    return (DONOR_STAGES as readonly string[]).includes(stage);
  }
  return false;
}

/**
 * Claim status computed per specification section 6.5:
 * - Filed if claimFiledDate is set
 * - Overdue if claimDeadline is before today
 * - DueSoon if claimDeadline is within 7 days
 * - Open otherwise, or None if there is no deadline
 */
export function computeClaimStatus(
  claimFiledDate: string | Date | null | undefined,
  claimDeadline: string | Date | null | undefined,
  today: string = todayDate()
): ClaimStatus {
  if (claimFiledDate && dateKey(claimFiledDate)) {
    return "Filed";
  }
  const deadlineKey = dateKey(claimDeadline);
  if (!deadlineKey) {
    return "None";
  }

  const todayKey = dateKey(today) || todayDate();
  const deadlineMs = parseLocalDate(deadlineKey).getTime();
  const todayMs = parseLocalDate(todayKey).getTime();
  const diffDays = Math.floor((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Overdue";
  }
  if (diffDays <= 7) {
    return "DueSoon";
  }
  return "Open";
}

/** Add calendar days to a YYYY-MM-DD string */
export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Add calendar months to a YYYY-MM-DD string, clamping to month end if needed */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Days in target month
  const daysInMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInMonth);

  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Guide auto-suggest for post-KT recipients (Laboratory and Tacro only)
 * Specification section 6.1:
 * Anchor is slot's dueDate, not the serviceDate.
 * Days from surgeryDate to slot dueDate:
 * - 0 to 30 (month 1): + 7 days
 * - 31 to 60 (month 2): + 14 days
 * - 61 to 365 (months 3 to 12): + 1 calendar month
 * - over 365: + followupMonths calendar months
 */
export function suggestNextDueDate(
  serviceType: string,
  surgeryDateStr: string | Date | null | undefined,
  completedSlotDueDateStr: string | Date | null | undefined,
  followupMonths: number = 1
): string | null {
  if (serviceType !== "Laboratory" && serviceType !== "Tacro") {
    return null;
  }
  const surgery = dateKey(surgeryDateStr);
  const slotDue = dateKey(completedSlotDueDateStr);
  if (!surgery || !slotDue) return null;

  const surgeryMs = parseLocalDate(surgery).getTime();
  const slotDueMs = parseLocalDate(slotDue).getTime();
  const daysFromSurgery = Math.floor((slotDueMs - surgeryMs) / (1000 * 60 * 60 * 24));

  if (daysFromSurgery <= 30) {
    return addDays(slotDue, 7);
  }
  if (daysFromSurgery <= 60) {
    return addDays(slotDue, 14);
  }
  if (daysFromSurgery <= 365) {
    return addMonths(slotDue, 1);
  }
  const interval = Math.max(1, Math.min(3, followupMonths || 1));
  return addMonths(slotDue, interval);
}

/** Check consent validity */
export function isConsentUpToDate(
  patientConsentVersion: number | null | undefined,
  currentAppConsentVersion: number | string | null | undefined
): boolean {
  const currentVer = typeof currentAppConsentVersion === "number"
    ? currentAppConsentVersion
    : parseInt(String(currentAppConsentVersion ?? "1"), 10) || 1;
  const patientVer = patientConsentVersion ?? 0;
  return patientVer >= currentVer;
}
