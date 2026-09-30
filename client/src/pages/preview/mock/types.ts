// Fictional preview dataset types. Mirror the spec data model (section 5.3),
// limited to what the four preview screens need. No real patient data.

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO with offset, Asia/Manila (+08:00)

export type DoctorRole = "Nephrologist" | "Fellow";

export interface Doctor {
  id: string;
  name: string;
  role: DoctorRole;
  active: boolean;
}

export type PatientType = "Recipient" | "Donor";
export type PatientStatus = "Active" | "Inactive" | "Deceased" | "Transferred";
export type Sex = "F" | "M";
export type RiskCategory = "StandardLow" | "High";

// Spec D7. Recipients have 7 stages, donors 6.
export type RecipientStage =
  | "Orientation"
  | "Phase1"
  | "Phase2"
  | "Clearances"
  | "PhilHealthZ"
  | "Phase3"
  | "PostKT";
export type DonorStage =
  | "Orientation"
  | "Phase1"
  | "Phase2"
  | "Clearances"
  | "Phase3"
  | "PostDonation";
export type PatientStage = RecipientStage | DonorStage;

interface PatientBase {
  id: string;
  hrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  sex: Sex;
  birthDate: ISODate;
  age: number;
  status: PatientStatus;
  riskCategory: RiskCategory | null;
  /** Transplant date (recipient) or donation date (donor). */
  surgeryDate: ISODate | null;
  followupMonths: 1 | 2 | 3;
  nephrologistId: string;
  fellowId: string;
}

export interface RecipientPatient extends PatientBase {
  patientType: "Recipient";
  stage: RecipientStage;
  linkedRecipientId: null;
}

export interface DonorPatient extends PatientBase {
  patientType: "Donor";
  stage: DonorStage;
  linkedRecipientId: string | null;
}

export type Patient = RecipientPatient | DonorPatient;

export type ServiceType = "Meds" | "Laboratory" | "Tacro" | "XrayUsd";
export type ServiceStatus = "Planned" | "Done" | "Superseded";
export type ServiceSource = "Manual" | "Guide";
export type RepeatReason =
  | "Hemolyzed"
  | "Clotted"
  | "WrongTroughTiming"
  | "LabError"
  | "DoctorRequest"
  | "Other";

export interface ServiceRecord {
  id: string;
  patientId: string;
  serviceType: ServiceType;
  label: string;
  status: ServiceStatus;
  dueDate: ISODate;
  serviceDate: ISODate | null;
  claimDeadline: ISODate | null;
  claimFiledDate: ISODate | null;
  repeatOfId: string | null;
  repeatReason: RepeatReason | null;
  repeatEveryDays: number | null;
  source: ServiceSource;
  note: string | null;
}

export interface LabTest {
  id: string;
  name: string;
  unit: string;
  low: number | null;
  high: number | null;
  active: boolean;
  sortOrder: number;
}

export type LabFlag = "Low" | "Normal" | "High";

export interface LabResult {
  id: string;
  serviceRecordId: string;
  labTestId: string;
  value: number;
  lowSnapshot: number | null;
  highSnapshot: number | null;
  flag: LabFlag | null;
}

export type AppointmentKind = "FollowUp" | "Biopsy" | "Workup" | "Clearance" | "Other";
export type AppointmentResponse = "Pending" | "Confirmed" | "RescheduleRequested";

export interface Appointment {
  id: string;
  patientId: string;
  title: string;
  kind: AppointmentKind;
  startsAt: ISODateTime;
  location: string;
  note: string | null;
  response: AppointmentResponse;
  responseNote: string | null;
  respondedAt: ISODate | null;
  cancelledAt: ISODateTime | null;
}

export type MessageAudience = "OnePatient" | "AllRecipients";

export interface Message {
  id: string;
  patientId: string;
  audience: MessageAudience;
  title: string;
  body: string;
  sentAt: ISODateTime;
  readAt: ISODate | ISODateTime | null;
  acknowledgedAt: ISODate | ISODateTime | null;
}

export interface MockDataset {
  doctors: Doctor[];
  patients: Patient[];
  serviceRecords: ServiceRecord[];
  labTests: LabTest[];
  labResults: LabResult[];
  appointments: Appointment[];
  messages: Message[];
}

// Derived types

export type ClaimStatus = "Filed" | "Overdue" | "DueSoon" | "Open" | "None";
export type DueState = "Overdue" | "DueSoon" | "Upcoming";

export interface ServiceTracker {
  serviceType: ServiceType;
  lastDone: ServiceRecord | null;
  nextPlanned: ServiceRecord | null;
  nextDueState: DueState | null;
  /** Claim status of the last done record, null when nothing is done yet. */
  lastDoneClaim: ClaimStatus | null;
}

export interface StageCount {
  stage: PatientStage;
  label: string;
  count: number;
}

export interface OverdueServiceRow {
  patient: Patient;
  record: ServiceRecord;
  daysOverdue: number;
}

export interface ClaimDueRow {
  patient: Patient;
  record: ServiceRecord;
  daysLeft: number;
}

export interface RescheduleRow {
  patient: Patient;
  appointment: Appointment;
}

export interface SupersededUnfiledRow {
  patient: Patient;
  record: ServiceRecord;
}

export interface DashboardAggregates {
  activeCount: number;
  recipientCount: number;
  donorCount: number;
  recipientStages: StageCount[];
  donorStages: StageCount[];
  overdueServices: OverdueServiceRow[];
  claimsDueSoon: ClaimDueRow[];
  rescheduleRequests: RescheduleRow[];
  supersededUnfiled: SupersededUnfiledRow[];
}

export interface LabPoint {
  recordId: string;
  resultId: string;
  date: ISODate;
  value: number;
  flag: LabFlag | null;
  superseded: boolean;
}

export interface LabSeries {
  test: LabTest;
  points: LabPoint[];
}
