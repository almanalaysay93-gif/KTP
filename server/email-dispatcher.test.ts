import { describe, it, expect } from "vitest";
import { runLicenseExpiryEmailPass, runUpcomingSeminarEmailPass } from "./email/dispatcher";

describe("Email Background Dispatcher", () => {
  it("runs license expiry email pass safely without throwing", async () => {
    const result = await runLicenseExpiryEmailPass();
    expect(result).toBeDefined();
    expect(typeof result.processed).toBe("number");
    expect(typeof result.sent).toBe("number");
    expect(typeof result.skipped).toBe("number");
  });

  it("renders 1-year, 6-month, 3-month, and 1-month email templates with correct badges", async () => {
    const { renderLicenseExpiryEmail } = await import("./email/templates");

    // 1 year (365d)
    const email365 = renderLicenseExpiryEmail({
      nurseName: "Maria Santos",
      licenseType: "PRC Registered Nurse License",
      licenseNumber: "0912345",
      expiryDateStr: "2027-09-16",
      daysRemaining: 365,
      thresholdKey: "365d",
      actionUrl: "https://nursetrack.example.com/me",
    });
    expect(email365).toContain("Advance Renewal Notice");
    expect(email365).toContain("365 days");

    // 6 months (180d)
    const email180 = renderLicenseExpiryEmail({
      nurseName: "Maria Santos",
      licenseType: "PRC Registered Nurse License",
      licenseNumber: "0912345",
      expiryDateStr: "2027-03-16",
      daysRemaining: 180,
      thresholdKey: "180d",
      actionUrl: "https://nursetrack.example.com/me",
    });
    expect(email180).toContain("Upcoming Renewal");
    expect(email180).toContain("180 days");

    // 3 months (90d)
    const email90 = renderLicenseExpiryEmail({
      nurseName: "Maria Santos",
      licenseType: "PRC Registered Nurse License",
      licenseNumber: "0912345",
      expiryDateStr: "2026-12-16",
      daysRemaining: 90,
      thresholdKey: "90d",
      actionUrl: "https://nursetrack.example.com/me",
    });
    expect(email90).toContain("Upcoming Renewal");
    expect(email90).toContain("90 days");

    // 1 month (30d)
    const email30 = renderLicenseExpiryEmail({
      nurseName: "Maria Santos",
      licenseType: "PRC Registered Nurse License",
      licenseNumber: "0912345",
      expiryDateStr: "2026-10-16",
      daysRemaining: 30,
      thresholdKey: "30d",
      actionUrl: "https://nursetrack.example.com/me",
    });
    expect(email30).toContain("Urgent Renewal Required");
    expect(email30).toContain("30 days");
  });
});
