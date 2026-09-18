import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  CACHED_QUERY_KEYS,
  CACHE_PREFIX,
  MAX_CACHE_AGE_MS,
  BUILD_VERSION,
  isQueryAllowlisted,
  persistSupervisorCache,
  restoreSupervisorCache,
  purgeSupervisorCache,
  getStorageKey,
} from "./queryPersister";

describe("queryPersister", () => {
  let queryClient: QueryClient;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          staleTime: Infinity,
        },
      },
    });

    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        get length() {
          return Object.keys(mockStorage).length;
        },
        key: (idx: number) => Object.keys(mockStorage)[idx] ?? null,
      },
    });
  });

  describe("isQueryAllowlisted", () => {
    it("allows registered tRPC nested procedure formats", () => {
      expect(isQueryAllowlisted([["dashboard", "initial"], { type: "query" }])).toBe(true);
      expect(isQueryAllowlisted([["nurses", "initial"], { type: "query" }])).toBe(true);
      expect(isQueryAllowlisted([["areas", "list"], { type: "query" }])).toBe(true);
      expect(isQueryAllowlisted([["settings", "getAll"], { type: "query" }])).toBe(true);
    });

    it("allows registered flat procedure formats", () => {
      expect(isQueryAllowlisted(["dashboard.initial"])).toBe(true);
      expect(isQueryAllowlisted(["nurses", "list"])).toBe(true);
    });

    it("rejects non-allowlisted queries strictly", () => {
      expect(isQueryAllowlisted([["auth", "me"]])).toBe(false);
      expect(isQueryAllowlisted(["auth.me"])).toBe(false);
      expect(isQueryAllowlisted([["settings", "listEmailLogs"]])).toBe(false);
      expect(isQueryAllowlisted([["reports", "runReport"]])).toBe(false);
      expect(isQueryAllowlisted([["inquiry", "chat"]])).toBe(false);
    });
  });

  describe("persistSupervisorCache & restoreSupervisorCache", () => {
    it("persists allowlisted queries and ignores non-allowlisted ones", () => {
      // Seed data into query cache
      queryClient.setQueryData([["dashboard", "initial"]], { summary: { totalNurses: 42 } });
      queryClient.setQueryData([["auth", "me"]], { id: 1, email: "admin@spmc.ph" });
      queryClient.setQueryData([["settings", "listEmailLogs"]], [{ id: 99 }]);

      persistSupervisorCache(queryClient, 1);

      const savedKey = getStorageKey(1);
      expect(mockStorage[savedKey]).toBeDefined();

      const raw = JSON.parse(mockStorage[savedKey]);
      expect(raw.userId).toBe(1);
      expect(raw.buildVersion).toBe(BUILD_VERSION);

      // Verify only allowlisted queries got saved
      const savedQueryKeys = raw.data.queries.map((q: any) => q.queryKey);
      expect(savedQueryKeys).toEqual([[["dashboard", "initial"]]]);

      // Create new clean client and restore
      const freshClient = new QueryClient();
      const restored = restoreSupervisorCache(freshClient, 1);
      expect(restored).toBe(true);

      const restoredData = freshClient.getQueryData([["dashboard", "initial"]]);
      expect(restoredData).toEqual({ summary: { totalNurses: 42 } });

      const authData = freshClient.getQueryData([["auth", "me"]]);
      expect(authData).toBeUndefined();
    });

    it("discards cache when age exceeds 12 hours", () => {
      queryClient.setQueryData([["dashboard", "initial"]], { summary: { totalNurses: 42 } });
      persistSupervisorCache(queryClient, 1);

      const key = getStorageKey(1);
      const envelope = JSON.parse(mockStorage[key]);
      // Artificially age it by 13 hours
      envelope.savedAt = Date.now() - (13 * 60 * 60 * 1000);
      mockStorage[key] = JSON.stringify(envelope);

      const freshClient = new QueryClient();
      const restored = restoreSupervisorCache(freshClient, 1);
      expect(restored).toBe(false);
      expect(mockStorage[key]).toBeUndefined(); // Was purged
    });

    it("discards cache when build version changes", () => {
      queryClient.setQueryData([["dashboard", "initial"]], { summary: { totalNurses: 42 } });
      persistSupervisorCache(queryClient, 1);

      const key = getStorageKey(1);
      const envelope = JSON.parse(mockStorage[key]);
      envelope.buildVersion = "older-version";
      mockStorage[key] = JSON.stringify(envelope);

      const freshClient = new QueryClient();
      const restored = restoreSupervisorCache(freshClient, 1);
      expect(restored).toBe(false);
      expect(mockStorage[key]).toBeUndefined();
    });

    it("discards cache when requested user ID does not match stored user ID", () => {
      queryClient.setQueryData([["dashboard", "initial"]], { summary: { totalNurses: 42 } });
      persistSupervisorCache(queryClient, 1);

      const freshClient = new QueryClient();
      // User 2 tries to restore User 1's cache
      const restored = restoreSupervisorCache(freshClient, 2);
      expect(restored).toBe(false);
      // User 1 cache remains safe or unaffected
      expect(mockStorage[getStorageKey(1)]).toBeDefined();
    });
  });

  describe("purgeSupervisorCache", () => {
    it("purges single user cache when userId is specified", () => {
      mockStorage[getStorageKey(1)] = JSON.stringify({ userId: 1 });
      mockStorage[getStorageKey(2)] = JSON.stringify({ userId: 2 });
      mockStorage["other_key"] = "keep_me";

      purgeSupervisorCache(1);

      expect(mockStorage[getStorageKey(1)]).toBeUndefined();
      expect(mockStorage[getStorageKey(2)]).toBeDefined();
      expect(mockStorage["other_key"]).toBe("keep_me");
    });

    it("purges all skti_cache entries when called without userId", () => {
      mockStorage[getStorageKey(1)] = JSON.stringify({ userId: 1 });
      mockStorage[getStorageKey(2)] = JSON.stringify({ userId: 2 });
      mockStorage["other_key"] = "keep_me";

      purgeSupervisorCache();

      expect(mockStorage[getStorageKey(1)]).toBeUndefined();
      expect(mockStorage[getStorageKey(2)]).toBeUndefined();
      expect(mockStorage["other_key"]).toBe("keep_me");
    });
  });
});
