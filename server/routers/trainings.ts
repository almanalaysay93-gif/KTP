import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  nurseFullName,
  PARTICIPATION_ROLES,
  sanitizeFilename,
  storageKey,
  trainingCompliance,
  validateMime,
  TRAINING_KINDS,
} from "../../shared/nursetrack";
import { storageDelete, storagePut } from "../storage";
import {
  checkTrainingConflicts,
  enqueueTrainingNotice,
  createMilestonesForAssignment,
  invalidatePendingOutboxJobs,
  dispatchSingleOutboxItem,
  resolveTrainingSchedule,
} from "../trainingReminders";

const nullableDateInput = z.union([z.date(), z.string().datetime(), z.null()]).transform((d) => (d === null ? null : d instanceof Date ? d : new Date(d))).optional();

export const trainingsRouter = router({
  // Single round-trip initial load: catalog + records in one call (same enriched shape as listRecords).
  initial: adminProcedure.query(async () => {
    const [catalog, rows, nurses] = await Promise.all([db.listTrainingCatalog(true), db.listNurseTrainings(), db.listNurses()]);
    const nurseById = new Map(nurses.map((n) => [n.id, n]));
    const catById = new Map(catalog.map((t) => [t.id, t]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = rows.map((r) => {
      const nurse = nurseById.get(r.nurseId);
      const item = catById.get(r.trainingId);
      let derivedStatus = r.status;
      if (r.status === "Scheduled" && r.scheduledDate && new Date(r.scheduledDate) < today) derivedStatus = "Scheduled";
      if (r.status === "Completed" && r.expiryDate && new Date(r.expiryDate) < today) derivedStatus = "Expired";
      return { ...r, nurse, trainingName: item?.name ?? "Unknown", trainingItem: item ?? null, derivedStatus };
    });
    return { catalog, records };
  }),

  listCatalog: adminProcedure.query(() => db.listTrainingCatalog(true)),

  createCatalogItem: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        category: z.string().max(64).optional(),
        kind: z.enum(TRAINING_KINDS).optional(),
        renewalRequired: z.boolean().optional(),
        defaultValidityMonths: z.number().int().positive().max(600).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.createTrainingType(input);
      return { id };
    }),

  updateCatalogItem: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        category: z.string().max(64).optional().nullable(),
        kind: z.enum(TRAINING_KINDS).optional(),
        renewalRequired: z.boolean().optional(),
        defaultValidityMonths: z.number().int().positive().max(600).optional().nullable(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      await db.updateTrainingType(id, {
        ...rest,
        category: rest.category ?? undefined,
        defaultValidityMonths: rest.defaultValidityMonths ?? undefined,
      });
      return { success: true } as const;
    }),

  deleteCatalogItem: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await db.deleteTrainingCatalogItem(input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Training catalog item not found." });
      await db.logActivity({
        supervisorId: ctx.user.id,
        actionType: "training.catalog.deleted",
        entityType: "trainingCatalog",
        entityId: input.id,
        summary: `${deleted.catalog.kind} "${deleted.catalog.name}" permanently deleted, including ${deleted.eventsDeleted} seminar event(s) and ${deleted.attendanceDeleted} attendance record(s)`,
      });
      return {
        success: true,
        eventsDeleted: deleted.eventsDeleted,
        attendanceDeleted: deleted.attendanceDeleted,
      } as const;
    }),

  listRecords: adminProcedure.query(async () => {
    const rows = await db.listNurseTrainings();
    const nurses = await db.listNurses();
    const nurseById = new Map(nurses.map((n) => [n.id, n]));
    const catalog = await db.listTrainingCatalog(true);
    const catById = new Map(catalog.map((t) => [t.id, t]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.map((r) => {
      const nurse = nurseById.get(r.nurseId);
      const item = catById.get(r.trainingId);
      let derivedStatus = r.status;
      if (r.status === "Scheduled" && r.scheduledDate && new Date(r.scheduledDate) < today) derivedStatus = "Scheduled";
      if (r.status === "Completed" && r.expiryDate && new Date(r.expiryDate) < today) derivedStatus = "Expired";
      return { ...r, nurse, trainingName: item?.name ?? "Unknown", trainingItem: item ?? null, derivedStatus };
    });
  }),

  listForNurse: adminProcedure
    .input(z.object({ nurseId: z.number() }))
    .query(async ({ input }) => {
      const rows = await db.listNurseTrainings({ nurseId: input.nurseId });
      const catalog = await db.listTrainingCatalog(true);
      const catById = new Map(catalog.map((t) => [t.id, t]));
      return rows.map((r) => ({ ...r, trainingName: catById.get(r.trainingId)?.name ?? "Unknown" }));
    }),

  checkConflict: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        startDate: z.string(),
        endDate: z.string().optional().nullable(),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        excludeAssignmentId: z.number().optional().nullable(),
      })
    )
    .query(async ({ input }) => {
      return checkTrainingConflicts(
        input.nurseId,
        input.startDate,
        input.endDate,
        input.startTime,
        input.endTime,
        input.excludeAssignmentId
      );
    }),

  createRecord: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        trainingId: z.number(),
        eventId: z.number().optional(),
        participationRole: z.enum(PARTICIPATION_ROLES).optional(),
        provider: z.string().max(128).optional(),
        status: z.enum(["Scheduled", "Completed", "Expired", "Cancelled"]).optional(),
        scheduledDate: nullableDateInput,
        completionDate: nullableDateInput,
        expiryDate: nullableDateInput,
        trainingHours: z.number().int().positive().optional(),
        cpdUnits: z.number().int().positive().optional(),
        certificateNumber: z.string().max(64).optional(),
        certificateKey: z.string().optional(),
        remarks: z.string().max(2000).optional(),
        conflictOverrideReason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });

      const status = input.status ?? "Scheduled";
      const scheduledDateStr = input.scheduledDate ? input.scheduledDate.toISOString().slice(0, 10) : null;

      // Conflict validation for scheduled training
      if (status === "Scheduled" && scheduledDateStr) {
        const conflictRes = await checkTrainingConflicts(input.nurseId, scheduledDateStr);
        if (conflictRes.hasConflict && !conflictRes.warningOnly) {
          if (!input.conflictOverrideReason || input.conflictOverrideReason.trim().length === 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Scheduling conflict detected with: ${conflictRes.conflicts.map((c) => c.trainingName).join(", ")}. Override reason is required to proceed.`,
            });
          }
        }
      }

      const id = await db.createNurseTraining({
        ...input,
        status,
        scheduleVersion: 1,
        staffResponse: "Pending",
        evidenceRequired: true,
        conflictOverrideReason: input.conflictOverrideReason ?? null,
        conflictOverrideBy: input.conflictOverrideReason ? ctx.user.id : null,
      });

      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "training.created",
        entityType: "nurseTraining",
        entityId: id,
        summary: `Training record added for ${nurseFullName(nurse)}`,
      });

      // If scheduled, enqueue immediate notice and schedule reminder milestones
      if (status === "Scheduled" && scheduledDateStr) {
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
            startDateStr: scheduledDateStr,
            recipientNurseId: input.nurseId,
          });
          if (noticeItem?.id) {
            // Awaited bounded dispatch attempt
            await dispatchSingleOutboxItem(noticeItem.id).catch(() => {});
          }
        } catch (noticeErr) {
          console.warn("[Trainings] Failed to enqueue training notice:", noticeErr);
        }
      }

      return { id };
    }),

  updateRecord: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["Scheduled", "Completed", "Expired", "Cancelled"]).optional(),
        participationRole: z.enum(PARTICIPATION_ROLES).optional(),
        scheduledDate: nullableDateInput,
        completionDate: nullableDateInput,
        expiryDate: nullableDateInput,
        provider: z.string().max(128).optional(),
        trainingHours: z.number().int().positive().optional(),
        cpdUnits: z.number().int().positive().optional(),
        certificateNumber: z.string().max(64).optional(),
        remarks: z.string().max(2000).optional(),
        conflictOverrideReason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const rows = await db.listNurseTrainings();
      const record = rows.find((r) => r.id === id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found" });

      const oldDateStr = record.scheduledDate ? new Date(record.scheduledDate).toISOString().slice(0, 10) : null;
      const newDateStr = rest.scheduledDate ? rest.scheduledDate.toISOString().slice(0, 10) : oldDateStr;
      const isReschedule = Boolean(oldDateStr && newDateStr && oldDateStr !== newDateStr);
      const isCancellation = Boolean(rest.status === "Cancelled" && record.status !== "Cancelled");

      let newScheduleVersion = record.scheduleVersion ?? 1;
      const updatePayload: any = { ...rest };

      if (isReschedule) {
        newScheduleVersion += 1;
        updatePayload.scheduleVersion = newScheduleVersion;
        updatePayload.staffResponse = "Pending";
        updatePayload.staffResponseReason = null;
        updatePayload.staffRespondedAt = null;
        updatePayload.staffResponseVersion = null;
      }

      if (rest.conflictOverrideReason) {
        updatePayload.conflictOverrideReason = rest.conflictOverrideReason;
        updatePayload.conflictOverrideBy = ctx.user.id;
      }

      await db.updateNurseTraining(id, updatePayload);

      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "training.updated",
        entityType: "nurseTraining",
        entityId: id,
        summary: `Training record #${id} updated${isReschedule ? " (rescheduled)" : isCancellation ? " (cancelled)" : ""}`,
      });

      // Handle reschedule notices and milestone jobs
      if (isReschedule && newDateStr) {
        try {
          await invalidatePendingOutboxJobs(id, newScheduleVersion);
          const notice = await enqueueTrainingNotice({
            assignmentId: id,
            scheduleVersion: newScheduleVersion,
            noticeKind: "rescheduled",
            recipientNurseId: record.nurseId,
            actorUserId: ctx.user.id,
          });
          await createMilestonesForAssignment({
            assignmentId: id,
            scheduleVersion: newScheduleVersion,
            startDateStr: newDateStr,
            recipientNurseId: record.nurseId,
          });
          if (notice?.id) {
            await dispatchSingleOutboxItem(notice.id).catch(() => {});
          }
        } catch (err) {
          console.warn("[Trainings] Reschedule outbox notice failed:", err);
        }
      } else if (isCancellation) {
        try {
          await invalidatePendingOutboxJobs(id);
          const cancelNotice = await enqueueTrainingNotice({
            assignmentId: id,
            scheduleVersion: record.scheduleVersion ?? 1,
            noticeKind: "cancelled",
            recipientNurseId: record.nurseId,
            actorUserId: ctx.user.id,
          });
          if (cancelNotice?.id) {
            await dispatchSingleOutboxItem(cancelNotice.id).catch(() => {});
          }
        } catch (err) {
          console.warn("[Trainings] Cancellation outbox notice failed:", err);
        }
      }

      return { success: true } as const;
    }),

  recordAttendance: adminProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        attendanceOutcome: z.enum(["not_recorded", "attended", "missed", "excused"]),
        attendanceNote: z.string().max(1000).optional(),
        autoComplete: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db.listNurseTrainings();
      const record = rows.find((r) => r.id === input.assignmentId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found" });

      const updateData: any = {
        attendanceOutcome: input.attendanceOutcome,
        attendanceRecordedAt: new Date(),
        attendanceRecordedBy: ctx.user.id,
        attendanceNote: input.attendanceNote ?? null,
      };

      if (input.autoComplete && input.attendanceOutcome === "attended") {
        updateData.status = "Completed";
        if (!record.completionDate) {
          updateData.completionDate = record.scheduledDate ?? new Date();
        }
      }

      await db.updateNurseTraining(input.assignmentId, updateData);

      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "training.attendance.recorded",
        entityType: "nurseTraining",
        entityId: input.assignmentId,
        summary: `Attendance recorded as ${input.attendanceOutcome} for training record #${input.assignmentId}`,
      });

      return { ok: true };
    }),

  reviewEvidence: adminProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        decision: z.enum(["verified", "rejected"]),
        note: z.string().max(1000).optional(),
        autoComplete: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db.listNurseTrainings();
      const record = rows.find((r) => r.id === input.assignmentId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found" });

      if (input.decision === "rejected" && (!input.note || input.note.trim().length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A reason is required when rejecting evidence." });
      }

      const updateData: any = {
        evidenceStatus: input.decision === "verified" ? "Verified" : "Rejected",
        evidenceReviewedAt: new Date(),
        evidenceReviewedBy: ctx.user.id,
        evidenceReviewNote: input.note ?? null,
      };

      if (input.decision === "verified" && input.autoComplete) {
        updateData.status = "Completed";
        if (!record.completionDate) {
          updateData.completionDate = record.scheduledDate ?? new Date();
        }
      }

      await db.updateNurseTraining(input.assignmentId, updateData);

      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "training.evidence.reviewed",
        entityType: "nurseTraining",
        entityId: input.assignmentId,
        summary: `Training evidence ${input.decision} for training record #${input.assignmentId}`,
      });

      return { ok: true };
    }),

  followUpList: adminProcedure
    .input(
      z
        .object({
          trainingId: z.number().optional(),
          filter: z
            .enum([
              "all",
              "pending_response",
              "cannot_attend",
              "missing_email",
              "delivery_failed",
              "evidence_review",
              "missed",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const [rows, allNurses, catalog] = await Promise.all([
        db.listNurseTrainings(),
        db.listNurses(),
        db.listTrainingCatalog(true),
      ]);
      const nurseById = new Map(allNurses.map((n) => [n.id, n]));
      const catById = new Map(catalog.map((c) => [c.id, c]));

      let assignments = rows.filter((r) => r.status !== "Cancelled");
      if (input?.trainingId) {
        assignments = assignments.filter((r) => r.trainingId === input.trainingId);
      }

      const items: any[] = [];
      for (const a of assignments) {
        const nurse = nurseById.get(a.nurseId);
        if (!nurse) continue;
        const resolved = await resolveTrainingSchedule(a.id);
        if (!resolved) continue;

        const trainingName = catById.get(a.trainingId)?.name || resolved.trainingName;
        const hasEmail = Boolean(nurse.accountEmail);
        const item = {
          assignmentId: a.id,
          nurseId: a.nurseId,
          nurseName: nurseFullName(nurse),
          employeeId: nurse.employeeId,
          accountEmail: nurse.accountEmail,
          hasEmail,
          trainingId: a.trainingId,
          trainingName,
          startDateStr: resolved.startDateStr,
          endDateStr: resolved.endDateStr,
          startTime: resolved.startTime,
          venue: resolved.venue,
          status: a.status,
          scheduleVersion: a.scheduleVersion ?? 1,
          staffResponse: a.staffResponse || "Pending",
          staffResponseReason: a.staffResponseReason,
          attendanceOutcome: a.attendanceOutcome || "not_recorded",
          evidenceRequired: Boolean(a.evidenceRequired),
          evidenceStatus: a.evidenceStatus || "None",
          certificateKey: a.certificateKey,
        };

        // Filter evaluation
        const filter = input?.filter || "all";
        if (filter === "pending_response" && item.staffResponse !== "Pending") continue;
        if (filter === "cannot_attend" && item.staffResponse !== "Cannot attend") continue;
        if (filter === "missing_email" && item.hasEmail) continue;
        if (filter === "evidence_review" && item.evidenceStatus !== "Submitted") continue;
        if (filter === "missed" && item.attendanceOutcome !== "missed") continue;

        items.push(item);
      }

      // Compute total metrics across the dataset
      const counts = {
        total: assignments.length,
        pendingResponse: assignments.filter((a) => (a.staffResponse || "Pending") === "Pending").length,
        cannotAttend: assignments.filter((a) => a.staffResponse === "Cannot attend").length,
        missingEmail: assignments.filter((a) => !nurseById.get(a.nurseId)?.accountEmail).length,
        evidenceReview: assignments.filter((a) => a.evidenceStatus === "Submitted").length,
        missed: assignments.filter((a) => a.attendanceOutcome === "missed").length,
      };

      return { items, counts };
    }),

  deleteRecord: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const record = await db.deleteNurseTraining(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found." });
      if (record.certificateKey) {
        await storageDelete(record.certificateKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "training.deleted",
        entityType: "nurseTraining",
        entityId: input.id,
        summary: `Training record #${input.id} permanently deleted`,
      });
      return { success: true } as const;
    }),


  uploadCertificate: adminProcedure
    .input(
      z.object({
        recordId: z.number(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await db.listNurseTrainings();
      const record = rows.find((r) => r.id === input.recordId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found" });
      const mimeCheck = validateMime(input.mimeType, "document");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
      const oldKey = record.certificateKey;
      const key = storageKey("certificates", record.nurseId, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurseTraining(input.recordId, { certificateKey: storedKey });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: record.nurseId,
        actionType: "training.certificate.uploaded",
        entityType: "nurseTraining",
        entityId: input.recordId,
        summary: `Certificate uploaded for training record #${input.recordId}`,
      });
      return { url };
    }),

  getAreaRequirements: adminProcedure
    .input(z.object({ areaId: z.number() }))
    .query(async ({ input }) => {
      return await db.getAreaTrainingRequirementIds(input.areaId);
    }),

  setAreaRequirement: adminProcedure
    .input(z.object({ areaId: z.number(), trainingId: z.number(), required: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.setAreaTrainingRequirement(input.areaId, input.trainingId, input.required);
      return { success: true } as const;
    }),

  getCompliance: adminProcedure
    .input(z.object({ nurseId: z.number() }))
    .query(async ({ input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      if (!nurse.currentAreaId) return { compliancePercent: 100, requiredCount: 0, completedCount: 0 };
      const requiredIds = await db.getAreaTrainingRequirementIds(nurse.currentAreaId);
      const records = await db.listNurseTrainings({ nurseId: input.nurseId });
      const compliance = trainingCompliance({
        requiredTrainingIds: requiredIds,
        nurseTrainingRecords: records.map((r) => ({
          trainingId: r.trainingId,
          status: r.status,
          expiryDate: r.expiryDate,
          completionDate: r.completionDate,
        })),
      });
      const completedValid = requiredIds.filter((tid) => {
        const recs = records.filter((r) => r.trainingId === tid && r.status === "Completed");
        return recs.some((r) => !r.expiryDate || new Date(r.expiryDate) > new Date());
      }).length;
      return { compliancePercent: compliance, requiredCount: requiredIds.length, completedCount: completedValid };
    }),
});
