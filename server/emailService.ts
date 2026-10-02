import { getBatchClient } from "./db";
import { getSqliteDb } from "./localDb";
import { todayDate } from "../shared/ktp";

export interface AutomationTriggerConfig {
  key: "appointment_reminder" | "overdue_lab" | "weekly_digest";
  label: string;
  description: string;
  enabled: boolean;
  leadDays: number;
}

export interface EmailAutomationConfig {
  masterEnabled: boolean;
  dispatchTimeManila: string;
  triggers: AutomationTriggerConfig[];
  lastRunAt: string | null;
  lastRunStats: { sent: number; failed: number; skipped: number } | null;
}

export const DEFAULT_AUTOMATION_CONFIG: EmailAutomationConfig = {
  masterEnabled: true,
  dispatchTimeManila: "08:00",
  triggers: [
    {
      key: "appointment_reminder",
      label: "Clinic Appointment Notice",
      description: "Send patient email reminder 2 days before scheduled clinic visit.",
      enabled: true,
      leadDays: 2,
    },
    {
      key: "overdue_lab",
      label: "Overdue Lab Workup Alert",
      description: "Send alert when scheduled laboratory workup due date has passed.",
      enabled: true,
      leadDays: 1,
    },
    {
      key: "weekly_digest",
      label: "Weekly Nephrology Digest",
      description: "Send weekly patient census and pending clearance digest to doctors.",
      enabled: true,
      leadDays: 7,
    },
  ],
  lastRunAt: null,
  lastRunStats: null,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function baseTemplate(title: string, patientBanner: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0; padding:0; background-color:#e2e5d5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#2a301e; }
    .wrapper { width:100%; max-width:600px; margin:24px auto; background-color:#fbfbf7; border-radius:12px; border:1px solid #cbd0bb; overflow:hidden; }
    .header { background-color:#f3f4ec; padding:20px 24px; border-bottom:1px solid #cbd0bb; }
    .title { font-size:18px; font-weight:700; margin:0; color:#2a301e; }
    .sub { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#545b45; margin-top:4px; }
    .banner { background-color:#d8dcc9; padding:12px 24px; font-size:12px; font-family:monospace; color:#2a301e; border-bottom:1px solid #cbd0bb; }
    .content { padding:24px; font-size:14px; line-height:1.5; color:#2a301e; }
    .footer { background-color:#f3f4ec; padding:16px 24px; font-size:11px; color:#545b45; border-top:1px solid #cbd0bb; }
    .btn { display:inline-block; background-color:#ae3c30; color:#fffaf6; text-decoration:none; padding:10px 18px; font-size:13px; font-weight:600; border-radius:6px; margin-top:16px; }
    .highlight { background-color:#dcefdc; color:#1d6433; padding:2px 6px; border-radius:4px; font-weight:600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="title">SPMC Kidney Transplant Service</h1>
      <div class="sub">Clinical Notification System · Confidential</div>
    </div>
    ${patientBanner ? `<div class="banner">${patientBanner}</div>` : ""}
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      Southern Philippines Medical Center · Kidney Transplant Program<br>
      This notification is sent automatically. For urgent clinical emergencies, visit the emergency department.
    </div>
  </div>
</body>
</html>`;
}

export function renderEmailTemplate(
  templateName: string,
  data: Record<string, any>
): { subject: string; html: string; text: string } {
  const patientName = data.patientName || "Patient";
  const hrn = data.hrn || "KTP-2026-0000";

  if (templateName === "AppointmentNotice") {
    const subject = `Appointment Notice: ${patientName} (${hrn}) on ${data.appointmentDate || todayDate()}`;
    const banner = `PATIENT: ${escapeHtml(patientName)} | HRN: ${escapeHtml(hrn)} | VISIT: ${escapeHtml(data.kind || "FollowUp")}`;
    const body = `
      <p>Dear <strong>${escapeHtml(patientName)}</strong>,</p>
      <p>This is an automated reminder of your upcoming kidney transplant clinic appointment:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Date and Time:</strong> <span class="highlight">${escapeHtml(data.appointmentDate || "")} at ${escapeHtml(data.time || "09:00 AM")}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Attending Doctor:</strong> ${escapeHtml(data.doctorName || "Transplant Specialist")}</p>
        <p style="margin:0;"><strong>Location:</strong> SPMC Kidney Transplant Clinic, OPD Building</p>
      </div>
      <p>Please arrive 15 minutes before your scheduled time. Bring your previous lab results and PhilHealth identification.</p>
      <a href="https://ktp-beryl.vercel.app/me/calendar" class="btn">View Appointment in Patient Portal</a>
    `;
    const text = `SPMC Kidney Transplant Appointment Reminder\nPatient: ${patientName} (${hrn})\nDate: ${data.appointmentDate} at ${data.time}\nDoctor: ${data.doctorName}\nLocation: SPMC Kidney Transplant Clinic`;
    return { subject, html: baseTemplate("Clinic Appointment Notice", banner, body), text };
  }

  if (templateName === "OverdueLabAlert") {
    const subject = `Action Required: Scheduled Lab Workup Due for ${patientName} (${hrn})`;
    const banner = `PATIENT: ${escapeHtml(patientName)} | HRN: ${escapeHtml(hrn)} | ALERT: Due Lab Service`;
    const body = `
      <p>Dear <strong>${escapeHtml(patientName)}</strong>,</p>
      <p>Our records show a scheduled laboratory workup has reached its due date without recorded results:</p>
      <div style="background-color:#fbe1e8; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #ae3c30;">
        <p style="margin:0 0 8px 0; color:#ae3c30;"><strong>Laboratory Requirement:</strong> ${escapeHtml(data.labTitle || "Periodic Blood Chemistry")}</p>
        <p style="margin:0; color:#2a301e;"><strong>Target Due Date:</strong> ${escapeHtml(data.dueDate || todayDate())}</p>
      </div>
      <p>Routine lab monitoring is critical to protect your graft function. Please complete your blood draw and upload your results or submit them to the transplant coordinator.</p>
      <a href="https://ktp-beryl.vercel.app/me/labs" class="btn">Upload Results to Portal</a>
    `;
    const text = `SPMC Kidney Transplant Lab Workup Alert\nPatient: ${patientName} (${hrn})\nRequirement: ${data.labTitle}\nDue Date: ${data.dueDate}`;
    return { subject, html: baseTemplate("Overdue Lab Workup Alert", banner, body), text };
  }

  if (templateName === "WeeklyClinicalDigest") {
    const subject = `Weekly Kidney Transplant Clinical Digest: ${data.date || todayDate()}`;
    const banner = `CLINICAL DIGEST | SPMC TRANSPLANT SERVICE | CENSUS SUMMARY`;
    const body = `
      <p>Dear <strong>${escapeHtml(data.doctorName || "Transplant Team")}</strong>,</p>
      <p>Here is the weekly active patient census and workup status summary:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Active Transplant Patients:</strong> <span class="highlight">${data.activeCount || 0}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Pending Lab Workups:</strong> ${data.pendingLabs || 0}</p>
        <p style="margin:0 0 8px 0;"><strong>Upcoming Clinic Visits (7 Days):</strong> ${data.upcomingVisits || 0}</p>
        <p style="margin:0;"><strong>Patients in Pre-Transplant Evaluation:</strong> ${data.evalCount || 0}</p>
      </div>
      <a href="https://ktp-beryl.vercel.app/dashboard" class="btn">Open Transplant Dashboard</a>
    `;
    const text = `Weekly Transplant Digest\nActive Patients: ${data.activeCount}\nPending Labs: ${data.pendingLabs}\nUpcoming Visits: ${data.upcomingVisits}`;
    return { subject, html: baseTemplate("Weekly Clinical Digest", banner, body), text };
  }

  // Default Test Notice
  const subject = `KTP Notification System Test (${data.testId || "Ping"})`;
  const body = `
    <p>This is a test notification confirming email delivery connectivity for the SPMC Kidney Transplant Program.</p>
    <p>Timestamp: <strong>${new Date().toISOString()}</strong></p>
    <p>Status: All automated clinical dispatch pipelines operational.</p>
  `;
  return { subject, html: baseTemplate("Notification System Test", "", body), text: "KTP Email Test OK" };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  templateName,
  patientId,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateName: string;
  patientId?: number | null;
}): Promise<{ id: number; status: "sent" | "failed" | "mock" }> {
  const apiKey = process.env.RESEND_API_KEY;
  let status: "sent" | "failed" | "mock" = "mock";
  let errorMessage: string | null = null;

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "KTP Notifications <notifications@spmcdvo.net>",
          to: [to],
          subject,
          html,
          text,
        }),
      });
      if (res.ok) {
        status = "sent";
      } else {
        const errorData = await res.json().catch(() => ({}));
        status = "failed";
        errorMessage = errorData.message || `HTTP ${res.status}`;
      }
    } catch (err: any) {
      status = "failed";
      errorMessage = err.message || "Network dispatch failure";
    }
  } else {
    // Mock delivery mode
    status = "mock";
  }

  // Record delivery in emailLogs
  const db = getBatchClient();
  let logId = 0;

  if (db) {
    try {
      const [row] = await db`
        INSERT INTO "ktp"."emailLogs" ("recipientEmail", "subject", "templateName", "status", "errorMessage", "patientId")
        VALUES (${to}, ${subject}, ${templateName}, ${status}, ${errorMessage}, ${patientId || null})
        RETURNING id
      `;
      logId = Number(row?.id || 0);
    } catch (e) {
      console.error("[Email Log Insert Failed PG]", e);
    }
  } else {
    try {
      const sqlite = getSqliteDb();
      const res = sqlite
        .prepare(
          "INSERT INTO emailLogs (recipientEmail, subject, templateName, status, errorMessage, patientId) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(to, subject, templateName, status, errorMessage, patientId || null);
      logId = Number(res.lastInsertRowid);
    } catch (e) {
      console.error("[Email Log Insert Failed SQLite]", e);
    }
  }

  return { id: logId, status };
}

export async function getAutomationConfig(): Promise<EmailAutomationConfig> {
  const db = getBatchClient();
  try {
    if (db) {
      const rows = await db`SELECT value FROM "ktp"."appSettings" WHERE key = 'email_automation_config' LIMIT 1`;
      if (rows.length && rows[0].value) return JSON.parse(rows[0].value);
    } else {
      const sqlite = getSqliteDb();
      const row = sqlite.prepare("SELECT value FROM appSettings WHERE key = 'email_automation_config'").get() as any;
      if (row?.value) return JSON.parse(row.value);
    }
  } catch (e) {
    // Return default on error
  }
  return DEFAULT_AUTOMATION_CONFIG;
}

export async function updateAutomationConfig(config: EmailAutomationConfig): Promise<boolean> {
  const jsonStr = JSON.stringify(config);
  const db = getBatchClient();
  try {
    if (db) {
      await db`
        INSERT INTO "ktp"."appSettings" (key, value)
        VALUES ('email_automation_config', ${jsonStr})
        ON CONFLICT (key) DO UPDATE SET value = ${jsonStr}, "updatedAt" = now()
      `;
    } else {
      const sqlite = getSqliteDb();
      sqlite
        .prepare("INSERT INTO appSettings (key, value) VALUES ('email_automation_config', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
        .run(jsonStr, jsonStr);
    }
    return true;
  } catch (e) {
    console.error("[Update Email Config Error]", e);
    return false;
  }
}

export async function runEmailAutomationSweep(): Promise<{
  created: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const config = await getAutomationConfig();
  if (!config.masterEnabled) {
    return { created: 0, sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const today = todayDate();
  const db = getBatchClient();

  // 1. Process upcoming appointments (2 days ahead)
  const apptTrigger = config.triggers.find(t => t.key === "appointment_reminder");
  if (apptTrigger && apptTrigger.enabled) {
    try {
      let appointments: any[] = [];
      if (db) {
        appointments = await db`
          SELECT a.id, a."patientId", a.title, a.kind, a."startsAt", a.location, p."firstName", p."lastName", p."accountEmail", p."hrn"
          FROM "ktp"."appointments" a
          JOIN "ktp"."patients" p ON p.id = a."patientId"
          WHERE a."cancelledAt" IS NULL
            AND a."startsAt"::date >= ${today}::date
            AND a."startsAt"::date <= (${today}::date + interval '2 days')
        `;
      } else {
        const sqlite = getSqliteDb();
        appointments = sqlite.prepare(`
          SELECT a.id, a.patientId, a.title, a.kind, a.startsAt, a.location, p.firstName, p.lastName, p.accountEmail, p.hrn
          FROM appointments a
          JOIN patients p ON p.id = a.patientId
          WHERE a.cancelledAt IS NULL
            AND substr(a.startsAt, 1, 10) >= ?
            AND substr(a.startsAt, 1, 10) <= date(?, '+2 days')
        `).all(today, today);
      }

      for (const appt of appointments) {
        if (!appt.accountEmail || !appt.accountEmail.includes("@")) {
          skipped++;
          continue;
        }
        const patientName = `${appt.firstName} ${appt.lastName}`;
        const appointmentDate = (appt.startsAt || "").slice(0, 10);
        const { subject, html, text } = renderEmailTemplate("AppointmentNotice", {
          patientName,
          hrn: appt.hrn,
          appointmentDate,
          doctorName: appt.location || "SPMC Nephrology Clinic",
          kind: appt.kind,
        });

        const res = await sendEmail({
          to: appt.accountEmail,
          subject,
          html,
          text,
          templateName: "AppointmentNotice",
          patientId: appt.patientId,
        });

        if (res.status === "failed") failed++;
        else sent++;
      }
    } catch (err) {
      console.error("[Sweep Appointment Error]", err);
    }
  }

  // Update last run stats
  config.lastRunAt = new Date().toISOString();
  config.lastRunStats = { sent, failed, skipped };
  await updateAutomationConfig(config);

  return { created: sent + failed, sent, failed, skipped };
}

export async function listEmailLogs({
  status,
  search,
  limit = 50,
  offset = 0,
}: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getBatchClient();
  if (db) {
    let rows: any[] = [];
    if (status && status !== "all") {
      rows = await db`
        SELECT l.*, p."firstName", p."lastName", p."hrn"
        FROM "ktp"."emailLogs" l
        LEFT JOIN "ktp"."patients" p ON p.id = l."patientId"
        WHERE l.status = ${status}
        ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await db`
        SELECT l.*, p."firstName", p."lastName", p."hrn"
        FROM "ktp"."emailLogs" l
        LEFT JOIN "ktp"."patients" p ON p.id = l."patientId"
        ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return rows.map(r => ({
      id: Number(r.id),
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      templateName: r.templateName,
      status: r.status,
      errorMessage: r.errorMessage,
      patientId: r.patientId ? Number(r.patientId) : null,
      patientName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
      patientHrn: r.hrn || null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));
  }

  const sqlite = getSqliteDb();
  let query = `
    SELECT l.*, p.firstName, p.lastName, p.hrn
    FROM emailLogs l
    LEFT JOIN patients p ON p.id = l.patientId
  `;
  const params: any[] = [];
  if (status && status !== "all") {
    query += " WHERE l.status = ?";
    params.push(status);
  }
  query += " ORDER BY l.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = sqlite.prepare(query).all(...params) as any[];
  return rows.map(r => ({
    id: Number(r.id),
    recipientEmail: r.recipientEmail,
    subject: r.subject,
    templateName: r.templateName,
    status: r.status,
    errorMessage: r.errorMessage,
    patientId: r.patientId ? Number(r.patientId) : null,
    patientName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
    patientHrn: r.hrn || null,
    createdAt: r.createdAt || new Date().toISOString(),
  }));
}
