import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb, activeNurseCondition, INACTIVE_STATUS_SQL_LIST } from "../db";
import {
  areas,
  nurses,
  nurseCredentials,
  nurseTrainings,
  trainingCatalog,
  trainingEvents,
} from "../../drizzle/schema";
import {
  deriveLicenseStatus,
  daysUntilExpiry,
  nurseFullName,
  dateKey,
} from "../../shared/nursetrack";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
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
  action_links?: Array<{ label: string; url: string }>;
}

export const FALLBACK_TOPICS: TopicPill[] = [
  { id: "needs_attention", name: "Needs Attention", short_desc: "Expiring & overdue records" },
  { id: "find_staff", name: "Find Staff", short_desc: "Nurses & attendants" },
  { id: "license_status", name: "License Status", short_desc: "Expiry & renewal" },
  { id: "training_followup", name: "Training Follow-up", short_desc: "Pending & missing evidence" },
  { id: "upcoming_seminars", name: "Upcoming Seminars", short_desc: "Seminars & LDI" },
  { id: "area_assignments", name: "Area Assignments", short_desc: "Staff by clinical unit" },
  { id: "calendar", name: "Calendar", short_desc: "Events & scheduled training" },
  { id: "reports", name: "Reports", short_desc: "Choose & export reports" },
];

const SERVICE_UNAVAILABLE_ANSWER =
  "NurseTrack inquiry service is currently unavailable. For assistance with staff assignments, license registry, or training schedules, please open the respective dashboard module or contact the SKTI Nursing Office at (082) 227-2731 (local 4135).";

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
  const validTaskIds = [
    "needs_attention",
    "find_staff",
    "license_status",
    "training_followup",
    "upcoming_seminars",
    "area_assignments",
    "calendar",
    "reports",
    "trainings",
    "areas",
  ];
  if (tId && validTaskIds.includes(tId)) return true;
  if (!question) return false;
  const q = question.toLowerCase();
  const triggers = [
    "attention", "urgent", "alert", "alerts", "overdue", "staff", "nurse", "nurses", "attendant",
    "license", "licenses", "prc", "renewal", "followup", "certificate", "certificates", "evidence",
    "seminar", "seminars", "workshop", "area", "areas", "unit", "units", "ward", "calendar",
    "event", "events", "today", "report", "reports", "export", "excel"
  ];
  return triggers.some((t) => q.includes(t));
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

/** Identify specific target topic for selective DB loading */
function detectTargetTopic(question?: string, topicId?: string | null): string {
  if (topicId) return topicId.trim().toLowerCase();
  if (!question) return "needs_attention";
  const q = question.toLowerCase();
  if (q.includes("attention") || q.includes("urgent") || q.includes("alert") || q.includes("overdue")) {
    return "needs_attention";
  }
  if (q.includes("find") || q.includes("search") || q.includes("who is") || q.includes("staff") || q.includes("nurse") || q.includes("attendant")) {
    return "find_staff";
  }
  if (q.includes("license") || q.includes("prc") || q.includes("credential")) {
    return "license_status";
  }
  if (q.includes("followup") || q.includes("follow-up") || q.includes("evidence") || q.includes("missing certificate")) {
    return "training_followup";
  }
  if (q.includes("seminar") || q.includes("workshop") || q.includes("ldi")) {
    return "upcoming_seminars";
  }
  if (q.includes("area") || q.includes("unit") || q.includes("ward") || q.includes("station")) {
    return "area_assignments";
  }
  if (q.includes("calendar") || q.includes("today") || q.includes("this week") || q.includes("scheduled")) {
    return "calendar";
  }
  if (q.includes("report") || q.includes("export") || q.includes("excel")) {
    return "reports";
  }
  return "needs_attention";
}

