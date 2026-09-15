import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { CLAIM_COOKIE_NAME } from "@shared/const";
import { publicProcedure, router, staffProcedure } from "../_core/trpc";
import { getClaimCookieOptions } from "../_core/cookies";
import { checkRateLimit } from "../_core/rateLimit";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { nurseFullName, sanitizeFilename, storageKey, validateMime } from "../../shared/nursetrack";
import { storagePut } from "../storage";

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
    const nurse = await db.getNurseById(ctx.nurseId);
    if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

    const [areaRows, types, catalog] = await Promise.all([
      db.listAreas(false),
      db.listCredentialTypes(true),
      db.listTrainingCatalog(true),
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const typeById = new Map(types.map((t) => [t.id, t.name]));
    const catalogById = new Map(catalog.map((c) => [c.id, c.name]));

    const { status, licenseNumber } = await db.getNurseLicenseInfo(nurse.id);
    const credentials = await db.listCredentials({ nurseId: nurse.id });
    const trainings = await db.listNurseTrainings({ nurseId: nurse.id });
    const assignments = await db.listAssignmentsForNurse(nurse.id);

    return {
      ...nurse,
      currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
      licenseStatus: status,
      licenseNumber,
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

  uploadMyPhoto: staffProcedure
    .input(z.object({ fileBase64: z.string(), fileName: z.string().max(200), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(ctx.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Your account isn't linked to a staff profile yet." });

      const mimeCheck = validateMime(input.mimeType, "photo");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const key = storageKey("profile-photos", nurse.id, sanitizeFilename(input.fileName));
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurse(nurse.id, { profilePhotoKey: key });
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

      const key = storageKey("license-documents", nurse.id, sanitizeFilename(input.fileName));
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updateCredential(input.credentialId, { documentKey: key });
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

      const key = storageKey("certificates", nurse.id, sanitizeFilename(input.fileName));
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurseTraining(input.recordId, { certificateKey: key });
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
});
