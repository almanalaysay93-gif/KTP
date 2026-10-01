import { hasFullAccess } from "../adminAccess";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import * as db from "../db";
import type { TrpcContext } from "./context";
import type { Patient } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

const SLOW_PROCEDURE_MS = 1000;

// Logs slow procedures by path and type only. Inputs are never logged.
const timing = t.middleware(async ({ path, type, next }) => {
  const started = Date.now();
  const result = await next();
  const ms = Date.now() - started;
  if (ms > SLOW_PROCEDURE_MS) {
    console.warn(`[tRPC] slow ${type} ${path} ${ms}ms ok=${result.ok}`);
  }
  return result;
});

const baseProcedure = t.procedure.use(timing);

export const publicProcedure = baseProcedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(requireUser);

export const adminProcedure = baseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !hasFullAccess(ctx.user.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * Base patient procedure: authenticates an active enrolled patient.
 * Revokes access immediately if patient is archived (status !== 'Active') or email changes.
 * Used for consent acceptance and checking portal eligibility.
 */
export const patientBaseProcedure = baseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const patient = await db.getPatientByLinkedUserId(ctx.user.id);
    if (!patient) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
    const patientEmail = (patient.accountEmail ?? "").trim().toLowerCase();
    if (!userEmail || !patientEmail || userEmail !== patientEmail || patient.status !== "Active") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        patientId: patient.id,
        patient,
      },
    });
  })
);

/**
 * Enforced patient procedure: requires active enrolled patient AND valid current consent.
 * Derives patientId strictly from authenticated session.
 */
export const patientProcedure = patientBaseProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const patient = (ctx as any).patient as Patient;

    const currentConsentVersion = await db.getSetting("consentVersion");
    const requiredVersion = currentConsentVersion ? parseInt(currentConsentVersion, 10) : 1;
    const acceptedVersion = patient.consentVersion ?? 0;

    if (acceptedVersion < requiredVersion) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CONSENT_REQUIRED",
      });
    }

    return next({
      ctx: {
        ...ctx,
        patientId: patient.id,
        patient,
      },
    });
  })
);
