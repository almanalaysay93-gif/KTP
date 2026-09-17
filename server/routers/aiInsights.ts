import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { generateInsightsReport, InsightsServiceError } from "../_core/aiInsights";
import { getManilaDateKey } from "../scheduled";

export const aiInsightsRouter = router({
  generateReport: adminProcedure.mutation(async () => {
    try {
      const report = await generateInsightsReport(getManilaDateKey());
      return { ...report, generatedAt: new Date().toISOString() };
    } catch (err) {
      if (err instanceof InsightsServiceError) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: err.message });
      }
      console.error("[Insights] report failed:", err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The insights report could not be created. Try again later." });
    }
  }),

  chat: adminProcedure
    .input(
      z.object({
        question: z.string().min(1).max(1000),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
      const secret = process.env.INQUIRY_SERVICE_SECRET;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (secret) {
        headers["Authorization"] = `Bearer ${secret}`;
      }
      try {
        const resp = await fetch(`${serviceUrl}/api/inquiry`, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: input.question, context: { is_authorized: true } }),
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const data = await resp.json();
          return { answer: data.answer };
        }
      } catch {
        // Fallback to verified hospital inquiry information
      }
      return {
        answer:
          "SPMC Kidney Transplant Institute (SKTI) General Inquiries: For questions regarding services, hours, location, requirements, or fees, please contact the SPMC SKTI Information Desk directly at (082) 227-2731 (local 4128/4129).",
      };
    }),
});