/** Targeted query for active areas and staff counts (3-second deadline) */
export async function getAreaCountsSummary(isAuthorized = false): Promise<{
  status: "success" | "failed";
  areas: Array<{ id: number; name: string; staffCount?: number }>;
  totalStaff?: number;
}> {
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

/** Targeted query for dashboard alerts / action center items (3-second deadline) */
export async function getAlertsSummary(todayManila: string): Promise<{
  status: "success" | "failed";
  alerts?: {
    total: number;
    licenseUrgent: number;
    trainingUrgent: number;
    topItems: Array<{ title: string; severity: string }>;
  };
}> {
  try {
    const fetchAlerts = async () => {
      const dbConn = await getDb();
      let topItems: Array<{ title: string; severity: string }> = [];
      let licenseUrgent = 0;
      let trainingUrgent = 0;

      if (dbConn) {
        const creds = await dbConn
          .select({
            id: nurseCredentials.id,
            expiryDate: nurseCredentials.expiryDate,
            renewalStatus: nurseCredentials.renewalStatus,
            firstName: nurses.firstName,
            lastName: nurses.lastName,
          })
          .from(nurseCredentials)
          .innerJoin(nurses, eq(nurseCredentials.nurseId, nurses.id))
          .where(isNull(nurses.archivedAt));

        for (const c of creds) {
          const d = dateKey(c.expiryDate);
          const status = deriveLicenseStatus(d, todayManila);
          const days = daysUntilExpiry(d, todayManila);
          if (status === "Expired" || status === "Within 6 Months") {
            licenseUrgent++;
            if (topItems.length < 4) {
              topItems.push({
                title: `${c.firstName} ${c.lastName} — license ${status === "Expired" ? "expired" : `expires in ${days}d`} (${c.renewalStatus || "Not Started"})`,
                severity: status === "Expired" ? "urgent" : "attention",
              });
            }
          }
        }

        const trainings = await dbConn
          .select({
            id: nurseTrainings.id,
            scheduledDate: nurseTrainings.scheduledDate,
            expiryDate: nurseTrainings.expiryDate,
            status: nurseTrainings.status,
            trainingName: trainingCatalog.name,
            firstName: nurses.firstName,
            lastName: nurses.lastName,
          })
          .from(nurseTrainings)
          .innerJoin(nurses, eq(nurseTrainings.nurseId, nurses.id))
          .innerJoin(trainingCatalog, eq(nurseTrainings.trainingId, trainingCatalog.id))
          .where(isNull(nurses.archivedAt));

        for (const t of trainings) {
          const schedDate = dateKey(t.scheduledDate);
          const expDate = dateKey(t.expiryDate);
          let urgent = false;
          let label = "";

          if (t.status === "Scheduled" && schedDate && schedDate <= todayManila) {
            urgent = true;
            label = `${t.firstName} ${t.lastName} — overdue training ${t.trainingName} (was ${schedDate})`;
          } else if (t.status === "Completed" && expDate && daysUntilExpiry(expDate, todayManila) <= 0) {
            urgent = true;
            label = `${t.firstName} ${t.lastName} — certification expired for ${t.trainingName}`;
          }

          if (urgent) {
            trainingUrgent++;
            if (topItems.length < 6) {
              topItems.push({ title: label, severity: "attention" });
            }
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const credRows = sqlite.prepare(
            `SELECT nc.id, nc.expiryDate, nc.renewalStatus, n.firstName, n.lastName
             FROM nurseCredentials nc
             JOIN nurses n ON nc.nurseId = n.id
             WHERE n.archivedAt IS NULL`
          ).all() as any[];

          for (const c of credRows) {
            const d = dateKey(c.expiryDate);
            const status = deriveLicenseStatus(d, todayManila);
            const days = daysUntilExpiry(d, todayManila);
            if (status === "Expired" || status === "Within 6 Months") {
              licenseUrgent++;
              if (topItems.length < 4) {
                topItems.push({
                  title: `${c.firstName} ${c.lastName} — license ${status === "Expired" ? "expired" : `expires in ${days}d`}`,
                  severity: status === "Expired" ? "urgent" : "attention",
                });
              }
            }
          }

          const trainRows = sqlite.prepare(
            `SELECT nt.id, nt.scheduledDate, nt.expiryDate, nt.status, tc.name as trainingName, n.firstName, n.lastName
             FROM nurseTrainings nt
             JOIN nurses n ON nt.nurseId = n.id
             JOIN trainingCatalog tc ON nt.trainingId = tc.id
             WHERE n.archivedAt IS NULL`
          ).all() as any[];

          for (const t of trainRows) {
            const schedDate = dateKey(t.scheduledDate);
            const expDate = dateKey(t.expiryDate);
            if (t.status === "Scheduled" && schedDate && schedDate <= todayManila) {
              trainingUrgent++;
              if (topItems.length < 6) {
                topItems.push({
                  title: `${t.firstName} ${t.lastName} — overdue training ${t.trainingName} (${schedDate})`,
                  severity: "attention",
                });
              }
            } else if (t.status === "Completed" && expDate && daysUntilExpiry(expDate, todayManila) <= 0) {
              trainingUrgent++;
              if (topItems.length < 6) {
                topItems.push({
                  title: `${t.firstName} ${t.lastName} — cert expired for ${t.trainingName}`,
                  severity: "attention",
                });
              }
            }
          }
        }
      }

      return {
        status: "success" as const,
        alerts: {
          total: licenseUrgent + trainingUrgent,
          licenseUrgent,
          trainingUrgent,
          topItems,
        },
      };
    };

    return await withTimeout(fetchAlerts(), 3000, "Alerts database query timed out");
  } catch {
    return { status: "failed" };
  }
}

/** Targeted query for staff directory and search (3-second deadline) */
export async function getStaffSummaryOrSearch(
  isAuthorized: boolean,
  queryTerm?: string
): Promise<{
  status: "success" | "failed";
  staffSummary?: { total: number; rnCount: number; naCount: number };
  matchedStaff?: Array<{ name: string; staffType: string; areaName?: string; prcLicenseNumber?: string }>;
}> {
  if (!isAuthorized) {
    return { status: "success" };
  }
  try {
    const fetchStaff = async () => {
      const qClean = queryTerm?.trim().toLowerCase();
      // Extract search tokens if user typed "find nurse Maria" or "search Dela Cruz"
      const cleanedSearch = qClean
        ? qClean
            .replace(/^(find|search|look up|who is)\s+(nurse|staff|attendant)?\s*/i, "")
            .trim()
        : "";

      const dbConn = await getDb();
      if (dbConn) {
        const activeCondition = and(isNull(nurses.archivedAt), activeNurseCondition());
        if (cleanedSearch && cleanedSearch.length >= 2) {
          const matched = await dbConn
            .select({
              id: nurses.id,
              firstName: nurses.firstName,
              lastName: nurses.lastName,
              staffType: nurses.staffType,
              employeeId: nurses.employeeId,
              areaName: areas.name,
            })
            .from(nurses)
            .leftJoin(areas, eq(nurses.currentAreaId, areas.id))
            .where(
              and(
                activeCondition,
                sql`lower(${nurses.firstName} || ' ' || ${nurses.lastName}) LIKE ${`%${cleanedSearch}%`} OR lower(${nurses.employeeId}) LIKE ${`%${cleanedSearch}%`}`
              )
            )
            .limit(5);

          return {
            status: "success" as const,
            matchedStaff: matched.map((m) => ({
              name: nurseFullName(m),
              staffType: m.staffType || "Staff",
              areaName: m.areaName || undefined,
            })),
          };
        }

        // Summary counts
        const allActive = await dbConn
          .select({ staffType: nurses.staffType })
          .from(nurses)
          .where(activeCondition);

        const rnCount = allActive.filter((n) => n.staffType === "Registered Nurse").length;
        const naCount = allActive.filter((n) => n.staffType === "Nursing Attendant").length;

        return {
          status: "success" as const,
          staffSummary: {
            total: allActive.length,
            rnCount,
            naCount,
          },
        };
      }

      const sqlite = getSqliteDb();
      if (sqlite) {
        if (cleanedSearch && cleanedSearch.length >= 2) {
          const matched = sqlite.prepare(
            `SELECT n.id, n.firstName, n.lastName, n.staffType, n.employeeId, a.name as areaName
             FROM nurses n
             LEFT JOIN areas a ON n.currentAreaId = a.id
             WHERE n.archivedAt IS NULL AND (lower(n.firstName || ' ' || n.lastName) LIKE ? OR lower(n.employeeId) LIKE ?)
             LIMIT 5`
          ).all(`%${cleanedSearch}%`, `%${cleanedSearch}%`) as any[];

          return {
            status: "success" as const,
            matchedStaff: matched.map((m) => ({
              name: nurseFullName(m),
              staffType: m.staffType || "Staff",
              areaName: m.areaName || undefined,
            })),
          };
        }

        const counts = sqlite.prepare(
          `SELECT staffType, COUNT(*) as count FROM nurses WHERE archivedAt IS NULL GROUP BY staffType`
        ).all() as any[];

        let rnCount = 0;
        let naCount = 0;
        let total = 0;
        for (const c of counts) {
          const cnt = Number(c.count);
          total += cnt;
          if (c.staffType === "Registered Nurse") rnCount += cnt;
          if (c.staffType === "Nursing Attendant") naCount += cnt;
        }

        return {
          status: "success" as const,
          staffSummary: { total, rnCount, naCount },
        };
      }

      return { status: "success" as const };
    };

    return await withTimeout(fetchStaff(), 3000, "Staff database query timed out");
  } catch {
    return { status: "failed" };
  }
}

/** Targeted query for license compliance summary (3-second deadline) */
export async function getLicensesSummary(todayManila: string): Promise<{
  status: "success" | "failed";
  licenses?: {
    expired: number;
    within6Months: number;
    within1Year: number;
    valid: number;
    total: number;
    urgentItems: Array<{ nurseName: string; status: string; daysText: string }>;
  };
}> {
  try {
    const fetchLicenses = async () => {
      const dbConn = await getDb();
      let expired = 0;
      let within6Months = 0;
      let within1Year = 0;
      let valid = 0;
      let total = 0;
      const urgentItems: Array<{ nurseName: string; status: string; daysText: string }> = [];

      if (dbConn) {
        const rows = await dbConn
          .select({
            id: nurseCredentials.id,
            expiryDate: nurseCredentials.expiryDate,
            firstName: nurses.firstName,
            lastName: nurses.lastName,
          })
          .from(nurseCredentials)
          .innerJoin(nurses, eq(nurseCredentials.nurseId, nurses.id))
          .where(isNull(nurses.archivedAt));

        total = rows.length;
        for (const r of rows) {
          const d = dateKey(r.expiryDate);
          const status = deriveLicenseStatus(d, todayManila);
          const days = daysUntilExpiry(d, todayManila);
          if (status === "Expired") {
            expired++;
            if (urgentItems.length < 5) {
              urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: "Expired" });
            }
          } else if (status === "Within 6 Months") {
            within6Months++;
            if (urgentItems.length < 5) {
              urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: `expires in ${days} days` });
            }
          } else if (status === "Within 1 Year") {
            within1Year++;
          } else {
            valid++;
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT nc.id, nc.expiryDate, n.firstName, n.lastName
             FROM nurseCredentials nc
             JOIN nurses n ON nc.nurseId = n.id
             WHERE n.archivedAt IS NULL`
          ).all() as any[];

          total = rows.length;
          for (const r of rows) {
            const d = dateKey(r.expiryDate);
            const status = deriveLicenseStatus(d, todayManila);
            const days = daysUntilExpiry(d, todayManila);
            if (status === "Expired") {
              expired++;
              if (urgentItems.length < 5) {
                urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: "Expired" });
              }
            } else if (status === "Within 6 Months") {
              within6Months++;
              if (urgentItems.length < 5) {
                urgentItems.push({ nurseName: `${r.firstName} ${r.lastName}`, status, daysText: `expires in ${days} days` });
              }
            } else if (status === "Within 1 Year") {
              within1Year++;
            } else {
              valid++;
            }
          }
        }
      }

      return {
        status: "success" as const,
        licenses: {
          expired,
          within6Months,
          within1Year,
          valid,
          total,
          urgentItems,
        },
      };
    };

    return await withTimeout(fetchLicenses(), 3000, "License database query timed out");
  } catch {
    return { status: "failed" };
  }
}

/** Targeted query for training follow-up items (3-second deadline) */
export async function getTrainingFollowupSummary(): Promise<{
  status: "success" | "failed";
  followup?: {
    counts: {
      total: number;
      pendingResponse: number;
      cannotAttend: number;
      missingEmail: number;
      evidenceReview: number;
      missed: number;
    };
  };
}> {
  try {
    const fetchFollowup = async () => {
      const dbConn = await getDb();
      let total = 0;
      let pendingResponse = 0;
      let cannotAttend = 0;
      let missingEmail = 0;
      let evidenceReview = 0;
      let missed = 0;

      if (dbConn) {
        const rows = await dbConn
          .select({
            id: nurseTrainings.id,
            status: nurseTrainings.status,
            staffResponse: nurseTrainings.staffResponse,
            evidenceStatus: nurseTrainings.evidenceStatus,
            attendanceOutcome: nurseTrainings.attendanceOutcome,
            accountEmail: nurses.accountEmail,
          })
          .from(nurseTrainings)
          .innerJoin(nurses, eq(nurseTrainings.nurseId, nurses.id))
          .where(and(isNull(nurses.archivedAt), sql`${nurseTrainings.status} != 'Cancelled'`));

        total = rows.length;
        for (const r of rows) {
          if (!r.staffResponse || r.staffResponse === "Pending") pendingResponse++;
          if (r.staffResponse === "Cannot attend") cannotAttend++;
          if (!r.accountEmail) missingEmail++;
          if (r.evidenceStatus === "Submitted") evidenceReview++;
          if (r.attendanceOutcome === "Missed") missed++;
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT nt.id, nt.status, nt.staffResponse, nt.evidenceStatus, nt.attendanceOutcome, n.accountEmail
             FROM nurseTrainings nt
             JOIN nurses n ON nt.nurseId = n.id
             WHERE n.archivedAt IS NULL AND nt.status != 'Cancelled'`
          ).all() as any[];

          total = rows.length;
          for (const r of rows) {
            if (!r.staffResponse || r.staffResponse === "Pending") pendingResponse++;
            if (r.staffResponse === "Cannot attend") cannotAttend++;
            if (!r.accountEmail) missingEmail++;
            if (r.evidenceStatus === "Submitted") evidenceReview++;
            if (r.attendanceOutcome === "Missed" || r.attendanceOutcome === "missed") missed++;
          }
        }
      }

      return {
        status: "success" as const,
        followup: {
          counts: {
            total,
            pendingResponse,
            cannotAttend,
            missingEmail,
            evidenceReview,
            missed,
          },
        },
      };
    };

    return await withTimeout(fetchFollowup(), 3000, "Training follow-up query timed out");
  } catch {
    return { status: "failed" };
  }
}

