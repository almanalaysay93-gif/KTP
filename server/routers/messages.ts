import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { createBroadcastMessage, listAdminMessages } from "../dbMessages";

export const messagesRouter = router({
  list: adminProcedure.query(async () => {
    return listAdminMessages();
  }),

  create: adminProcedure
    .input(
      z.object({
        subject: z.string().trim().min(1, "Subject is required").max(200),
        body: z.string().trim().min(1, "Message content is required").max(4000),
        targetType: z.enum(["All", "Recipient", "Donor", "Stage", "Specific"]),
        targetStage: z.string().optional(),
        targetPatientId: z.number().int().positive().safe().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createBroadcastMessage({
        senderUserId: ctx.user.id,
        subject: input.subject,
        body: input.body,
        targetType: input.targetType,
        targetStage: input.targetStage,
        targetPatientId: input.targetPatientId,
      });
    }),
});
