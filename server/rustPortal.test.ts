import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  rustAcceptConsent,
  rustAuthMe,
  rustClinical,
  rustPortalMessages,
  rustPortalProfile,
  rustUpdateContact,
} from "./rustPortal";
import { rustRequest } from "./rustBackend";

const req = {
  headers: { cookie: "app_session_id=test.jwt" },
  ip: "192.0.2.30",
} as Request;
const dates = {
  createdAt: "2026-09-01T12:30:00",
  updatedAt: "2026-10-03T10:00:00",
};
const patient = {
  id: 1,
  ...dates,
  birthDate: "1980-02-03",
  surgeryDate: null,
  consentAcceptedAt: "2026-10-03T10:00:00",
};
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://unused-test");
  vi.stubEnv("RUST_BACKEND_URL", "http://127.0.0.1:3001");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Rust patient portal adapter", () => {
  it("preserves anonymous auth and restores current user, patient and doctor dates", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(null))
        .mockResolvedValueOnce(
          Response.json({
            ...dates,
            lastSignedIn: dates.updatedAt,
            patient,
            isAdmin: false,
            consentRequired: true,
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            patient,
            nephrologist: dates,
            fellow: null,
            linkedRecipientName: "Synthetic Recipient",
          })
        )
    );
    expect(await rustAuthMe(req)).toBeNull();
    const me = await rustAuthMe(req);
    expect(me?.lastSignedIn).toBeInstanceOf(Date);
    expect(me?.patient?.birthDate).toEqual(new Date("1980-02-03T00:00:00Z"));
    expect(me?.consentRequired).toBe(true);
    const profile = await rustPortalProfile(req);
    expect(profile.nephrologist?.createdAt).toBeInstanceOf(Date);
    expect(profile.fellow).toBeNull();
    expect(profile.linkedRecipientName).toBe("Synthetic Recipient");
  });

  it("keeps clinical calendar dates and appointment ISO strings while restoring Date fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          services: [{ ...dates, dueDate: "2026-10-05", serviceDate: null }],
          labResults: [
            { createdAt: dates.createdAt, serviceDate: "2026-09-01" },
          ],
          labTests: [{ id: 1 }],
          checklist: [{ ...dates, doneDate: "2026-09-01" }],
          appointments: [
            {
              ...dates,
              startsAt: "2026-10-05T01:00:00.000Z",
              cancelledAt: null,
              respondedAt: dates.createdAt,
            },
          ],
        })
      )
    );
    const clinical = await rustClinical(req);
    expect(clinical.services[0].dueDate).toBe("2026-10-05");
    expect(clinical.services[0].createdAt).toBeInstanceOf(Date);
    expect(clinical.labResults[0].serviceDate).toBe("2026-09-01");
    expect(clinical.labResults[0].createdAt).toBeInstanceOf(Date);
    expect(clinical.checklist[0].doneDate).toBe("2026-09-01");
    expect(clinical.appointments[0].startsAt).toBe("2026-10-05T01:00:00.000Z");
    expect(clinical.appointments[0].respondedAt).toBeInstanceOf(Date);
  });

  it("leaves message timestamps as strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json([
            { ...dates, readAt: dates.createdAt, acknowledgedAt: null },
          ])
        )
    );
    const messages = await rustPortalMessages(req);
    expect(typeof messages[0].createdAt).toBe("string");
    expect(typeof messages[0].readAt).toBe("string");
    expect(messages[0].acknowledgedAt).toBeNull();
  });

  it("sends JSON for no-input consent mutations and explicit null contact updates", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: true, consentVersion: 2, patient })
      )
      .mockResolvedValueOnce(Response.json(patient));
    vi.stubGlobal("fetch", fetch);
    expect(
      (await rustAcceptConsent(req)).patient?.consentAcceptedAt
    ).toBeInstanceOf(Date);
    await rustUpdateContact(req, null);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
      redirect: "error",
    });
    expect(fetch.mock.calls[1][1].body).toBe('{"contactNumber":null}');
  });

  it("preserves the consent signal, maps conflicts, and hides arbitrary upstream details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ error: "CONSENT_REQUIRED" }, { status: 403 })
        )
        .mockResolvedValueOnce(
          Response.json({ error: "sensitive patient value" }, { status: 409 })
        )
    );
    await expect(
      rustRequest(req, "/api/rust/patient/profile")
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "CONSENT_REQUIRED" });
    await expect(
      rustRequest(req, "/api/rust/patient/contact", {}, {})
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Rust backend request failed",
    });
  });
});
