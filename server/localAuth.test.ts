import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, RequestHandler, Response } from "express";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  upsert: vi.fn(),
  get: vi.fn(),
  token: vi.fn(),
}));
vi.mock("./db", () => ({
  upsertUser: mocks.upsert,
  getUserByOpenId: mocks.get,
}));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.token } }));
import {
  readLocalCredentialRevision,
  registerLocalAuthRoutes,
} from "./localAuth";

type Overrides = {
  peer?: string;
  host?: string;
  origin?: string;
  protocol?: string;
  type?: string;
  fetchSite?: string;
};
function harness() {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get: (path: string, work: RequestHandler) =>
      routes.set(`GET ${path}`, work),
    post: (path: string, work: RequestHandler) =>
      routes.set(`POST ${path}`, work),
  } as unknown as Express;
  registerLocalAuthRoutes(app);
  return async (
    method: "GET" | "POST",
    route: string,
    body?: unknown,
    options: Overrides = {}
  ) => {
    const headers: Record<string, string> = {
      host: options.host ?? "127.0.0.1:3210",
    };
    if (options.origin !== undefined) headers.origin = options.origin;
    if (options.fetchSite !== undefined)
      headers["sec-fetch-site"] = options.fetchSite;
    const type = options.type ?? "application/json";
    const request = {
      method,
      protocol: options.protocol ?? "http",
      headers,
      body,
      socket: { remoteAddress: options.peer ?? "127.0.0.1" },
      is: () => (type === "application/json" ? type : false),
    } as unknown as Request;
    const result = {
      status: 200,
      body: undefined as any,
      headers: new Map<string, unknown>(),
    };
    const response = {
      setHeader: vi.fn((key: string, value: unknown) =>
        result.headers.set(key, value)
      ),
      status: vi.fn((code: number) => {
        result.status = code;
        return response;
      }),
      json: vi.fn((value: unknown) => {
        result.body = value;
        return response;
      }),
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };
    const handler = routes.get(`${method} /api/local-auth/${route}`);
    expect(handler).toBeDefined();
    await handler!(request, response as unknown as Response, vi.fn());
    return { ...result, response };
  };
}

