import type { DonorStage, RecipientStage, ServiceType } from "./ktpViewTypes";

// Display order per patient type (spec D7).
export const RECIPIENT_STAGES: readonly RecipientStage[] = [
  "Orientation",
  "Phase1",
  "Phase2",
  "Clearances",
  "PhilHealthZ",
  "Phase3",
  "PostKT",
];

export const DONOR_STAGES: readonly DonorStage[] = [
  "Orientation",
  "Phase1",
  "Phase2",
  "Clearances",
  "Phase3",
  "PostDonation",
];

// Admin labels, COPY.md section 5.1.
export const STAGE_ADMIN_LABEL: Record<RecipientStage | DonorStage, string> = {
  Orientation: "Orientation",
  Phase1: "Phase 1 work-up",
  Phase2: "Phase 2 work-up",
  Clearances: "Clearances",
  PhilHealthZ: "PhilHealth Z",
  Phase3: "Phase 3 pre-admission",
  PostKT: "Post-KT",
  PostDonation: "Post-donation",
};

// COPY.md section 5.2.
export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  Meds: "Meds claim",
  Laboratory: "Laboratory",
  Tacro: "Tacro test",
  XrayUsd: "X-ray and USD",
};

export const SERVICE_TYPES: readonly ServiceType[] = [
  "Meds",
  "Laboratory",
  "Tacro",
  "XrayUsd",
];
