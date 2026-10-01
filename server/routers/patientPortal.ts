import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { patientProcedure, router } from "../_core/trpc";

export const patientPortalRouter = router({
  getMyProfile: patientProcedure.query(async ({ ctx }) => {
    const patient = await db.getPatientById(ctx.patientId);
    if (!patient) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Patient profile not found" });
    }

    let nephrologist = null;
    if (patient.nephrologistId) {
      nephrologist = await db.getDoctorById(patient.nephrologistId);
    }

    let fellow = null;
    if (patient.fellowId) {
      fellow = await db.getDoctorById(patient.fellowId);
    }

    // Patient cannot see recipient's medical records or vice-versa, only basic reference if linked
    let linkedRecipientName: string | null = null;
    if (patient.linkedRecipientId) {
      const recipient = await db.getPatientById(patient.linkedRecipientId);
      if (recipient) {
        linkedRecipientName = `${recipient.firstName} ${recipient.lastName}`;
      }
    }

    return {
      patient,
      nephrologist,
      fellow,
      linkedRecipientName,
    };
  }),

  updateContact: patientProcedure
    .input(z.object({ contactNumber: z.string().max(32).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db.updatePatient(ctx.patientId, {
        contactNumber: input.contactNumber,
      });
      return updated;
    }),

  updatePhoto: patientProcedure
    .input(z.object({ photoFileId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db.updatePatient(ctx.patientId, {
        photoFileId: input.photoFileId,
      });
      return updated;
    }),
});
