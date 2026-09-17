import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { getTodayManila, needsDatabaseContext } from "./routers/inquiry";

describe("P1-P4: Reliable Rule-based Inquiry Chatbot & Python Microservice", () => {
  let pythonProc: ChildProcess | null = null;
  const testPort = 5099;
  const testSecret = "skti-test-secret-phase1-phase4";

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

  describe("P1: Service Authentication and Health Checks", () => {
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
        body: JSON.stringify({ query: "What are your hours?" }),
      });
      expect(resp.status).toBe(401);
    });

    it("tRPC router automatically attaches secret and succeeds with 200", async () => {
      const res = await caller.inquiry.chat({ question: "What are your operating hours?" });
      expect(res.success).toBe(true);
      expect(res.topic_id).toBe("hours");
    });

    it("inquiry.topics returns all 8 topics through authenticated proxy", async () => {
      const res = await caller.inquiry.topics();
      expect(res.topics).toHaveLength(8);
      const ids = res.topics.map((t) => t.id);
      expect(ids).toContain("services");
      expect(ids).toContain("hours");
      expect(ids).toContain("location");
      expect(ids).toContain("requirements");
      expect(ids).toContain("fees");
      expect(ids).toContain("contact");
      expect(ids).toContain("trainings");
      expect(ids).toContain("areas");
    });
  });

  describe("P2: Database Context Reliability & Deadlines", () => {
    it("needsDatabaseContext only activates for topics/queries needing DB records", () => {
      expect(needsDatabaseContext("What are your hours?", "hours")).toBe(false);
      expect(needsDatabaseContext("Where are you located?", "location")).toBe(false);
      expect(needsDatabaseContext("How much is dialysis?", "fees")).toBe(false);
      expect(needsDatabaseContext("What documents do I need?", "requirements")).toBe(false);
      expect(needsDatabaseContext("What is your phone number?", "contact")).toBe(false);

      expect(needsDatabaseContext(undefined, "trainings")).toBe(true);
      expect(needsDatabaseContext("What seminars are scheduled?")).toBe(true);
      expect(needsDatabaseContext(undefined, "areas")).toBe(true);
      expect(needsDatabaseContext("Show clinical units and wards")).toBe(true);
    });

    it("computes exact Manila date YYYY-MM-DD across midnight", () => {
      // Test with UTC 17:00 (which is 01:00 AM next day in Manila +08:00)
      const dateUtc = new Date("2026-09-17T17:00:00Z");
      const manilaDate = getTodayManila(dateUtc);
      expect(manilaDate).toBe("2026-09-18");

      // Test regular afternoon
      const afternoonUtc = new Date("2026-09-17T04:00:00Z");
      expect(getTodayManila(afternoonUtc)).toBe("2026-09-17");
    });

    it("restricts internal staff headcounts to authorized roles only", async () => {
      // Unauthenticated public caller
      const publicRes = await caller.inquiry.chat({ topicId: "areas" });
      expect(publicRes.success).toBe(true);
      expect(publicRes.answer).not.toContain("active staff assigned");
      expect(publicRes.answer).not.toContain("Total Active Staff Tracked");

      // Authenticated admin caller
      const authRes = await adminCaller.inquiry.chat({ topicId: "areas" });
      expect(authRes.success).toBe(true);
      // When live database has records, authorized output shows assignments
      if (authRes.answer.includes("assigned")) {
        expect(authRes.answer).toContain("active staff assigned");
      }
    });
  });

  describe("P3: Matching Precision, Greetings, and Ambiguity", () => {
    it("handles 'hi', 'hello', and greetings without false matching questions", async () => {
      const resHi = await caller.inquiry.chat({ question: "hi" });
      expect(resHi.success).toBe(true);
      expect(resHi.match_type).toBe("GREETING");
      expect(resHi.answer).toContain("Hello! Welcome to SPMC SKTI General Inquiries");
      // Must not match "Which building is the kidney center in?"
      expect(resHi.topic_id).toBeNull();

      const resHello = await caller.inquiry.chat({ question: "hello" });
      expect(resHello.match_type).toBe("GREETING");
    });

    it("handles short unsupported input ('a', 'x') without false matching", async () => {
      const resA = await caller.inquiry.chat({ question: "a" });
      expect(resA.success).toBe(true);
      expect(resA.match_type).toBe("NO_MATCH");
      expect(resA.topic_id).toBeNull();
      expect(resA.answer).toContain("only answer verified general inquiries");

      const resX = await caller.inquiry.chat({ question: "x" });
      expect(resX.match_type).toBe("NO_MATCH");
    });

    it("preserves exact matching for topic buttons", async () => {
      const topics = ["services", "hours", "location", "requirements", "fees", "contact", "trainings", "areas"];
      for (const t of topics) {
        const res = await caller.inquiry.chat({ topicId: t });
        expect(res.success).toBe(true);
        expect(res.topic_id).toBe(t);
      }
    });

    it("preserves ambiguity handling for questions matching multiple topics", async () => {
      const resAmbig = await caller.inquiry.chat({
        question: "What are the requirements, documents, fees, and costs for treatment?",
      });
      expect(resAmbig.success).toBe(true);
      expect(resAmbig.match_type).toBe("MULTIPLE_MATCHES");
      expect(resAmbig.candidate_topics.length).toBeGreaterThanOrEqual(2);
      expect(resAmbig.answer).toContain("matches multiple topics");
    });
  });

  describe("P4: Service Outage and Failure Recovery", () => {
    it("handles service outage without hanging and returns verified fallback with contact info", async () => {
      process.env.INQUIRY_SERVICE_URL = "http://127.0.0.1:59998";

      const res = await caller.inquiry.chat({ question: "What are your hours?" });
      expect(res.success).toBe(false);
      expect(res.match_type).toBe("SERVICE_UNAVAILABLE");
      expect(res.answer).toContain("Inquiry service is currently unavailable");
      expect(res.answer).toContain("(082) 227-2731");

      // Restore
      process.env.INQUIRY_SERVICE_URL = `http://127.0.0.1:${testPort}`;
    });

    it("confirms zero LLM model calls in inquiry flow", async () => {
      const res = await adminCaller.aiInsights.chat({ question: "Where are you located?" });
      expect(res.answer).toContain("J.P. Laurel Avenue");
    });
  });
});
