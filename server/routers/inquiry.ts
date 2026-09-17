import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

export interface TopicPill {
  id: string;
  name: string;
  short_desc?: string;
}

export interface InquiryChatResponse {
  success: boolean;
  answer: string;
  topic_id?: string | null;
  title?: string;
  match_type: string;
  related_topics: TopicPill[];
  candidate_topics: TopicPill[];
  contact_snippet?: string;
}

const FALLBACK_TOPICS: TopicPill[] = [
  { id: "services", name: "Services Offered", short_desc: "Hemodialysis, peritoneal dialysis, transplant" },
  { id: "hours", name: "Hours & Schedule", short_desc: "Clinic hours and 24/7 dialysis shifts" },
  { id: "location", name: "Location & Directions", short_desc: "SPMC Bajada Dialysis Complex" },
  { id: "requirements", name: "Requirements & Documents", short_desc: "Medical abstract, clearances, PhilHealth" },
  { id: "fees", name: "Fees & PhilHealth", short_desc: "156 sessions coverage and financial aid" },
  { id: "contact", name: "Contact & Inquiries", short_desc: "Trunkline (082) 227-2731 and direct locals" },
];

const SERVICE_UNAVAILABLE_ANSWER =
  "Inquiry service is currently unavailable. For general inquiries regarding SPMC SKTI services, hours, location, requirements, or fees, please contact the SPMC SKTI Information Desk directly at (082) 227-2731 (local 4128/4129) or visit the SPMC Dialysis Complex in Bajada, Davao City.";

export const inquiryRouter = router({
  topics: publicProcedure.query(async () => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry/topics`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { topics: (data.topics as TopicPill[]) || FALLBACK_TOPICS };
      }
    } catch {
      // Graceful fallback if python service is offline
    }
    return { topics: FALLBACK_TOPICS };
  }),

  chat: publicProcedure
    .input(
      z.object({
        question: z.string().max(1000).optional().default(""),
        topicId: z.string().max(100).optional().nullable(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .max(30)
          .optional(),
      })
    )
    .mutation(async ({ input }): Promise<InquiryChatResponse> => {
      const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
      try {
        const resp = await fetch(`${serviceUrl}/api/inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input.question || "",
            topic_id: input.topicId || undefined,
            history: input.history || [],
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const json = await resp.json();
          return {
            success: true,
            answer: json.answer || "",
            topic_id: json.topic_id ?? null,
            title: json.title || "General Inquiries",
            match_type: json.match_type || "UNKNOWN",
            related_topics: json.related_topics || [],
            candidate_topics: json.candidate_topics || [],
            contact_snippet: json.contact_snippet,
          };
        }
      } catch {
        // Fallback on connection error or service failure
      }

      // Return verified offline response with contact details — zero model calls
      return {
        success: false,
        answer: SERVICE_UNAVAILABLE_ANSWER,
        topic_id: null,
        title: "Service Unavailable",
        match_type: "SERVICE_UNAVAILABLE",
        related_topics: FALLBACK_TOPICS,
        candidate_topics: FALLBACK_TOPICS,
        contact_snippet: "SPMC Trunkline: (082) 227-2731 | Dialysis Local: 4128/4129",
      };
    }),
});
