import { TRPCError } from "@trpc/server";
import { parse } from "cookie";
import type { Request } from "express";
import type { Patient } from "../drizzle/schema";
import type { listMetrics } from "./dbMetrics";
import { COOKIE_NAME } from "../shared/const";
import { RUST_PUBLIC_ERRORS } from "./rustErrors";

/** Opt in per deployment. No silent fallback across two different databases. */
export function rustBackendEnabled(): boolean {
  return Boolean(process.env.RUST_BACKEND_URL);
}

export function rustBackendOrigin(): URL {
  const base = new URL(process.env.RUST_BACKEND_URL!);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "RUST_BACKEND_URL must be an HTTP(S) origin",
    });
  return base;
}

export async function rustRequest<T>(
  req: Request,
  path: string,
  query: Record<string, unknown> = {},
  body?: unknown,
  options?: { timeoutMs?: number }
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Rust reads require PostgreSQL in both services",
    });
  }
  const base = rustBackendOrigin();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null)
      url.searchParams.set(key, String(value));
  }
  // Send only the session cookie. Never forward OAuth state or unrelated cookies.
  const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  if (req.ip) headers["x-ktp-client-ip"] = req.ip;
  if (req.headers["user-agent"])
    headers["user-agent"] = req.headers["user-agent"];
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const response = await fetch(url, {
      headers,
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 10_000),
    });
    if (!response.ok) {
      const code =
        (
          {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
          } as const
        )[response.status as 400 | 401 | 403 | 404 | 409] ??
        "INTERNAL_SERVER_ERROR";
      const payload = await response.json().catch(() => null);
      const publicMessage =
        response.status < 500 &&
        typeof payload?.error === "string" &&
        RUST_PUBLIC_ERRORS.has(payload.error)
          ? payload.error
          : undefined;
      throw new TRPCError({
        code,
        message:
          publicMessage ??
          (response.status === 404
            ? "Patient not found"
            : "Rust backend request failed"),
      });
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    // Upstream error bodies and URLs may contain sensitive values.
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Rust backend unavailable",
    });
  }
}

export function restoreDates<T extends object>(
  row: T,
  fields: readonly string[] = ["createdAt", "updatedAt"]
): T {
  const result = { ...row } as Record<string, unknown>;
  for (const key of fields) {
    const value = result[key];
    if (typeof value === "string") {
      const iso =
        value.length === 10
          ? `${value}T00:00:00Z`
          : /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
            ? value
            : `${value}Z`;
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime()))
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid date from Rust backend",
        });
      result[key] = date;
    }
  }
  return result as T;
}

export function patientDates(patient: Patient): Patient {
  return restoreDates(patient, [
    "birthDate",
    "surgeryDate",
    "consentAcceptedAt",
    "createdAt",
    "updatedAt",
  ]);
}

export async function rustListPatients(
  req: Request,
  input?: Record<string, unknown>
): Promise<Patient[]> {
  return (await rustRequest<Patient[]>(req, "/api/rust/patients", input)).map(
    patientDates
  );
}

export async function rustPatientProfile(
  req: Request,
  input: { id: number; allowMissing?: boolean }
) {
  const result = await rustRequest<{
    patient: Patient | null;
    linkedRecipient: Patient | null;
    linkedDonors: Patient[];
  }>(req, `/api/rust/patients/${input.id}`, {
    allowMissing: input.allowMissing,
  });
  return {
    patient: result.patient ? patientDates(result.patient) : null,
    linkedRecipient: result.linkedRecipient
      ? patientDates(result.linkedRecipient)
      : null,
    linkedDonors: result.linkedDonors.map(patientDates),
  };
}

export function rustMetrics(
  req: Request,
  input?: { status?: string }
): ReturnType<typeof listMetrics> {
  return rustRequest(req, "/api/rust/metrics", input);
}
