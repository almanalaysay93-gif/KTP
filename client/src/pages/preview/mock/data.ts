// Fictional preview dataset, transcribed from docs/buildme/COPY.md section 6.
// Every name, HRN, date and value is invented. No real patients.

import { addDays } from "./dates";
import type {
  Appointment,
  Doctor,
  LabFlag,
  LabResult,
  LabTest,
  Message,
  MockDataset,
  Patient,
  ServiceRecord,
  ServiceSource,
  ServiceType,
} from "./types";

export const MOCK_TODAY = "2026-09-30";
export const FEATURED_PATIENT_ID = "p01";
export const FEATURED_DONOR_ID = "p09";

export const DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. Leonora Bautista-Galvez", role: "Nephrologist", active: true },
  { id: "d2", name: "Dr. Rafael Macaraeg", role: "Nephrologist", active: true },
  { id: "d3", name: "Dr. Soledad Evangelista", role: "Nephrologist", active: true },
  { id: "d4", name: "Dr. Paolo Sarmiento", role: "Fellow", active: true },
  { id: "d5", name: "Dr. Kristine Abad", role: "Fellow", active: true },
  { id: "d6", name: "Dr. Jericho Lumbao", role: "Fellow", active: true },
];

export const PATIENTS: Patient[] = [
  {
    id: "p01", hrn: "HRN-2026-0147", firstName: "Analyn", middleName: "Ferrer", lastName: "Villacorta",
    patientType: "Recipient", sex: "F", birthDate: "1988-03-14", age: 38, stage: "PostKT",
    surgeryDate: "2026-04-29", nephrologistId: "d1", fellowId: "d4", linkedRecipientId: null,
    riskCategory: "StandardLow", followupMonths: 1, status: "Active",
  },
  {
    id: "p02", hrn: "HRN-2025-0832", firstName: "Rodel", middleName: "Tupas", lastName: "Dimaculangan",
    patientType: "Recipient", sex: "M", birthDate: "1974-06-02", age: 52, stage: "PostKT",
    surgeryDate: "2025-11-12", nephrologistId: "d2", fellowId: "d5", linkedRecipientId: null,
    riskCategory: "StandardLow", followupMonths: 1, status: "Active",
  },
  {
    id: "p03", hrn: "HRN-2024-0519", firstName: "Evangeline", middleName: "Pacquing", lastName: "Serrano",
    patientType: "Recipient", sex: "F", birthDate: "1981-01-19", age: 45, stage: "PostKT",
    surgeryDate: "2024-08-20", nephrologistId: "d3", fellowId: "d6", linkedRecipientId: null,
    riskCategory: "High", followupMonths: 2, status: "Active",
  },
  {
    id: "p04", hrn: "HRN-2026-0391", firstName: "Jomar", middleName: "Alcantara", lastName: "Pineda",
    patientType: "Recipient", sex: "M", birthDate: "1997-05-08", age: 29, stage: "PostKT",
    surgeryDate: "2026-08-26", nephrologistId: "d1", fellowId: "d5", linkedRecipientId: null,
    riskCategory: "StandardLow", followupMonths: 1, status: "Active",
  },
  {
    id: "p05", hrn: "HRN-2026-0412", firstName: "Charito", middleName: "Lagman", lastName: "Esguerra",
    patientType: "Recipient", sex: "F", birthDate: "1970-02-11", age: 56, stage: "Phase3",
    surgeryDate: null, nephrologistId: "d2", fellowId: "d4", linkedRecipientId: null,
    riskCategory: "StandardLow", followupMonths: 1, status: "Active",
  },
  {
    id: "p06", hrn: "HRN-2026-0228", firstName: "Bernardo", middleName: "Yap", lastName: "Ilagan",
    patientType: "Recipient", sex: "M", birthDate: "1979-07-21", age: 47, stage: "PhilHealthZ",
    surgeryDate: null, nephrologistId: "d3", fellowId: "d6", linkedRecipientId: null,
    riskCategory: "High", followupMonths: 1, status: "Active",
  },
  {
    id: "p07", hrn: "HRN-2026-0455", firstName: "Maricar", middleName: "Umali", lastName: "Gallardo",
    patientType: "Recipient", sex: "F", birthDate: "1992-04-03", age: 34, stage: "Clearances",
    surgeryDate: null, nephrologistId: "d1", fellowId: "d6", linkedRecipientId: null,
    riskCategory: null, followupMonths: 1, status: "Active",
  },
  {
    id: "p08", hrn: "HRN-2026-0503", firstName: "Nestor", middleName: "Quijano", lastName: "Abellera",
    patientType: "Recipient", sex: "M", birthDate: "1965-08-30", age: 61, stage: "Phase1",
    surgeryDate: null, nephrologistId: "d2", fellowId: "d5", linkedRecipientId: null,
    riskCategory: null, followupMonths: 1, status: "Active",
  },
  {
    id: "p09", hrn: "HRN-2026-0148", firstName: "Ramil", middleName: "Ferrer", lastName: "Villacorta",
    patientType: "Donor", sex: "M", birthDate: "1985-09-02", age: 41, stage: "PostDonation",
    surgeryDate: "2026-04-29", nephrologistId: "d1", fellowId: "d4", linkedRecipientId: "p01",
    riskCategory: null, followupMonths: 1, status: "Active",
  },
  {
    id: "p10", hrn: "HRN-2025-0833", firstName: "Josielyn", middleName: "Arcega", lastName: "Dimaculangan",
    patientType: "Donor", sex: "F", birthDate: "1977-03-25", age: 49, stage: "PostDonation",
    surgeryDate: "2025-11-12", nephrologistId: "d2", fellowId: "d5", linkedRecipientId: "p02",
    riskCategory: null, followupMonths: 1, status: "Active",
  },
  {
    id: "p11", hrn: "HRN-2026-0413", firstName: "Rhea", middleName: "Esguerra", lastName: "Tolentino",
    patientType: "Donor", sex: "F", birthDate: "1996-01-15", age: 30, stage: "Phase3",
    surgeryDate: null, nephrologistId: "d2", fellowId: "d4", linkedRecipientId: "p05",
    riskCategory: null, followupMonths: 1, status: "Active",
  },
  {
    id: "p12", hrn: "HRN-2026-0456", firstName: "Arvin", middleName: "Umali", lastName: "Gallardo",
    patientType: "Donor", sex: "M", birthDate: "1989-06-17", age: 37, stage: "Phase2",
    surgeryDate: null, nephrologistId: "d1", fellowId: "d6", linkedRecipientId: "p07",
    riskCategory: null, followupMonths: 1, status: "Active",
  },
];

