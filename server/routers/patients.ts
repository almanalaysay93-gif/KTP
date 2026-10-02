import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { hasFullAccess } from "../adminAccess";
import {
  DONOR_STAGES,
  PATIENT_STATUSES,
  PATIENT_TYPES,
  RECIPIENT_STAGES,
  RISK_CATEGORIES,
  isValidStageForPatientType,
} from "@shared/ktp";

const patientInputSchema = z.object({
  hrn: z.string().min(1, "HRN is required").max(64),
  patientType: z.enum(PATIENT_TYPES),
  firstName: z.string().min(1, "First name is required").max(128),
  middleName: z.string().max(128).nullable().optional(),
  lastName: z.string().min(1, "Last name is required").max(128),
  suffix: z.string().max(32).nullable().optional(),
  sex: z.enum(["M", "F"]).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  contactNumber: z.string().max(32).nullable().optional(),
  // Optional. A patient with no Gmail account has no access to the patient portal.
  accountEmail: z
    .union([z.literal(""), z.string().trim().email("Gmail account is not a valid e-mail address").max(320)])
    .nullable()
    .optional()
    // Not sent: no change (an update keeps the saved value). Empty: no Gmail account.
    .transform(value => (value === undefined ? undefined : value || null)),
  nephrologistId: z.number().nullable().optional(),
  fellowId: z.number().nullable().optional(),
  stage: z.string().min(1, "Stage is required"),
  riskCategory: z.enum(RISK_CATEGORIES).nullable().optional(),
  surgeryDate: z.string().nullable().optional(),
  linkedRecipientId: z.number().nullable().optional(),
  followupMonths: z.number().int().min(1).max(3).default(1),
  status: z.enum(PATIENT_STATUSES).default("Active"),
  photoFileId: z.number().nullable().optional(),
});

function validatePatientBusinessRules(
  data: z.infer<typeof patientInputSchema>,
  patientId?: number
) {
  // Gmail cannot be on admin allowlist
  if (data.accountEmail && hasFullAccess(data.accountEmail)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Patient Gmail cannot be on the admin email allowlist",
    });
  }

  // Validate stage against patient type
  if (!isValidStageForPatientType(data.stage, data.patientType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Stage '${data.stage}' is not valid for patient type '${data.patientType}'`,
    });
  }

  // Surgery date required for PostKT and PostDonation
  if ((data.stage === "PostKT" || data.stage === "PostDonation") && !data.surgeryDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Surgery date is required when stage is '${data.stage}'`,
    });
  }

  // Donors must link to a valid recipient, never to self
  if (data.patientType === "Donor") {
    if (!data.linkedRecipientId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Living donor must be linked to a recipient",
      });
    }
    if (patientId && data.linkedRecipientId === patientId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Donor cannot be linked to themselves",
      });
    }
  }
}

export const patientsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          type: z.enum(PATIENT_TYPES).optional(),
          stage: z.string().optional(),
          doctorId: z.number().optional(),
          status: z.enum(PATIENT_STATUSES).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return db.listPatients(input);
    }),

  getById: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive().safe(),
        allowMissing: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const patient = await db.getPatientById(input.id);
      if (!patient) {
        if (input.allowMissing) {
          return { patient: null, linkedRecipient: null, linkedDonors: [] };
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      // Log admin access of patient profile (RA 10173 compliance)
      await db.logActivity(
        ctx.user.id,
        patient.id,
        "VIEW_PATIENT_PROFILE",
        { hrn: patient.hrn, name: `${patient.lastName}, ${patient.firstName}` },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      // If patient is a donor, also fetch linked recipient preview
      let linkedRecipient = null;
      if (patient.linkedRecipientId) {
        linkedRecipient = await db.getPatientById(patient.linkedRecipientId);
      }

      // If patient is a recipient, find any linked donors
      let linkedDonors: any[] = [];
      if (patient.patientType === "Recipient") {
        const allPatients = await db.listPatients({ type: "Donor" });
        linkedDonors = allPatients.filter((p) => p.linkedRecipientId === patient.id);
      }

      return {
        patient,
        linkedRecipient,
        linkedDonors,
      };
    }),

  create: adminProcedure
    .input(patientInputSchema)
    .mutation(async ({ ctx, input }) => {
      validatePatientBusinessRules(input);

      // Check unique HRN
      const existingHrn = await db.getPatientByHrn(input.hrn);
      if (existingHrn) {
        throw new TRPCError({ code: "CONFLICT", message: "A patient with this HRN already exists" });
      }

      // Check unique accountEmail
      const existingEmail = input.accountEmail ? await db.getPatientByAccountEmail(input.accountEmail) : null;
      if (existingEmail) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A patient with this Gmail account is already enrolled",
        });
      }

      // Verify linked recipient exists and is actually a Recipient
      if (input.patientType === "Donor" && input.linkedRecipientId) {
        const recipient = await db.getPatientById(input.linkedRecipientId);
        if (!recipient || recipient.patientType !== "Recipient") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Linked recipient not found or is not a recipient profile",
          });
        }
      }

      const created = await db.createPatient({ ...input, accountEmail: input.accountEmail ?? null } as any);

      await db.logActivity(
        ctx.user.id,
        created.id,
        "ENROLL_PATIENT",
        { hrn: created.hrn, type: created.patientType, stage: created.stage },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive().safe(),
        data: patientInputSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPatientById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const merged = {
        ...existing,
        ...input.data,
      } as z.infer<typeof patientInputSchema>;

      validatePatientBusinessRules(merged, input.id);

      // Check HRN duplicate if changed
      if (input.data.hrn && input.data.hrn !== existing.hrn) {
        const dupHrn = await db.getPatientByHrn(input.data.hrn);
        if (dupHrn && dupHrn.id !== input.id) {
          throw new TRPCError({ code: "CONFLICT", message: "A patient with this HRN already exists" });
        }
      }

      // Check Gmail duplicate if changed
      if (input.data.accountEmail && input.data.accountEmail.toLowerCase() !== (existing.accountEmail ?? "").toLowerCase()) {
        const dupEmail = await db.getPatientByAccountEmail(input.data.accountEmail);
        if (dupEmail && dupEmail.id !== input.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A patient with this Gmail account is already enrolled",
          });
        }
      }

      // Validate linked recipient
      if (merged.patientType === "Donor" && merged.linkedRecipientId) {
        const recipient = await db.getPatientById(merged.linkedRecipientId);
        if (!recipient || recipient.patientType !== "Recipient") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Linked recipient not found or is not a recipient profile",
          });
        }
      }

      const updated = await db.updatePatient(input.id, input.data as any);

      await db.logActivity(
        ctx.user.id,
        input.id,
        "UPDATE_PATIENT",
        { changes: Object.keys(input.data) },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      return updated;
    }),

  archive: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive().safe(),
        status: z.enum(["Inactive", "Deceased", "Transferred"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPatientById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const updated = await db.updatePatient(input.id, { status: input.status });

      await db.logActivity(
        ctx.user.id,
        input.id,
        "ARCHIVE_PATIENT",
        { previousStatus: existing.status, newStatus: input.status, reason: input.reason },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      return updated;
    }),

  activityLogs: adminProcedure
    .input(z.object({ patientId: z.number().int().positive().safe(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.listActivityLogs(input.patientId, input.limit ?? 50);
    }),
});
