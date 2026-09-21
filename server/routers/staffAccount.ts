import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { CLAIM_COOKIE_NAME } from "@shared/const";
import { publicProcedure, router, staffProcedure } from "../_core/trpc";
import { getClaimCookieOptions } from "../_core/cookies";
import { checkRateLimit } from "../_core/rateLimit";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import * as memosDb from "../memosDb";
import { dateKey, daysUntilExpiry, deriveLicenseStatus, nurseFullName, sanitizeFilename, storageKey, validateMime } from "../../shared/nursetrack";
import { storageDelete, storagePut } from "../storage";
import { listResolvedTrainingSchedules, resolveTrainingSchedule } from "../trainingReminders";

const GENERIC_CLAIM_ERROR =
  "No matching staff record, or this profile already has a sign-in email.";

const CLAIM_RATE_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

/**
 * Self-service for non-admin (staff) accounts: first-visit claim by
 * PRC/employee ID, then view/edit that one nurse record on return Google
 * visits. Every procedure here is scoped to the caller's own claimed or
 * linked nurse — never any other nurseId. See
 * docs/plans/2026-09-15-staff-signin-claim-then-google-design.md.
 */
export const staffAccountRouter = router({
  myLink: staffProcedure.query(async ({ ctx }) => {
    return { linked: true, nurseId: ctx.nurseId, authMode: ctx.authMode };
  }),

  /** First visit: identify by PRC/license number (RN) or employee ID (attendant, no PRC on file). */
  startClaim: publicProcedure
    .input(z.object({ identifier: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
      if (!checkRateLimit(`staff-claim:${ip}`, CLAIM_RATE_LIMIT)) {
        // E8: rate-limited attempts return the exact same generic message as a
        // failed lookup, so an attacker can't tell throttling from a wrong guess.
        throw new TRPCError({ code: "NOT_FOUND", message: GENERIC_CLAIM_ERROR });
      }

      const result = await db.claimNurseByIdentifier(input.identifier);
      if (!result.ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: GENERIC_CLAIM_ERROR });
      }

      const token = await sdk.createClaimToken(result.nurseId);
      ctx.res.cookie(CLAIM_COOKIE_NAME, token, getClaimCookieOptions(ctx.req));
      return { ok: true } as const;
    }),

  /** End of first visit (D3): staff types their Gmail and it's saved at once. */
  saveClaimEmail: staffProcedure
    .input(z.object({ email: z.string().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.authMode !== "claim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Already signed in with Google — use change email instead." });
      }
      const result = await db.saveClaimEmail(ctx.nurseId, input.email);
      if (!result.ok) {
        if (result.reason === "already_claimed") {
          throw new TRPCError({ code: "CONFLICT", message: GENERIC_CLAIM_ERROR });
        }
        throw new TRPCError({ code: "CONFLICT", message: "That email is already in use." });
      }
      return { ok: true } as const;
    }),

  /** D6: change the sign-in Gmail from an established Google session only. */
  changeEmail: staffProcedure
    .input(z.object({ email: z.string().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.authMode !== "google") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sign in with Google to change your sign-in email." });
      }
      const result = await db.changeNurseAccountEmail(ctx.nurseId, input.email);
      if (!result.ok) {
        throw new TRPCError({ code: "CONFLICT", message: "That email is already in use." });
      }
      return { ok: true } as const;
    }),

  myProfile: staffProcedure.query(async ({ ctx }) => {
    const nurseId = Math.floor(ctx.nurseId);
    const pg = db.getBatchClient();

    if (pg) {
      const sets = (await pg
        .unsafe(
          [
            `select * from nursetrack.nurses where id = ${nurseId} limit 1`,
            `select * from nursetrack.areas order by "sortOrder"`,
            `select * from nursetrack."credentialTypes"`,
            `select * from nursetrack."trainingCatalog" order by name`,
            `select id, "nurseId", "areaId", "startDate"::text as "startDate", "endDate"::text as "endDate", "assignmentType", remarks, "isCurrent"
               from nursetrack."areaAssignments"
               where "nurseId" = ${nurseId}
               order by "startDate" desc`,
            `select id, "nurseId", "credentialTypeId", "licenseNumber", "issuingOrganization", "issueDate"::text as "issueDate", "expiryDate"::text as "expiryDate", "renewalStatus", "verificationStatus", "documentKey", "renewalCycleKey", remarks
               from nursetrack."nurseCredentials"
               where "nurseId" = ${nurseId}
               order by "expiryDate" desc`,
            `select id, "nurseId", "trainingId", "eventId", "participationRole", "completionDate"::text as "completionDate", "expiryDate"::text as "expiryDate", "scheduledDate"::text as "scheduledDate", status, "trainingHours", "cpdUnits", provider, "certificateNumber", "certificateKey", remarks
               from nursetrack."nurseTrainings"
               where "nurseId" = ${nurseId}
               order by "completionDate" desc nulls last, id desc`,
          ].join(";\n"),
        )
        .simple()) as unknown as [
          any[], // nurseRows
          any[], // areaRows
          any[], // credTypes
          any[], // catalog
          any[], // rawAssignments
          any[], // rawCreds
          any[], // rawTrainings
        ];

      const [nurseRows, areaRows, credTypes, catalog, rawAssignments, rawCreds, rawTrainings] = sets;
      const nurse = nurseRows[0];
      if (!nurse) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
      }

      const areaById = new Map(areaRows.map((a: any) => [a.id, a]));
      const typeById = new Map(credTypes.map((t: any) => [t.id, t.name]));
      const catalogById = new Map(catalog.map((c: any) => [c.id, c.name]));

      const latestCred = rawCreds[0];
      const expKey = latestCred ? dateKey(latestCred.expiryDate) : null;
      const days = expKey ? daysUntilExpiry(expKey) : null;
      const licenseStatus = latestCred
        ? (latestCred.renewalStatus === "Renewed" ? "Valid" : (expKey ? deriveLicenseStatus(expKey) : null))
        : null;

      return {
        ...nurse,
        currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
        licenseStatus,
        licenseNumber: latestCred?.licenseNumber ?? null,
        licenseExpiryDate: expKey,
        licenseDaysRemaining: days,
        credentials: rawCreds.map((c: any) => ({
          ...c,
          typeName: typeById.get(c.credentialTypeId) ?? "Credential / License",
        })),
        trainings: rawTrainings.map((t: any) => ({
          ...t,
          trainingName: catalogById.get(t.trainingId) ?? "Training",
        })),
        assignments: rawAssignments.map((a: any) => {
          const area = areaById.get(a.areaId) ?? null;
          return {
            ...a,
            area,
            areaName: area?.name ?? "Unknown",
          };
        }),
        authMode: ctx.authMode,
      };
    }

    const nurse = await db.getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

    const [areaRows, types, catalog, licenseInfo, credentials, trainings, assignments] = await Promise.all([
      db.listAreas(false),
      db.listCredentialTypes(true),
      db.listTrainingCatalog(true),
      db.getNurseLicenseInfo(nurse.id),
      db.listCredentials({ nurseId: nurse.id }),
      db.listNurseTrainings({ nurseId: nurse.id }),
      db.listAssignmentsForNurse(nurse.id),
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const typeById = new Map(types.map((t) => [t.id, t.name]));
    const catalogById = new Map(catalog.map((c) => [c.id, c.name]));

    const { status, licenseNumber, expiryDate, daysRemaining } = licenseInfo;

    return {
      ...nurse,
      currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
      licenseStatus: status,
      licenseNumber,
      licenseExpiryDate: expiryDate,
      licenseDaysRemaining: daysRemaining,
      credentials: credentials.map((c) => ({
        ...c,
        typeName: typeById.get(c.credentialTypeId) ?? "Credential / License",
      })),
      trainings: trainings.map((t) => ({
        ...t,
        trainingName: catalogById.get(t.trainingId) ?? "Training",
      })),
      assignments: assignments.map((a) => {
        const area = areaById.get(a.areaId) ?? null;
        return {
          ...a,
          area,
          areaName: area?.name ?? "Unknown",
        };
      }),
      authMode: ctx.authMode,
    };
  }),

  updateMyBasicInfo: staffProcedure
    .input(z.object({ contactNumber: z.string().max(32).optional() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
      await db.updateNurse(nurse.id, { contactNumber: input.contactNumber ?? null });
      return { ok: true };
    }),

  updateMyPrcLicense: staffProcedure
    .input(z.object({ licenseNumber: z.string().max(64).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });
      const licResult = await db.upsertNursePrcLicense(nurse.id, input.licenseNumber ?? null);
      if (!licResult.ok) {
        throw new TRPCError({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
      }
      await db.logActivity({
        supervisorId: ctx.user?.id ?? null,
        nurseId: nurse.id,
        actionType: "nurse.updated",
        entityType: "nurse",
        entityId: nurse.id,
        summary: `PRC License Number updated to ${input.licenseNumber || "none"} by ${nurseFullName(nurse)} (self-service)`,
      });
      return { ok: true };
    }),

  uploadMyPhoto: staffProcedure
    .input(z.object({ fileBase64: z.string(), fileName: z.string().max(200), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

      const mimeCheck = validateMime(input.mimeType, "photo");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const oldKey = nurse.profilePhotoKey;
      const key = storageKey("profile-photos", nurse.id, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurse(nurse.id, { profilePhotoKey: storedKey });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user?.id ?? null,
        nurseId: nurse.id,
        actionType: "nurse.photo.updated",
        entityType: "nurse",
        entityId: nurse.id,
        summary: `Profile photo updated by ${nurseFullName(nurse)} (self-service)`,
      });
      return { url };
    }),

  listCatalog: staffProcedure.query(async () => {
    return db.listTrainingCatalog(false);
  }),

  uploadCredentialDocument: staffProcedure
    .input(
      z.object({
        credentialId: z.number(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

      const allCreds = await db.listCredentials({ nurseId: nurse.id });
      const cred = allCreds.find((c) => c.id === input.credentialId);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "Credential record not found on your profile." });

      const mimeCheck = validateMime(input.mimeType, "document");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const oldKey = cred.documentKey;
      const key = storageKey("license-documents", nurse.id, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
      await db.updateCredential(input.credentialId, { documentKey: storedKey });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user?.id ?? null,
        nurseId: nurse.id,
        actionType: "license.document.uploaded",
        entityType: "credential",
        entityId: input.credentialId,
        summary: `License/credential document uploaded by ${nurseFullName(nurse)} (self-service)`,
      });
      return { url };
    }),

  addTrainingRecord: staffProcedure
    .input(
      z.object({
        trainingId: z.number(),
        provider: z.string().max(128).optional(),
        completionDate: z.string().min(1),
        trainingHours: z.number().int().positive().optional(),
        cpdUnits: z.number().int().positive().optional(),
        certificateNumber: z.string().max(64).optional(),
        remarks: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

      const id = await db.createNurseTraining({
        nurseId: nurse.id,
        trainingId: input.trainingId,
        provider: input.provider || undefined,
        status: "Completed",
        completionDate: new Date(input.completionDate),
        trainingHours: input.trainingHours || undefined,
        cpdUnits: input.cpdUnits || undefined,
        certificateNumber: input.certificateNumber || undefined,
        remarks: input.remarks || undefined,
      });

      await db.logActivity({
        supervisorId: ctx.user?.id ?? null,
        nurseId: nurse.id,
        actionType: "training.created",
        entityType: "nurseTraining",
        entityId: id,
        summary: `Training completion submitted by ${nurseFullName(nurse)} (self-service)`,
      });

      return { id };
    }),

  uploadTrainingCertificate: staffProcedure
    .input(
      z.object({
        recordId: z.number(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

      const trainings = await db.listNurseTrainings({ nurseId: nurse.id });
      const record = trainings.find((t) => t.id === input.recordId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Training record not found on your profile." });

      const mimeCheck = validateMime(input.mimeType, "document");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const oldKey = record.certificateKey;
      const key = storageKey("certificates", nurse.id, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurseTraining(input.recordId, { certificateKey: storedKey });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user?.id ?? null,
        nurseId: nurse.id,
        actionType: "training.certificate.uploaded",
        entityType: "nurseTraining",
        entityId: input.recordId,
        summary: `Training certificate uploaded by ${nurseFullName(nurse)} (self-service)`,
      });
      return { url };
    }),

  myTrainingCalendar: staffProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const assignments = await listResolvedTrainingSchedules(ctx.nurseId);
      const results: any[] = [];
      for (const resolved of assignments) {
        if (input?.status && input.status !== "all" && resolved.status !== input.status) continue;
        if (input?.startDate && resolved.startDateStr && resolved.startDateStr < input.startDate) continue;
        if (input?.endDate && resolved.startDateStr && resolved.startDateStr > input.endDate) continue;

        results.push({
          assignmentId: resolved.assignmentId,
          trainingId: resolved.trainingId,
          trainingName: resolved.trainingName,
          startDateStr: resolved.startDateStr,
          endDateStr: resolved.endDateStr,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          venue: resolved.venue,
          status: resolved.status,
          scheduleVersion: resolved.scheduleVersion,
          staffResponse: resolved.staffResponse,
          staffResponseReason: resolved.staffResponseReason,
          attendanceOutcome: resolved.attendanceOutcome,
          evidenceRequired: resolved.evidenceRequired,
          evidenceStatus: resolved.evidenceStatus,
          instructions: resolved.remarks,
        });
      }
      return results;
    }),

  myTrainingDetail: staffProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const resolved = await resolveTrainingSchedule(input.assignmentId);
      if (!resolved || resolved.nurseId !== ctx.nurseId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
      }
      return resolved;
    }),

  respondToTraining: staffProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        scheduleVersion: z.number().int().positive(),
        response: z.enum(["confirmed", "cannot_attend"]),
        reason: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveTrainingSchedule(input.assignmentId);
      if (!resolved || resolved.nurseId !== ctx.nurseId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
      }
      if (resolved.scheduleVersion !== input.scheduleVersion) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The training schedule was updated by supervisor. Please review the current schedule.",
        });
      }
      if (input.response === "cannot_attend" && (!input.reason || input.reason.trim().length === 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A reason is required when indicating you cannot attend (1 to 1000 characters).",
        });
      }

      const responseValue = input.response === "cannot_attend" ? ("Cannot attend" as const) : ("Confirmed" as const);
      await db.updateNurseTraining(input.assignmentId, {
        staffResponse: responseValue,
        staffResponseReason: input.response === "cannot_attend" ? input.reason!.trim() : null,
        staffRespondedAt: new Date(),
        staffResponseVersion: input.scheduleVersion,
      });

      await db.logActivity({
        supervisorId: null,
        nurseId: ctx.nurseId,
        actionType: "training.response",
        entityType: "nurseTraining",
        entityId: input.assignmentId,
        summary: `Staff response: ${responseValue}${input.reason ? ` - ${input.reason.trim()}` : ""}`,
      });

      return { ok: true };
    }),

  submitTrainingEvidence: staffProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveTrainingSchedule(input.assignmentId);
      if (!resolved || resolved.nurseId !== ctx.nurseId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Training assignment not found on your profile." });
      }
      const mimeCheck = validateMime(input.mimeType, "document");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const oldKey = (resolved as any).certificateKey;
      const key = storageKey("certificates", ctx.nurseId, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);

      await db.updateNurseTraining(input.assignmentId, {
        certificateKey: storedKey,
        evidenceStatus: "Submitted",
        evidenceSubmittedAt: new Date(),
      });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }

      await db.logActivity({
        supervisorId: null,
        nurseId: ctx.nurseId,
        actionType: "training.evidence.submitted",
        entityType: "nurseTraining",
        entityId: input.assignmentId,
        summary: `Training completion evidence submitted for ${resolved.trainingName}`,
      });

      return { ok: true, url };
    }),

  myMemoFeed: staffProcedure.query(async ({ ctx }) => {
    return memosDb.listFeedForNurse(ctx.nurseId);
  }),

  unreadMemoCount: staffProcedure.query(async ({ ctx }) => {
    return memosDb.countUnreadForNurse(ctx.nurseId);
  }),

  markMemoRead: staffProcedure
    .input(z.object({ memoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await memosDb.markMemoRead({ memoId: input.memoId, nurseId: ctx.nurseId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not mark memo as read.";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