// Record builders. "rule" = claimDeadline serviceDate + 30, claimFiledDate serviceDate + 14.

type Extra = Partial<ServiceRecord>;

function base(
  id: string,
  patientId: string,
  serviceType: ServiceType,
  label: string,
  dueDate: string,
  source: ServiceSource,
): ServiceRecord {
  return {
    id, patientId, serviceType, label, status: "Planned", dueDate,
    serviceDate: null, claimDeadline: null, claimFiledDate: null,
    repeatOfId: null, repeatReason: null, repeatEveryDays: null, source, note: null,
  };
}

/** Done with the claim filed by the rule. `extra` overrides any field. */
function done(
  id: string,
  patientId: string,
  serviceType: ServiceType,
  label: string,
  dueDate: string,
  source: ServiceSource,
  extra: Extra = {},
): ServiceRecord {
  const serviceDate = extra.serviceDate ?? dueDate;
  return {
    ...base(id, patientId, serviceType, label, dueDate, source),
    status: "Done",
    serviceDate,
    claimDeadline: addDays(serviceDate, 30),
    claimFiledDate: addDays(serviceDate, 14),
    ...extra,
  };
}

function planned(
  id: string,
  patientId: string,
  serviceType: ServiceType,
  label: string,
  dueDate: string,
  source: ServiceSource,
  extra: Extra = {},
): ServiceRecord {
  return { ...base(id, patientId, serviceType, label, dueDate, source), ...extra };
}

const P = FEATURED_PATIENT_ID;
const LAB = "Laboratory" as const;
const MONTHLY_DATES = [
  "2026-05-06", "2026-05-13", "2026-05-20", "2026-05-27", "2026-06-03", "2026-06-17", "2026-07-01",
];
const XRAY = "Chest X-ray and graft ultrasound";

