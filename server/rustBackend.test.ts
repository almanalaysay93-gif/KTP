import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  rustBackendEnabled,
  rustListPatients,
  rustMetrics,
  rustPatientProfile,
} from "./rustBackend";

const request = {
  headers: {
    cookie:
      "unrelated=secret; app_session_id=test.jwt.signature; oauth_state=private",
    "user-agent": "KTP test",
  },
  ip: "192.0.2.10",
} as Request;
const row = {
  id: 1,
  birthDate: "1980-02-03",
  surgeryDate: null,
  consentAcceptedAt: null,
  createdAt: "2026-09-01T12:30:00",
  updatedAt: "2026-10-03T10:00:00.123",
};

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://unused-test");
  vi.stubEnv("RUST_BACKEND_URL", "http://127.0.0.1:3001");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Rust read adapter", () => {
  it("forwards filters, only the session cookie, client IP and user agent", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([row]));
    vi.stubGlobal("fetch", fetch);
    const result = await rustListPatients(request, {
      search: "A & B",
      doctorId: 2,
      status: "Active",
      stage: undefined,
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url.searchParams.get("search")).toBe("A & B");
    expect(url.searchParams.get("doctorId")).toBe("2");
    expect(url.searchParams.has("stage")).toBe(false);
    expect(options.headers).toEqual({
      cookie: "app_session_id=test.jwt.signature",
      "x-ktp-client-ip": "192.0.2.10",
      "user-agent": "KTP test",
    });
    expect(options.redirect).toBe("error");
    expect(result[0].birthDate).toEqual(new Date("1980-02-03T00:00:00Z"));
    expect(result[0].createdAt).toEqual(new Date("2026-09-01T12:30:00Z"));
    expect(result[0].updatedAt).toEqual(new Date("2026-10-03T10:00:00.123Z"));
    expect(result[0].surgeryDate).toBeNull();
  });

  it("restores dates in all linked profiles and preserves missing results", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            patient: row,
            linkedRecipient: row,
            linkedDonors: [row],
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            patient: null,
            linkedRecipient: null,
            linkedDonors: [],
          })
        )
    );
    const result = await rustPatientProfile(request, { id: 1 });
    expect(result.linkedRecipient?.createdAt).toBeInstanceOf(Date);
    expect(result.linkedDonors[0].birthDate).toBeInstanceOf(Date);
    expect(
      await rustPatientProfile(request, { id: 999, allowMissing: true })
    ).toEqual({ patient: null, linkedRecipient: null, linkedDonors: [] });
  });

  it.each([
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [503, "INTERNAL_SERVER_ERROR"],
  ])("maps HTTP %s without leaking upstream text", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("sensitive database details", { status })
        )
    );
    await expect(rustMetrics(request)).rejects.toMatchObject({ code });
    await expect(rustMetrics(request)).rejects.not.toThrow("sensitive");
  });

  it("fails closed on transport failure and requires a shared PostgreSQL database", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("sensitive transport details"))
    );
    await expect(rustListPatients(request)).rejects.toThrow(
      "Rust backend unavailable"
    );
    vi.stubEnv("DATABASE_URL", "");
    await expect(rustListPatients(request)).rejects.toThrow(
      "Rust reads require PostgreSQL"
    );
  });

  it("rejects upstream origins containing credentials or paths and remains opt in", async () => {
    vi.stubEnv("RUST_BACKEND_URL", "https://user:password@example.invalid");
    await expect(rustMetrics(request)).rejects.toThrow(
      "must be an HTTP(S) origin"
    );
    vi.stubEnv("RUST_BACKEND_URL", "https://example.invalid/path");
    await expect(rustMetrics(request)).rejects.toThrow(
      "must be an HTTP(S) origin"
    );
    vi.stubEnv("RUST_BACKEND_URL", "");
    expect(rustBackendEnabled()).toBe(false);
  });
});
