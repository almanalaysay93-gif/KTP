import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { MEMO_TYPES } from "../../shared/nursetrack";
import * as memosDb from "../memosDb";

const memoTypeSchema = z.enum(MEMO_TYPES);

function asTrpc(err: unknown): never {
  const message = err instanceof Error ? err.message : "Memo request failed.";
  if (/not found/i.test(message)) throw new TRPCError({ code: "NOT_FOUND", message });
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const memosRouter = router({
  previewAudience: adminProcedure
    .input(z.object({ memoType: memoTypeSchema, areaId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      try {
        return await memosDb.previewAudience(input);
      } catch (err) {
        asTrpc(err);
      }
    }),

  create: adminProcedure
    .input(
      z.object({
        memoType: memoTypeSchema,
        areaId: z.number().int().positive().optional(),
        title: z.string().min(1).max(256),
        body: z.string().min(1).max(8000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await memosDb.createMemo({ ...input, authorUserId: ctx.user.id });
      } catch (err) {
        asTrpc(err);
      }
    }),

  list: adminProcedure
    .input(z.object({ memoType: memoTypeSchema.optional(), limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(async ({ input }) => memosDb.listMemos(input ?? {})),

  get: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const memo = await memosDb.getMemo(input.id);
      if (!memo) throw new TRPCError({ code: "NOT_FOUND", message: "Memo not found." });
      return memo;
    }),

  receipts: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => memosDb.listMemoReceipts(input.id)),

  retract: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await memosDb.retractMemo({ memoId: input.id, authorUserId: ctx.user.id });
      } catch (err) {
        asTrpc(err);
      }
    }),
});
