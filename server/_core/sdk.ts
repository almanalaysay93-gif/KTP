import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  credentialRevision?: string;
};
class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    if (
      (ENV.isProduction || process.env.KTP_LOCAL_MODE === "1") &&
      !ENV.cookieSecret
    ) {
      throw new Error(
        "FATAL: JWT_SECRET environment variable is missing in production!"
      );
    }
    const secret =
      ENV.cookieSecret || "skti-default-jwt-secret-key-32-chars-min!";
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: {
      expiresInMs?: number;
      name?: string;
      credentialRevision?: string;
    } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: "ktp-local",
        name: options.name || "User",
        credentialRevision: options.credentialRevision,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId || "skti-app",
      name: payload.name || "User",
      ...(payload.credentialRevision
        ? { credentialRevision: payload.credentialRevision }
        : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing valid openId");
        return null;
      }

      return {
        openId,
        appId: typeof appId === "string" ? appId : "skti-app",
        name: typeof name === "string" ? name : "User",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(COOKIE_NAME);

    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    if (process.env.KTP_LOCAL_MODE === "1") {
      const { readLocalCredentialRevision } = await import("../localAuth");
      const { payload } = await jwtVerify(
        sessionToken!,
        this.getSessionSecret(),
        { algorithms: ["HS256"] }
      );
      const revision = await readLocalCredentialRevision();
      if (
        session.openId !== "ktp-local-admin" ||
        !revision ||
        payload.credentialRevision !== revision
      ) {
        throw ForbiddenError("Invalid local session");
      }
    }

    // One round trip: stamps lastSignedIn, enforces the email allowlist, and returns
    // the post-update row. A missing row means the session references a user
    // that no longer exists, which stays a hard rejection.
    const user = await db.touchUserSession(session.openId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}
export type AuthenticatedUser = User;
export const sdk = new SDKServer();
