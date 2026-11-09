import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { DOCTOR_ROLES } from "@shared/ktp";
import { rustBackendEnabled } from "../rustBackend";
import { rustDoctors, rustDoctor, rustDoctorWrite } from "../rustAdmin";

export const doctorsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          role: z.enum(DOCTOR_ROLES).optional(),
          activeOnly: z.boolean().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (rustBackendEnabled()) return rustDoctors(ctx.req,input);
      return db.listDoctors(input);
    }),

  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (rustBackendEnabled()) return rustDoctor(ctx.req,input.id);
      const doc = await db.getDoctorById(input.id);
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doctor not found" });
      }
      return doc;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Doctor name is required").max(128),
        role: z.enum(DOCTOR_ROLES),
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx,input }) => {
      if (rustBackendEnabled()) return rustDoctorWrite(ctx.req,"createDoctor",input);
      return db.createDoctor(input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        role: z.enum(DOCTOR_ROLES).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx,input }) => {
      if (rustBackendEnabled()) return rustDoctorWrite(ctx.req,"updateDoctor",input);
      const { id, ...data } = input;
      const updated = await db.updateDoctor(id, data);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doctor not found" });
      }
      return updated;
    }),
});
