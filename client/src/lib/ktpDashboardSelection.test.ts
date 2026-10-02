import { describe, expect, it } from "vitest";
import { dashboardSelectionFromSearch, dashboardSelectionParam } from "./ktpDashboardSelection";
import { TRIAGE_ORDER } from "@/components/ktp/admin/triage";
import { DONOR_STAGES, RECIPIENT_STAGES } from "@shared/ktp";
describe("dashboard deep links", () => {
  it("round trips all 21 selections", () => {
    const values = [
      ...TRIAGE_ORDER.map(id => ({ kind: "cell" as const, id })),
      ...RECIPIENT_STAGES.map(stage => ({ kind: "stage" as const, patientType: "Recipient" as const, stage })),
      ...DONOR_STAGES.map(stage => ({ kind: "stage" as const, patientType: "Donor" as const, stage })),
    ];
    expect(values).toHaveLength(21);
    for (const value of values) expect(dashboardSelectionFromSearch(`?list=${encodeURIComponent(dashboardSelectionParam(value))}`)).toEqual(value);
  });
  it("rejects malformed and mismatched selections", () => {
    for (const value of ["cell:superseded", "cell:active:extra", "stage:Donor:PostKT", "stage:Recipient:PostDonation", "stage:Recipient:Phase1:extra", "cell:missing"])
      expect(dashboardSelectionFromSearch(`?list=${value}`)).toEqual({ kind: "cell", id: "overdue" });
  });
});