/** Targeted query for upcoming scheduled seminars (3-second deadline) */
export async function getUpcomingSeminarsSummary(todayManila: string): Promise<{
  status: "success" | "failed";
  seminars: Array<{ id: number; title: string; dateStr: string; venue?: string; enrolledCount: number }>;
}> {
  try {
    const fetchSeminars = async () => {
      const dbConn = await getDb();
      if (dbConn) {
        const rows = await dbConn
          .select({
            id: trainingEvents.id,
            venue: trainingEvents.venue,
            startDate: trainingEvents.startDate,
            endDate: trainingEvents.endDate,
            title: trainingCatalog.name,
          })
          .from(trainingEvents)
          .innerJoin(trainingCatalog, eq(trainingCatalog.id, trainingEvents.trainingId))
          .where(sql`(${trainingEvents.endDate} >= (${todayManila})::date OR ${trainingEvents.startDate} >= (${todayManila})::date)`)
          .orderBy(asc(trainingEvents.startDate))
          .limit(5);

        const eventIds = rows.map((r) => r.id);
        const countMap = new Map<number, number>();
        if (eventIds.length > 0) {
          const counts = await dbConn
            .select({ eventId: nurseTrainings.eventId, count: sql<number>`count(*)::int` })
            .from(nurseTrainings)
            .where(sql`${nurseTrainings.eventId} IN (${sql.join(eventIds.map((id) => sql`${id}`), sql`, `)})`)
            .groupBy(nurseTrainings.eventId);
          for (const c of counts) {
            if (c.eventId) countMap.set(c.eventId, Number(c.count));
          }
        }

        return {
          status: "success" as const,
          seminars: rows.map((r) => ({
            id: r.id,
            title: r.title,
            dateStr: dateKey(r.startDate),
            venue: r.venue || undefined,
            enrolledCount: countMap.get(r.id) ?? 0,
          })),
        };
      }

      const sqlite = getSqliteDb();
      if (sqlite) {
        const rows = sqlite.prepare(
          `SELECT te.id, te.venue, te.startDate, te.endDate, tc.name as title
           FROM trainingEvents te
           JOIN trainingCatalog tc ON te.trainingId = tc.id
           WHERE te.endDate >= ? OR te.startDate >= ?
           ORDER BY te.startDate ASC
           LIMIT 5`
        ).all(todayManila, todayManila) as any[];

        return {
          status: "success" as const,
          seminars: rows.map((r) => ({
            id: r.id,
            title: r.title,
            dateStr: dateKey(r.startDate),
            venue: r.venue || undefined,
            enrolledCount: 0,
          })),
        };
      }

      return { status: "success" as const, seminars: [] };
    };

    return await withTimeout(fetchSeminars(), 3000, "Seminars query timed out");
  } catch {
    return { status: "failed", seminars: [] };
  }
}

