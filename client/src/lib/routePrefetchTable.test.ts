import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  ROUTE_PREFETCH_TABLE,
  PREFETCH_FRESHNESS_MS,
  isQueryFresh,
  prefetchRoute,
} from "./routePrefetchTable";

describe("routePrefetchTable", () => {
  let queryClient: QueryClient;
  let mockUtils: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          staleTime: Infinity,
        },
      },
    });

    mockUtils = {
      dashboard: { initial: { prefetch: vi.fn().mockResolvedValue({}) } },
      nurses: { initial: { prefetch: vi.fn().mockResolvedValue({}) } },
      areas: { list: { prefetch: vi.fn().mockResolvedValue({}) } },
      trainings: { initial: { prefetch: vi.fn().mockResolvedValue({}) } },
      seminars: { list: { prefetch: vi.fn().mockResolvedValue({}) } },
      credentials: { initial: { prefetch: vi.fn().mockResolvedValue({}) } },
      calendar: { listEvents: { prefetch: vi.fn().mockResolvedValue({}) } },
      reports: { list: { prefetch: vi.fn().mockResolvedValue({}) } },
      settings: { getAll: { prefetch: vi.fn().mockResolvedValue({}) } },
    };
  });

  it("contains prefetch definitions for key supervisor routes", () => {
    expect(ROUTE_PREFETCH_TABLE["/dashboard"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/areas"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/nurses"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/nurses?type=Registered%20Nurse"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/trainings"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/licenses"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/calendar"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/reports"]).toBeDefined();
    expect(ROUTE_PREFETCH_TABLE["/settings"]).toBeDefined();
  });

  it("isQueryFresh correctly detects fresh vs stale or absent queries", () => {
    const key = [["dashboard", "initial"]];
    expect(isQueryFresh(queryClient, key)).toBe(false);

    // Set fresh data
    queryClient.setQueryData(key, { ready: true });
    expect(isQueryFresh(queryClient, key)).toBe(true);

    // Manually mutate dataUpdatedAt to simulate > 5 minutes ago
    const query = queryClient.getQueryCache().find({ queryKey: key });
    if (query) {
      query.state.dataUpdatedAt = Date.now() - (PREFETCH_FRESHNESS_MS + 1000);
    }
    expect(isQueryFresh(queryClient, key)).toBe(false);
  });

  it("prefetchRoute triggers both component and data prefetch", async () => {
    const loadMock = vi.fn().mockResolvedValue({});
    const prefetchDataMock = vi.fn().mockResolvedValue({});

    ROUTE_PREFETCH_TABLE["/test-route"] = {
      loadComponent: loadMock,
      prefetchData: prefetchDataMock,
      path: "/test-route",
    };

    prefetchRoute("/test-route", mockUtils, queryClient);

    expect(loadMock).toHaveBeenCalled();
    // Allow queue promise to tick
    await new Promise((r) => setTimeout(r, 10));
    expect(prefetchDataMock).toHaveBeenCalledWith(mockUtils);

    delete ROUTE_PREFETCH_TABLE["/test-route"];
  });
});
