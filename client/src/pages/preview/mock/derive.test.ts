import { describe, expect, it } from "vitest";
import { FEATURED_PATIENT_ID, MOCK_DATASET, MOCK_TODAY } from "./data";
import {
  claimStatus,
  dashboardAggregates,
  daysSinceSurgery,
  dueState,
  labSeries,
  patientById,
  serviceTrackers,
} from "./derive";

describe("dashboard aggregates match COPY.md 6.7", () => {
  const agg = dashboardAggregates();

  it("counts patients", () => {
    expect(agg.activeCount).toBe(12);
    expect(agg.recipientCount).toBe(8);
    expect(agg.donorCount).toBe(4);
    expect(agg.recipientStages.map((s) => s.count)).toEqual([0, 1, 0, 1, 1, 1, 4]);
    expect(agg.donorStages.map((s) => s.count)).toEqual([0, 0, 1, 0, 1, 2]);
  });

  it("finds 5 overdue services sorted by days overdue", () => {
    expect(agg.overdueServices).toHaveLength(5);
    expect(agg.overdueServices.map((r) => r.daysOverdue)).toEqual([19, 15, 9, 8, 5]);
    expect(agg.overdueServices.map((r) => r.patient.id)).toEqual(["p02", "p08", "p03", "p01", "p04"]);
  });

  it("finds 4 claims due within 7 days sorted by deadline", () => {
    expect(agg.claimsDueSoon).toHaveLength(4);
    expect(agg.claimsDueSoon.map((r) => r.daysLeft)).toEqual([1, 2, 5, 6]);
    expect(agg.claimsDueSoon.map((r) => r.record.claimDeadline)).toEqual([
      "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06",
    ]);
  });

  it("finds 2 reschedule requests", () => {
    expect(agg.rescheduleRequests.map((r) => r.appointment.id)).toEqual(["a03", "a05"]);
  });

  it("finds 1 superseded unfiled claim", () => {
    expect(agg.supersededUnfiled).toHaveLength(1);
    expect(agg.supersededUnfiled[0].record.id).toBe("r10");
    expect(agg.supersededUnfiled[0].patient.id).toBe("p01");
  });
});

describe("claimStatus", () => {
  const today = "2026-09-30";
  it("deadline today is DueSoon", () => {
    expect(claimStatus({ claimDeadline: "2026-09-30", claimFiledDate: null }, today)).toBe("DueSoon");
  });
  it("deadline yesterday is Overdue", () => {
    expect(claimStatus({ claimDeadline: "2026-09-29", claimFiledDate: null }, today)).toBe("Overdue");
  });
  it("filed wins over an overdue deadline", () => {
    expect(claimStatus({ claimDeadline: "2026-09-01", claimFiledDate: "2026-09-20" }, today)).toBe("Filed");
  });
  it("7 days out is DueSoon, 8 days out is Open", () => {
    expect(claimStatus({ claimDeadline: "2026-10-07", claimFiledDate: null }, today)).toBe("DueSoon");
    expect(claimStatus({ claimDeadline: "2026-10-08", claimFiledDate: null }, today)).toBe("Open");
  });
  it("no deadline is None", () => {
    expect(claimStatus({ claimDeadline: null, claimFiledDate: null }, today)).toBe("None");
  });
});

describe("dueState", () => {
  const today = "2026-09-30";
  it("classifies Planned records", () => {
    expect(dueState({ status: "Planned", dueDate: "2026-09-29" }, today)).toBe("Overdue");
    expect(dueState({ status: "Planned", dueDate: "2026-09-30" }, today)).toBe("DueSoon");
    expect(dueState({ status: "Planned", dueDate: "2026-10-07" }, today)).toBe("DueSoon");
    expect(dueState({ status: "Planned", dueDate: "2026-10-08" }, today)).toBe("Upcoming");
  });
  it("is null for Done and Superseded", () => {
    expect(dueState({ status: "Done", dueDate: "2026-01-01" }, today)).toBeNull();
    expect(dueState({ status: "Superseded", dueDate: "2026-01-01" }, today)).toBeNull();
  });
});

describe("featured patient", () => {
  const p01 = patientById(FEATURED_PATIENT_ID)!;

  it("is on Post-KT day 154", () => {
    expect(daysSinceSurgery(p01, MOCK_TODAY)).toBe(154);
  });

  it("tracker cards match COPY.md 6.3", () => {
    const [meds, lab, tacro, xray] = serviceTrackers(FEATURED_PATIENT_ID);
    expect(meds.lastDone?.serviceDate).toBe("2026-09-04");
    expect(meds.nextPlanned?.dueDate).toBe("2026-10-02");
    expect(meds.nextDueState).toBe("DueSoon");
    expect(meds.lastDoneClaim).toBe("DueSoon");
    expect(lab.lastDone?.id).toBe("r11");
    expect(lab.nextPlanned?.dueDate).toBe("2026-10-01");
    expect(lab.lastDoneClaim).toBe("DueSoon");
    expect(tacro.lastDone?.serviceDate).toBe("2026-09-01");
    expect(tacro.lastDoneClaim).toBe("Open");
    expect(xray.lastDone?.serviceDate).toBe("2026-06-24");
    expect(xray.nextDueState).toBe("Overdue");
    expect(xray.lastDoneClaim).toBe("Filed");
  });
});

describe("labSeries", () => {
  it("excludes superseded records from the series", () => {
    const series = labSeries(FEATURED_PATIENT_ID, "lt-creatinine")!;
    expect(series.points).toHaveLength(10);
    expect(series.points.some((p) => p.recordId === "r10")).toBe(false);
    expect(series.points.some((p) => p.value === 101)).toBe(false);
    expect(series.points[0]).toMatchObject({ date: "2026-05-06", value: 142, flag: "High" });
    expect(series.points[9]).toMatchObject({ recordId: "r11", date: "2026-09-03", value: 96, flag: "Normal" });
  });

  it("can include superseded rows for table views", () => {
    const series = labSeries(FEATURED_PATIENT_ID, "lt-creatinine", MOCK_DATASET, { includeSuperseded: true })!;
    expect(series.points).toHaveLength(11);
    expect(series.points.filter((p) => p.superseded).map((p) => p.recordId)).toEqual(["r10"]);
  });

  it("builds the 10-point tacrolimus series with flags", () => {
    const series = labSeries(FEATURED_PATIENT_ID, "lt-tacrolimus")!;
    expect(series.points).toHaveLength(10);
    expect(series.points.map((p) => p.flag)).toEqual([
      "Normal", "Normal", "High", "High", "Normal", "Normal", "High", "Normal", "Normal", "Normal",
    ]);
  });

  it("returns null for an unknown test", () => {
    expect(labSeries(FEATURED_PATIENT_ID, "nope")).toBeNull();
  });
});
