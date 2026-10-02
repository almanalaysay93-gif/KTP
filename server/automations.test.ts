import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { renderEmailTemplate } from "./emailService";

describe("Clinical Email Automations and Dispatch System", () => {
  const adminCaller = appRouter.createCaller({
    user: {
      id: 1,
      email: "share@spmcdvo.net",
      name: "Admin",
      role: "admin",
      openId: "admin-id",
      loginMethod: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { ip: "127.0.0.1", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  });

  const patientCaller = appRouter.createCaller({
    user: {
      id: 10,
      email: "patient@example.com",
      name: "Juan Dela Cruz",
      role: "patient",
      openId: "patient-id",
      loginMethod: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { ip: "127.0.0.1", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  });

  it("retrieves default automation configuration", async () => {
    const config = await adminCaller.automations.getConfig();
    expect(config).toBeDefined();
    expect(typeof config.masterEnabled).toBe("boolean");
    expect(config.dispatchTimeManila).toMatch(/^\d{2}:\d{2}$/);
    expect(config.triggers.length).toBeGreaterThanOrEqual(3);

    const keys = config.triggers.map(t => t.key);
    expect(keys).toContain("appointment_reminder");
    expect(keys).toContain("overdue_lab");
    expect(keys).toContain("weekly_digest");
  });

  it("updates automation configuration successfully", async () => {
    const current = await adminCaller.automations.getConfig();
    const updatedTriggers = current.triggers.map(t =>
      t.key === "appointment_reminder" ? { ...t, leadDays: 3 } : t
    );

    const res = await adminCaller.automations.updateConfig({
      masterEnabled: true,
      dispatchTimeManila: "07:30",
      triggers: updatedTriggers,
    });

    expect(res.success).toBe(true);

    const reloaded = await adminCaller.automations.getConfig();
    expect(reloaded.dispatchTimeManila).toBe("07:30");
    const apptTrigger = reloaded.triggers.find(t => t.key === "appointment_reminder");
    expect(apptTrigger?.leadDays).toBe(3);
  });

  it("renders all four clinical email templates with merge tags", async () => {
    // 1. AppointmentNotice
    const appt = renderEmailTemplate("AppointmentNotice", {
      patientName: "Maria Clara",
      hrn: "KTP-2026-9999",
      appointmentDate: "2026-10-15",
      time: "10:30 AM",
      doctorName: "Dr. Santos",
    });
    expect(appt.subject).toContain("Appointment Notice");
    expect(appt.html).toContain("Maria Clara");
    expect(appt.html).toContain("KTP-2026-9999");
    expect(appt.html).toContain("Dr. Santos");
    expect(appt.html).toContain("2026-10-15");

    // 2. OverdueLabAlert
    const labAlert = renderEmailTemplate("OverdueLabAlert", {
      patientName: "Juan Dela Cruz",
      hrn: "KTP-2026-0001",
      labTitle: "Serum Creatinine and Tacrolimus Trough",
      dueDate: "2026-10-01",
    });
    expect(labAlert.subject).toContain("Scheduled Lab Workup Due");
    expect(labAlert.html).toContain("Juan Dela Cruz");
    expect(labAlert.html).toContain("Serum Creatinine and Tacrolimus Trough");

    // 3. WeeklyClinicalDigest
    const digest = renderEmailTemplate("WeeklyClinicalDigest", {
      activeCount: 45,
      pendingLabs: 7,
      upcomingVisits: 12,
      evalCount: 15,
    });
    expect(digest.subject).toContain("Weekly Kidney Transplant Clinical Digest");
    expect(digest.html).toContain("45");
    expect(digest.html).toContain("7");
    expect(digest.html).toContain("12");

    // 4. TestNotice
    const testNotice = renderEmailTemplate("TestNotice", {});
    expect(testNotice.subject).toContain("Notification System Test");
    expect(testNotice.html).toContain("Southern Philippines Medical Center");
  });

  it("renders preview endpoint via tRPC", async () => {
    const preview = await adminCaller.automations.renderPreview({
      templateName: "AppointmentNotice",
      sampleData: {
        patientName: "Pedro Penduko",
        hrn: "KTP-TEST-01",
        appointmentDate: "2026-11-01",
        doctorName: "Dr. Nephro",
      },
    });

    expect(preview.subject).toBeDefined();
    expect(preview.html).toContain("Pedro Penduko");
    expect(preview.text).toContain("Pedro Penduko");
  });

  it("dispatches test notification and records in dispatch logs", async () => {
    const dispatchRes = await adminCaller.automations.sendTestEmail({
      to: "test-eval@spmcdvo.net",
      templateName: "TestNotice",
    });

    expect(dispatchRes.success).toBe(true);
    expect(["sent", "mock", "mock_sent"]).toContain(dispatchRes.status);

    const logs = await adminCaller.automations.listLogs({ limit: 10 });
    expect(logs.items.length).toBeGreaterThanOrEqual(1);

    const testLog = logs.items.find(l => l.recipientEmail === "test-eval@spmcdvo.net");
    expect(testLog).toBeDefined();
    expect(testLog?.templateName).toBe("TestNotice");
  });

  it("runs manual sweep execution and calculates telemetry stats", async () => {
    const sweep = await adminCaller.automations.runManualSweep();
    expect(sweep.success).toBe(true);
    expect(sweep.stats).toBeDefined();
    expect(typeof sweep.stats.created).toBe("number");
    expect(typeof sweep.stats.sent).toBe("number");
    expect(typeof sweep.stats.failed).toBe("number");
    expect(typeof sweep.stats.skipped).toBe("number");
  });

  it("blocks non-admin users from accessing automation endpoints", async () => {
    await expect(patientCaller.automations.getConfig()).rejects.toThrow();
    await expect(
      patientCaller.automations.sendTestEmail({
        to: "hack@example.com",
        templateName: "TestNotice",
      })
    ).rejects.toThrow();
  });
});
