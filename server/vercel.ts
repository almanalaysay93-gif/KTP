import "dotenv/config";
import crypto from "crypto";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { importStaffEmailsHandler } from "./importStaffEmails";
import { importStaffRosterHandler } from "./importStaffRoster";
import { importStaffAreasHandler } from "./importStaffAreas";
import { importStaffTrainingsHandler } from "./importStaffTrainings";
import { createContext } from "./_core/context";

let appPromise: Promise<express.Express> | null = null;

async function getApp(): Promise<express.Express> {
  const app = express();

  app.use((req, res, next) => {
    if (req.url.includes("%VITE_") || req.url.includes("%25VITE_")) {
      return res.status(204).end();
    }
    try {
      decodeURI(req.url);
      next();
    } catch {
      return res.status(400).end();
    }
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/cron/daily-reminders", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const authHeader = req.headers["authorization"];
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret.length < 16) {
      return res.status(500).json({ error: "CRON_SECRET is unconfigured or insecure on server" });
    }

    const expected = `Bearer ${cronSecret}`;
    if (
      typeof authHeader !== "string" ||
      authHeader.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { runDailyReminderJob } = await import("./scheduled");
      const result = await runDailyReminderJob();
      if (result.locked) {
        return res.status(409).json({ error: result.message });
      }
      return res.status(200).json({ ok: true, result });
    } catch (err: any) {
      console.error("[Cron:DailyReminders] Execution failed:", err);
      return res.status(500).json({ error: "Daily reminder job execution failed" });
    }
  });

  app.post("/api/admin/import-staff-emails", importStaffEmailsHandler);
  app.post("/api/admin/import-staff-roster", importStaffRosterHandler);
  app.post("/api/admin/import-staff-areas", importStaffAreasHandler);
  app.post("/api/admin/import-staff-trainings", importStaffTrainingsHandler);
  // Rule-based Inquiry API endpoints
  app.post("/api/inquiry", async (req, res) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(5000),
      });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    } catch {
      return res.status(503).json({
        success: false,
        answer: "Inquiry service is currently unavailable. Please contact SPMC SKTI directly at (082) 227-2731 (local 4128/4129).",
        match_type: "SERVICE_UNAVAILABLE",
      });
    }
  });
  app.get("/api/inquiry/topics", async (_req, res) => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry/topics`, { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    } catch {
      return res.status(503).json({ success: false, error: "Inquiry service unavailable" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    if (!appPromise) {
      appPromise = getApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error("[Vercel Serverless Error]:", error);
    appPromise = null;
    res.status(500).json({ error: "Internal Server Error" });
  }
}
