import { z } from "zod";
import { patientProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { rustBackendEnabled } from "../rustBackend";
import { rustNotifications, rustUnreadNotifications, rustMarkNotification } from "../rustNotifications";

export const notificationsRouter = router({
  myList: patientProcedure.query(async ({ ctx }) => {
    if (rustBackendEnabled()) return rustNotifications(ctx.req);
    return db.listNotifications(ctx.patientId);
  }),

  myUnreadCount: patientProcedure.query(async ({ ctx }) => {
    if (rustBackendEnabled()) return rustUnreadNotifications(ctx.req);
    return db.countUnreadNotifications(ctx.patientId);
  }),

  markMyRead: patientProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (rustBackendEnabled()) return rustMarkNotification(ctx.req,input.id);
      await db.markNotificationRead(input.id, ctx.patientId);
      return { success: true } as const;
    }),

  markAllMyRead: patientProcedure.mutation(async ({ ctx }) => {
    if (rustBackendEnabled()) return rustMarkNotification(ctx.req);
    await db.markAllNotificationsRead(ctx.patientId);
    return { success: true } as const;
  }),
});
