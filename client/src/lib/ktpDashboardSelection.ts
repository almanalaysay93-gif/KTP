import {
  DONOR_STAGES,
  RECIPIENT_STAGES,
  type DonorStage,
  type RecipientStage,
} from "@shared/ktp";
import {
  TRIAGE_ORDER,
  type TriageCellId,
  type TriageSelection,
} from "@/components/ktp/admin/triage";

export function dashboardSelectionParam(selection: TriageSelection): string {
  return selection.kind === "cell"
    ? `cell:${selection.id}`
    : `stage:${selection.patientType}:${selection.stage}`;
}

export function dashboardSelectionFromSearch(search: string): TriageSelection {
  const value = new URLSearchParams(search).get("list");
  if (!value) return { kind: "cell", id: "overdue" };

  const parts = value.split(":");
  const [kind, first, second] = parts;
  if (kind === "cell" && parts.length === 2 && TRIAGE_ORDER.includes(first as TriageCellId)) {
    return { kind: "cell", id: first as TriageCellId };
  }

  if (
    kind === "stage" && parts.length === 3 &&
    first === "Recipient" &&
    RECIPIENT_STAGES.includes(second as RecipientStage)
  ) {
    return { kind: "stage", patientType: "Recipient", stage: second as RecipientStage };
  }
  if (
    kind === "stage" && parts.length === 3 &&
    first === "Donor" &&
    DONOR_STAGES.includes(second as DonorStage)
  ) {
    return { kind: "stage", patientType: "Donor", stage: second as DonorStage };
  }

  return { kind: "cell", id: "overdue" };
}
