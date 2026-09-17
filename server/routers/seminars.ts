import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, isNull, lte, notInArray } from "drizzle-orm";
import { z } from "zod";
import {
  areas,
  activityLog,
  nurseTrainings,
  nurses,
  trainingCatalog,
  trainingEvents,
} from "../../drizzle/schema";
import {
  dateKey,
  nurseFullName,
  PARTICIPATION_ROLES,
  STAFF_TYPES,
  TARGET_STAFF_TYPES,
} from "../../shared/nursetrack";
import { adminProcedure, router } from "../_core/trpc";
import { deleteNurseTraining, deleteTrainingEvent, getBatchClient, getDb, getNurseTrainingById, logActivity } from "../db";
import { getSqliteDb } from "../localDb";
import { storageDelete } from "../storage";
import {
  getLocalSeminarsList,
  getLocalSeminarDetail,
  getLocalSeminarMatrix,
  getLocalMonthlySummary,
  getLocalQuarterlyLedger,
} from "../sqliteHelpers";
import {
  checkTrainingConflicts,
  enqueueTrainingNotice,
  createMilestonesForAssignment,
  dispatchSingleOutboxItem,
} from "../trainingReminders";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Invalid calendar date.");
const dateInput = z.union([z.date(), dateString]).transform((value) =>
  value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00`),
);
const optionalDateInput = dateInput.optional();
const attendanceStatuses = ["Scheduled", "Completed", "Expired", "Cancelled"] as const;
const inactiveStatuses: ("Archived" | "Resigned" | "Retired" | "Transferred" | "Rotated")[] = [
  "Archived", "Resigned", "Retired", "Transferred", "Rotated",
];

function validateRange(startDate: Date, endDate: Date) {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid seminar date." });
  }
  if (endDate < startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "End date cannot be before start date." });
  }
}

export const seminarsRouter = router({
  list: adminProcedure
    .input(z.object({ from: optionalDateInput, to: optionalDateInput }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getLocalSeminarsList(input as any);
      }
      const conditions = [];
      if (input?.from) conditions.push(gte(trainingEvents.endDate, input.from));
      if (input?.to) conditions.push(lte(trainingEvents.startDate, input.to));
      const rows = await db
        .select({ event: trainingEvents, training: trainingCatalog })
        .from(trainingEvents)
        .innerJoin(trainingCatalog, eq(trainingCatalog.id, trainingEvents.trainingId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(trainingEvents.startDate), asc(trainingCatalog.name));
      const records = await db.select({ eventId: nurseTrainings.eventId, status: nurseTrainings.status }).from(nurseTrainings);
      const counts = new Map<number, { total: number; completed: number }>();
      for (const record of records) {
        if (!record.eventId) continue;
        const count = counts.get(record.eventId) ?? { total: 0, completed: 0 };
        count.total++;
        if (record.status === "Completed") count.completed++;
        counts.set(record.eventId, count);
      }
      return rows.map((row) => ({ ...row, attendance: counts.get(row.event.id) ?? { total: 0, completed: 0 } }));
    }),

  create: adminProcedure
    .input(z.object({
      trainingId: z.number().int().positive(),
      provider: z.string().max(128).optional(),
      venue: z.string().max(256).optional(),
      startDate: dateInput,
      endDate: dateInput,
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      targetStaffType: z.enum(TARGET_STAFF_TYPES).optional(),
      remarks: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      validateRange(input.startDate, input.endDate);
      if (dateKey(input.startDate) === dateKey(input.endDate) && input.startTime && input.endTime && input.endTime < input.startTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End time cannot be before start time." });
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [training] = await db.select().from(trainingCatalog).where(eq(trainingCatalog.id, input.trainingId)).limit(1);
      if (!training) throw new TRPCError({ code: "NOT_FOUND", message: "Training catalog item not found." });
      const result = await db.insert(trainingEvents).values({
        ...input,
        provider: input.provider ?? null,
        venue: input.venue ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        targetStaffType: input.targetStaffType ?? "All",
        remarks: input.remarks ?? null,
      }).returning({ id: trainingEvents.id });
      const id = Number(result[0].id);
      await logActivity({
        supervisorId: ctx.user.id,
        actionType: "seminar.created",
        entityType: "trainingEvent",
        entityId: id,
        summary: `${training.kind} scheduled: ${training.name} (${dateKey(input.startDate)})`,
      });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      provider: z.string().max(128).optional().nullable(),
      venue: z.string().max(256).optional().nullable(),
      startDate: dateInput.optional(),
      endDate: dateInput.optional(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
      targetStaffType: z.enum(TARGET_STAFF_TYPES).optional(),
      remarks: z.string().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const sqlite = getSqliteDb();
        const existing = sqlite.prepare("SELECT * FROM trainingEvents WHERE id = ?").get(input.id) as any;
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
        const start = input.startDate ? dateKey(input.startDate) : existing.startDate;
        const end = input.endDate ? dateKey(input.endDate) : existing.endDate;
        if (start && end && end < start) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "End date cannot be before start date." });
        }
        sqlite.prepare(`
          UPDATE trainingEvents
          SET provider = ?, venue = ?, startDate = ?, endDate = ?, startTime = ?, endTime = ?, targetStaffType = ?, remarks = ?
          WHERE id = ?
        `).run(
          input.provider !== undefined ? input.provider : existing.provider,
          input.venue !== undefined ? input.venue : existing.venue,
          start,
          end,
          input.startTime !== undefined ? input.startTime : existing.startTime,
          input.endTime !== undefined ? input.endTime : existing.endTime,
          input.targetStaffType ?? existing.targetStaffType,
          input.remarks !== undefined ? input.remarks : existing.remarks,
          input.id
        );
        return { success: true };
      }

      const [existing] = await db.select().from(trainingEvents).where(eq(trainingEvents.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });

      const startDate = input.startDate ?? existing.startDate;
      const endDate = input.endDate ?? existing.endDate;
      validateRange(startDate, endDate);

      const startTime = input.startTime !== undefined ? input.startTime : existing.startTime;
      const endTime = input.endTime !== undefined ? input.endTime : existing.endTime;
      if (dateKey(startDate) === dateKey(endDate) && startTime && endTime && endTime < startTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End time cannot be before start time." });
      }

      await db.update(trainingEvents).set({
        provider: input.provider !== undefined ? input.provider : existing.provider,
        venue: input.venue !== undefined ? input.venue : existing.venue,
        startDate,
        endDate,
        startTime,
        endTime,
        targetStaffType: input.targetStaffType ?? existing.targetStaffType,
        remarks: input.remarks !== undefined ? input.remarks : existing.remarks,
      }).where(eq(trainingEvents.id, input.id));

      await logActivity({
        supervisorId: ctx.user.id,
        actionType: "seminar.updated",
        entityType: "trainingEvent",
        entityId: input.id,
        summary: `Seminar updated (event #${input.id})`,
      });

      return { success: true } as const;
    }),

  deleteEvent: adminProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteTrainingEvent(input.eventId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      await logActivity({
        supervisorId: ctx.user.id,
        actionType: "seminar.deleted",
        entityType: "trainingEvent",
        entityId: input.eventId,
        summary: `${deleted.training.kind} permanently deleted: ${deleted.training.name} (${dateKey(deleted.event.startDate)}), including ${deleted.attendanceDeleted} attendance record(s)`,
      });
      return { success: true, attendanceDeleted: deleted.attendanceDeleted } as const;
    }),

  detail: adminProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pg = getBatchClient();
      if (pg) {
        const queries = [
          `select te.id, te."trainingId", te.provider, te.venue,
                  te."startDate"::text as "startDate", te."endDate"::text as "endDate",
                  te."startTime", te."endTime", te."targetStaffType", te.remarks,
                  tc.id as "catalogId", tc.name as "catalogName", tc.category as "catalogCategory", tc.kind as "catalogKind"
             from nursetrack."trainingEvents" te
            inner join nursetrack."trainingCatalog" tc on tc.id = te."trainingId"
            where te.id = ${input.eventId}
            limit 1`,
          `select t.id, t."nurseId", t."trainingId", t."eventId", t."participationRole",
                  t."completionDate"::text as "completionDate", t."scheduledDate"::text as "scheduledDate",
                  t.status, t."trainingHours", t."cpdUnits", t.remarks
             from nursetrack."nurseTrainings" t
            where t."eventId" = ${input.eventId}
            order by t."completionDate" desc nulls last`,
          `select t.id, t."nurseId", t."trainingId", t."eventId", t."participationRole",
                  t."completionDate"::text as "completionDate", t."scheduledDate"::text as "scheduledDate",
                  t.status, t."trainingHours", t."cpdUnits", t.remarks
             from nursetrack."nurseTrainings" t
            where t."trainingId" = (select "trainingId" from nursetrack."trainingEvents" where id = ${input.eventId})
            order by t."completionDate" desc nulls last`,
          `select n.id, n."firstName", n."middleName", n."lastName", n.suffix,
                  n."staffType", n."employmentStatus", n."currentAreaId", n."archivedAt"
             from nursetrack.nurses n
            order by n."lastName" asc, n."firstName" asc`,
          `select a.id, a.name from nursetrack.areas a order by a."sortOrder"`,
          `select e.id, e."startDate"::text as "startDate", e."endDate"::text as "endDate"
             from nursetrack."trainingEvents" e
            where e."trainingId" = (select "trainingId" from nursetrack."trainingEvents" where id = ${input.eventId})`,
        ];

        const sets = (await pg.unsafe(queries.join(";\n")).simple()) as unknown as [
          any[], // selectedEventRows
          any[], // records
          any[], // allTrainingRecords
          any[], // staff
          any[], // areaRows
          any[], // relatedEvents
        ];

        const [selectedRows, records, allTrainingRecords, staff, areaRows, relatedEvents] = sets;
        const selected = selectedRows[0];
        if (!selected) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });

        const staffById = new Map(staff.map((person: any) => [person.id, person]));
        const areaById = new Map(areaRows.map((area: any) => [area.id, area]));

        const attendees = records.map((record: any) => {
          const person = staffById.get(record.nurseId);
          return {
            ...record,
            staffName: person ? nurseFullName(person) : "Unknown staff",
            staffType: person?.staffType ?? "Registered Nurse",
            areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
          };
        });

        const eventById = new Map(relatedEvents.map((event: any) => [event.id, event]));
        const allAttendees = allTrainingRecords.map((record: any) => {
          const person = staffById.get(record.nurseId);
          const occurrence = record.eventId ? eventById.get(record.eventId) : undefined;
          return {
            ...record,
            staffName: person ? nurseFullName(person) : "Unknown staff",
            staffType: person?.staffType ?? "Registered Nurse",
            areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
            occurrenceStartDate: occurrence?.startDate ?? record.scheduledDate,
            occurrenceEndDate: occurrence?.endDate ?? record.scheduledDate,
          };
        });

        const completedIds = new Set(records.filter((record: any) => record.status === "Completed").map((record: any) => record.nurseId));
        const inactive = new Set<string>(inactiveStatuses);
        const missing = staff
          .filter((person: any) => !person.archivedAt)
          .filter((person: any) => !inactive.has(person.employmentStatus))
          .filter((person: any) => selected.targetStaffType === "All" || person.staffType === selected.targetStaffType)
          .filter((person: any) => !completedIds.has(person.id))
          .map((person: any) => ({
            id: person.id,
            staffName: nurseFullName(person),
            staffType: person.staffType,
            areaName: person.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
          }));

        return {
          event: {
            id: selected.id,
            trainingId: selected.trainingId,
            provider: selected.provider,
            venue: selected.venue,
            startDate: selected.startDate,
            endDate: selected.endDate,
            startTime: selected.startTime,
            endTime: selected.endTime,
            targetStaffType: selected.targetStaffType,
            remarks: selected.remarks,
          },
          training: {
            id: selected.catalogId,
            name: selected.catalogName,
            category: selected.catalogCategory,
            kind: selected.catalogKind,
          },
          attendees,
          allAttendees,
          missing,
        };
      }

      const db = await getDb();
      if (!db) {
        const detail = getLocalSeminarDetail(input.eventId);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
        return detail;
      }
      const [selected] = await db
        .select({ event: trainingEvents, training: trainingCatalog })
        .from(trainingEvents)
        .innerJoin(trainingCatalog, eq(trainingCatalog.id, trainingEvents.trainingId))
        .where(eq(trainingEvents.id, input.eventId))
        .limit(1);
      if (!selected) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      const [records, allTrainingRecords, staff, areaRows, relatedEvents] = await Promise.all([
        db.select().from(nurseTrainings).where(eq(nurseTrainings.eventId, input.eventId)).orderBy(desc(nurseTrainings.completionDate)),
        db.select().from(nurseTrainings).where(eq(nurseTrainings.trainingId, selected.training.id)).orderBy(desc(nurseTrainings.completionDate)),
        db.select().from(nurses).orderBy(asc(nurses.lastName), asc(nurses.firstName)),
        db.select().from(areas),
        db.select().from(trainingEvents).where(eq(trainingEvents.trainingId, selected.training.id)),
      ]);
      const staffById = new Map(staff.map((person) => [person.id, person]));
      const areaById = new Map(areaRows.map((area) => [area.id, area]));
      const attendees = records.map((record) => {
        const person = staffById.get(record.nurseId);
        return {
          ...record,
          staffName: person ? nurseFullName(person) : "Unknown staff",
          staffType: person?.staffType ?? "Registered Nurse",
          areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
        };
      });
      const eventById = new Map(relatedEvents.map((event) => [event.id, event]));
      const allAttendees = allTrainingRecords.map((record) => {
        const person = staffById.get(record.nurseId);
        const occurrence = record.eventId ? eventById.get(record.eventId) : undefined;
        return {
          ...record,
          staffName: person ? nurseFullName(person) : "Unknown staff",
          staffType: person?.staffType ?? "Registered Nurse",
          areaName: person?.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
          occurrenceStartDate: occurrence?.startDate ?? record.scheduledDate,
          occurrenceEndDate: occurrence?.endDate ?? record.scheduledDate,
        };
      });
      const completedIds = new Set(records.filter((record) => record.status === "Completed").map((record) => record.nurseId));
      const inactive = new Set<string>(inactiveStatuses);
      const missing = staff
        .filter((person) => !person.archivedAt)
        .filter((person) => !inactive.has(person.employmentStatus))
        .filter((person) => selected.event.targetStaffType === "All" || person.staffType === selected.event.targetStaffType)
        .filter((person) => !completedIds.has(person.id))
        .map((person) => ({
          id: person.id,
          staffName: nurseFullName(person),
          staffType: person.staffType,
          areaName: person.currentAreaId ? areaById.get(person.currentAreaId)?.name ?? "Unassigned" : "Unassigned",
        }));
      return { ...selected, attendees, allAttendees, missing };
    }),

  addAttendance: adminProcedure
    .input(z.object({
      eventId: z.number().int().positive(),
      nurseId: z.number().int().positive(),
      status: z.enum(attendanceStatuses).default("Scheduled"),
      completionDate: optionalDateInput,
      participationRole: z.enum(PARTICIPATION_ROLES).default("Participant"),
      trainingHours: z.number().int().positive().optional(),
      cpdUnits: z.number().int().positive().optional(),
      certificateNumber: z.string().max(64).optional(),
      expiryDate: optionalDateInput,
      remarks: z.string().max(2000).optional(),
      conflictOverrideReason: z.string().max(1000).optional(),
    }).superRefine((value, ctx) => {
      if ((value.status === "Completed" || value.status === "Expired") && !value.completionDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["completionDate"], message: "Completion date is required for completed attendance." });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [event] = await db.select().from(trainingEvents).where(eq(trainingEvents.id, input.eventId)).limit(1);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Seminar occurrence not found." });
      const [person] = await db.select().from(nurses).where(eq(nurses.id, input.nurseId)).limit(1);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      if (person.archivedAt || inactiveStatuses.includes(person.employmentStatus as typeof inactiveStatuses[number])) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Attendance can only be added for active staff." });
      }
      if (event.targetStaffType !== "All" && event.targetStaffType !== person.staffType) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Staff type does not match this seminar audience." });
      }
      if (input.completionDate && (input.completionDate < new Date(`${dateKey(event.startDate)}T00:00:00`) || input.completionDate > new Date(`${dateKey(event.endDate)}T23:59:59`))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Completion date must fall within seminar dates." });
      }
      if (input.completionDate && input.expiryDate && input.expiryDate < input.completionDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Expiry date cannot be before completion date." });
      }
      const duplicate = await db
        .select({ id: nurseTrainings.id })
        .from(nurseTrainings)
        .where(and(eq(nurseTrainings.eventId, input.eventId), eq(nurseTrainings.nurseId, input.nurseId)))
        .limit(1);
      if (duplicate.length) throw new TRPCError({ code: "CONFLICT", message: "Staff member is already listed for this seminar." });

      const startDateStr = dateKey(event.startDate);
      const endDateStr = dateKey(event.endDate);

      // Conflict validation for scheduled assignment
      if (input.status === "Scheduled") {
        const conflictRes = await checkTrainingConflicts(
          input.nurseId,
          startDateStr,
          endDateStr,
          event.startTime,
          event.endTime
        );
        if (conflictRes.hasConflict && !conflictRes.warningOnly) {
          if (!input.conflictOverrideReason || input.conflictOverrideReason.trim().length === 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Scheduling conflict detected with: ${conflictRes.conflicts.map((c) => c.trainingName).join(", ")}. Override reason is required to proceed.`,
            });
          }
        }
      }

      const id = await db.transaction(async (tx) => {
        const result = await tx.insert(nurseTrainings).values({
          nurseId: input.nurseId,
          trainingId: event.trainingId,
          eventId: input.eventId,
          status: input.status,
          completionDate: input.completionDate ?? null,
          scheduledDate: event.startDate,
          provider: event.provider,
          participationRole: input.participationRole,
          trainingHours: input.trainingHours ?? null,
          cpdUnits: input.cpdUnits ?? null,
          certificateNumber: input.certificateNumber ?? null,
          expiryDate: input.expiryDate ?? null,
          remarks: input.remarks ?? null,
          scheduleVersion: 1,
          staffResponse: "Pending",
          evidenceRequired: true,
          conflictOverrideReason: input.conflictOverrideReason ?? null,
          conflictOverrideBy: input.conflictOverrideReason ? ctx.user.id : null,
        }).returning({ id: nurseTrainings.id });
        const newId = Number(result[0].id);
        await tx.insert(activityLog).values({
          supervisorId: ctx.user.id,
          nurseId: input.nurseId,
          actionType: "seminar.attendance.added",
          entityType: "nurseTraining",
          entityId: newId,
          summary: `Seminar attendance added for ${nurseFullName(person)}`,
        });
        return newId;
      });

      // Enqueue immediate notice and milestone jobs if Scheduled
      if (input.status === "Scheduled") {
        try {
          const noticeItem = await enqueueTrainingNotice({
            assignmentId: id,
            scheduleVersion: 1,
            noticeKind: "assigned",
            recipientNurseId: input.nurseId,
            actorUserId: ctx.user.id,
          });
          await createMilestonesForAssignment({
            assignmentId: id,
            scheduleVersion: 1,
            startDateStr,
            recipientNurseId: input.nurseId,
          });
          if (noticeItem?.id) {
            await dispatchSingleOutboxItem(noticeItem.id).catch(() => {});
          }
        } catch (noticeErr) {
          console.warn("[Seminars] Failed to enqueue training notice:", noticeErr);
        }
      }

      return { id };
    }),

  removeAttendance: adminProcedure
    .input(z.object({ attendanceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      // Only seminar attendance (a record attached to an occurrence) may be removed here;
      // plain training-log entries are owned by the trainings router.
      const existing = await getNurseTrainingById(input.attendanceId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Attendance record not found." });
      if (existing.eventId == null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That record is not seminar attendance." });
      }
      const record = await deleteNurseTraining(input.attendanceId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Attendance record not found." });
      if (record.certificateKey) {
        await storageDelete(record.certificateKey).catch(() => {});
      }
      await logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "seminar.attendance.deleted",
        entityType: "nurseTraining",
        entityId: input.attendanceId,
        summary: `Seminar attendance record #${input.attendanceId} removed`,
      });
      return { success: true } as const;
    }),

  matrix: adminProcedure
    .input(z.object({
      from: optionalDateInput,
      to: optionalDateInput,
      staffType: z.enum(STAFF_TYPES).optional(),
      areaId: z.number().int().positive().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getLocalSeminarMatrix(input as any);
      }
      const staffConditions = [isNull(nurses.archivedAt), notInArray(nurses.employmentStatus, inactiveStatuses)];
      if (input?.staffType) staffConditions.push(eq(nurses.staffType, input.staffType));
      if (input?.areaId) staffConditions.push(eq(nurses.currentAreaId, input.areaId));
      const eventConditions = [];
      if (input?.from) eventConditions.push(gte(trainingEvents.endDate, input.from));
      if (input?.to) eventConditions.push(lte(trainingEvents.startDate, input.to));
      const [staff, events, records] = await Promise.all([
        db.select().from(nurses).where(and(...staffConditions)).orderBy(asc(nurses.lastName), asc(nurses.firstName)),
        db.select({ event: trainingEvents, training: trainingCatalog }).from(trainingEvents)
          .innerJoin(trainingCatalog, eq(trainingCatalog.id, trainingEvents.trainingId))
          .where(eventConditions.length ? and(...eventConditions) : undefined)
          .orderBy(asc(trainingEvents.startDate), asc(trainingCatalog.name)),
        db.select().from(nurseTrainings),
      ]);
      const eventIds = new Set(events.map((item) => item.event.id));
      const staffIds = new Set(staff.map((person) => person.id));
      return {
        staff: staff.map((person) => ({ id: person.id, name: nurseFullName(person), staffType: person.staffType, areaId: person.currentAreaId })),
        events,
        records: records.filter((record) => record.eventId && eventIds.has(record.eventId) && staffIds.has(record.nurseId)),
      };
    }),

  monthlySummary: adminProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getLocalMonthlySummary(input.year);
      }
      const [records, staff] = await Promise.all([
        db.select().from(nurseTrainings).where(eq(nurseTrainings.status, "Completed")),
        db.select().from(nurses).where(and(isNull(nurses.archivedAt), notInArray(nurses.employmentStatus, inactiveStatuses))).orderBy(asc(nurses.lastName), asc(nurses.firstName)),
      ]);
      return staff.map((person) => {
        const months = Array.from({ length: 12 }, () => 0);
        for (const record of records) {
          if (record.nurseId !== person.id || !record.completionDate) continue;
          const key = dateKey(record.completionDate);
          if (Number(key.slice(0, 4)) === input.year) months[Number(key.slice(5, 7)) - 1]++;
        }
        return { nurseId: person.id, staffName: nurseFullName(person), months, h1: months.slice(0, 6).reduce((a, b) => a + b, 0), h2: months.slice(6).reduce((a, b) => a + b, 0) };
      });
    }),

  quarterlyLedger: adminProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100), quarter: z.number().int().min(1).max(4) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return getLocalQuarterlyLedger(input.year, input.quarter);
      }
      const startMonth = (input.quarter - 1) * 3;
      const from = new Date(input.year, startMonth, 1);
      const to = new Date(input.year, startMonth + 3, 0);
      const rows = await db
        .select({ record: nurseTrainings, person: nurses, event: trainingEvents, training: trainingCatalog })
        .from(nurseTrainings)
        .innerJoin(nurses, eq(nurses.id, nurseTrainings.nurseId))
        .leftJoin(trainingEvents, eq(trainingEvents.id, nurseTrainings.eventId))
        .innerJoin(trainingCatalog, eq(trainingCatalog.id, nurseTrainings.trainingId))
        .where(and(eq(nurseTrainings.status, "Completed"), gte(nurseTrainings.completionDate, from), lte(nurseTrainings.completionDate, to)))
        .orderBy(asc(nurseTrainings.completionDate), asc(nurses.lastName), asc(trainingCatalog.name));
      return rows.map((row) => ({
        recordId: row.record.id,
        nurseId: row.person.id,
        staffName: nurseFullName(row.person),
        trainingName: row.training.name,
        kind: row.training.kind,
        provider: row.event?.provider ?? row.record.provider,
        venue: row.event?.venue ?? null,
        startDate: row.event ? dateKey(row.event.startDate) : dateKey(row.record.completionDate),
        endDate: row.event ? dateKey(row.event.endDate) : dateKey(row.record.completionDate),
        completionDate: dateKey(row.record.completionDate),
        participationRole: row.record.participationRole,
      }));
    }),
});
