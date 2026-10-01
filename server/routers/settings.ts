import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const settingsRouter = router({
  getAll: adminProcedure.query(async () => {
    const all = await db.getAllSettings();
    return {
      appTitle: all.appTitle ?? "KTP",
      orgName: all.orgName ?? "Organ Transplant Services",
      contactEmail: all.contactEmail ?? "",
      emergencyHotlineText:
        all.emergencyHotlineText ?? "KT Unit Hotline: 0917-000-0000 | Hospital Trunk: (082) 227-2731 loc 4100",
      consentNoticeText:
        all.consentNoticeText ??
        "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.",
      consentVersion: all.consentVersion ?? "1",
    };
  }),

  getConsentNotice: publicProcedure.query(async () => {
    const consentNoticeText =
      (await db.getSetting("consentNoticeText")) ??
      "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.";
    const consentVersion = (await db.getSetting("consentVersion")) ?? "1";
    return {
      consentNoticeText,
      consentVersion: parseInt(consentVersion, 10) || 1,
    };
  }),

  update: adminProcedure
    .input(
      z.object({
        emergencyHotlineText: z.string().max(1000).optional(),
        consentNoticeText: z.string().max(5000).optional(),
        consentVersion: z.number().int().min(1).optional(),
        appTitle: z.string().max(128).optional(),
        orgName: z.string().max(128).optional(),
        contactEmail: z.string().email().or(z.literal("")).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.emergencyHotlineText !== undefined) {
        await db.setSetting("emergencyHotlineText", input.emergencyHotlineText);
      }
      if (input.consentNoticeText !== undefined) {
        await db.setSetting("consentNoticeText", input.consentNoticeText);
      }
      if (input.consentVersion !== undefined) {
        await db.setSetting("consentVersion", String(input.consentVersion));
      }
      if (input.appTitle !== undefined) {
        await db.setSetting("appTitle", input.appTitle);
      }
      if (input.orgName !== undefined) {
        await db.setSetting("orgName", input.orgName);
      }
      if (input.contactEmail !== undefined) {
        await db.setSetting("contactEmail", input.contactEmail);
      }

      await db.logActivity(
        ctx.user.id,
        null,
        "UPDATE_SETTINGS",
        { updatedKeys: Object.keys(input) },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      return { success: true } as const;
    }),
});
