import type {
  DashboardAggregates,
  MockDataset,
  Patient,
  PatientStage,
  StageCount,
} from "./ktpViewTypes";
import { RECIPIENT_STAGES, DONOR_STAGES, STAGE_ADMIN_LABEL } from "./ktpLabels";

function stages(
  patients: Patient[],
  order: readonly PatientStage[]
): StageCount[] {
  return order.map(stage => ({
    stage,
    label: STAGE_ADMIN_LABEL[stage],
    count: patients.filter(p => p.stage === stage).length,
  }));
}

export function liveDashboardData(patients: Patient[]): MockDataset {
  return {
    patients,
    doctors: [],
    serviceRecords: [],
    appointments: [],
    messages: [],
    labTests: [],
    labResults: [],
  };
}

export function liveDashboardAggregates(
  data: MockDataset
): DashboardAggregates {
  const active = data.patients.filter(p => p.status === "Active");
  const recipients = active.filter(p => p.patientType === "Recipient");
  const donors = active.filter(p => p.patientType === "Donor");
  return {
    activeCount: active.length,
    recipientCount: recipients.length,
    donorCount: donors.length,
    recipientStages: stages(recipients, RECIPIENT_STAGES),
    donorStages: stages(donors, DONOR_STAGES),
    overdueServices: [],
    claimsDueSoon: [],
    rescheduleRequests: [],
    supersededUnfiled: [],
  };
}
