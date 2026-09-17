import { hasFullAccess } from "../adminAccess";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import * as db from "../db";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

const SLOW_PROCEDURE_MS = 1000;

// Logs slow procedures by path and type only. Inputs are never logged: they can hold staff data.
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

const requireUser = t.middleware(async opts => {
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

export type StaffAuthMode = "google" | "claim";

/**
 * Staff self-service procedures accept either a linked Google session or a
 * valid first-visit claim cookie — never any other nurse's id (see
 * docs/plans/2026-09-15-staff-signin-claim-then-google-design.md, section 4.4).
 */
export const staffProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (ctx.user) {
      const nurse = await db.getNurseByLinkedUserId(ctx.user.id);
      if (nurse) {
        const userEmail = (ctx.user.email ?? "").trim().toLowerCase();
        const nurseEmail = (nurse.accountEmail ?? "").trim().toLowerCase();
        if (userEmail && nurseEmail && userEmail === nurseEmail && !nurse.archivedAt) {
          return next({ ctx: { ...ctx, nurseId: nurse.id, authMode: "google" as StaffAuthMode } });
        }
        // If email was changed or nurse was archived, old session loses access immediately.
        // Never fall through to claim cookie when Google user identity is present.
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }
    }

    if (ctx.claimNurseId) {
      return next({ ctx: { ...ctx, nurseId: ctx.claimNurseId, authMode: "claim" as StaffAuthMode } });
    }

    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });

    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }),
);

export const adminProcedure = baseProcedure.use(
  t.middleware(async opts => {
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
  }),
);
