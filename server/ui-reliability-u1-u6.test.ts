import { describe, expect, it, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { appRouter } from "./routers";
import { getNotificationLogicalKey, listNotifications, countUnreadNotifications, markNotificationRead } from "./db";
import { runDailyReminders } from "./reminders";
import { INSIGHTS_UNAVAILABLE_MESSAGE, requestInsightsReport } from "./_core/aiInsights";

describe("U1: Export data on-demand and authorization", () => {
  it("rejects unauthorized access for non-admin session", async () => {
    const caller = appRouter.createCaller({
      user: { id: 2, openId: "nurse-user", role: "user", name: "Staff Nurse" } as any,
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.settings.exportData({ entity: "nurses" })).rejects.toThrow();
  });

  it("exports specific entity and 'all' for admin session", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "admin-user", role: "admin", name: "Supervisor", email: "almanalaysay93@gmail.com" } as any,
      req: {} as any,
      res: {} as any,
    });

    const nursesExport = await caller.settings.exportData({ entity: "nurses" });
    expect(nursesExport).toHaveProperty("nurses");
    expect(Array.isArray(nursesExport.nurses)).toBe(true);

    const allExport = await caller.settings.exportData({ entity: "all" });
    expect(allExport).toHaveProperty("nurses");
    expect(allExport).toHaveProperty("nurseCredentials");
    expect(allExport).toHaveProperty("nurseTrainings");
    expect(allExport).toHaveProperty("areaAssignments");
  });
});

describe("U2: Insights report service reliability and error mapping", () => {
  const digest = { today_manila: "2026-09-17", areas: [], staff: [], licenses: [], trainings: [], coverage: [] };
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("returns the sections from the Python service and sends the secret", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        generated_for: "2026-09-17",
        sections: [{ code: "S1", title: "Urgent licenses", lines: ["Nothing to report."] }],
        text: "report text",
      }),
    );

    const report = await requestInsightsReport(digest, { serviceUrl: "http://svc", secret: "s3cret", fetchImpl });

    expect(report).toEqual({
      generatedFor: "2026-09-17",
      sections: [{ code: "S1", title: "Urgent licenses", lines: ["Nothing to report."] }],
      text: "report text",
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://svc/api/insights/report");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body)).toEqual({ digest });
  });

  it("maps an unreachable or slow service to the clear message", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
    await expect(requestInsightsReport(digest, { fetchImpl })).rejects.toThrow(INSIGHTS_UNAVAILABLE_MESSAGE);
  });

  it("maps a non-JSON response (e.g. a platform error page) to the clear message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("An error occurred with your deployment", { status: 504 }));
    await expect(requestInsightsReport(digest, { fetchImpl })).rejects.toThrow(INSIGHTS_UNAVAILABLE_MESSAGE);
  });

  it("maps a service error response to the clear message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: "Invalid digest: today_manila" }));
    await expect(requestInsightsReport(digest, { fetchImpl })).rejects.toThrow(INSIGHTS_UNAVAILABLE_MESSAGE);
  });

  it("aborts a request that runs past the timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    ) as unknown as typeof fetch;
    await expect(requestInsightsReport(digest, { fetchImpl, timeoutMs: 50 })).rejects.toThrow(INSIGHTS_UNAVAILABLE_MESSAGE);
  });
});

describe("U4: Stop duplicate notifications and historical deduplication", () => {
  it("generates correct logical event keys for license.expired and license.renewalReminder", () => {
    const expiredKey1 = getNotificationLogicalKey({
      type: "license.expired",
      nurseId: 10,
      relatedEntityType: "credential",
      relatedEntityId: 25,
      title: "License expired — Jane Doe",
    });
    const expiredKey2 = getNotificationLogicalKey({
      type: "license.expired",
      nurseId: 10,
      relatedEntityType: "credential",
      relatedEntityId: 25,
      title: "License expired — Jane Doe (different run)",
    });
    expect(expiredKey1).toBe("license.expired:10:credential:25");
    expect(expiredKey1).toBe(expiredKey2);

    const renewalKey1Year = getNotificationLogicalKey({
      type: "license.renewalReminder",
      nurseId: 10,
      relatedEntityType: "credential",
      relatedEntityId: 25,
      title: "1-year renewal reminder — Jane Doe",
    });
    const renewalKey180Day = getNotificationLogicalKey({
      type: "license.renewalReminder",
      nurseId: 10,
      relatedEntityType: "credential",
      relatedEntityId: 25,
      title: "180-day renewal reminder — Jane Doe",
    });

    expect(renewalKey1Year).toBe("license.renewalReminder:10:credential:25:1-year renewal reminder");
    expect(renewalKey180Day).toBe("license.renewalReminder:10:credential:25:180-day renewal reminder");
    expect(renewalKey1Year).not.toBe(renewalKey180Day);
  });

  it("deduplicates historical duplicate rows and aligns unread counts", async () => {
    // Get notifications
    const list = await listNotifications(100);
    const unreadCount = await countUnreadNotifications();

    // Verify all returned items in list have unique logical keys
    const seenKeys = new Set<string>();
    for (const item of list) {
      const key = getNotificationLogicalKey(item);
      expect(seenKeys.has(key)).toBe(false);
      seenKeys.add(key);
    }

    const unreadInList = list.filter((n) => !n.readAt).length;
    // unreadCount must equal or exceed unread items in the bounded limit
    expect(unreadCount).toBeGreaterThanOrEqual(unreadInList);
  });

  it("sequential daily reminder runs do not create duplicate expired notifications", async () => {
    const res1 = await runDailyReminders("2026-09-16");
    const countAfterRun1 = await countUnreadNotifications();

    const res2 = await runDailyReminders("2026-09-16");
    const countAfterRun2 = await countUnreadNotifications();

    expect(countAfterRun2).toBe(countAfterRun1);
  });
});
