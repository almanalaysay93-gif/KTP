import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { ASSIGNMENT_TYPES, EMPLOYMENT_STATUSES, STAFF_TYPES, storageKey, validateMime, nurseFullName, dateKey, daysUntilExpiry, deriveLicenseStatus, trainingCompliance } from "../../shared/nursetrack";
import { sanitizeFilename } from "../../shared/nursetrack";
import { storageDelete, storagePut } from "../storage";

const dateInput = z.union([z.date(), z.string().datetime()]).transform((d) => (d instanceof Date ? d : new Date(d)));
const nullableDateInput = z.union([z.date(), z.string().datetime(), z.null()]).transform((d) => (d === null ? null : d instanceof Date ? d : new Date(d))).optional();

export const nursesRouter = router({
  // Single round-trip initial load: nurses with areas in one call.
  initial: adminProcedure.query(async () => {
    const [rows, areaRows, licenseMap] = await Promise.all([
      db.listNurses(),
      db.listAreas(false),
      db.getAllNurseLicenseInfos(),
    ]);
    const areaById = new Map(areaRows.map((a) => [a.id, a]));
    const nurses = rows.map((n) => {
      const info = licenseMap.get(n.id) ?? { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null };
      return {
        ...n,
        currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
        licenseStatus: info.status,
        licenseNumber: info.licenseNumber,
        licenseExpiryDate: info.expiryDate,
        licenseDaysRemaining: info.daysRemaining,
      };
    });
    return { nurses, areas: areaRows };
  }),

  list: adminProcedure
    .input(z.object({ archived: z.boolean().optional(), areaId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const [rows, areaRows, licenseMap] = await Promise.all([
        db.listNurses({ archived: input?.archived, areaId: input?.areaId }),
        db.listAreas(false),
        db.getAllNurseLicenseInfos(),
      ]);
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      return rows.map((n) => {
        const info = licenseMap.get(n.id) ?? { status: null, licenseNumber: null, expiryDate: null, daysRemaining: null };
        return {
          ...n,
          currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
          licenseStatus: info.status,
          licenseNumber: info.licenseNumber,
          licenseExpiryDate: info.expiryDate,
          licenseDaysRemaining: info.daysRemaining,
        };
      });
    }),

  search: adminProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const rows = await db.searchNurses(input.query);
      const areaRows = await db.listAreas(false);
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      return Promise.all(rows.map(async (n) => {
        const info = await db.getNurseLicenseInfo(n.id);
        return {
          ...n,
          currentArea: n.currentAreaId ? areaById.get(n.currentAreaId) ?? null : null,
          licenseStatus: info.status,
          licenseNumber: info.licenseNumber,
          licenseExpiryDate: info.expiryDate,
          licenseDaysRemaining: info.daysRemaining,
        };
      }));
    }),

  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const nurse = await db.getNurseById(input.id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      const areaRows = await db.listAreas(false);
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      const info = await db.getNurseLicenseInfo(nurse.id);
      return {
        ...nurse,
        currentArea: nurse.currentAreaId ? areaById.get(nurse.currentAreaId) ?? null : null,
        licenseStatus: info.status,
        licenseNumber: info.licenseNumber,
        licenseExpiryDate: info.expiryDate,
        licenseDaysRemaining: info.daysRemaining,
      };
    }),

  profile: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const nurseId = Math.floor(input.id);
      const pg = db.getBatchClient();

      if (pg) {
        const sets = (await pg
          .unsafe(
            [
              `select * from nursetrack.nurses where id = ${nurseId} limit 1`,
              `select * from nursetrack.areas order by "sortOrder"`,
              `select * from nursetrack."credentialTypes"`,
              `select id, name from nursetrack."trainingCatalog" order by name`,
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
              `select "areaId", "trainingId", required
                 from nursetrack."areaTrainingRequirements"
                where "areaId" in (
                  select coalesce("currentAreaId", -1) from nursetrack.nurses where id = ${nurseId}
                  union
                  select coalesce("areaId", -1) from nursetrack."areaAssignments" where "nurseId" = ${nurseId}
                )`,
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
            any[], // areaReqs
          ];

        const [nurseRows, areaRows, credTypes, catalog, rawAssignments, rawCreds, rawTrainings, areaReqs] = sets;
        const nurse = nurseRows[0];
        if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });

        const areaById = new Map(areaRows.map((a: any) => [a.id, a]));
        const credTypeById = new Map(credTypes.map((t: any) => [t.id, t]));
        const catById = new Map(catalog.map((t: any) => [t.id, t]));

        const credentials = rawCreds.map((c: any) => ({
          ...c,
          typeName: credTypeById.get(c.credentialTypeId)?.name ?? "Unknown",
          derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
          daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
        }));

        const latestCred = rawCreds[0];
        const licenseStatus = latestCred ? deriveLicenseStatus(dateKey(latestCred.expiryDate)) : null;
        const licenseNumber = latestCred?.licenseNumber ?? null;
        const licenseExpiryDate = latestCred?.expiryDate ? dateKey(latestCred.expiryDate) : null;
        const licenseDaysRemaining = licenseExpiryDate ? daysUntilExpiry(licenseExpiryDate) : null;

        const trainings = rawTrainings.map((r: any) => ({
          ...r,
          trainingName: catById.get(r.trainingId)?.name ?? "Unknown",
        }));

        const assignments = rawAssignments.map((a: any) => {
          const area = areaById.get(a.areaId) ?? null;
          return {
            ...a,
            area,
            areaName: area?.name ?? "Unknown",
          };
        });

        const effectiveAreaId = nurse.currentAreaId ?? rawAssignments.find((a: any) => a.isCurrent)?.areaId ?? null;

        let compliance: { compliancePercent: number; requiredCount: number; completedCount: number } | null = null;
        if (effectiveAreaId) {
          const requiredIds = areaReqs
            .filter((r: any) => r.areaId === effectiveAreaId && r.required)
            .map((r: any) => r.trainingId);
          const comp = trainingCompliance({
            requiredTrainingIds: requiredIds,
            nurseTrainingRecords: rawTrainings.map((r: any) => ({
              trainingId: r.trainingId,
              status: r.status,
              expiryDate: r.expiryDate,
              completionDate: r.completionDate,
            })),
          });
          const completedValid = requiredIds.filter((tid: number) => {
            const recs = rawTrainings.filter((r: any) => r.trainingId === tid && r.status === "Completed");
            return recs.some((r: any) => !r.expiryDate || new Date(r.expiryDate) > new Date());
          }).length;
          compliance = { compliancePercent: comp, requiredCount: requiredIds.length, completedCount: completedValid };
        }

        return {
          nurse: {
            ...nurse,
            currentArea: effectiveAreaId ? areaById.get(effectiveAreaId) ?? null : null,
            licenseStatus,
            licenseNumber,
            licenseExpiryDate,
            licenseDaysRemaining,
          },
          assignments,
          credentials,
          trainings,
          compliance,
          catalog,
          areas: areaRows,
        };
      }

      // SQLite fallback (tests / local dev)
      const nurse = await db.getNurseById(input.id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });

      const [areaRows, licenseInfo, rawAssignments, rawCreds, rawTrainings, credTypes, catalog] = await Promise.all([
        db.listAreas(false),
        db.getNurseLicenseInfo(nurse.id),
        db.listAssignmentsForNurse(nurse.id),
        db.listCredentials({ nurseId: nurse.id }),
        db.listNurseTrainings({ nurseId: nurse.id }),
        db.listCredentialTypes(),
        db.listTrainingCatalog(false),
      ]);

      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      const credTypeById = new Map(credTypes.map((t) => [t.id, t]));
      const catById = new Map(catalog.map((t) => [t.id, t]));

      const assignments = rawAssignments.map((a: any) => {
        const area = areaById.get(a.areaId) ?? null;
        return {
          ...a,
          area,
          areaName: area?.name ?? "Unknown",
        };
      });

      const effectiveAreaId = nurse.currentAreaId ?? rawAssignments.find((a: any) => a.isCurrent)?.areaId ?? null;

      const credentials = rawCreds.map((c) => ({
        ...c,
        typeName: credTypeById.get(c.credentialTypeId)?.name ?? "Unknown",
        derivedStatus: deriveLicenseStatus(dateKey(c.expiryDate)),
        daysRemaining: daysUntilExpiry(dateKey(c.expiryDate)),
      }));

      const trainings = rawTrainings.map((r) => ({
        ...r,
        trainingName: catById.get(r.trainingId)?.name ?? "Unknown",
      }));

      let compliance: { compliancePercent: number; requiredCount: number; completedCount: number } | null = null;
      if (effectiveAreaId) {
        const requiredIds = await db.getAreaTrainingRequirementIds(effectiveAreaId);
        const comp = trainingCompliance({
          requiredTrainingIds: requiredIds,
          nurseTrainingRecords: rawTrainings.map((r) => ({
            trainingId: r.trainingId,
            status: r.status,
            expiryDate: r.expiryDate,
            completionDate: r.completionDate,
          })),
        });
        const completedValid = requiredIds.filter((tid) => {
          const recs = rawTrainings.filter((r) => r.trainingId === tid && r.status === "Completed");
          return recs.some((r) => !r.expiryDate || new Date(r.expiryDate) > new Date());
        }).length;
        compliance = { compliancePercent: comp, requiredCount: requiredIds.length, completedCount: completedValid };
      }

      return {
        nurse: {
          ...nurse,
          currentArea: effectiveAreaId ? areaById.get(effectiveAreaId) ?? null : null,
          licenseStatus: licenseInfo.status,
          licenseNumber: licenseInfo.licenseNumber,
          licenseExpiryDate: licenseInfo.expiryDate,
          licenseDaysRemaining: licenseInfo.daysRemaining,
        },
        assignments,
        credentials,
        trainings,
        compliance,
        catalog,
        areas: areaRows,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        employeeId: z.string().min(1).max(64),
        firstName: z.string().min(1).max(128),
        middleName: z.string().max(128).optional(),
        lastName: z.string().min(1).max(128),
        suffix: z.string().max(32).optional(),
        position: z.string().max(128).optional(),
        staffType: z.enum(STAFF_TYPES).optional(),
        dateHired: nullableDateInput,
        employmentStatus: z.enum([...EMPLOYMENT_STATUSES] as [string, ...string[]]),
        currentAreaId: z.number().optional(),
        accountEmail: z.string().email().max(320).optional(),
        licenseNumber: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { accountEmail, licenseNumber, ...nurseData } = input;
      const byId = await db.getNurseByEmployeeId(input.employeeId);
      if (byId) throw new TRPCError({ code: "CONFLICT", message: "A nurse with this Employee ID already exists." });
      const id = await db.createNurse(nurseData as Parameters<typeof db.createNurse>[0]);
      await db.updateNurse(id, { currentAreaId: input.currentAreaId ?? null });
      if (licenseNumber !== undefined) {
        const licRes = await db.upsertNursePrcLicense(id, licenseNumber);
        if (!licRes.ok) throw new TRPCError({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
      }
      if (accountEmail) {
        const result = await db.adminSetNurseAccountEmail(id, accountEmail);
        if (!result.ok) throw new TRPCError({ code: "CONFLICT", message: "That sign-in email is already in use." });
      }
      if (input.currentAreaId) {
        await db.createAssignment({
          nurseId: id,
          areaId: input.currentAreaId,
          startDate: new Date(),
          assignmentType: "Permanent Transfer",
          isCurrent: true,
        });
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: id,
        actionType: "nurse.created",
        entityType: "nurse",
        entityId: id,
        summary: `Nurse profile created: ${nurseFullName(input)}`,
      });
      return { id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        employeeId: z.string().min(1).max(64).optional(),
        firstName: z.string().min(1).max(128).optional(),
        middleName: z.string().max(128).optional().nullable(),
        lastName: z.string().min(1).max(128).optional(),
        suffix: z.string().max(32).optional().nullable(),
        position: z.string().max(128).optional().nullable(),
        staffType: z.enum(STAFF_TYPES).optional(),
        dateHired: nullableDateInput,
        employmentStatus: z.enum([...EMPLOYMENT_STATUSES] as [string, ...string[]]).optional(),
        currentAreaId: z.number().optional(),
        accountEmail: z.union([z.string().email().max(320), z.literal("")]).optional(),
        licenseNumber: z.string().max(64).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, employeeId, accountEmail, licenseNumber, ...rest } = input;
      const nurse = await db.getNurseById(id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      if (employeeId !== undefined && employeeId !== nurse.employeeId) {
        const taken = await db.getNurseByEmployeeId(employeeId);
        if (taken) throw new TRPCError({ code: "CONFLICT", message: "A nurse with this Employee ID already exists." });
      }
      await db.updateNurse(id, { ...rest, ...(employeeId ? { employeeId } : {}) } as Parameters<typeof db.updateNurse>[1]);
      if (licenseNumber !== undefined) {
        const licRes = await db.upsertNursePrcLicense(id, licenseNumber);
        if (!licRes.ok) throw new TRPCError({ code: "CONFLICT", message: "Another nurse is already registered with this PRC License Number." });
      }
      if (accountEmail !== undefined) {
        // "" clears accountEmail + linkedUserId (E10 supervisor reset) so the
        // claim flow can run again for a new account.
        const result = await db.adminSetNurseAccountEmail(id, accountEmail === "" ? null : accountEmail);
        if (!result.ok) throw new TRPCError({ code: "CONFLICT", message: "That sign-in email is already in use." });
      }
      if (input.currentAreaId !== undefined && input.currentAreaId !== nurse.currentAreaId) {
        await db.clearCurrentAssignmentsForNurse(id);
        if (input.currentAreaId) {
          await db.createAssignment({
            nurseId: id,
            areaId: input.currentAreaId,
            startDate: new Date(),
            assignmentType: "Permanent Transfer",
            remarks: "Updated via nurse profile edit",
            isCurrent: true,
          });
        }
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: id,
        actionType: "nurse.updated",
        entityType: "nurse",
        entityId: id,
        summary: `Nurse profile updated: ${nurseFullName({ ...nurse, ...input })}`,
      });
      return { success: true } as const;
    }),

  archive: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      if (nurse.archivedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Nurse is already archived." });
      await db.updateNurse(input.id, { archivedAt: new Date(), employmentStatus: "Archived" });
      await db.clearCurrentAssignmentsForNurse(input.id);
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.id,
        actionType: "nurse.archived",
        entityType: "nurse",
        entityId: input.id,
        summary: `Nurse archived: ${nurseFullName(nurse)}`,
      });
      return { success: true } as const;
    }),

  restore: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      if (!nurse.archivedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Nurse is not archived." });
      await db.updateNurse(input.id, { archivedAt: null, employmentStatus: nurse.employmentStatus === "Archived" ? "Active" : nurse.employmentStatus });
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.id,
        actionType: "nurse.restored",
        entityType: "nurse",
        entityId: input.id,
        summary: `Nurse restored: ${nurseFullName(nurse)}`,
      });
      return { success: true } as const;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.id);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      const fullName = nurseFullName(nurse);
      await db.deleteNurse(input.id);
      await db.logActivity({
        supervisorId: ctx.user.id,
        actionType: "nurse.deleted",
        entityType: "nurse",
        entityId: input.id,
        summary: `Nurse record permanently deleted: ${fullName} (${nurse.employeeId})`,
      });
      return { success: true } as const;
    }),

  uploadPhoto: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        fileBase64: z.string(),
        fileName: z.string().max(200),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      const mimeCheck = validateMime(input.mimeType, "photo");
      if (!mimeCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: mimeCheck.error });
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 10 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10 MB)." });
      const oldKey = nurse.profilePhotoKey;
      const key = storageKey("profile-photos", input.nurseId, sanitizeFilename(input.fileName));
      const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
      await db.updateNurse(input.nurseId, { profilePhotoKey: storedKey });
      if (oldKey && oldKey !== storedKey) {
        await storageDelete(oldKey).catch(() => {});
      }
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "nurse.photo.updated",
        entityType: "nurse",
        entityId: input.nurseId,
        summary: `Profile photo replaced for ${nurseFullName(nurse)}`,
      });
      return { url };
    }),

  getAssignments: adminProcedure
    .input(z.object({ nurseId: z.number() }))
    .query(async ({ input }) => {
      const rows = await db.listAssignmentsForNurse(input.nurseId);
      const areaRows = await db.listAreas();
      const areaById = new Map(areaRows.map((a) => [a.id, a]));
      return rows.map((a) => ({ ...a, area: areaById.get(a.areaId) ?? null }));
    }),

  changeArea: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        newAreaId: z.number(),
        effectiveDate: z.date(),
        assignmentType: z.enum([...ASSIGNMENT_TYPES] as [string, ...string[]]),
        remarks: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      const assignments = await db.listAssignmentsForNurse(input.nurseId);
      const current = assignments.find((a) => a.isCurrent);
      if (!current) throw new TRPCError({ code: "BAD_REQUEST", message: "Nurse has no current assignment." });
      if (current.areaId === input.newAreaId) throw new TRPCError({ code: "BAD_REQUEST", message: "Nurse is already in that area." });

      // Use the effective date in local calendar days so timezone offsets do not
      // shift a same-day change into a future-dated one.
      const effective = new Date(
        input.effectiveDate.getFullYear(),
        input.effectiveDate.getMonth(),
        input.effectiveDate.getDate(),
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Close current assignment the day before the effective date.
      await db.closeAssignment(current.id, new Date(effective.getTime() - 86400000));

      await db.createAssignment({
        nurseId: input.nurseId,
        areaId: input.newAreaId,
        startDate: effective,
        assignmentType: input.assignmentType as string,
        remarks: input.remarks ?? undefined,
        isCurrent: effective <= today,
      });
      if (effective <= today) {
        await db.updateNurse(input.nurseId, { currentAreaId: input.newAreaId });
      }

      const oldAreaName = current.areaId ? (await db.getAreaById(current.areaId))?.name : "Unassigned";
      const newAreaName = (await db.getAreaById(input.newAreaId))?.name ?? "Unknown";
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "nurse.area.changed",
        entityType: "areaAssignment",
        summary: `Area changed from ${oldAreaName} to ${newAreaName} effective ${effective.toLocaleDateString("en-CA")} (${input.assignmentType})`,
        metadata: {
          nurseId: input.nurseId,
          oldAreaId: current.areaId,
          newAreaId: input.newAreaId,
          effectiveDate: effective.toLocaleDateString("en-CA"),
          assignmentType: input.assignmentType,
        },
      });

      // Asynchronously dispatch email notification if staff has linked email
      if (nurse.accountEmail) {
        (async () => {
          try {
            const { sendEmail } = await import("../email/service");
            const { renderProfileUpdateEmail } = await import("../email/templates");
            const appUrl = process.env.APP_URL || "http://localhost:3000";
            const html = renderProfileUpdateEmail({
              nurseName: nurseFullName(nurse),
              updateTitle: "Unit / Area Assignment Changed",
              details: `Your assignment has been updated from ${oldAreaName} to ${newAreaName} (${input.assignmentType}) effective ${effective.toLocaleDateString("en-CA")}.`,
              actionUrl: `${appUrl}/me`,
            });
            await sendEmail({
              to: nurse.accountEmail!,
              subject: `Assignment Update: Transferred to ${newAreaName}`,
              html,
              nurseId: nurse.id,
              emailType: "profile_update",
            });
          } catch (err) {
            console.error("[Email:AreaChange] Failed to dispatch email:", err);
          }
        })();
      }

      return { success: true } as const;
    }),

  backfillAssignment: adminProcedure
    .input(
      z.object({
        nurseId: z.number(),
        areaId: z.number(),
        startDate: z.date(),
        endDate: nullableDateInput,
        assignmentType: z.enum([...ASSIGNMENT_TYPES] as [string, ...string[]]).optional(),
        remarks: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found" });
      await db.createAssignment({
        nurseId: input.nurseId,
        areaId: input.areaId,
        startDate: input.startDate,
        endDate: (input.endDate ?? undefined) as Date | undefined,
        assignmentType: input.assignmentType ?? undefined,
        remarks: input.remarks ?? undefined,
        isCurrent: false,
      });
      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: input.nurseId,
        actionType: "nurse.assignment.backfilled",
        entityType: "areaAssignment",
        summary: `Historical assignment backfilled: ${input.assignmentType ?? "Other"} (${input.startDate.toISOString().slice(0, 10)})`,
      });
      return { success: true } as const;
    }),

  getEmployeeById: adminProcedure
    .input(z.object({ employeeId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      return await db.getNurseByEmployeeId(input.employeeId);
    }),

  sendDirectNotice: adminProcedure
    .input(
      z.object({
        nurseId: z.number().int().positive(),
        subject: z.string().min(1).max(256),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const nurse = await db.getNurseById(input.nurseId);
      if (!nurse) throw new TRPCError({ code: "NOT_FOUND", message: "Nurse not found." });
      if (!nurse.accountEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This staff member does not have a linked email address yet.",
        });
      }

      const { sendEmail } = await import("../email/service");
      const { renderDirectNoticeEmail } = await import("../email/templates");
      const appUrl = process.env.APP_URL || "http://localhost:3000";

      const html = renderDirectNoticeEmail({
        nurseName: nurseFullName(nurse),
        subject: input.subject,
        message: input.message,
        actionUrl: `${appUrl}/me`,
      });

      const res = await sendEmail({
        to: nurse.accountEmail,
        subject: input.subject,
        html,
        nurseId: nurse.id,
        emailType: "manual_notice",
      });

      await db.logActivity({
        supervisorId: ctx.user.id,
        nurseId: nurse.id,
        actionType: "nurse.notice.sent",
        entityType: "nurse",
        entityId: nurse.id,
        summary: `Direct email notice sent to ${nurseFullName(nurse)}: "${input.subject}"`,
      });

      return res;
    }),
});
