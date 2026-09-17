import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb, activeNurseCondition, INACTIVE_STATUS_SQL_LIST } from "../db";
import { areas, nurses, nurseTrainings, trainingCatalog } from "../../drizzle/schema";
import { dateKey } from "../../shared/nursetrack";
import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getSqliteDb } from "../localDb";

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
  { id: "trainings", name: "Seminars & Trainings", short_desc: "Training calendar and upcoming seminars" },
  { id: "areas", name: "Clinical Units & Areas", short_desc: "Active clinical units and hospital stations" },
];

const SERVICE_UNAVAILABLE_ANSWER =
  "Inquiry service is currently unavailable. For general inquiries regarding SPMC SKTI services, hours, location, requirements, or fees, please contact the SPMC SKTI Information Desk directly at (082) 227-2731 (local 4128/4129) or visit the SPMC Dialysis Complex in Bajada, Davao City.";

/** Returns YYYY-MM-DD in Asia/Manila timezone (+08:00). */
export function getTodayManila(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Check if inquiry query/topic needs live database context */
export function needsDatabaseContext(question?: string, topicId?: string | null): boolean {
  const tId = topicId?.trim().toLowerCase();
  if (tId === "trainings" || tId === "areas") return true;
  if (!question) return false;
  const q = question.toLowerCase();
  const triggers = [
    "seminar", "seminars", "training", "trainings", "workshop", "course", "courses",
    "bls", "acls", "area", "areas", "unit", "units", "ward", "wards", "department", "departments",
    "station", "stations", "roster", "staffing",
  ];
  return triggers.some((t) => q.includes(t));
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

/** Targeted query for active areas and staff counts (3-second deadline) */
export async function getAreaCountsSummary(isAuthorized = false): Promise<
  { status: "success" | "failed"; areas: Array<{ id: number; name: string; staffCount?: number }>; totalStaff?: number }
> {
  try {
    const fetchAreas = async () => {
      const dbConn = await getDb();
      if (dbConn) {
        const areaRows = await dbConn.select().from(areas).where(eq(areas.active, true)).orderBy(areas.sortOrder);
        const countMap = new Map<number, number>();
        let total = 0;

        if (isAuthorized) {
          const nurseCounts = await dbConn
            .select({ areaId: nurses.currentAreaId, count: sql<number>`count(*)::int` })
            .from(nurses)
            .where(activeNurseCondition())
            .groupBy(nurses.currentAreaId);
          for (const c of nurseCounts) {
            if (c.areaId !== null && c.areaId !== undefined) {
              const cnt = Number(c.count);
              countMap.set(c.areaId, cnt);
              total += cnt;
            }
          }
        }

        return {
          status: "success" as const,
          areas: areaRows.map((a) => ({
            id: a.id,
            name: a.name,
            ...(isAuthorized ? { staffCount: countMap.get(a.id) ?? 0 } : {}),
          })),
          ...(isAuthorized ? { totalStaff: total } : {}),
        };
      }

      const sqlite = getSqliteDb();
      if (sqlite) {
        const areaRows = sqlite.prepare("SELECT id, name, sortOrder FROM areas WHERE active = 1 ORDER BY sortOrder").all() as any[];
        const countMap = new Map<number, number>();
        let total = 0;

        if (isAuthorized) {
          const countRows = sqlite.prepare(
            `SELECT currentAreaId as areaId, COUNT(*) as count FROM nurses WHERE archivedAt IS NULL AND employmentStatus NOT IN (${INACTIVE_STATUS_SQL_LIST}) GROUP BY currentAreaId`
          ).all() as any[];
          for (const c of countRows) {
            if (c.areaId !== null && c.areaId !== undefined) {
              const cnt = Number(c.count);
              countMap.set(Number(c.areaId), cnt);
              total += cnt;
            }
          }
        }

        return {
          status: "success" as const,
          areas: areaRows.map((a) => ({
            id: a.id,
            name: a.name,
            ...(isAuthorized ? { staffCount: countMap.get(a.id) ?? 0 } : {}),
          })),
          ...(isAuthorized ? { totalStaff: total } : {}),
        };
      }

      return { status: "success" as const, areas: [] };
    };

    return await withTimeout(fetchAreas(), 3000, "Area database query timed out");
  } catch {
    return { status: "failed", areas: [] };
  }
}

/** Targeted query for upcoming training events (3-second deadline) */
export async function getUpcomingTrainingsSummary(
  todayManila: string
): Promise<{ status: "success" | "failed"; upcoming: Array<{ trainingName: string; scheduledDate: string }> }> {
  try {
    const fetchTrainings = async () => {
      const dbConn = await getDb();
      if (dbConn) {
        const rows = await dbConn
          .select({
            trainingName: trainingCatalog.name,
            scheduledDate: nurseTrainings.scheduledDate,
          })
          .from(nurseTrainings)
          .innerJoin(trainingCatalog, eq(nurseTrainings.trainingId, trainingCatalog.id))
          .where(
            and(
              eq(nurseTrainings.status, "Scheduled"),
              isNotNull(nurseTrainings.scheduledDate),
              gte(nurseTrainings.scheduledDate, sql`(${todayManila})::date`)
            )
          )
          .orderBy(asc(nurseTrainings.scheduledDate))
          .limit(20);

        const seen = new Set<string>();
        const results: Array<{ trainingName: string; scheduledDate: string }> = [];
        for (const r of rows) {
          const d = dateKey(r.scheduledDate);
          if (!d || d < todayManila) continue; // Past events excluded
          const key = `${r.trainingName}::${d}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ trainingName: r.trainingName, scheduledDate: d });
          }
          if (results.length >= 10) break;
        }
        return { status: "success" as const, upcoming: results };
      }

      const sqlite = getSqliteDb();
      if (sqlite) {
        const rows = sqlite.prepare(
          `SELECT c.name as trainingName, nt.scheduledDate as scheduledDate
           FROM nurseTrainings nt
           JOIN trainingCatalog c ON nt.trainingId = c.id
           WHERE nt.status = 'Scheduled' AND nt.scheduledDate >= ?
           ORDER BY nt.scheduledDate ASC
           LIMIT 20`
        ).all(todayManila) as any[];

        const seen = new Set<string>();
        const results: Array<{ trainingName: string; scheduledDate: string }> = [];
        for (const r of rows) {
          const d = dateKey(r.scheduledDate);
          if (!d || d < todayManila) continue;
          const key = `${r.trainingName}::${d}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ trainingName: r.trainingName, scheduledDate: d });
          }
          if (results.length >= 10) break;
        }
        return { status: "success" as const, upcoming: results };
      }

      return { status: "success" as const, upcoming: [] };
    };

    return await withTimeout(fetchTrainings(), 3000, "Training database query timed out");
  } catch {
    return { status: "failed", upcoming: [] };
  }
}