const featuredRecords: ServiceRecord[] = [
  ...MONTHLY_DATES.map((d, i) => done(`r0${i + 1}`, P, LAB, "Monthly panel", d, "Guide")),
  done("r08", P, LAB, "Interim check", "2026-07-15", "Manual", {
    note: "Extra draw ordered by Dr. Bautista-Galvez",
  }),
  done("r09", P, LAB, "Monthly panel", "2026-08-01", "Guide", {
    serviceDate: "2026-08-03", claimDeadline: "2026-09-25", claimFiledDate: null,
  }),
  done("r10", P, LAB, "Monthly panel", "2026-09-01", "Guide", {
    status: "Superseded", claimDeadline: "2026-10-12", claimFiledDate: null,
  }),
  done("r11", P, LAB, "Monthly panel", "2026-09-01", "Manual", {
    serviceDate: "2026-09-03", claimDeadline: "2026-10-02", claimFiledDate: null,
    repeatOfId: "r10", repeatReason: "Hemolyzed",
  }),
  planned("r12", P, LAB, "Monthly panel", "2026-10-01", "Guide"),
  ...["2026-05-06", "2026-05-29", "2026-06-29", "2026-07-29"].map((d, i) =>
    done(`r${13 + i}`, P, LAB, "CMV PCR", d, "Guide"),
  ),
  planned("r17", P, LAB, "CMV PCR", "2026-10-29", "Guide"),
  ...["2026-05-29", "2026-06-29", "2026-07-29"].map((d, i) =>
    done(`r${18 + i}`, P, LAB, "RT-PCR", d, "Guide"),
  ),
  ...MONTHLY_DATES.map((d, i) => done(`t0${i + 1}`, P, "Tacro", "Tacro trough", d, "Guide")),
  done("t08", P, "Tacro", "Tacro recheck", "2026-07-15", "Manual"),
  done("t09", P, "Tacro", "Tacro trough", "2026-08-01", "Guide", { serviceDate: "2026-08-03" }),
  done("t10", P, "Tacro", "Tacro trough", "2026-09-01", "Guide", {
    claimDeadline: "2026-10-15", claimFiledDate: null,
  }),
  planned("t11", P, "Tacro", "Tacro trough", "2026-10-01", "Guide"),
  done("m01", P, "Meds", "Meds claim", "2026-08-07", "Manual", { repeatEveryDays: 28 }),
  done("m02", P, "Meds", "Meds claim", "2026-09-04", "Manual", {
    claimDeadline: "2026-10-05", claimFiledDate: null, repeatEveryDays: 28,
  }),
  planned("m03", P, "Meds", "Meds claim", "2026-10-02", "Manual", { repeatEveryDays: 28 }),
  done("x01", P, "XrayUsd", XRAY, "2026-06-24", "Manual", {
    claimDeadline: "2026-07-24", claimFiledDate: "2026-07-20", repeatEveryDays: 90,
  }),
  planned("x02", P, "XrayUsd", XRAY, "2026-09-22", "Manual"),
];

// Other patients. Each record is Done with the claim filed, or Planned and not
// past due, except the rows that feed the dashboard lists (overdue, claim due soon).
const otherRecords: ServiceRecord[] = [
  // p02: overdue X-ray, unfiled Tacro claim due 1 Oct.
  planned("q01", "p02", "XrayUsd", XRAY, "2026-09-11", "Manual", { repeatEveryDays: 90 }),
  done("q02", "p02", "Tacro", "Tacro trough", "2026-09-10", "Guide", {
    claimDeadline: "2026-10-01", claimFiledDate: null,
  }),
  planned("q03", "p02", "Tacro", "Tacro trough", "2026-10-22", "Guide"),
  done("q04", "p02", LAB, "Monthly panel", "2026-08-20", "Guide"),
  // p03: overdue Tacro.
  done("q05", "p03", "Tacro", "Tacro trough", "2026-07-21", "Guide"),
  planned("q06", "p03", "Tacro", "Tacro trough", "2026-09-21", "Guide"),
  // p04: overdue Meds claim.
  done("q07", "p04", "Meds", "Meds claim", "2026-08-28", "Manual", { repeatEveryDays: 28 }),
  planned("q08", "p04", "Meds", "Meds claim", "2026-09-25", "Manual", { repeatEveryDays: 28 }),
  // p05: upcoming pre-admission labs.
  planned("q09", "p05", LAB, "Phase 3 labs", "2026-10-14", "Manual"),
  // p08: overdue Phase 1 labs.
  planned("q10", "p08", LAB, "Phase 1 labs", "2026-09-15", "Manual"),
  // p09: donor follow-up, unfiled claim due 6 Oct.
  done("q11", "p09", LAB, "Donor follow-up", "2026-09-16", "Manual", {
    claimDeadline: "2026-10-06", claimFiledDate: null,
  }),
  planned("q12", "p09", LAB, "Donor follow-up", "2026-10-16", "Manual", { repeatEveryDays: 30 }),
  // p10: donor follow-up filed, next one upcoming.
  done("q13", "p10", LAB, "Donor follow-up", "2026-09-10", "Manual"),
  planned("q14", "p10", LAB, "Donor follow-up", "2026-11-10", "Manual", { repeatEveryDays: 30 }),
];

export const SERVICE_RECORDS: ServiceRecord[] = [...featuredRecords, ...otherRecords];

// Sample reference ranges (COPY.md 6.4). The admin enters real lab ranges later.
export const LAB_TESTS: LabTest[] = [
  { id: "lt-creatinine", name: "Creatinine", unit: "umol/L", low: 53, high: 106, active: true, sortOrder: 1 },
  { id: "lt-tacrolimus", name: "Tacrolimus trough", unit: "ng/mL", low: 5.0, high: 10.0, active: true, sortOrder: 2 },
];

