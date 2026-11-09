import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { isIP } from "node:net";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { sdk } from "./_core/sdk";

const OPEN_ID = "ktp-local-admin";
const EMAIL = "local.admin@localhost";
const SESSION_MS = 8 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const passwordBody = z
  .object({ password: z.string().min(12).max(128) })
  .strict();
const emptyBody = z.object({}).strict();
const credentialSchema = z
  .object({
    version: z.literal(1),
    salt: z.string().regex(/^[a-f0-9]{32}$/),
    hash: z.string().regex(/^[a-f0-9]{128}$/),
    revision: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict();
type Credentials = z.infer<typeof credentialSchema>;

class LocalError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
const fileCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code;

async function directory(): Promise<string> {
  const path = process.env.LOCAL_APP_DATA_DIR;
  if (!path || !isAbsolute(path))
    throw new LocalError(503, "Local authentication is unavailable");
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (typeof process.getuid === "function" && info.uid !== process.getuid())
  ) {
    throw new LocalError(503, "Local authentication is unavailable");
  }
  await chmod(path, 0o700);
  return path;
}

async function readCredentials(): Promise<Credentials | null> {
  const path = join(await directory(), "credentials.json");
  let handle;
  try {
    // O_NOFOLLOW is not available on Windows; reject reparse links explicitly.
    if ((await lstat(path)).isSymbolicLink())
      throw new LocalError(503, "Local authentication is unavailable");
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (fileCode(error) === "ENOENT") return null;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.size > 4096 ||
      (typeof process.getuid === "function" && info.uid !== process.getuid())
    ) {
      throw new LocalError(503, "Local authentication is unavailable");
    }
    await handle.chmod(0o600);
    return credentialSchema.parse(JSON.parse(await handle.readFile("utf8")));
  } finally {
    await handle.close();
  }
}

/** Session validation binds local tokens to the currently stored credential file. */
export async function readLocalCredentialRevision(): Promise<string | null> {
  if (process.env.KTP_LOCAL_MODE !== "1") return null;
  return (await readCredentials())?.revision ?? null;
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

async function publish(credentials: Credentials): Promise<void> {
  const path = await directory();
  const temporary = join(
    path,
    `.credentials-${randomBytes(16).toString("hex")}.tmp`
  );
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(credentials), "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(temporary).catch(() => {});
    throw error;
  }
  await handle.close();
  try {
    // A hard link publishes the complete private file atomically and cannot
    // overwrite another setup winner. No partially written credential is read.
    await link(temporary, join(path, "credentials.json"));
  } catch (error) {
    if (fileCode(error) === "EEXIST")
      throw new LocalError(409, "Local password is already configured");
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function loopback(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  return (
    normalized === "::1" ||
    (isIP(normalized) === 4 && normalized.startsWith("127."))
  );
}

function guard(req: Request): void {
  if (process.env.KTP_LOCAL_MODE !== "1")
    throw new LocalError(404, "Not found");
  if (!loopback(req.socket.remoteAddress ?? ""))
    throw new LocalError(403, "Local access required");
  const protocol = req.protocol;
  if (protocol !== "http" && protocol !== "https")
    throw new LocalError(403, "Local access required");
  let url: URL;
  try {
    url = new URL(`${protocol}://${req.headers.host ?? ""}`);
  } catch {
    throw new LocalError(403, "Local access required");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    (hostname !== "localhost" && !loopback(hostname)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new LocalError(403, "Local access required");
  if (req.method !== "GET") {
    if (!req.is("application/json"))
      throw new LocalError(415, "JSON request required");
    if (
      (req.headers.origin !== undefined && req.headers.origin !== url.origin) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      throw new LocalError(403, "Same-origin request required");
  }
}

function body<T>(schema: z.ZodType<T>, req: Request): T {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    throw new LocalError(400, "Invalid local authentication request");
  return parsed.data;
}

async function account(): Promise<void> {
  await db.upsertUser({
    openId: OPEN_ID,
    name: "Local Administrator",
    email: EMAIL,
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });
  const user = await db.getUserByOpenId(OPEN_ID);
  if (!user || user.email !== EMAIL || user.role !== "admin")
    throw new LocalError(503, "Local authentication is unavailable");
}

async function session(
  req: Request,
  res: Response,
  credentials: Credentials
): Promise<void> {
  const options: Parameters<typeof sdk.createSessionToken>[1] & {
    credentialRevision: string;
  } = {
    name: "Local Administrator",
    expiresInMs: SESSION_MS,
    credentialRevision: credentials.revision,
  };
  const token = await sdk.createSessionToken(OPEN_ID, options);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.protocol === "https",
    path: "/",
    maxAge: SESSION_MS,
  });
  res.json({ success: true });
}

export function registerLocalAuthRoutes(app: Express): void {
  // Keys are fixed by the application, never supplied by request IPs. The
  // shared setup/login budget cannot grow or be bypassed by rotating 127/8 IPs.
  const attempts = new Map<"password", { start: number; count: number }>();
  const limited = (res: Response) => {
    const now = Date.now();
    let bucket = attempts.get("password");
    if (!bucket || now - bucket.start >= WINDOW_MS) {
      bucket = { start: now, count: 0 };
      attempts.set("password", bucket);
    }
    if (bucket.count >= 8) {
      res.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((WINDOW_MS - now + bucket.start) / 1000))
      );
      throw new LocalError(429, "Too many password attempts. Try again later");
    }
    bucket.count++;
  };
  const route =
    (work: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        guard(req);
        await work(req, res);
      } catch (error) {
        const known = error instanceof LocalError;
        res.status(known ? error.status : 503).json({
          error: known ? error.message : "Local authentication is unavailable",
        });
      }
    };
  app.get(
    "/api/local-auth/status",
    route(async (_req, res) => {
      res.json({ setupRequired: (await readCredentials()) === null });
    })
  );
  app.post(
    "/api/local-auth/setup",
    route(async (req, res) => {
      limited(res);
      const { password } = body(passwordBody, req);
      if (await readCredentials())
        throw new LocalError(409, "Local password is already configured");
      const salt = randomBytes(16);
      const credentials: Credentials = {
        version: 1,
        salt: salt.toString("hex"),
        hash: (await derive(password, salt)).toString("hex"),
        revision: randomBytes(16).toString("hex"),
      };
      await account();
      await publish(credentials);
      await session(req, res, credentials);
    })
  );
  app.post(
    "/api/local-auth/login",
    route(async (req, res) => {
      limited(res);
      const { password } = body(passwordBody, req);
      const credentials = await readCredentials();
      if (!credentials) throw new LocalError(409, "Set a local password first");
      const key = await derive(password, Buffer.from(credentials.salt, "hex"));
      if (!timingSafeEqual(key, Buffer.from(credentials.hash, "hex")))
        throw new LocalError(401, "Incorrect password");
      await account();
      await session(req, res, credentials);
    })
  );
  app.post(
    "/api/local-auth/logout",
    route(async (req, res) => {
      body(emptyBody, req);
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.protocol === "https",
        path: "/",
      });
      res.json({ success: true });
    })
  );
}
