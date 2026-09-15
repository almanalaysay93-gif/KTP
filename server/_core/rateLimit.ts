/**
 * In-memory fixed-window rate limiter. No existing rate-limiting utility in
 * this codebase to reuse (~200 staff, single-instance deployment — an
 * in-process window is enough; it resets on redeploy, which is acceptable
 * for a login-guessing throttle).
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, opts: { max: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= opts.max;
}

/** Test-only: clear all tracked windows between cases. */
export function _resetRateLimitsForTests(): void {
  windows.clear();
}
