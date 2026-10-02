import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import * as clinical from "../dbClinical";
import { acknowledgePatientMessage, listPatientMessages } from "../dbMessages";
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

  getMyClinical: patientProcedure.query(async ({ ctx }) => {
    return clinical.getClinical(ctx.patientId);
  }),

  respondAppointment: patientProcedure
    .input(
      z.object({
        appointmentId: z.number().int().positive().safe(),
        response: z.enum(["Confirmed", "RescheduleRequested"]),
        responseNote: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return clinical.respondToAppointment({
        patientId: ctx.patientId,
        id: input.appointmentId,
        response: input.response,
        responseNote: input.responseNote,
      });
    }),

  getMyMessages: patientProcedure.query(async ({ ctx }) => {
    return listPatientMessages(ctx.patientId);
  }),

  acknowledgeMessage: patientProcedure
    .input(z.object({ messageId: z.number().int().positive().safe() }))
    .mutation(async ({ ctx, input }) => {
      return acknowledgePatientMessage(ctx.patientId, input.messageId);
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
