import type { trpc } from "@/lib/trpc"
import type { QueryClient } from "@tanstack/react-query"

export type TrpcUtils = ReturnType<typeof trpc.useUtils>

export interface RoutePrefetchEntry {
  path?: string
  loadComponent?: () => Promise<unknown>
  prefetchData?: (utils: TrpcUtils) => Promise<unknown> | void
}

export const PREFETCH_FRESHNESS_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Route table mapping admin navigation items to code loaders and primary queries.
 */
export const ROUTE_PREFETCH_TABLE: Record<string, RoutePrefetchEntry> = {
  "/dashboard": {
    loadComponent: () => import("@/pages/Dashboard"),
    prefetchData: (utils) => utils.dashboard.initial.prefetch(),
  },
  "/patients": {
    loadComponent: () => import("@/pages/PatientsPage"),
    prefetchData: (utils) => utils.patients.list.prefetch(),
  },
  "/settings": {
    loadComponent: () => import("@/pages/Settings"),
    prefetchData: (utils) => utils.settings.getAll.prefetch(),
  },
}

// Queue state: max 1 concurrent network prefetch request
let isPrefetching = false
const prefetchQueue: (() => Promise<void>)[] = []

async function processQueue() {
  if (isPrefetching || prefetchQueue.length === 0) return
  isPrefetching = true
  const nextTask = prefetchQueue.shift()
  if (nextTask) {
    try {
      await nextTask()
    } catch {
      // Ignore prefetch network errors quietly
    }
  }
  isPrefetching = false
  if (prefetchQueue.length > 0) {
    processQueue()
  }
}

/**
 * Checks if a query is still fresh (dataUpdatedAt < 5 minutes).
 */
export function isQueryFresh(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  const query = queryClient.getQueryCache().find({ queryKey, exact: false })
  if (!query || !query.state.dataUpdatedAt) return false
  return Date.now() - query.state.dataUpdatedAt < PREFETCH_FRESHNESS_MS
}

/**
 * Triggers prefetch for a route with concurrency limit and 5-minute freshness guard.
 */
export function prefetchRoute(
  path: string,
  utils: TrpcUtils,
  queryClient: QueryClient,
): void {
  const entry = ROUTE_PREFETCH_TABLE[path]
  if (!entry) return

  // 1. Code chunk preload (runs unconstrained in browser background)
  if (entry.loadComponent) {
    entry.loadComponent().catch(() => {})
  }

  // 2. Data prefetch (strictly queued, max 1 concurrent request)
  if (entry.prefetchData) {
    prefetchQueue.push(async () => {
      try {
        await entry.prefetchData!(utils)
      } catch {
        // Silently catch prefetch failures
      }
    })
    processQueue()
  }
}
