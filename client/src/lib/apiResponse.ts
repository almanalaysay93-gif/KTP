/**
 * A failed API response that is not JSON came from the hosting platform, not
 * from tRPC (for example a Vercel timeout page). Parsing it as JSON gives
 * "Unexpected token 'A' ... is not valid JSON", so turn it into a readable error.
 */
export function nonJsonErrorMessage(status: number, contentType: string | null): string | null {
  if (status < 400) return null;
  if ((contentType ?? "").toLowerCase().includes("json")) return null;
  if (status === 504 || status === 408) {
    return `The server did not respond in time (HTTP ${status}). Try again.`;
  }
  return `The server returned an unexpected response (HTTP ${status}). Try again.`;
}

/** Retry once for network or server trouble. Never retry a 4xx: the same request fails again. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = (error as { data?: { httpStatus?: unknown } } | null)?.data?.httpStatus;
  if (typeof status === "number" && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

/** Layout-level queries that must not hold a page's data request open. */
export const SEPARATE_BATCH_PATHS: ReadonlySet<string> = new Set([
  "auth.me",
  "notifications.unreadCount",
  "notifications.list",
  "areas.list",
]);
