import { describe, expect, it } from "vitest";
import { formStateToUpdate, recordToFormState } from "./trainingRecordForm";

// Shape of a record as trainings.initial returns it: drizzle `date` columns arrive as UTC-midnight Dates.
const acls = {
  id: 42,
  trainingName: "ACLS",
  status: "Completed",
  provider: "PHA",
  scheduledDate: new Date("2026-03-02T00:00:00.000Z"),
  completionDate: new Date("2026-03-04T00:00:00.000Z"),
  expiryDate: new Date("2028-03-04T00:00:00.000Z"),
  trainingHours: 16,
  cpdUnits: 12,
  certificateNumber: "ACLS-2026-0042",
  remarks: "Passed megacode",
};

describe("recordToFormState", () => {
  it("fills every stored value of an ACLS record", () => {
    expect(recordToFormState(acls)).toEqual({
      status: "Completed",
      provider: "PHA",
      scheduledDate: "2026-03-02",
      completionDate: "2026-03-04",
      expiryDate: "2028-03-04",
      hours: "16",
      cpd: "12",
      certNumber: "ACLS-2026-0042",
      remarks: "Passed megacode",
    });
  });

  it("accepts string dates and empty optional fields", () => {
    const form = recordToFormState({ status: "Scheduled", scheduledDate: "2026-10-01", provider: null, trainingHours: null });
    expect(form.scheduledDate).toBe("2026-10-01");
    expect(form.completionDate).toBe("");
    expect(form.provider).toBe("");
    expect(form.hours).toBe("");
  });
});

describe("formStateToUpdate", () => {
  it("sends nothing when no field changed", () => {
    const initial = recordToFormState(acls);
    expect(formStateToUpdate(initial, { ...initial })).toEqual({});
  });

  it("sends only remarks when only remarks changed, keeping status and dates", () => {
    const initial = recordToFormState(acls);
    expect(formStateToUpdate(initial, { ...initial, remarks: "  Renewed early " })).toEqual({ remarks: "Renewed early" });
  });

  it("sends null for a cleared date or count", () => {
    const initial = recordToFormState(acls);
    expect(formStateToUpdate(initial, { ...initial, expiryDate: "", cpd: "" })).toEqual({ expiryDate: null, cpdUnits: null });
  });

  it("converts changed dates and counts", () => {
    const initial = recordToFormState(acls);
    const update = formStateToUpdate(initial, { ...initial, completionDate: "2026-03-05", hours: "8" });
    expect(update.completionDate?.toISOString()).toBe("2026-03-05T00:00:00.000Z");
    expect(update.trainingHours).toBe(8);
    expect(Object.keys(update).sort()).toEqual(["completionDate", "trainingHours"]);
  });
});
