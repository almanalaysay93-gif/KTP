import { describe, expect, it } from "vitest";
import { nonJsonErrorMessage, shouldRetryQuery } from "./apiResponse";

describe("nonJsonErrorMessage", () => {
  it("explains a Vercel text timeout page", () => {
    expect(nonJsonErrorMessage(504, "text/plain; charset=utf-8")).toBe(
      "The server did not respond in time (HTTP 504). Try again.",
    );
  });

  it("explains other non-JSON failures", () => {
    expect(nonJsonErrorMessage(500, "text/html")).toBe("The server returned an unexpected response (HTTP 500). Try again.");
    expect(nonJsonErrorMessage(502, null)).toContain("HTTP 502");
  });

  it("leaves tRPC JSON errors and successes alone", () => {
    expect(nonJsonErrorMessage(500, "application/json")).toBeNull();
    expect(nonJsonErrorMessage(403, "application/json; charset=utf-8")).toBeNull();
    expect(nonJsonErrorMessage(200, "text/plain")).toBeNull();
  });
});

describe("shouldRetryQuery", () => {
  const withStatus = (httpStatus: number) => ({ data: { httpStatus } });

  it("never retries client errors", () => {
    expect(shouldRetryQuery(0, withStatus(401))).toBe(false);
    expect(shouldRetryQuery(0, withStatus(403))).toBe(false);
    expect(shouldRetryQuery(0, withStatus(404))).toBe(false);
  });

  it("retries server and network errors once", () => {
    expect(shouldRetryQuery(0, withStatus(500))).toBe(true);
    expect(shouldRetryQuery(1, withStatus(500))).toBe(false);
    expect(shouldRetryQuery(0, new Error("fetch failed"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("fetch failed"))).toBe(false);
  });
});
