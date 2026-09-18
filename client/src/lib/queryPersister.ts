import type { QueryClient, DehydratedState } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";

/**
 * Allowlist of supervisor queries safe to persist in localStorage.
 * Excludes: auth.me, mutation caches, report downloads, errors, sensitive email logs.
 */
export const CACHED_QUERY_KEYS: readonly string[] = [
  "dashboard.initial",
  "dashboard.stats",
  "nurses.initial",
  "nurses.list",
  "areas.list",
  "areas.areaDashboard",
  "trainings.initial",
  "seminars.list",
  "credentials.listTypes",
  "settings.getAll",
] as const;

export const CACHE_PREFIX = "skti_cache_v1_";
export const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
export const BUILD_VERSION = "2026-09-18-v1";

export interface PersistedCacheEnvelope {
  userId: number;
  buildVersion: string;
  savedAt: number;
  data: DehydratedState;
}

/**
 * Returns the storage key for a supervisor account.
 */
export function getStorageKey(userId: number): string {
  return `${CACHE_PREFIX}${userId}`;
}

/**
 * Checks whether a query key is allowlisted for persistence.
 * Handles tRPC query key arrays, e.g. [["dashboard", "initial"], { ... }]
 */
export function isQueryAllowlisted(queryKey: readonly unknown[]): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;

  const first = queryKey[0];
  if (Array.isArray(first)) {
    const procedure = first.join(".");
    return CACHED_QUERY_KEYS.includes(procedure);
  }

  if (typeof first === "string") {
    // If format is ["dashboard.initial", ...]
    if (CACHED_QUERY_KEYS.includes(first)) return true;

    // If format is ["dashboard", "initial", ...]
    if (queryKey.length >= 2 && typeof queryKey[1] === "string") {
      const procedure = `${first}.${queryKey[1]}`;
      return CACHED_QUERY_KEYS.includes(procedure);
    }
  }

  return false;
}

/**
 * Dehydrates allowlisted queries and writes to localStorage for a user.
 */
export function persistSupervisorCache(queryClient: QueryClient, userId: number): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!userId || typeof userId !== "number") return;

  try {
    const dehydrated = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => {
        // Only persist successful, non-error queries on the allowlist
        if (query.state.status !== "success") return false;
        if (query.state.error) return false;
        return isQueryAllowlisted(query.queryKey);
      },
    });

    if (!dehydrated.queries || dehydrated.queries.length === 0) return;

    const envelope: PersistedCacheEnvelope = {
      userId,
      buildVersion: BUILD_VERSION,
      savedAt: Date.now(),
      data: dehydrated,
    };

    const key = getStorageKey(userId);
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    // QuotaExceededError or private browsing restrictions
    console.warn("[queryPersister] Failed to persist cache:", err);
  }
}

/**
 * Restores cached supervisor queries from localStorage for a confirmed user.
 * Validates account scoping, 12-hour age limit, and build version.
 */
export function restoreSupervisorCache(queryClient: QueryClient, userId: number): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  if (!userId || typeof userId !== "number") return false;

  try {
    const key = getStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;

    const envelope: PersistedCacheEnvelope = JSON.parse(raw);

    // Validate account ID
    if (envelope.userId !== userId) {
      purgeSupervisorCache(envelope.userId);
      return false;
    }

    // Validate build version
    if (envelope.buildVersion !== BUILD_VERSION) {
      purgeSupervisorCache(userId);
      return false;
    }

    // Validate 12-hour age
    const age = Date.now() - envelope.savedAt;
    if (age > MAX_CACHE_AGE_MS || age < 0) {
      purgeSupervisorCache(userId);
      return false;
    }

    // Filter queries against allowlist to ensure safety
    if (envelope.data && Array.isArray(envelope.data.queries)) {
      envelope.data.queries = envelope.data.queries.filter((q) =>
        isQueryAllowlisted(q.queryKey)
      );
    }

    hydrate(queryClient, envelope.data);
    return true;
  } catch (err) {
    console.warn("[queryPersister] Failed to restore cache, purging:", err);
    purgeSupervisorCache(userId);
    return false;
  }
}

/**
 * Purges stored cache for a specific user ID or all skti_cache entries.
 */
export function purgeSupervisorCache(userId?: number): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    if (userId) {
      window.localStorage.removeItem(getStorageKey(userId));
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    }
  } catch (err) {
    console.warn("[queryPersister] Failed to purge cache:", err);
  }
}
