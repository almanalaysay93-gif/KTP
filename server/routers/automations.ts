import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  getAutomationConfig,
  listEmailLogs,
  renderEmailTemplate,
  runEmailAutomationSweep,
  sendEmail,
  updateAutomationConfig,
} from "../emailService";

export const automationsRouter = router({
  getConfig: adminProcedure.query(async () => {
    return getAutomationConfig();
  }),

  updateConfig: adminProcedure
    .input(
      z.object({
        masterEnabled: z.boolean(),
        dispatchTimeManila: z.string().regex(/^\d{2}:\d{2}$/),
        triggers: z.array(
          z.object({
            key: z.enum(["appointment_reminder", "overdue_lab", "weekly_digest"]),
            label: z.string(),
            description: z.string(),
            enabled: z.boolean(),
            leadDays: z.number().int().min(1).max(30),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const current = await getAutomationConfig();
      const updated = {
        ...current,
        masterEnabled: input.masterEnabled,
        dispatchTimeManila: input.dispatchTimeManila,
        triggers: input.triggers,
      };
      const ok = await updateAutomationConfig(updated);
      return { success: ok };
    }),

  runManualSweep: adminProcedure.mutation(async () => {
    const stats = await runEmailAutomationSweep();
    return { success: true, stats };
  }),

  listLogs: adminProcedure
    .input(
      z.object({
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const items = await listEmailLogs(input);
      return { items };
    }),

  sendTestEmail: adminProcedure
    .input(
      z.object({
        to: z.string().email(),
        templateName: z.enum([
          "AppointmentNotice",
          "OverdueLabAlert",
          "WeeklyClinicalDigest",
          "TestNotice",
        ]),
      })
    )
    .mutation(async ({ input }) => {
      const { subject, html, text } = renderEmailTemplate(input.templateName, {
        patientName: "Sample Test Patient",
        hrn: "KTP-2026-TEST",
        appointmentDate: "2026-10-08",
        time: "10:00 AM",
        doctorName: "Dr. Nephrologist",
        labTitle: "Serum Creatinine and Electrolytes",
        dueDate: "2026-10-04",
        activeCount: 42,
        pendingLabs: 8,
        upcomingVisits: 14,
        evalCount: 12,
      });

      const res = await sendEmail({
        to: input.to,
        subject,
        html,
        text,
        templateName: input.templateName,
      });

      return { success: res.status !== "failed", status: res.status, id: res.id };
    }),

  renderPreview: adminProcedure
    .input(
      z.object({
        templateName: z.enum([
          "AppointmentNotice",
          "OverdueLabAlert",
          "WeeklyClinicalDigest",
          "TestNotice",
        ]),
        sampleData: z.record(z.string(), z.any()).optional(),
      })
    )
    .query(async ({ input }) => {
      const data = input.sampleData || {
        patientName: "Juan Dela Cruz",
        hrn: "KTP-2026-0001",
        appointmentDate: "2026-10-06",
        time: "09:30 AM",
        doctorName: "Dr. Maria Santos",
        labTitle: "Complete Blood Count and Creatinine",
        dueDate: "2026-10-03",
        activeCount: 38,
        pendingLabs: 6,
        upcomingVisits: 11,
        evalCount: 9,
      };

      const { subject, html, text } = renderEmailTemplate(input.templateName, data);
      return { subject, html, text };
    }),
});
