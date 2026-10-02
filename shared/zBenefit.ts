import { SERVICE_TYPES, dateKey, type ServiceType } from "./ktp";

/*
 * PhilHealth Z Benefit follow-up of one patient: for each service type (medicines, laboratory,
 * tacrolimus test, X-ray and ultrasound) the dates that the Z Benefit claim needs. All values
 * come from the service records of the Tracker.
 */

export type ZServiceInput = {
  serviceType: string;
  status: string;
  dueDate: string | Date | null;
  serviceDate: string | Date | null;
  claimDeadline: string | Date | null;
  claimFiledDate: string | Date | null;
};

export type ZServiceSummary = {
  /** Service date of the first completed record. For medicines: the date of the first claim. */
  firstDate: string | null;
  /** Service date of the newest completed record. */
  lastDate: string | null;
  /** Due date of the earliest planned record. */
  nextDue: string | null;
  /** Earliest claim deadline of a completed record with no filed claim. */
  claimDue: string | null;
};

export type ZBenefitSummary = Record<ServiceType, ZServiceSummary>;

const earliest = (values: string[]) => (values.length ? values.reduce((a, b) => (a < b ? a : b)) : null);
const latest = (values: string[]) => (values.length ? values.reduce((a, b) => (a > b ? a : b)) : null);

export function summarizeZBenefit(services: ZServiceInput[]): ZBenefitSummary {
  const summary = {} as ZBenefitSummary;
  for (const type of SERVICE_TYPES) {
    const records = services.filter(service => service.serviceType === type);
    const done = records.filter(service => service.status === "Done");
    const serviceDates = done.map(service => dateKey(service.serviceDate)).filter(Boolean);
    summary[type] = {
      firstDate: earliest(serviceDates),
      lastDate: latest(serviceDates),
      nextDue: earliest(records.filter(service => service.status === "Planned").map(service => dateKey(service.dueDate)).filter(Boolean)),
      claimDue: earliest(done.filter(service => !dateKey(service.claimFiledDate)).map(service => dateKey(service.claimDeadline)).filter(Boolean)),
    };
  }
  return summary;
}

export type ZDueState = "overdue" | "soon" | "later";

/** Overdue: before today. Soon: today or in the next 7 days. */
export function zDueState(date: string, today: string): ZDueState {
  if (date < today) return "overdue";
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 7 ? "soon" : "later";
}
