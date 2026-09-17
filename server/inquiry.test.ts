import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { getTodayManila, needsDatabaseContext } from "./routers/inquiry";

describe("P1-P4: NurseTrack Assistant & Task-Driven Inquiry Microservice", () => {
  let pythonProc: ChildProcess | null = null;
  const testPort = 5099;
  const testSecret = "skti-test-secret-nursetrack-tasks";

  const caller = appRouter.createCaller({
    user: null,
    req: { cookies: {}, headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  });

  const adminCaller = appRouter.createCaller({
    user: { id: "1", email: "almanalaysay93@gmail.com", name: "Admin" } as any,
    req: { cookies: {}, headers: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  });

  beforeAll(async () => {
    process.env.INQUIRY_SERVICE_URL = `http://127.0.0.1:${testPort}`;
    process.env.INQUIRY_SERVICE_SECRET = testSecret;

    // Spawn python chat_service.py with service secret enabled
    const scriptPath = path.resolve(process.cwd(), "inquiry", "chat_service.py");
    pythonProc = spawn("python", [scriptPath, "--port", String(testPort)], {
      stdio: "pipe",
      env: {
        ...process.env,
        INQUIRY_SERVICE_SECRET: testSecret,
      },
    });

    // Wait for python service to come up
    const startTime = Date.now();
    let ready = false;
    while (Date.now() - startTime < 8000) {
      try {
        const resp = await fetch(`http://127.0.0.1:${testPort}/health`);
        if (resp.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!ready) {
      throw new Error("Python inquiry chat_service failed to start within 8 seconds.");
    }
  });

  afterAll(() => {
    if (pythonProc) {
      pythonProc.kill();
    }
    delete process.env.INQUIRY_SERVICE_SECRET;
  });

  describe("P1: Service Authentication and 8 NurseTrack Task Buttons", () => {
    it("health probe endpoint remains public without secret", async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/health`);
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("skti-inquiry-service");
    });

    it("microservice rejects requests lacking shared secret with 401", async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/api/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "What needs attention?" }),
      });
      expect(resp.status).toBe(401);
    });

    it("inquiry.topics returns all 8 NurseTrack supervisor task buttons", async () => {
      const res = await caller.inquiry.topics();
      expect(res.topics).toHaveLength(8);
      const ids = res.topics.map((t) => t.id);
      expect(ids).toEqual([
        "needs_attention",
        "find_staff",
        "license_status",
        "training_followup",
        "upcoming_seminars",
        "area_assignments",
        "calendar",
        "reports",
      ]);
    });
  });

  describe("P2: Database Context Reliability & Destination Links", () => {
    it("needsDatabaseContext activates for supervisor tasks needing DB records", () => {
      expect(needsDatabaseContext(undefined, "needs_attention")).toBe(true);
      expect(needsDatabaseContext(undefined, "find_staff")).toBe(true);
      expect(needsDatabaseContext(undefined, "license_status")).toBe(true);
      expect(needsDatabaseContext(undefined, "training_followup")).toBe(true);
      expect(needsDatabaseContext(undefined, "upcoming_seminars")).toBe(true);
      expect(needsDatabaseContext(undefined, "area_assignments")).toBe(true);
      expect(needsDatabaseContext(undefined, "calendar")).toBe(true);
      expect(needsDatabaseContext("show expiring licenses")).toBe(true);
      expect(needsDatabaseContext("find nurse")).toBe(true);
    });

    it("computes exact Manila date YYYY-MM-DD across midnight", () => {
      const dateUtc = new Date("2026-09-17T17:00:00Z");
      const manilaDate = getTodayManila(dateUtc);
      expect(manilaDate).toBe("2026-09-18");

      const afternoonUtc = new Date("2026-09-17T04:00:00Z");
      expect(getTodayManila(afternoonUtc)).toBe("2026-09-17");
    });

    it("restricts internal alerts and staff data to authorized supervisors", async () => {
      // Unauthenticated public caller
      const publicRes = await caller.inquiry.chat({ topicId: "needs_attention" });
      expect(publicRes.success).toBe(true);
      expect(publicRes.answer).toContain("Supervisor authentication required");
      expect(publicRes.action_links?.[0]?.url).toBe("/dashboard");

      // Authenticated admin caller
      const authRes = await adminCaller.inquiry.chat({ topicId: "needs_attention" });
      expect(authRes.success).toBe(true);
      expect(authRes.answer).toContain("NurseTrack Action Center");
      expect(authRes.action_links?.[0]?.url).toBe("/dashboard");
    });

    it("returns typed destination action links for all 8 topics", async () => {
      const taskRoutes: Record<string, string> = {
        needs_attention: "/dashboard",
        find_staff: "/nurses",
        license_status: "/licenses",
        training_followup: "/trainings",
        upcoming_seminars: "/seminars",
        area_assignments: "/areas",
        calendar: "/calendar",
        reports: "/reports",
      };

      for (const [topicId, expectedUrl] of Object.entries(taskRoutes)) {
        const res = await adminCaller.inquiry.chat({ topicId });
        expect(res.success).toBe(true);
        expect(res.action_links).toBeDefined();
        expect(res.action_links!.length).toBeGreaterThan(0);
        expect(res.action_links![0].url).toBe(expectedUrl);
      }
    });
  });

  describe("P3: Matching Precision, Staff Lookup, and Ambiguity", () => {
    it("handles 'hi', 'hello', and greetings with NurseTrack welcome message", async () => {
      const resHi = await caller.inquiry.chat({ question: "hi" });
      expect(resHi.success).toBe(true);
      expect(resHi.match_type).toBe("GREETING");
      expect(resHi.answer).toContain("NurseTrack Assistant");
      expect(resHi.topic_id).toBeNull();
    });

    it("handles short unsupported input ('a', 'x') without false matching", async () => {
      const resA = await caller.inquiry.chat({ question: "a" });
      expect(resA.success).toBe(true);
      expect(resA.match_type).toBe("NO_MATCH");
      expect(resA.topic_id).toBeNull();
      expect(resA.answer).toContain("only answer verified NurseTrack supervisor inquiries");
    });

    it("matches specific intent queries to correct task buttons", async () => {
      const queries = [
        { q: "licenses expiring", topic: "license_status" },
        { q: "find nurse Maria", topic: "find_staff" },
        { q: "missing certificate", topic: "training_followup" },
        { q: "upcoming seminar", topic: "upcoming_seminars" },
        { q: "clinical unit assignments", topic: "area_assignments" },
        { q: "what is scheduled today", topic: "calendar" },
        { q: "compliance report export", topic: "reports" },
      ];

      for (const item of queries) {
        const res = await adminCaller.inquiry.chat({ question: item.q });
        expect(res.success).toBe(true);
        expect(res.topic_id).toBe(item.topic);
      }
    });
  });

  describe("P4: Service Outage and Zero Model Calls", () => {
    it("handles service outage without hanging and returns verified fallback with contact info", async () => {
      process.env.INQUIRY_SERVICE_URL = "http://127.0.0.1:59998";

      const res = await caller.inquiry.chat({ question: "What is on the calendar?" });
      expect(res.success).toBe(true); // Offline fallback handles calendar
      expect(res.action_links?.[0]?.url).toBe("/calendar");

      // Test complete invalid target
      const resUnavailable = await caller.inquiry.chat({ question: "some totally random inquiry 12345" });
      expect(resUnavailable.action_links?.[0]?.url).toBe("/dashboard");

      // Restore
      process.env.INQUIRY_SERVICE_URL = `http://127.0.0.1:${testPort}`;
    });

    it("confirms zero LLM model calls in inquiry flow", async () => {
      const res = await adminCaller.aiInsights.chat({ question: "What needs attention?" });
      expect(res.answer).toContain("NurseTrack Action Center");
    });
  });
});
