import { describe, expect, it, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { appRouter } from "./routers";
import { getNotificationLogicalKey, listNotifications, countUnreadNotifications, markNotificationRead } from "./db";
import { runDailyReminders } from "./reminders";
import { generateInsightsReport } from "./_core/aiInsights";
import { ENV } from "./_core/env";

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

describe("U2: AI Insights report reliability and error mapping", () => {
  it("throws clear error when OPENROUTER_API_KEY is missing", async () => {
    const originalKey = ENV.openRouterApiKey;
    (ENV as any).openRouterApiKey = "";
    try {
      await expect(generateInsightsReport()).rejects.toThrow("OPENROUTER_API_KEY is missing");
    } finally {
      (ENV as any).openRouterApiKey = originalKey;
    }
  });

  it("translates 401 unauthorized to user-friendly message", async () => {
    const originalKey = ENV.openRouterApiKey;
    (ENV as any).openRouterApiKey = "invalid-test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => JSON.stringify({ error: { message: "Invalid API Key" } }),
    } as any);

    try {
      await expect(generateInsightsReport()).rejects.toThrow("Invalid or expired OPENROUTER_API_KEY");
    } finally {
      globalThis.fetch = originalFetch;
      (ENV as any).openRouterApiKey = originalKey;
    }
  });

  it("translates 429 rate limit to user-friendly message", async () => {
    const originalKey = ENV.openRouterApiKey;
    (ENV as any).openRouterApiKey = "rate-limited-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } }),
    } as any);

    try {
      await expect(generateInsightsReport()).rejects.toThrow("AI service rate limit exceeded");
    } finally {
      globalThis.fetch = originalFetch;
      (ENV as any).openRouterApiKey = originalKey;
    }
  });

  it("rejects empty response content defensively", async () => {
    const originalKey = ENV.openRouterApiKey;
    (ENV as any).openRouterApiKey = "valid-mock-key";
    const originalFetch = globalThis.fetch;
    const bodyStr = JSON.stringify({ choices: [{ message: { content: "   " } }] });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => bodyStr,
      json: async () => JSON.parse(bodyStr),
    } as any);

    try {
      await expect(generateInsightsReport()).rejects.toThrow("empty or invalid response");
    } finally {
      globalThis.fetch = originalFetch;
      (ENV as any).openRouterApiKey = originalKey;
    }
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
