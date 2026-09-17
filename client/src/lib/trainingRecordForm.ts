import { dateKey } from "@shared/nursetrack";

export const RECORD_STATUSES = ["Scheduled", "Completed", "Expired", "Cancelled"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** The stored fields the Edit Training Record dialog shows. */
export type TrainingRecordFields = {
  status: string;
  provider?: string | null;
  scheduledDate?: Date | string | null;
  completionDate?: Date | string | null;
  expiryDate?: Date | string | null;
  trainingHours?: number | null;
  cpdUnits?: number | null;
  certificateNumber?: string | null;
  remarks?: string | null;
};

/** Dialog state: every input is a string, dates are `YYYY-MM-DD`. */
export type TrainingRecordFormState = {
  status: RecordStatus;
  provider: string;
  scheduledDate: string;
  completionDate: string;
  expiryDate: string;
  hours: string;
  cpd: string;
  certNumber: string;
  remarks: string;
};

export type TrainingRecordUpdate = {
  status?: RecordStatus;
  provider?: string;
  scheduledDate?: Date | null;
  completionDate?: Date | null;
  expiryDate?: Date | null;
  trainingHours?: number | null;
  cpdUnits?: number | null;
  certificateNumber?: string;
  remarks?: string;
};

export const EMPTY_TRAINING_RECORD_FORM: TrainingRecordFormState = {
  status: "Scheduled",
  provider: "",
  scheduledDate: "",
  completionDate: "",
  expiryDate: "",
  hours: "",
  cpd: "",
  certNumber: "",
  remarks: "",
};

function asStatus(value: string): RecordStatus {
  return (RECORD_STATUSES as readonly string[]).includes(value) ? (value as RecordStatus) : "Scheduled";
}

export function recordToFormState(record: TrainingRecordFields): TrainingRecordFormState {
  return {
    status: asStatus(record.status),
    provider: record.provider ?? "",
    scheduledDate: dateKey(record.scheduledDate),
    completionDate: dateKey(record.completionDate),
    expiryDate: dateKey(record.expiryDate),
    hours: record.trainingHours != null ? String(record.trainingHours) : "",
    cpd: record.cpdUnits != null ? String(record.cpdUnits) : "",
    certNumber: record.certificateNumber ?? "",
    remarks: record.remarks ?? "",
  };
}

const toDate = (value: string) => (value ? new Date(value) : null);
const toCount = (value: string) => (value.trim() ? Number(value) : null);

/**
 * Only the fields the user changed. An unchanged field is left out so the
 * server keeps its stored value; a cleared date or count becomes `null`.
 */
export function formStateToUpdate(initial: TrainingRecordFormState, current: TrainingRecordFormState): TrainingRecordUpdate {
  const update: TrainingRecordUpdate = {};
  if (current.status !== initial.status) update.status = current.status;
  if (current.provider.trim() !== initial.provider.trim()) update.provider = current.provider.trim();
  if (current.scheduledDate !== initial.scheduledDate) update.scheduledDate = toDate(current.scheduledDate);
  if (current.completionDate !== initial.completionDate) update.completionDate = toDate(current.completionDate);
  if (current.expiryDate !== initial.expiryDate) update.expiryDate = toDate(current.expiryDate);
  if (current.hours.trim() !== initial.hours.trim()) update.trainingHours = toCount(current.hours);
  if (current.cpd.trim() !== initial.cpd.trim()) update.cpdUnits = toCount(current.cpd);
  if (current.certNumber.trim() !== initial.certNumber.trim()) update.certificateNumber = current.certNumber.trim();
  if (current.remarks.trim() !== initial.remarks.trim()) update.remarks = current.remarks.trim();
  return update;
}