/** Targeted query for calendar events (today & this week) */
export async function getCalendarSummary(todayManila: string): Promise<{
  status: "success" | "failed";
  calendar?: {
    todayEvents: Array<{ title: string }>;
    weekEvents: Array<{ title: string; date: string }>;
  };
}> {
  try {
    const fetchCalendar = async () => {
      const todayDateObj = new Date(`${todayManila}T00:00:00`);
      const weekEndDateObj = new Date(todayDateObj.getTime() + 7 * 86400000);
      const weekEndStr = getTodayManila(weekEndDateObj);

      const dbConn = await getDb();
      const todayEvents: Array<{ title: string }> = [];
      const weekEvents: Array<{ title: string; date: string }> = [];

      if (dbConn) {
        // Seminars
        const seminars = await dbConn
          .select({ title: trainingCatalog.name, startDate: trainingEvents.startDate, venue: trainingEvents.venue })
          .from(trainingEvents)
          .innerJoin(trainingCatalog, eq(trainingEvents.trainingId, trainingCatalog.id))
          .where(sql`(${trainingEvents.startDate} >= (${todayManila})::date AND ${trainingEvents.startDate} <= (${weekEndStr})::date)`)
          .limit(10);

        for (const s of seminars) {
          const d = dateKey(s.startDate);
          if (d === todayManila) {
            todayEvents.push({ title: `Seminar: ${s.title}${s.venue ? ` @ ${s.venue}` : ""}` });
          } else {
            weekEvents.push({ title: `Seminar: ${s.title}`, date: d });
          }
        }
      } else {
        const sqlite = getSqliteDb();
        if (sqlite) {
          const rows = sqlite.prepare(
            `SELECT tc.name as title, te.startDate, te.venue
             FROM trainingEvents te
             JOIN trainingCatalog tc ON te.trainingId = tc.id
             WHERE te.startDate >= ? AND te.startDate <= ?
             LIMIT 10`
          ).all(todayManila, weekEndStr) as any[];

          for (const s of rows) {
            const d = dateKey(s.startDate);
            if (d === todayManila) {
              todayEvents.push({ title: `Seminar: ${s.title}${s.venue ? ` @ ${s.venue}` : ""}` });
            } else {
              weekEvents.push({ title: `Seminar: ${s.title}`, date: d });
            }
          }
        }
      }

      return {
        status: "success" as const,
        calendar: {
          todayEvents,
          weekEvents,
        },
      };
    };

    return await withTimeout(fetchCalendar(), 3000, "Calendar query timed out");
  } catch {
    return { status: "failed" };
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
        const target = detectTargetTopic(input.question, input.topicId);
        liveContext = {
          today_manila: todayManila,
          is_authorized: isAuthorized,
        };

        if (target === "needs_attention") {
          const res = await getAlertsSummary(todayManila);
          liveContext.alerts_status = res.status;
          liveContext.alerts_summary = res.alerts;
          dbReadSucceeded = res.status === "success";
        } else if (target === "find_staff") {
          const res = await getStaffSummaryOrSearch(isAuthorized, input.question);
          liveContext.staff_status = res.status;
          liveContext.staff_summary = res.staffSummary;
          liveContext.matched_staff = res.matchedStaff;
          dbReadSucceeded = res.status === "success";
        } else if (target === "license_status") {
          const res = await getLicensesSummary(todayManila);
          liveContext.licenses_status = res.status;
          liveContext.licenses_summary = res.licenses;
          dbReadSucceeded = res.status === "success";
        } else if (target === "training_followup") {
          const res = await getTrainingFollowupSummary();
          liveContext.followup_status = res.status;
          liveContext.followup_summary = res.followup;
          dbReadSucceeded = res.status === "success";
        } else if (target === "upcoming_seminars" || target === "trainings") {
          const res = await getUpcomingSeminarsSummary(todayManila);
          liveContext.seminars_status = res.status;
          liveContext.seminar_events = res.seminars;
          dbReadSucceeded = res.status === "success";
        } else if (target === "area_assignments" || target === "areas") {
          const res = await getAreaCountsSummary(isAuthorized);
          liveContext.areas_status = res.status;
          liveContext.active_areas = res.areas;
          liveContext.total_active_staff = res.totalStaff;
          dbReadSucceeded = res.status === "success";
        } else if (target === "calendar") {
          const res = await getCalendarSummary(todayManila);
          liveContext.calendar_status = res.status;
          liveContext.calendar_summary = res.calendar;
          dbReadSucceeded = res.status === "success";
        } else {
          // reports / generic
          dbReadSucceeded = true;
        }
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
            success: Boolean(json.success ?? true),
            answer: json.answer || "",
            topic_id: json.topic_id ?? null,
            title: json.title || "NurseTrack Assistant",
            match_type: json.match_type || "UNKNOWN",
            related_topics: json.related_topics || [],
            candidate_topics: json.candidate_topics || [],
            contact_snippet: json.contact_snippet,
            live_synced: dbReadAttempted ? dbReadSucceeded : false,
            action_links: json.action_links || [],
          };
        }
      } catch {
        // Microservice failed or unreachable
      }

      // Offline / standalone fallback handler
      const target = detectTargetTopic(input.question, input.topicId);
      if (!isAuthorized && ["needs_attention", "find_staff", "license_status", "training_followup"].includes(target)) {
        return {
          success: true,
          answer: "Supervisor authentication required to view internal staff and compliance records. Please sign in to NurseTrack.",
          topic_id: target,
          title: "Authentication Required",
          match_type: "UNAUTHORIZED",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== target),
          candidate_topics: [],
          live_synced: false,
          action_links: [{ label: "Supervisor Sign In", url: "/dashboard" }],
        };
      }

      if (target === "needs_attention") {
        const alerts = liveContext?.alerts_summary;
        const ans = alerts
          ? `NurseTrack Action Center: ${alerts.total} item(s) need attention (${alerts.licenseUrgent} expiring/expired licenses, ${alerts.trainingUrgent} overdue trainings).`
          : "Action Center: Expiring licenses, overdue trainings, and unassigned staff require supervisor review.";
        return {
          success: true,
          answer: ans,
          topic_id: "needs_attention",
          title: "Needs Attention",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "needs_attention"),
          candidate_topics: [],
          live_synced: Boolean(liveContext?.alerts_status === "success"),
          action_links: [{ label: "Open Dashboard Action Center", url: "/dashboard" }],
        };
      }

      if (target === "license_status") {
        const l = liveContext?.licenses_summary;
        const ans = l
          ? `PRC License Compliance: ${l.expired} expired, ${l.within6Months} expiring within 6 months, ${l.valid} valid (${l.total} total active credentials).`
          : "PRC License Registry: Monitors licenses against hospital compliance thresholds.";
        return {
          success: true,
          answer: ans,
          topic_id: "license_status",
          title: "License Status",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "license_status"),
          candidate_topics: [],
          live_synced: Boolean(liveContext?.licenses_status === "success"),
          action_links: [{ label: "Open License Registry", url: "/licenses" }],
        };
      }

      if (target === "training_followup") {
        const f = liveContext?.followup_summary?.counts;
        const ans = f
          ? `Training Follow-up: ${f.pendingResponse} pending staff response, ${f.evidenceReview} certificates uploaded, ${f.cannotAttend} cannot attend.`
          : "Training Follow-up: Review submitted certificates and attendance outcomes.";
        return {
          success: true,
          answer: ans,
          topic_id: "training_followup",
          title: "Training Follow-up",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "training_followup"),
          candidate_topics: [],
          live_synced: Boolean(liveContext?.followup_status === "success"),
          action_links: [{ label: "Open Training Follow-up", url: "/trainings" }],
        };
      }

      if (target === "upcoming_seminars" || target === "trainings") {
        const s = liveContext?.seminar_events || [];
        const ans = s.length > 0
          ? `Upcoming Seminars:\n${s.map((ev: any) => `• ${ev.title} — ${ev.dateStr}${ev.venue ? ` @ ${ev.venue}` : ""}`).join("\n")}`
          : "Upcoming Seminars: There are currently no upcoming hospital seminars or workshops scheduled in the database.";
        return {
          success: true,
          answer: ans,
          topic_id: "upcoming_seminars",
          title: "Upcoming Seminars",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "upcoming_seminars"),
          candidate_topics: [],
          live_synced: Boolean(liveContext?.seminars_status === "success"),
          action_links: [{ label: "Open Seminar Schedule", url: "/seminars" }],
        };
      }

      if (target === "area_assignments" || target === "areas") {
        const areaList = liveContext?.active_areas || [];
        let ans = "SPMC SKTI Clinical Units & Areas (Live Database):\n\n";
        if (areaList.length > 0) {
          ans += areaList
            .map((a: any) => {
              const countStr = isAuthorized && a.staffCount !== undefined ? ` (${a.staffCount} active staff assigned)` : "";
              return `• ${a.name}${countStr}`;
            })
            .join("\n");
          if (isAuthorized && liveContext?.total_active_staff !== undefined) {
            ans += `\n\nTotal Active Staff Tracked: ${liveContext.total_active_staff}`;
          }
        } else {
          ans += "No active clinical areas currently found in the system.";
        }
        return {
          success: true,
          answer: ans,
          topic_id: "area_assignments",
          title: "Area Assignments",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "area_assignments"),
          candidate_topics: [],
          live_synced: Boolean(liveContext?.areas_status === "success"),
          action_links: [{ label: "Manage Clinical Units", url: "/areas" }],
        };
      }

      if (target === "calendar") {
        return {
          success: true,
          answer: "Master Calendar displays hospital operational events across daily, weekly, and monthly views.",
          topic_id: "calendar",
          title: "Calendar",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "calendar"),
          candidate_topics: [],
          live_synced: true,
          action_links: [{ label: "Open Master Calendar", url: "/calendar" }],
        };
      }

      if (target === "reports") {
        return {
          success: true,
          answer: "NurseTrack includes 6 verified compliance reports: License Status, Expiring & Due Licenses, Training Compliance, Area Exposure, Training Summary, and Area Transfer Log. All exportable to Excel (.xlsx).",
          topic_id: "reports",
          title: "Reports",
          match_type: "EXACT_TOPIC",
          related_topics: FALLBACK_TOPICS.filter((t) => t.id !== "reports"),
          candidate_topics: [],
          live_synced: true,
          action_links: [{ label: "Open Reports & Exports", url: "/reports" }],
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
        contact_snippet: "SKTI Nursing Office: (082) 227-2731 local 4135",
        live_synced: false,
        action_links: [{ label: "Open Dashboard", url: "/dashboard" }],
      };
    }),
});
