import { describe, expect, it } from "vitest";
import { liveDashboardData, liveDashboardAggregates } from "./ktpDashboard";
import {
  patientsFor,
  triageCounts,
  matchesQuery,
  servicesDueSoon,
} from "@/components/ktp/admin/triage";
import type { Patient, ServiceRecord } from "./ktpViewTypes";

const base: Patient = {
  id: 101,
  hrn: "KTP-2026-0001",
  firstName: "Alai",
  middleName: "",
  lastName: "Fixture",
  patientType: "Recipient",
  stage: "Phase1",
  status: "Active",
  age: null,
  sex: null,
  birthDate: null,
  surgeryDate: null,
  linkedRecipientId: null,
  followupMonths: 1,
  riskCategory: null,
  nephrologistId: null,
  fellowId: null,
};
const today = "2026-10-01";

describe("live dashboard data consistency", () => {
  it("uses canonical IDs, identical active predicates and complete list counts", () => {
    const patients: Patient[] = [
      ...Array.from({ length: 7 }, (_, i) => ({ ...base, id: 101 + i })),
      { ...base, id: 108, stage: "PostKT", surgeryDate: "2026-09-30" },
      {
        ...base,
        id: 109,
        patientType: "Donor",
        stage: "Phase1",
        linkedRecipientId: 101,
      },
      {
        ...base,
        id: 110,
        patientType: "Donor",
        stage: "PostDonation",
        linkedRecipientId: 101,
      },
      ...(["Inactive", "Deceased", "Transferred"] as const).map(
        (status, i) => ({ ...base, id: 111 + i, status })
      ),
    ];
    const data = liveDashboardData(patients);
    const agg = liveDashboardAggregates(data);
    const counts = triageCounts(agg, data, today);
    expect([
      counts.active,
      counts.workup,
      counts.postkt,
      counts.donors,
      counts.donorsWorkup,
    ]).toEqual([10, 7, 1, 2, 1]);
    for (const id of ["active", "workup", "postkt", "donors"] as const) {
      expect(patientsFor({ kind: "cell", id }, data)).toHaveLength(counts[id]);
      expect(
        patientsFor({ kind: "cell", id }, data).every(
          p => typeof p.id === "number"
        )
      ).toBe(true);
    }
    for (const patientType of ["Recipient", "Donor"] as const) {
      for (const { stage, count } of patientType === "Recipient"
        ? agg.recipientStages
        : agg.donorStages) {
        expect(
          patientsFor({ kind: "stage", patientType, stage }, data)
        ).toHaveLength(count);
      }
    }
    expect(data.serviceRecords).toEqual([]);
    expect(servicesDueSoon(data, today)).toEqual([]);
  });
  it("searches enrolled names and HRNs independently of active triage", () => {
    for (const query of [" AlAI ", "ktp-2026-0001", "fixture"])
      expect(matchesQuery(base, query)).toBe(true);
    expect(matchesQuery(base, "absent")).toBe(false);
    const inactive = { ...base, status: "Inactive" } as Patient;
    expect(matchesQuery(inactive, "Alai")).toBe(true);
    expect(
      patientsFor({ kind: "cell", id: "active" }, liveDashboardData([inactive]))
    ).toEqual([]);
  });
  it("shows only active patients' planned services due within seven days", () => {
    const record: ServiceRecord = {
      id: "service-1",
      patientId: "101",
      serviceType: "Meds",
      label: "Meds",
      status: "Planned",
      dueDate: today,
      serviceDate: null,
      claimDeadline: null,
      claimFiledDate: null,
      repeatOfId: null,
      repeatReason: null,
      repeatEveryDays: null,
      source: "Manual",
      note: null,
    };
    const data = liveDashboardData([{ ...base, id: "101" }]);
    data.serviceRecords = [
      record,
      { ...record, id: "done", status: "Done" },
      { ...record, id: "later", dueDate: "2026-10-09" },
    ];
    expect(servicesDueSoon(data, today).map(r => r.record.id)).toEqual([
      "service-1",
    ]);
  });
});
