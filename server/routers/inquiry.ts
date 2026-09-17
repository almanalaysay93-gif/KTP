import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

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
  live_synced?: boolean;
}

const FALLBACK_TOPICS: TopicPill[] = [
  { id: "services", name: "Services Offered", short_desc: "Hemodialysis, peritoneal dialysis, transplant" },
  { id: "hours", name: "Hours & Schedule", short_desc: "Clinic hours and 24/7 dialysis shifts" },
  { id: "location", name: "Location & Directions", short_desc: "SPMC Bajada Dialysis Complex" },
  { id: "requirements", name: "Requirements & Documents", short_desc: "Medical abstract, clearances, PhilHealth" },
  { id: "fees", name: "Fees & PhilHealth", short_desc: "156 sessions coverage and financial aid" },
  { id: "contact", name: "Contact & Inquiries", short_desc: "Trunkline (082) 227-2731 and direct locals" },
  { id: "trainings", name: "Seminars & Trainings", short_desc: "Live training calendar and upcoming seminars" },
  { id: "areas", name: "Clinical Units & Areas", short_desc: "Active clinical units and hospital stations" },
];

const SERVICE_UNAVAILABLE_ANSWER =
  "Inquiry service is currently unavailable. For general inquiries regarding SPMC SKTI services, hours, location, requirements, or fees, please contact the SPMC SKTI Information Desk directly at (082) 227-2731 (local 4128/4129) or visit the SPMC Dialysis Complex in Bajada, Davao City.";

/** Gather live database context (Option D1: Auto-Sync to FAQ / Dynamic Context) */
export async function buildLiveInquiryContext() {
  try {
    const [areas, trainingCatalog, nurseTrainings, nurses] = await Promise.all([
      db.listAreas(false).catch(() => []),
      db.listTrainingCatalog(false).catch(() => []),
      db.listNurseTrainings().catch(() => []),
      db.listNurses().catch(() => []),
    ]);

    const activeNurses = nurses.filter(
      (n) => !n.archivedAt && n.employmentStatus !== "Archived" && n.employmentStatus !== "Resigned"
    );

    const areaById = new Map(areas.map((a) => [a.id, a.name]));
    const areaCounts = new Map<string, number>();
    for (const a of areas) areaCounts.set(a.name, 0);
    for (const n of activeNurses) {
      if (n.currentAreaId && areaById.has(n.currentAreaId)) {
        const name = areaById.get(n.currentAreaId)!;
        areaCounts.set(name, (areaCounts.get(name) ?? 0) + 1);
      }
    }

    const activeAreas = areas.map((a) => ({
      id: a.id,
      name: a.name,
      staffCount: areaCounts.get(a.name) ?? 0,
    }));

    const todayStr = new Date().toISOString().slice(0, 10);
    const catalogById = new Map(trainingCatalog.map((t) => [t.id, t.name]));
    const upcoming = nurseTrainings
      .filter((t) => t.status === "Scheduled" && t.scheduledDate && String(t.scheduledDate) >= todayStr)
      .map((t) => ({
        trainingName: catalogById.get(t.trainingId) ?? "Training/Seminar",
        scheduledDate: String(t.scheduledDate).slice(0, 10),
      }))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    const seen = new Set<string>();
    const deduplicatedUpcoming = upcoming.filter((u) => {
      const key = `${u.trainingName}::${u.scheduledDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);

    return {
      active_areas: activeAreas,
      upcoming_trainings: deduplicatedUpcoming,
      total_active_staff: activeNurses.length,
    };
  } catch {
    return {
      active_areas: [],
      upcoming_trainings: [],
      total_active_staff: 0,
    };
  }
}

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
      const liveContext = await buildLiveInquiryContext();

      try {
        const resp = await fetch(`${serviceUrl}/api/inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input.question || "",
            topic_id: input.topicId || undefined,
            history: input.history || [],
            context: liveContext,
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
            live_synced: true,
          };
        }
      } catch {
        // Fallback on connection error or service failure
      }

      // Offline fallback: if asking about areas or trainings, format from liveContext directly
      if (input.topicId === "trainings" || input.question?.toLowerCase().includes("seminar") || input.question?.toLowerCase().includes("training")) {
        const upcoming = liveContext.upcoming_trainings;
        let answer = "SPMC SKTI Seminars & Staff Trainings (Live Database):\n\n";
        if (upcoming && upcoming.length > 0) {
          answer += upcoming.map((u) => `• ${u.trainingName} — Scheduled: ${u.scheduledDate}`).join("\n");
        } else {
          answer += "There are currently no upcoming seminars or trainings scheduled in the database.";
        }
        return {
          success: true,
          answer,
          topic_id: "trainings",
          title: "Seminars & Trainings",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "trainings"),
          candidate_topics: [],
          live_synced: true,
        };
      }

      if (input.topicId === "areas" || input.question?.toLowerCase().includes("area") || input.question?.toLowerCase().includes("unit")) {
        const areas = liveContext.active_areas;
        let answer = "SPMC SKTI Clinical Units & Areas (Live Database):\n\n";
        if (areas && areas.length > 0) {
          answer += areas.map((a) => `• ${a.name} (${a.staffCount} active staff assigned)`).join("\n");
          answer += `\n\nTotal Active Staff Tracked: ${liveContext.total_active_staff}`;
        } else {
          answer += "Active hospital areas tracked in NurseTrack.";
        }
        return {
          success: true,
          answer,
          topic_id: "areas",
          title: "Clinical Units & Areas",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "areas"),
          candidate_topics: [],
          live_synced: true,
        };
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
        live_synced: false,
      };
    }),
});
