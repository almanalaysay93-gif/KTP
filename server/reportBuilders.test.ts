import { describe, expect, it } from "vitest";
import { buildAreaExposure, buildTrainingCompliance, daysBetween } from "./reportBuilders";

const today = "2026-09-17";

describe("buildTrainingCompliance", () => {
  const areas = [
    { id: 1, name: "Hemodialysis" },
    { id: 2, name: "Transplant Ward" },
    { id: 3, name: "No Requirements" },
  ];
  const requirements = [
    { areaId: 1, trainingId: 10 },
    { areaId: 1, trainingId: 11 },
    { areaId: 2, trainingId: 10 },
  ];
  const nurses = [
    { id: 100, currentAreaId: 1 },
    { id: 101, currentAreaId: 1 },
    { id: 102, currentAreaId: 2 },
    { id: 103, currentAreaId: null },
  ];

  it("counts current completed records per staff and required training", () => {
    const rows = buildTrainingCompliance({
      areas,
      requirements,
      nurses,
      completedRecords: [
        { nurseId: 100, trainingId: 10, expiryDate: null }, // no expiry -> current
        { nurseId: 100, trainingId: 11, expiryDate: "2027-01-01" }, // future -> current
        { nurseId: 101, trainingId: 10, expiryDate: today }, // expires today -> not current
        { nurseId: 101, trainingId: 99, expiryDate: null }, // not required
        { nurseId: 102, trainingId: 10, expiryDate: new Date("2026-09-18T00:00:00.000Z") },
        { nurseId: 103, trainingId: 10, expiryDate: null }, // unassigned nurse
      ],
      today,
    });

    expect(rows).toEqual([
      { areaName: "Hemodialysis", requiredTrainings: 2, staffCount: 2, requiredChecks: 4, compliantChecks: 2, compliancePercent: 50 },
      { areaName: "Transplant Ward", requiredTrainings: 1, staffCount: 1, requiredChecks: 1, compliantChecks: 1, compliancePercent: 100 },
      { areaName: "No Requirements", requiredTrainings: 0, staffCount: 0, requiredChecks: 0, compliantChecks: 0, compliancePercent: 100 },
    ]);
  });

  it("does not double count duplicate records", () => {
    const rows = buildTrainingCompliance({
      areas: [areas[1]],
      requirements,
      nurses,
      completedRecords: [
        { nurseId: 102, trainingId: 10, expiryDate: null },
        { nurseId: 102, trainingId: 10, expiryDate: null },
      ],
      today,
    });
    expect(rows[0]).toMatchObject({ requiredChecks: 1, compliantChecks: 1, compliancePercent: 100 });
  });
});

describe("buildAreaExposure", () => {
  const ana = { nurseId: 1, firstName: "Ana", lastName: "Cruz", employeeId: "E-1", licenseNumber: "PRC-1" };
  const ben = { nurseId: 2, firstName: "Ben", lastName: "Diaz", employeeId: "E-2", licenseNumber: null };

  it("adds up days per nurse per area", () => {
    const rows = buildAreaExposure(
      [
        { ...ana, areaId: 1, areaName: "Hemodialysis", startDate: "2026-01-01", endDate: "2026-01-11" }, // 10 days
        { ...ana, areaId: 1, areaName: "Hemodialysis", startDate: "2026-09-07", endDate: null }, // 10 days to today
        { ...ana, areaId: 2, areaName: "ICU", startDate: "2026-02-01", endDate: "2026-02-03" }, // 2 days
        { ...ben, areaId: 1, areaName: "Hemodialysis", startDate: new Date("2026-03-01T00:00:00.000Z"), endDate: new Date("2026-03-31T00:00:00.000Z") },
      ],
      today,
    );

    expect(rows).toEqual([
      { nurseId: 1, nurse: "Ana Cruz", licenseNumber: "PRC-1", areaName: "Hemodialysis", firstStart: "2026-01-01", lastEnd: "Present", assignments: 2, totalDays: 20 },
      { nurseId: 1, nurse: "Ana Cruz", licenseNumber: "PRC-1", areaName: "ICU", firstStart: "2026-02-01", lastEnd: "2026-02-03", assignments: 1, totalDays: 2 },
      { nurseId: 2, nurse: "Ben Diaz", licenseNumber: "E-2", areaName: "Hemodialysis", firstStart: "2026-03-01", lastEnd: "2026-03-31", assignments: 1, totalDays: 30 },
    ]);
  });

  it("uses the earliest start and latest end regardless of row order", () => {
    const rows = buildAreaExposure(
      [
        { ...ana, areaId: 1, areaName: "HD", startDate: "2026-05-01", endDate: "2026-05-02" },
        { ...ana, areaId: 1, areaName: "HD", startDate: "2026-01-01", endDate: "2026-06-01" },
      ],
      today,
    );
    expect(rows[0]).toMatchObject({ firstStart: "2026-01-01", lastEnd: "2026-06-01", assignments: 2 });
  });
});

describe("daysBetween", () => {
  it("never returns a negative value", () => {
    expect(daysBetween("2026-09-20", "2026-09-10", today)).toBe(0);
    expect(daysBetween("2026-09-10", null, today)).toBe(7);
  });
});
