import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { daysUntilExpiry, deriveLicenseStatus, LICENSE_STATUS_META, nurseFullName, parseStrictCalendarDate, renewalCycleKey, sanitizeFilename, storageKey, validateEffectivePrcDates, validateMime, dateKey } from "../../shared/nursetrack";
import { storageDelete, storagePut } from "../storage";

const nullableDateInput = z.union([z.date(), z.string().datetime(), z.null()]).transform((d) => (d === null ? null : d instanceof Date ? d : new Date(d))).optional();

export const credentialsRouter = router({
  listTypes: adminProcedure.query(() => db.listCredentialTypes()),

  createType: adminProcedure
    .input(z.object({ name: z.string().min(1).max(128), issuingOrganizationDefault: z.string().max(200).optional() }))
    .mutation(async ({ input }) => {
      const id = await db.createCredentialType(input.name, input.issuingOrganizationDefault);
      return { id };
    }),

  updateType: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(128).optional(), issuingOrganizationDefault: z.string().max(200).optional().nullable(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      await db.updateCredentialType(input.id, { ...input, issuingOrganizationDefault: input.issuingOrganizationDefault ?? undefined });
      return { success: true } as const;
    }),

  // Single round-trip initial load merging credentials + nurses + types
  initial: adminProcedure.query(async () => {
    const pg = db.getBatchClient();
    if (pg) {
      const sets = (await pg
        .unsafe(
          [
            `select id, "nurseId", "credentialTypeId", "licenseNumber", "issuingOrganization",
                    "issueDate"::text as "issueDate", "expiryDate"::text as "expiryDate",
                    "renewalStatus", "verificationStatus", "documentKey", remarks
               from nursetrack."nurseCredentials"
              order by "expiryDate" asc`,
            `select id, "employeeId", "firstName", "middleName", "lastName", suffix, position, "currentAreaId", "archivedAt"
               from nursetrack.nurses
              where "archivedAt" is null`,
            `select * from nursetrack."credentialTypes" order by name`,
          ].join(";\n"),
        )
        .simple()) as unknown as [any[], any[], any[]];

      const [rawCreds, activeNurses, types] = sets;
      const activeNurseIds = new Set(activeNurses.map((n: any) => n.id));
      const nurseById = new Map(activeNurses.map((n: any) => [n.id, n]));
      const typeById = new Map(types.map((t: any) => [t.id, t]));
      const activeCreds = rawCreds.filter((c: any) => activeNurseIds.has(c.nurseId));

      return {
        credentials: activeCreds.map((c: any) => ({
          ...c,
          nurse: nurseById.get(c.nurseId),
          typeName: typeById.get(c.credentialTypeId)?.name ?? "Unknown",
          derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
          daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
        })),
        nurses: activeNurses,
        types,
      };
    }

    const [credentials, nurses, types] = await Promise.all([
      db.listCredentials(),
      db.listNurses(),
      db.listCredentialTypes(),
    ]);
    const activeNurses = nurses.filter((n) => !n.archivedAt);
    const activeNurseIds = new Set(activeNurses.map((n) => n.id));
    const activeCreds = credentials.filter((c) => activeNurseIds.has(c.nurseId));
    const nurseById = new Map(nurses.map((n) => [n.id, n]));
    const typeById = new Map(types.map((t) => [t.id, t]));

    return {
      credentials: activeCreds.map((c) => ({
        ...c,
        nurse: nurseById.get(c.nurseId),
        typeName: typeById.get(c.credentialTypeId)?.name ?? "Unknown",
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
      })),
      nurses: activeNurses,
      types,
    };
  }),

  list: adminProcedure.query(async () => {
    const rows = await db.listCredentials();
    const nurses = await db.listNurses();
    const nurseById = new Map(nurses.map((n) => [n.id, n]));
    const types = await db.listCredentialTypes();
    const typeById = new Map(types.map((t) => [t.id, t]));
    return rows.map((c) => {
      const nurse = nurseById.get(c.nurseId);
      const typeName = typeById.get(c.credentialTypeId)?.name ?? "Unknown";
      return {
        ...c,
        nurse,
        typeName,
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
      };
    });
  }),

  listForNurse: adminProcedure
    .input(z.object({ nurseId: z.number() }))
    .query(async ({ input }) => {
      const rows = await db.listCredentials({ nurseId: input.nurseId });
      const types = await db.listCredentialTypes();
      const typeById = new Map(types.map((t) => [t.id, t]));
      return rows.map((c) => ({
        ...c,
        typeName: typeById.get(c.credentialTypeId)?.name ?? "Unknown",
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
      }));
    }),

  create: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        credentialTypeId: z.number(),
        licenseNumber: z.string().max(64).optional(),
        issuingOrganization: z.string().max(128).optional(),
        issueDate: nullableDateInput,
        expiryDate: z.date(),
        renewalStatus: z.enum(["Not Started", "Renewal In Progress", "Submitted", "Renewed"]).optional(),
        verificationStatus: z.enum(["Unverified", "Pending Verification", "Verified"]).optional(),
        documentKey: z.string().optional(),
        remarks: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      const id = await db.createCredential({
        ...input,
        renewalStatus: input.renewalStatus ?? "Not Started",
        verificationStatus: input.verificationStatus ?? "Unverified",
        renewalCycleKey: renewalCycleKey(`new-${Date.now()}`),
      });
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "license.created",
        entityType: "credential",
        entityId: id,
        summary: `License added for ${nurseFullName(nurse)} (expires ${dateKey(input.expiryDate)})`,
      });
      return { id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        licenseNumber: z.string().max(64).optional(),
        issuingOrganization: z.string().max(128).optional(),
        issueDate: nullableDateInput,
        expiryDate: z.date().optional(),
        renewalStatus: z.enum(["Not Started", "Renewal In Progress", "Submitted", "Renewed"]).optional(),
        verificationStatus: z.enum(["Unverified", "Pending Verification", "Verified"]).optional(),
        remarks: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const cred = (await db.listCredentials()).find((c) => c.id === id);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });

      if (rest.licenseNumber !== undefined) {
        const norm = rest.licenseNumber ? rest.licenseNumber.trim() : null;
        if (norm) {
          const matchingNurseIds = await db.findNurseIdsByLicenseNumber(norm);
          if (matchingNurseIds.some((nurseId) => nurseId !== cred.nurseId)) {
            throw new TRPCError({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
          }
        }
      }

      const patch: Record<string, unknown> = {};
      if (rest.licenseNumber !== undefined) patch.licenseNumber = rest.licenseNumber ? rest.licenseNumber.trim() : null;
      if (rest.issuingOrganization !== undefined) patch.issuingOrganization = rest.issuingOrganization;

      if (rest.issueDate !== undefined || rest.expiryDate !== undefined) {
        let effectiveDates;
        try {
          effectiveDates = validateEffectivePrcDates({
            existingIssueDate: cred.issueDate,
            existingExpiryDate: cred.expiryDate,
            patchIssueDate: rest.issueDate,
            patchExpiryDate: rest.expiryDate,
          });
        } catch (err: any) {
          if (err?.message === "Expiry date is required.") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Expiry date is required." });
          }
          throw new TRPCError({ code: "BAD_REQUEST", message: "Issue date cannot be after expiry date." });
        }
        if (rest.issueDate !== undefined) patch.issueDate = effectiveDates.effectiveIssueDate;
        if (rest.expiryDate !== undefined) {
          patch.expiryDate = effectiveDates.effectiveExpiryDate;
          patch.renewalCycleKey = renewalCycleKey(`${id}-${effectiveDates.effectiveExpiryDate.toISOString()}`);
        }
      }

      if (rest.renewalStatus !== undefined) patch.renewalStatus = rest.renewalStatus;
      if (rest.verificationStatus !== undefined) patch.verificationStatus = rest.verificationStatus;
      if (rest.remarks !== undefined) patch.remarks = rest.remarks;
      await db.updateCredential(id, patch);
      const nurse = await db.getNurseById(cred.nurseId);
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: cred.nurseId,
        actionType: "license.updated",
        entityType: "credential",
        entityId: id,
        summary: nurse ? `License updated for ${nurseFullName(nurse)}` : `License #${id} updated`,
      });
      return { success: true } as const;
    }),

  uploadDocument: adminProcedure
    .input(
      z.object({
        credentialId: z.number(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
        confirmedFields: z
          .object({
            licenseNumber: z.string().trim().max(64).optional().nullable(),
            issueDate: z.union([z.string(), z.date()]).optional().nullable(),
            expiryDate: z.union([z.string(), z.date()]).optional().nullable(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const all = await db.listCredentials();
      const cred = all.find((c) => c.id === input.credentialId);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
      const mimeCheck = validateMime(input.mimeType, "document");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });

      const patch: Record<string, unknown> = {};

      if (input.confirmedFields) {
        if (input.confirmedFields.expiryDate === null || input.confirmedFields.expiryDate === "") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Expiry date is required." });
        }

        let effectiveDates;
        try {
          effectiveDates = validateEffectivePrcDates({
            existingIssueDate: cred.issueDate,
            existingExpiryDate: cred.expiryDate,
            patchIssueDate: input.confirmedFields.issueDate,
            patchExpiryDate: input.confirmedFields.expiryDate,
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err?.message || "Invalid dates.",
          });
        }

        if (input.confirmedFields.licenseNumber !== undefined) {
          const normPrc = input.confirmedFields.licenseNumber ? input.confirmedFields.licenseNumber.trim() : null;
          if (normPrc) {
            const matchingNurseIds = await db.findNurseIdsByLicenseNumber(normPrc);
            if (matchingNurseIds.some((id) => id !== cred.nurseId)) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Another nurse is already registered with this PRC License Number.",
              });
            }
          }
          patch.licenseNumber = normPrc;
        }

        if (input.confirmedFields.issueDate !== undefined) {
          patch.issueDate = effectiveDates.effectiveIssueDate;
        }

        if (input.confirmedFields.expiryDate !== undefined) {
          patch.expiryDate = effectiveDates.effectiveExpiryDate;
          const existingExpiryStr = cred.expiryDate
            ? cred.expiryDate instanceof Date
              ? cred.expiryDate.toISOString().slice(0, 10)
              : String(cred.expiryDate).slice(0, 10)
            : null;
          const newExpiryStr = effectiveDates.effectiveExpiryDate.toISOString().slice(0, 10);
          if (newExpiryStr !== existingExpiryStr) {
            patch.renewalCycleKey = renewalCycleKey(`${cred.id}-${effectiveDates.effectiveExpiryDate.toISOString()}`);
          }
        }
      }

      const credTypes = await db.listCredentialTypes(true);
      const credType = credTypes.find((t) => t.id === cred.credentialTypeId);
      const isPrc = credType ? credType.name.toLowerCase().includes("prc") : false;
      if (isPrc) {
        patch.verificationStatus = "Pending Verification";
      }

      const oldKey = cred.documentKey;
      const key = storageKey("license-documents", cred.nurseId, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);

      patch.documentKey = storedKey;
      await db.updateCredential(input.credentialId, patch);

      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: cred.nurseId,
        actionType: "license.document.uploaded",
        entityType: "credential",
        entityId: input.credentialId,
        summary: `License document uploaded for license #${input.credentialId}${input.confirmedFields ? " with reviewed fields" : ""}`,
      });
      return { url };
    }),

  markRenewed: adminProcedure
    .input(
      z.object({
        credentialId: z.number(),
        newIssueDate: z.date(),
        newExpiryDate: z.date(),
        newLicenseNumber: z.string().max(64).optional(),
        newIssuingOrganization: z.string().max(128).optional(),
        documentKey: z.string().optional(),
        remarks: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cred = (await db.listCredentials()).find((c) => c.id === input.credentialId);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
      // Preserve the old record: mark it renewed and its reminders cycle as done.
      await db.updateCredential(input.credentialId, { renewalStatus: "Renewed" });
      await db.markReminderExpiredByCredential(input.credentialId);
      // Create a brand-new license record = new renewal cycle with its own reminder lifecycle.
      const nurse = await db.getNurseById(cred.nurseId);
      const newId = await db.createCredential({
        nurseId: cred.nurseId,
        credentialTypeId: cred.credentialTypeId,
        licenseNumber: input.newLicenseNumber ?? cred.licenseNumber ?? undefined,
        issuingOrganization: input.newIssuingOrganization ?? cred.issuingOrganization ?? undefined,
        issueDate: input.newIssueDate,
        expiryDate: input.newExpiryDate,
        renewalStatus: "Not Started",
        verificationStatus: cred.verificationStatus,
        documentKey: input.documentKey ?? undefined,
        renewalCycleKey: renewalCycleKey(`new-${Date.now()}`),
        remarks: input.remarks ?? undefined,
      });
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: cred.nurseId,
        actionType: "license.renewed",
        entityType: "credential",
        entityId: input.credentialId,
        summary: nurse
          ? `License renewed for ${nurseFullName(nurse)} — new cycle expiring ${dateKey(input.newExpiryDate)} (old record #${input.credentialId} preserved)`
          : `License renewed — new cycle #${newId}`,
      });
      return { id: newId } as const;
    }),
});

export { LICENSE_STATUS_META };
