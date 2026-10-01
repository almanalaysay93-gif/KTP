import { z } from "zod";
import { patientProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const notificationsRouter = router({
  myList: patientProcedure.query(async ({ ctx }) => {
    return db.listNotifications(ctx.patientId);
  }),

  myUnreadCount: patientProcedure.query(async ({ ctx }) => {
    return db.countUnreadNotifications(ctx.patientId);
  }),

  markMyRead: patientProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.id, ctx.patientId);
      return { success: true } as const;
    }),

  markAllMyRead: patientProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(ctx.patientId);
    return { success: true } as const;
  }),
});
