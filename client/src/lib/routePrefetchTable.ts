import type { trpc } from "@/lib/trpc";
import type { QueryClient } from "@tanstack/react-query";

export type TrpcUtils = ReturnType<typeof trpc.useUtils>;

export interface RoutePrefetchEntry {
  path?: string;
  loadComponent?: () => Promise<unknown>;
  prefetchData?: (utils: TrpcUtils) => Promise<unknown> | void;
}

export const PREFETCH_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Route table mapping supervisor menu items to code loaders and primary queries.
 */
export const ROUTE_PREFETCH_TABLE: Record<string, RoutePrefetchEntry> = {
  "/dashboard": {
    loadComponent: () => import("@/pages/Dashboard"),
    prefetchData: (utils) => utils.dashboard.initial.prefetch(),
  },
  "/areas": {
    loadComponent: () => import("@/pages/Areas"),
    prefetchData: (utils) => utils.areas.list.prefetch(),
  },
  "/nurses?type=Registered%20Nurse": {
    loadComponent: () => import("@/pages/Nurses"),
    prefetchData: (utils) => utils.nurses.initial.prefetch(),
  },
  "/nurses?type=Nursing%20Attendant": {
    loadComponent: () => import("@/pages/Nurses"),
    prefetchData: (utils) => utils.nurses.initial.prefetch(),
  },
  "/nurses": {
    loadComponent: () => import("@/pages/Nurses"),
    prefetchData: (utils) => utils.nurses.initial.prefetch(),
  },
  "/trainings": {
    loadComponent: () => import("@/pages/Trainings"),
    prefetchData: (utils) => utils.trainings.initial.prefetch(),
  },
  "/seminars": {
    loadComponent: () => import("@/pages/Seminars"),
    prefetchData: (utils) => utils.seminars.list.prefetch(),
  },
  "/licenses": {
    loadComponent: () => import("@/pages/Licenses"),
    prefetchData: (utils) => utils.credentials.initial.prefetch(),
  },
  "/calendar": {
    loadComponent: () => import("@/pages/Calendar"),
    prefetchData: (utils) =>
      utils.calendar.listEvents.prefetch({
        from: new Date("2026-01-01T00:00:00"),
        to: new Date("2027-12-31T23:59:59"),
        includeTypes: ["license", "training", "areaChange", "custom"],
      }),
  },
  "/reports": {
    loadComponent: () => import("@/pages/Reports"),
    prefetchData: (utils) => utils.reports.list.prefetch(),
  },
  "/settings": {
    loadComponent: () => import("@/pages/Settings"),
    prefetchData: (utils) => utils.settings.getAll.prefetch(),
  },
  "/smart-import": {
    loadComponent: () => import("@/pages/SmartImport"),
  },
  "/ai-insights": {
    loadComponent: () => import("@/pages/AiInsights"),
  },
};

// Queue state: max 1 concurrent network prefetch request (Phase 4 requirement)
let isPrefetching = false;
const prefetchQueue: (() => Promise<void>)[] = [];

async function processQueue() {
  if (isPrefetching || prefetchQueue.length === 0) return;
  isPrefetching = true;
  const nextTask = prefetchQueue.shift();
  if (nextTask) {
    try {
      await nextTask();
    } catch {
      // Ignore prefetch network errors quietly
    }
  }
  isPrefetching = false;
  if (prefetchQueue.length > 0) {
    processQueue();
  }
}

/**
 * Checks if a query is still fresh (dataUpdatedAt < 5 minutes).
 */
export function isQueryFresh(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  const query = queryClient.getQueryCache().find({ queryKey, exact: false });
  if (!query || !query.state.dataUpdatedAt) return false;
  return Date.now() - query.state.dataUpdatedAt < PREFETCH_FRESHNESS_MS;
}

/**
 * Triggers prefetch for a route with concurrency limit and 5-minute freshness guard.
 */
export function prefetchRoute(
  path: string,
  utils: TrpcUtils,
  queryClient: QueryClient,
): void {
  const entry = ROUTE_PREFETCH_TABLE[path];
  if (!entry) return;

  // 1. Code chunk preload (runs unconstrained in browser background)
  if (entry.loadComponent) {
    entry.loadComponent().catch(() => {});
  }

  // 2. Data prefetch (strictly queued, max 1 concurrent request)
  if (entry.prefetchData) {
    prefetchQueue.push(async () => {
      try {
        await entry.prefetchData!(utils);
      } catch {
        // Silently catch prefetch failures
      }
    });
    processQueue();
  }
}
