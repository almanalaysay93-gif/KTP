import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { createBroadcastMessage, listAdminMessages } from "../dbMessages";
import { rustBackendEnabled } from "../rustBackend";
import { rustAdminMessages, rustBroadcast } from "../rustAdmin";

export const messagesRouter = router({
  list: adminProcedure.query(async ({ctx}) => {
    if (rustBackendEnabled()) return rustAdminMessages(ctx.req);
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
      }).refine(input => input.targetType !== "Stage" || !!input.targetStage?.trim(), "Choose a stage for the broadcast")
        .refine(input => input.targetType !== "Specific" || !!input.targetPatientId, "Choose a patient for the broadcast")
    )
    .mutation(async ({ ctx, input }) => {
      if (rustBackendEnabled()) return rustBroadcast(ctx.req,input);
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
