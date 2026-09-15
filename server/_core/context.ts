import { CLAIM_COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** nurseId from a valid first-visit claim cookie, if any. Never a `users` row. */
  claimNurseId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let claimNurseId: number | null = null;
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    claimNurseId = await sdk.verifyClaimToken(cookies[CLAIM_COOKIE_NAME]);
  } catch (error) {
    claimNurseId = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    claimNurseId,
  };
}