let root: string;
let data: string;
const password = "A private local password";
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ktp-local-auth-"));
  data = join(root, "private");
  vi.stubEnv("KTP_LOCAL_MODE", "1");
  vi.stubEnv("LOCAL_APP_DATA_DIR", data);
  mocks.user = null;
  mocks.upsert.mockReset().mockImplementation(async user => {
    mocks.user = { id: 1, ...user };
  });
  mocks.get.mockReset().mockImplementation(async () => mocks.user);
  mocks.token.mockReset().mockResolvedValue("signed-local-session");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("private local password authentication", () => {
  it("disables every endpoint outside local mode before filesystem or account access", async () => {
    vi.stubEnv("KTP_LOCAL_MODE", "0");
    const call = harness();
    for (const [method, route, body] of [
      ["GET", "status", undefined],
      ["POST", "setup", { password }],
      ["POST", "login", { password }],
      ["POST", "logout", {}],
    ] as const) {
      expect((await call(method, route, body)).status).toBe(404);
    }
    expect(await readLocalCredentialRevision()).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
    await expect(stat(data)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stores only a versioned salted hash privately and issues an eight-hour revision-bound session", async () => {
    const call = harness();
    expect((await call("GET", "status")).body).toEqual({ setupRequired: true });
    const result = await call("POST", "setup", { password });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
    const raw = await readFile(join(data, "credentials.json"), "utf8");
    expect(raw).not.toContain(password);
    const saved = JSON.parse(raw);
    expect(saved).toEqual({
      version: 1,
      salt: expect.stringMatching(/^[a-f0-9]{32}$/),
      hash: expect.stringMatching(/^[a-f0-9]{128}$/),
      revision: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    expect((await stat(data)).mode & 0o777).toBe(0o700);
    expect((await stat(join(data, "credentials.json"))).mode & 0o777).toBe(
      0o600
    );
    expect(await readdir(data)).toEqual(["credentials.json"]);
    expect(await readLocalCredentialRevision()).toBe(saved.revision);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "ktp-local-admin",
        name: "Local Administrator",
        email: "local.admin@localhost",
        loginMethod: "local",
        role: "admin",
      })
    );
    expect(mocks.get).toHaveBeenCalledWith("ktp-local-admin");
    expect(mocks.token).toHaveBeenCalledWith("ktp-local-admin", {
      name: "Local Administrator",
      expiresInMs: 28_800_000,
      credentialRevision: saved.revision,
    });
    expect(result.response.cookie).toHaveBeenCalledWith(
      "app_session_id",
      "signed-local-session",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 28_800_000,
      }
    );
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect((await call("GET", "status")).body).toEqual({
      setupRequired: false,
    });
  });

  it("rejects bad passwords and duplicate setup while preserving credentials across route restarts", async () => {
    const call = harness();
    expect((await call("POST", "setup", { password })).status).toBe(200);
    const saved = await readFile(join(data, "credentials.json"), "utf8");
    const duplicate = await call("POST", "setup", {
      password: "Different local password",
    });
    expect(duplicate.status).toBe(409);
    expect(await readFile(join(data, "credentials.json"), "utf8")).toBe(saved);
    const restarted = harness();
    const wrong = await restarted("POST", "login", {
      password: "A different local password",
    });
    expect(wrong.status).toBe(401);
    expect(wrong.response.cookie).not.toHaveBeenCalled();
    expect((await restarted("POST", "login", { password })).status).toBe(200);
    expect(mocks.user?.openId).toBe("ktp-local-admin");
    expect(await readFile(join(data, "credentials.json"), "utf8")).toBe(saved);
  });

  it("publishes exactly one complete credential under concurrent setup", async () => {
    const call = harness();
    const passwords = [password, "Another private local password"];
    const results = await Promise.all(
      passwords.map(password => call("POST", "setup", { password }))
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = results.findIndex(result => result.status === 200);
    const restarted = harness();
    expect(
      (await restarted("POST", "login", { password: passwords[winner] })).status
    ).toBe(200);
    expect(
      (await restarted("POST", "login", { password: passwords[1 - winner] }))
        .status
    ).toBe(401);
    expect(await readdir(data)).toEqual(["credentials.json"]);
    expect(
      JSON.parse(await readFile(join(data, "credentials.json"), "utf8")).version
    ).toBe(1);
  });

  it("requires both a loopback socket and loopback Host and rejects cross-origin JSON writes", async () => {
    const call = harness();
    for (const options of [
      { peer: "203.0.113.1" },
      { peer: "::ffff:203.0.113.1" },
      { host: "attacker.invalid" },
      { host: "localhost.attacker.invalid" },
      { host: "localhost@attacker.invalid" },
      { host: "localhost:3210/path" },
      { origin: "https://attacker.invalid" },
      { origin: "null" },
      { origin: "https://127.0.0.1:3210" },
      { origin: "http://127.0.0.1:3211" },
      { fetchSite: "cross-site" },
    ]) {
      expect((await call("POST", "setup", { password }, options)).status).toBe(
        403
      );
    }
    expect(
      (await call("GET", "status", undefined, { peer: "203.0.113.1" })).status
    ).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(
      (
        await call(
          "POST",
          "setup",
          { password },
          { origin: "http://127.0.0.1:3210" }
        )
      ).status
    ).toBe(200);
    expect(
      (await call("POST", "login", { password }, { peer: "::ffff:127.0.0.1" }))
        .status
    ).toBe(200);
  });

  it("permits IPv6 local origins and uses Secure cookies only for HTTPS", async () => {
    const result = await harness()(
      "POST",
      "setup",
      { password },
      {
        peer: "::1",
        host: "[::1]:3210",
        protocol: "https",
        origin: "https://[::1]:3210",
      }
    );
    expect(result.status).toBe(200);
    expect(result.response.cookie).toHaveBeenCalledWith(
      "app_session_id",
      expect.any(String),
      expect.objectContaining({ secure: true, httpOnly: true, sameSite: "lax" })
    );
    expect(result.response.cookie.mock.calls[0][2]).not.toHaveProperty(
      "domain"
    );
  });

  it("rejects non-JSON, unknown fields and out-of-bounds passwords without saving", async () => {
    const call = harness();
    expect(
      (await call("POST", "setup", { password }, { type: "text/plain" })).status
    ).toBe(415);
    for (const body of [
      { password: "x".repeat(11) },
      { password: "x".repeat(129) },
      { password: null },
      { password, role: "admin" },
      { password, email: "other@localhost" },
    ]) {
      expect((await call("POST", "setup", body)).status).toBe(400);
    }
    await expect(
      readFile(join(data, "credentials.json"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("bounds password attempts globally across rotating loopback addresses", async () => {
    const call = harness();
    expect((await call("POST", "setup", { password })).status).toBe(200);
    for (let i = 0; i < 7; i++) {
      expect(
        (
          await call(
            "POST",
            "login",
            { password: "An incorrect local password" },
            { peer: `127.0.0.${i + 2}` }
          )
        ).status
      ).toBe(401);
    }
    const blocked = await call(
      "POST",
      "login",
      { password },
      { peer: "127.0.0.99" }
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeGreaterThan(0);
    expect(blocked.response.cookie).not.toHaveBeenCalled();
    // The same budget guards setup, rather than opening a second attack path.
    expect((await call("POST", "setup", { password })).status).toBe(429);
  });

  it("fails closed on malformed or symlinked credential files without exposing their contents", async () => {
    const call = harness();
    await call("GET", "status");
    await writeFile(
      join(data, "credentials.json"),
      "private malformed credential",
      { mode: 0o600 }
    );
    const malformed = await call("GET", "status");
    expect(malformed.status).toBe(503);
    expect(malformed.body).toEqual({
      error: "Local authentication is unavailable",
    });
    await rm(join(data, "credentials.json"));
    await writeFile(join(root, "external"), "private external contents");
    await symlink(join(root, "external"), join(data, "credentials.json"));
    expect((await call("POST", "login", { password })).status).toBe(503);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("clears the same host-only session cookie and rejects extra logout fields", async () => {
    const call = harness();
    expect((await call("POST", "logout", { password })).status).toBe(400);
    const result = await call("POST", "logout", {});
    expect(result.body).toEqual({ success: true });
    expect(result.response.clearCookie).toHaveBeenCalledWith("app_session_id", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
  });

  it("does not publish a password when the local administrator cannot be persisted", async () => {
    mocks.upsert.mockRejectedValue(new Error("private database details"));
    const result = await harness()("POST", "setup", { password });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      error: "Local authentication is unavailable",
    });
    await expect(
      readFile(join(data, "credentials.json"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(mocks.token).not.toHaveBeenCalled();
  });
});