function flagFor(value: number, low: number | null, high: number | null): LabFlag | null {
  if (low === null && high === null) return null;
  if (low !== null && value < low) return "Low";
  if (high !== null && value > high) return "High";
  return "Normal";
}

function results(testId: string, rows: Array<[string, number]>): LabResult[] {
  const test = LAB_TESTS.find((t) => t.id === testId)!;
  return rows.map(([recordId, value]) => ({
    id: `lr-${recordId}`,
    serviceRecordId: recordId,
    labTestId: testId,
    value,
    lowSnapshot: test.low,
    highSnapshot: test.high,
    flag: flagFor(value, test.low, test.high),
  }));
}

export const LAB_RESULTS: LabResult[] = [
  ...results("lt-creatinine", [
    ["r01", 142], ["r02", 126], ["r03", 117], ["r04", 111], ["r05", 108],
    ["r06", 103], ["r07", 100], ["r08", 104], ["r09", 98],
    ["r10", 101], // Superseded, left out of the chart
    ["r11", 96],
  ]),
  ...results("lt-tacrolimus", [
    ["t01", 7.4], ["t02", 9.1], ["t03", 11.3], ["t04", 10.6], ["t05", 9.4],
    ["t06", 8.7], ["t07", 12.1], ["t08", 8.9], ["t09", 7.6], ["t10", 6.8],
  ]),
];

function appt(
  id: string,
  patientId: string,
  title: string,
  kind: Appointment["kind"],
  startsAt: string,
  location: string,
  response: Appointment["response"],
  responseNote: string | null,
  respondedAt: string | null,
): Appointment {
  return {
    id, patientId, title, kind, startsAt, location, note: null,
    response, responseNote, respondedAt, cancelledAt: null,
  };
}

export const APPOINTMENTS: Appointment[] = [
  appt("a01", "p01", "Follow-up visit", "FollowUp", "2026-09-03T08:30:00+08:00", "KT clinic", "Confirmed", null, "2026-08-28"),
  appt("a02", "p01", "Blood draw: monthly labs and tacro", "Other", "2026-10-01T07:00:00+08:00", "KT clinic", "Pending", null, null),
  appt(
    "a03", "p01", "Chest X-ray and graft ultrasound", "Other", "2026-10-02T10:00:00+08:00", "Imaging section",
    "RescheduleRequested", "I have work this Friday. Can we move it to Monday or Tuesday next week?", "2026-09-28",
  ),
  appt("a04", "p01", "Follow-up visit", "FollowUp", "2026-10-06T09:00:00+08:00", "KT clinic", "Confirmed", null, "2026-09-25"),
  appt(
    "a05", "p12", "Renal CT angiography", "Workup", "2026-10-08T13:00:00+08:00", "Imaging section",
    "RescheduleRequested", "I need to file leave at work first. Any day the week after is fine.", "2026-09-29",
  ),
];

export const MESSAGES: Message[] = [
  {
    id: "g01", patientId: "p01", audience: "OnePatient", title: "Blood tests on Thursday",
    body: "Hi Analyn. Your monthly blood tests and tacro test are due on Thu, 1 Oct. Please open Calendar and tap Confirm.",
    sentAt: "2026-09-29T16:10:00+08:00", readAt: null, acknowledgedAt: null,
  },
  {
    id: "g02", patientId: "p01", audience: "OnePatient", title: "We got your request",
    body: "We received your request to move your chest X-ray and ultrasound. We will set a new time, and you will get a notice.",
    sentAt: "2026-09-28T14:30:00+08:00", readAt: null, acknowledgedAt: null,
  },
  {
    id: "g03", patientId: "p01", audience: "OnePatient", title: "Claim filed",
    body: "The claim for your 3 Aug tacro test is filed.",
    sentAt: "2026-08-18T10:00:00+08:00", readAt: "2026-08-18", acknowledgedAt: "2026-08-18",
  },
  {
    id: "g04", patientId: "p01", audience: "AllRecipients", title: "Your records in KTP",
    body: "You can now see your tests, claims, and appointments in KTP. If something looks wrong, please tell the KT unit.",
    sentAt: "2026-09-01T09:00:00+08:00", readAt: "2026-09-02", acknowledgedAt: null,
  },
];

export const MOCK_DATASET: MockDataset = {
  doctors: DOCTORS,
  patients: PATIENTS,
  serviceRecords: SERVICE_RECORDS,
  labTests: LAB_TESTS,
  labResults: LAB_RESULTS,
  appointments: APPOINTMENTS,
  messages: MESSAGES,
};
