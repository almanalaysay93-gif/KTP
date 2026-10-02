import { clinicalRouter } from "./routers/clinical";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { patientBaseProcedure, publicProcedure, router } from "./_core/trpc";
import { patientsRouter } from "./routers/patients";
import { doctorsRouter } from "./routers/doctors";
import { settingsRouter } from "./routers/settings";
import { dashboardRouter } from "./routers/dashboard";
import { notificationsRouter } from "./routers/notifications";
import { patientPortalRouter } from "./routers/patientPortal";
import { messagesRouter } from "./routers/messages";
import { automationsRouter } from "./routers/automations";
import { patientImportRouter } from "./routers/patientImport";
import * as db from "./db";
import { hasFullAccess } from "./adminAccess";
import type { Patient } from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;

      const isAdmin = hasFullAccess(ctx.user.email);
      let patient: Patient | null = null;
      let consentRequired = false;

      if (!isAdmin) {
        patient = await db.getPatientByLinkedUserId(ctx.user.id);
        if (!patient && ctx.user.email) {
          patient = await db.autoLinkPatientByEmail(ctx.user.id, ctx.user.email);
        }
        if (patient) {
          const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
          const patientEmail = (patient.accountEmail ?? "").trim().toLowerCase();
          if (userEmail !== patientEmail || patient.status !== "Active") {
            // Archived or email mismatch -> revoked access
            patient = null;
          } else {
            const currentConsent = await db.getSetting("consentVersion");
            const reqVersion = currentConsent ? parseInt(currentConsent, 10) : 1;
            consentRequired = (patient.consentVersion ?? 0) < reqVersion;
          }
        }
      }

      return {
        ...ctx.user,
        isAdmin,
        patient,
        consentRequired,
      };
    }),

    getConsentNotice: publicProcedure.query(async () => {
      const consentNoticeText =
        (await db.getSetting("consentNoticeText")) ??
        "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.";
      const currentVersion = (await db.getSetting("consentVersion")) ?? "1";
      return {
        consentNoticeText,
        consentVersion: parseInt(currentVersion, 10) || 1,
      };
    }),

    acceptConsent: patientBaseProcedure.mutation(async ({ ctx }) => {
      const currentVersion = (await db.getSetting("consentVersion")) ?? "1";
      const verNum = parseInt(currentVersion, 10) || 1;

      const updated = await db.updatePatientConsent(ctx.patientId, verNum);

      await db.logActivity(
        ctx.user.id,
        ctx.patientId,
        "ACCEPT_CONSENT",
        { consentVersion: verNum },
        ctx.req.ip,
        ctx.req.headers["user-agent"]
      );

      return { success: true, consentVersion: verNum, patient: updated };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  clinical: clinicalRouter,
  patients: patientsRouter,
  doctors: doctorsRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  patientPortal: patientPortalRouter,
  messages: messagesRouter,
  automations: automationsRouter,
  patientImport: patientImportRouter,
});

export type AppRouter = typeof appRouter;