export const inquiryRouter = router({
  topics: publicProcedure.query(async () => {
    const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
    const headers: Record<string, string> = {};
    if (process.env.INQUIRY_SERVICE_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
    }
    try {
      const resp = await fetch(`${serviceUrl}/api/inquiry/topics`, {
        headers,
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
    .mutation(async ({ ctx, input }): Promise<InquiryChatResponse> => {
      const serviceUrl = process.env.INQUIRY_SERVICE_URL || "http://127.0.0.1:5005";
      const isAuthorized = Boolean(ctx.user);
      const todayManila = getTodayManila();

      // Only fetch database context when inquiry topic or query requires it
      let liveContext: Record<string, any> | null = null;
      let dbReadSucceeded = false;
      let dbReadAttempted = false;

      if (needsDatabaseContext(input.question, input.topicId)) {
        dbReadAttempted = true;
        const [areasRes, trainingsRes] = await Promise.all([
          getAreaCountsSummary(isAuthorized),
          getUpcomingTrainingsSummary(todayManila),
        ]);

        const areasSuccess = areasRes.status === "success";
        const trainingsSuccess = trainingsRes.status === "success";
        dbReadSucceeded = areasSuccess && trainingsSuccess;

        liveContext = {
          today_manila: todayManila,
          is_authorized: isAuthorized,
          active_areas: areasRes.areas,
          areas_status: areasRes.status,
          total_active_staff: areasRes.totalStaff,
          upcoming_trainings: trainingsRes.upcoming,
          trainings_status: trainingsRes.status,
        };
      }

      // Build headers for Python microservice with shared secret authentication
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.INQUIRY_SERVICE_SECRET) {
        headers["Authorization"] = `Bearer ${process.env.INQUIRY_SERVICE_SECRET}`;
      }

      try {
        const resp = await fetch(`${serviceUrl}/api/inquiry`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: input.question || "",
            topic_id: input.topicId || undefined,
            history: input.history || [],
            context: liveContext || undefined,
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
            live_synced: dbReadAttempted ? dbReadSucceeded : false,
          };
        }
      } catch {
        // Microservice failed or unreachable
      }

      // Standalone/offline fallback: handle areas or trainings with accurate failure reporting
      const tId = input.topicId?.trim().toLowerCase();
      const qLower = (input.question || "").toLowerCase();

      if (tId === "trainings" || qLower.includes("seminar") || qLower.includes("training")) {
        if (liveContext && liveContext.trainings_status === "failed") {
          return {
            success: false,
            answer: "Live training database records are currently unavailable. Please check the Training Calendar in the portal or contact the SKTI Training Coordinator.",
            topic_id: "trainings",
            title: "Seminars & Trainings",
            match_type: "DB_UNAVAILABLE",
            related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "trainings"),
            candidate_topics: [],
            live_synced: false,
          };
        }

        const upcoming = liveContext?.upcoming_trainings || [];
        let answer = "SPMC SKTI Seminars & Staff Trainings (Live Database):\n\n";
        if (upcoming.length > 0) {
          answer += upcoming.map((u: any) => `• ${u.trainingName} — Scheduled: ${u.scheduledDate}`).join("\n");
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
          live_synced: Boolean(liveContext && liveContext.trainings_status === "success"),
        };
      }

      if (tId === "areas" || qLower.includes("area") || qLower.includes("unit")) {
        if (liveContext && liveContext.areas_status === "failed") {
          return {
            success: false,
            answer: "Clinical area database records are currently unavailable. Please contact the SKTI Nursing Office at local 4135.",
            topic_id: "areas",
            title: "Clinical Units & Areas",
            match_type: "DB_UNAVAILABLE",
            related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "areas"),
            candidate_topics: [],
            live_synced: false,
          };
        }

        const areaList = liveContext?.active_areas || [];
        let answer = "SPMC SKTI Clinical Units & Areas (Live Database):\n\n";
        if (areaList.length > 0) {
          answer += areaList.map((a: any) => {
            const countStr = isAuthorized && a.staffCount !== undefined ? ` (${a.staffCount} active staff assigned)` : "";
            return `• ${a.name}${countStr}`;
          }).join("\n");
          if (isAuthorized && liveContext?.total_active_staff !== undefined) {
            answer += `\n\nTotal Active Staff Tracked: ${liveContext.total_active_staff}`;
          }
        } else {
          answer += "No active clinical areas currently found in the system.";
        }
        return {
          success: true,
          answer,
          topic_id: "areas",
          title: "Clinical Units & Areas",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "areas"),
          candidate_topics: [],
          live_synced: Boolean(liveContext && liveContext.areas_status === "success"),
        };
      }

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
