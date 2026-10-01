import { describe, expect, it } from "vitest";
import { fmtDate, fmtTime, fmtWeekday } from "@/components/ktp/admin/format";
import { todayDate } from "@shared/ktp";
import { parsePatientId, patientAge, daysSinceSurgery } from "./ktpPatientView";

describe("patient date rendering", () => {
  it("handles invalid dates without a crash or invented calendar date", () => {
    for (const date of [new Date(NaN), "bad-date", "2026-02-30", "2026-10-01Tgarbage", "", null]) {
      expect(fmtDate(date)).toBe("Not set");
    }
  });
  it("preserves calendar dates and supports Date payloads", () => {
    expect(fmtDate("2026-10-01")).toBe("01 Oct 2026");
    expect(fmtDate(new Date("2026-10-01T00:00:00Z"))).toBe("01 Oct 2026");
  });
  it("renders timestamp clocks in Manila regardless of input offset", () => {
    expect(fmtTime(new Date("2026-09-30T23:00:00Z"))).toBe("7:00 AM");
    expect(fmtTime("2026-09-30T23:00:00Z")).toBe("7:00 AM");
    expect(fmtWeekday("2026-09-30T23:00:00Z")).toBe("Thu 1 Oct");
    expect(fmtWeekday(new Date("2026-09-30T23:00:00Z"))).toBe("Thu 1 Oct");
  });
  it("uses Manila's calendar day across UTC midnight", () => {
    expect(todayDate(new Date("2026-09-30T16:01:00Z"))).toBe("2026-10-01");
  });
  it("rejects partial, preview, zero and unsafe patient IDs", () => {
    for (const value of [
      "p08",
      "1abc",
      "0",
      "-1",
      "1.5",
      "9007199254740992",
      undefined,
    ]) {
      expect(parsePatientId(value)).toBeNull();
    }
    expect(parsePatientId("123")).toBe(123);
  });
  it("derives age and surgery days from explicit dates with null preservation", () => {
    expect(patientAge("1990-10-02", "2026-10-01")).toBe(35);
    expect(patientAge("1990-10-01", "2026-10-01")).toBe(36);
    expect(patientAge(null, "2026-10-01")).toBeNull();
    expect(daysSinceSurgery({ surgeryDate: "2026-09-30" }, "2026-10-01")).toBe(
      1
    );
    expect(
      daysSinceSurgery({ surgeryDate: "bad-date" }, "2026-10-01")
    ).toBeNull();
  });
});
