import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, staffProcedure } from "../_core/trpc";
import {
  createStaffMessage,
  listSentStaffMessages,
  getStaffMessageDetail,
  updateStaffMessage,
  archiveStaffMessage,
  listNurseFeed,
  countUnreadNurseMessages,
  markNurseMessageRead,
  acknowledgeNurseMessage,
} from "../staffFeed";
import { retryFailedOutboxItem } from "../trainingReminders";
import { getDb } from "../db";
import { getSqliteDb } from "../localDb";
import { trainingActivity } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export const staffFeedRouter = router({
  // --- SUPERVISOR PROCEDURES (adminProcedure) ---

  createMessage: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(160),
        body: z.string().min(1).max(5000),
        recipientNurseIds: z.array(z.number().int().positive()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const msg = await createStaffMessage({
          senderUserId: ctx.user.id,
          title: input.title,
          body: input.body,
          recipientNurseIds: input.recipientNurseIds,
        });
        return { ok: true, message: msg };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Failed to create message" });
      }
    }),

  listSentMessages: adminProcedure
    .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
    .query(async ({ input }) => {
      return listSentStaffMessages(input?.limit ?? 50);
    }),

  getMessageDetail: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const msg = await getStaffMessageDetail(input.id);
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return msg;
    }),

  updateMessage: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(160),
        body: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const updated = await updateStaffMessage(input.id, input.title, input.body);
        return { ok: true, message: updated };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Failed to update message" });
      }
    }),

  archiveMessage: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await archiveStaffMessage(input.id);
      return { ok: true };
    }),

  retryOutbox: adminProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      try {
        const res = await retryFailedOutboxItem(input.itemId);
        return { ok: res.ok, status: res.status, error: res.error };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Failed to retry delivery" });
      }
    }),

  // --- NURSE STAFF PROCEDURES (staffProcedure, scoped to ctx.nurseId) ---

  myFeed: staffProcedure
    .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listNurseFeed(ctx.nurseId, input?.limit ?? 50);
    }),

  unreadCount: staffProcedure.query(async ({ ctx }) => {
    const count = await countUnreadNurseMessages(ctx.nurseId);
    return { count };
  }),

  markRead: staffProcedure
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await markNurseMessageRead(ctx.nurseId, input.messageId);
      return { ok: true };
    }),

  acknowledge: staffProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        revision: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await acknowledgeNurseMessage(ctx.nurseId, input.messageId, input.revision);
        return { ok: true };
      } catch (err: any) {
        if (err.message?.includes("newer revision")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This message was updated by supervisor. Please read the latest version before acknowledging.",
          });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Failed to acknowledge message" });
      }
    }),

  myActivity: staffProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const db = await getDb();
      if (db) {
        return db
          .select()
          .from(trainingActivity)
          .where(eq(trainingActivity.nurseId, ctx.nurseId))
          .orderBy(desc(trainingActivity.createdAt))
          .limit(limit);
      }
      const sqlite = getSqliteDb();
      return sqlite
        .prepare("SELECT * FROM trainingActivity WHERE nurseId = ? ORDER BY datetime(createdAt) DESC LIMIT ?")
        .all(ctx.nurseId, limit) as any[];
    }),
});
