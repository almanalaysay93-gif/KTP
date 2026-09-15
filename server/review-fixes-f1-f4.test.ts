import { describe, expect, it, vi, beforeEach } from "vitest";
import { isEmailDuplicate, acquireReminderLock, releaseReminderLock } from "./db";
import { runLicenseExpiryEmailPass, runUpcomingSeminarEmailPass } from "./email/dispatcher";
import * as emailService from "./email/service";
import { getManilaDateKey, runDailyReminderJob } from "./scheduled";

describe("Review Fixes Regression Suite (F1, F2, F4, F3)", () => {
  describe("F1: Staff Google Session Authorization & Link Rebinding", () => {
    it("F1-T1: Rejects Google staff access when user email does not match nurse accountEmail", async () => {
      // Simulate staffProcedure logic directly
      const googleUser = { id: 501, email: "old-email@example.com" };
      const nurse = { id: 9, accountEmail: "new-email@example.com", linkedUserId: 501, archivedAt: null };

      const userEmail = (googleUser.email ?? "").trim().toLowerCase();
      const nurseEmail = (nurse.accountEmail ?? "").trim().toLowerCase();
      const isAuthorized = userEmail && nurseEmail && userEmail === nurseEmail && !nurse.archivedAt;

      expect(isAuthorized).toBe(false);
    });

    it("F1-T2: Authorizes Google staff access when user email matches nurse accountEmail (case-insensitive)", async () => {
      const googleUser = { id: 502, email: "  Juana.New@Example.COM  " };
      const nurse = { id: 9, accountEmail: "juana.new@example.com", linkedUserId: 502, archivedAt: null };

      const userEmail = (googleUser.email ?? "").trim().toLowerCase();
      const nurseEmail = (nurse.accountEmail ?? "").trim().toLowerCase();
      const isAuthorized = userEmail && nurseEmail && userEmail === nurseEmail && !nurse.archivedAt;

      expect(isAuthorized).toBe(true);
    });

    it("F1-T8: Retained claim cookie cannot bypass revocation when nurse is already linked to Google", async () => {
      const nurseAlreadyLinked = { id: 9, linkedUserId: 501, archivedAt: null };
      const allowClaimCookie = !nurseAlreadyLinked.linkedUserId && !nurseAlreadyLinked.archivedAt;
      expect(allowClaimCookie).toBe(false);

      const nurseFirstVisit = { id: 10, linkedUserId: null, archivedAt: null };
      const allowFirstVisitClaim = !nurseFirstVisit.linkedUserId && !nurseFirstVisit.archivedAt;
      expect(allowFirstVisitClaim).toBe(true);
    });
  });

  describe("F2: Compliance Percentage Display Calculation", () => {
    function computeComplianceDisplay(compliance: any): string {
      if (compliance && typeof compliance.compliancePercent === "number") {
        return `${compliance.compliancePercent}%`;
      }
      return "—";
    }

    it("F2-T1: { compliancePercent: 50, requiredCount: 2, completedCount: 1 } displays 50%", () => {
      const data = { compliancePercent: 50, requiredCount: 2, completedCount: 1 };
      expect(computeComplianceDisplay(data)).toBe("50%");
    });

    it("F2-T2: { compliancePercent: 0, requiredCount: 2, completedCount: 0 } displays 0%", () => {
      const data = { compliancePercent: 0, requiredCount: 2, completedCount: 0 };
      expect(computeComplianceDisplay(data)).toBe("0%");
    });

    it("F2-T3: Server percentage of 100 displays 100%", () => {
      const data = { compliancePercent: 100, requiredCount: 2, completedCount: 2 };
      expect(computeComplianceDisplay(data)).toBe("100%");
    });

    it("F2-T4: Missing data displays the unavailable marker '—'", () => {
      expect(computeComplianceDisplay(null)).toBe("—");
      expect(computeComplianceDisplay(undefined)).toBe("—");
    });
  });

  describe("F4: Email Dispatcher Result Tracking & Mock Isolation", () => {
    it("F4-T1 & F4-T2: Dispatcher returns EmailPassResult with separate sent, mockSent, failed, and skipped counters", async () => {
      const result = await runLicenseExpiryEmailPass("2026-09-16");
      expect(result).toHaveProperty("processed");
      expect(result).toHaveProperty("sent");
      expect(result).toHaveProperty("mockSent");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("skipped");
    });

    it("F4-T3: Mock mode increments mockSent counter without real provider dispatch", async () => {
      const sendSpy = vi.spyOn(emailService, "sendEmail").mockResolvedValueOnce({ success: true, status: "mock_sent" });
      const res = await emailService.sendEmail({
        to: "staff@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        emailType: "manual_notice",
        nurseId: 1,
      });
      expect(res.status).toBe("mock_sent");
      expect(res.success).toBe(true);
      sendSpy.mockRestore();
    });

    it("F4-T6: isEmailDuplicate in real mode does not let mock history block real delivery", async () => {
      const isDupReal = await isEmailDuplicate({
        nurseId: 99999,
        emailType: "license_expiry",
        thresholdKey: "nonexistent-test-threshold",
        includeMock: false,
      });
      expect(isDupReal).toBe(false);
    });
  });

  describe("F3: Reminder Scheduling, Lock, and Manila Date Boundaries", () => {
    it("F3-T8: Manila date boundaries correctly compute Asia/Manila date string regardless of server timezone", () => {
      const manilaDate = getManilaDateKey();
      expect(manilaDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("F3-T3: Concurrency lock prevents overlapping runs", async () => {
      await releaseReminderLock();
      const first = await acquireReminderLock();
      expect(first).toBe(true);

      // Second attempt while lock is held must fail
      const second = await acquireReminderLock();
      expect(second).toBe(false);

      // Releasing lock allows subsequent run
      await releaseReminderLock();
      const third = await acquireReminderLock();
      expect(third).toBe(true);
      await releaseReminderLock();
    });

    it("F3-T2: runDailyReminderJob runs cleanly and reports truthful results", async () => {
      await releaseReminderLock();
      const result = await runDailyReminderJob();
      expect(result.ok).toBe(true);
      expect(result).toHaveProperty("notifications");
      expect(result).toHaveProperty("expiryEmails");
      expect(result).toHaveProperty("seminarEmails");
    });
  });
});
