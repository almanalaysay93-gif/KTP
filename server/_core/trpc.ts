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
export const publicProcedure = t.procedure;

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

export const protectedProcedure = t.procedure.use(requireUser);

export type StaffAuthMode = "google" | "claim";

/**
 * Staff self-service procedures accept either a linked Google session or a
 * valid first-visit claim cookie — never any other nurse's id (see
 * docs/plans/2026-09-15-staff-signin-claim-then-google-design.md, section 4.4).
 */
export const staffProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (ctx.user) {
      const nurse = await db.getNurseByLinkedUserId(ctx.user.id);
      if (nurse) {
        return next({ ctx: { ...ctx, nurseId: nurse.id, authMode: "google" as StaffAuthMode } });
      }
    }

    if (ctx.claimNurseId) {
      return next({ ctx: { ...ctx, nurseId: ctx.claimNurseId, authMode: "claim" as StaffAuthMode } });
    }

    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }),
);

export const adminProcedure = t.procedure.use(
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
