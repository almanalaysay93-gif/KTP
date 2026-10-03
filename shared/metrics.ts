import { DONOR_STAGES, RECIPIENT_STAGES, type PatientStatus, type PatientType } from "./ktp";

export interface MetricsPatient {
  patientType: PatientType;
  stage: string;
  status: PatientStatus;
  ethicsStatus: string | null;
}

export function summarizeMetrics(rows: MetricsPatient[]) {
  const recipients = rows.filter(p => p.patientType === "Recipient");
  const donors = rows.filter(p => p.patientType === "Donor");
  // Missing checklist progress is Pending, as in the clinical checklist.
  // Ethics only counts patients currently awaiting clearance, not post-surgery profiles.
  const forEthics = rows.filter(p => p.stage === "Clearances" && p.ethicsStatus === "Pending");
  return {
    total: rows.length,
    recipients: recipients.length,
    donors: donors.length,
    forEthics: forEthics.length,
    ethicsRecipients: forEthics.filter(p => p.patientType === "Recipient").length,
    ethicsDonors: forEthics.filter(p => p.patientType === "Donor").length,
    forTransplant: recipients.filter(p => p.stage === "Phase3").length,
    postTransplant: recipients.filter(p => p.stage === "PostKT").length,
    postDonation: donors.filter(p => p.stage === "PostDonation").length,
    stages: [...new Set([...RECIPIENT_STAGES, ...DONOR_STAGES])].map(stage => ({
      stage,
      recipients: recipients.filter(p => p.stage === stage).length,
      donors: donors.filter(p => p.stage === stage).length,
    })),
  };
}
