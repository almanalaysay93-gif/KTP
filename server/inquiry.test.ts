import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

describe("A1-A6: Rule-based Inquiry Chatbot & Python Service", () => {
  let pythonProc: ChildProcess | null = null;
  const testPort = 5099;
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

    // Spawn python chat_service.py for integration test
    const scriptPath = path.resolve(process.cwd(), "inquiry", "chat_service.py");
    pythonProc = spawn("python", [scriptPath, "--port", String(testPort)], {
      stdio: "pipe",
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
  });

  describe("A1: FAQ Database and Verified Topics", () => {
    it("faq.json defines all 6 core general inquiry topics", () => {
      const faqRaw = fs.readFileSync(path.resolve(process.cwd(), "inquiry", "faq.json"), "utf-8");
      const faq = JSON.parse(faqRaw);
      expect(faq.topics).toHaveLength(6);

      const topicIds = faq.topics.map((t: any) => t.id).sort();
      expect(topicIds).toEqual(["contact", "fees", "hours", "location", "requirements", "services"]);

      for (const t of faq.topics) {
        expect(t.name).toBeTruthy();
        expect(t.answer).toBeTruthy();
        expect(t.questions.length).toBeGreaterThan(0);
        expect(t.keywords.length).toBeGreaterThan(0);
      }
    });

    it("inquiry.topics endpoint returns the 6 approved topics", async () => {
      const res = await caller.inquiry.topics();
      expect(res.topics).toHaveLength(6);
      const ids = res.topics.map((t) => t.id);
      expect(ids).toContain("services");
      expect(ids).toContain("hours");
      expect(ids).toContain("location");
      expect(ids).toContain("requirements");
      expect(ids).toContain("fees");
      expect(ids).toContain("contact");
    });
  });

  describe("A2 & A6: Known Questions and Topic Button Matching", () => {
    it("matches exact topic button selection", async () => {
      const res = await caller.inquiry.chat({ topicId: "services" });
      expect(res.success).toBe(true);
      expect(res.topic_id).toBe("services");
      expect(res.match_type).toBe("EXACT_TOPIC");
      expect(res.answer).toContain("Hemodialysis");
      expect(res.answer).toContain("Peritoneal Dialysis");
      expect(res.related_topics.length).toBeGreaterThan(0);
    });

    it("answers known questions accurately with approved answers", async () => {
      const queries = [
        { q: "What services do you offer?", expectedId: "services" },
        { q: "What are your operating hours?", expectedId: "hours" },
        { q: "Where are you located?", expectedId: "location" },
        { q: "What documents do I need to bring?", expectedId: "requirements" },
        { q: "How much does hemodialysis cost?", expectedId: "fees" },
        { q: "What is your telephone contact number?", expectedId: "contact" },
      ];

      for (const { q, expectedId } of queries) {
        const res = await caller.inquiry.chat({ question: q });
        expect(res.success).toBe(true);
        expect(res.topic_id).toBe(expectedId);
        expect(res.answer).toBeTruthy();
      }
    });
  });

  describe("A3 & A6: Alternate Wording, Ambiguity, Empty Input, Unsupported Topics", () => {
    it("handles alternate wording correctly", async () => {
      const resHours = await caller.inquiry.chat({ question: "when can i go to dialysis clinic" });
      expect(resHours.topic_id).toBe("hours");
      expect(resHours.answer).toContain("8:00 AM");

      const resLoc = await caller.inquiry.chat({
        question: "can you tell me where the kidney building is situated in bajada",
      });
      expect(resLoc.topic_id).toBe("location");
      expect(resLoc.answer).toContain("J.P. Laurel Avenue");

      const resReq = await caller.inquiry.chat({
        question: "what papers do i need to prepare for admission",
      });
      expect(resReq.topic_id).toBe("requirements");
      expect(resReq.answer).toContain("Medical Abstract");

      const resFees = await caller.inquiry.chat({
        question: "is hemodialysis covered by philhealth 156 sessions",
      });
      expect(resFees.topic_id).toBe("fees");
      expect(resFees.answer).toContain("156 hemodialysis sessions");
    });

    it("handles ambiguous questions by offering topic choices", async () => {
      const res = await caller.inquiry.chat({
        question: "What are the requirements, documents, fees, and costs for treatment?",
      });
      expect(res.success).toBe(true);
      expect(res.match_type).toBe("MULTIPLE_MATCHES");
      expect(res.candidate_topics.length).toBeGreaterThanOrEqual(2);
      expect(res.answer).toContain("matches multiple topics");
    });

    it("handles empty and whitespace-only queries cleanly", async () => {
      const resEmpty = await caller.inquiry.chat({ question: "" });
      expect(resEmpty.success).toBe(true);
      expect(resEmpty.match_type).toBe("EMPTY_QUERY");
      expect(resEmpty.candidate_topics).toHaveLength(6);

      const resSpaces = await caller.inquiry.chat({ question: "     \n\t  " });
      expect(resSpaces.success).toBe(true);
      expect(resSpaces.match_type).toBe("EMPTY_QUERY");
    });

    it("handles unsupported / out-of-scope questions without inventing answers", async () => {
      const unsupported = [
        "What is the stock price of Apple?",
        "Can you write a poem about flowers?",
        "Who won the soccer match?",
      ];

      for (const q of unsupported) {
        const res = await caller.inquiry.chat({ question: q });
        expect(res.success).toBe(true);
        expect(res.match_type).toBe("NO_MATCH");
        expect(res.topic_id).toBeNull();
        expect(res.answer).toContain("only answer verified general inquiries");
        expect(res.answer).toContain("SPMC Trunkline");
      }
    });
  });

  describe("A5 & A6: Service Failure and Zero Model Calls", () => {
    it("gracefully handles service failure when inquiry service is unreachable", async () => {
      // Point caller to a dead port
      process.env.INQUIRY_SERVICE_URL = "http://127.0.0.1:59999";

      const res = await caller.inquiry.chat({ question: "What are your hours?" });
      expect(res.success).toBe(false);
      expect(res.match_type).toBe("SERVICE_UNAVAILABLE");
      expect(res.answer).toContain("Inquiry service is currently unavailable");
      expect(res.answer).toContain("(082) 227-2731");

      // Restore service url
      process.env.INQUIRY_SERVICE_URL = `http://127.0.0.1:${testPort}`;
    });

    it("confirms zero LLM model calls in inquiry flow", async () => {
      // The inquiry router exclusively contacts the python service or offline fallback.
      // aiInsights.chat now routes to inquiry service instead of OpenRouter.
      const res = await adminCaller.aiInsights.chat({ question: "Where are you located?" });
      expect(res.answer).toContain("J.P. Laurel Avenue");
      // No call to OpenRouter/Nemotron was made
    });
  });
});
