import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * Wraps dynamic component imports with a single-session auto-reload on chunk fetch failure.
 * If a new deployment replaces hashed chunks on Vercel, this prevents stale tab crashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName?: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const key = `skti_chunk_reload_${chunkName || "chunk"}`;
    try {
      const module = await factory();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(key);
      }
      return module;
    } catch (error: any) {
      if (typeof window !== "undefined") {
        const hasReloaded = sessionStorage.getItem(key);
        if (!hasReloaded) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      console.error(`[ChunkLoadError] Failed to load chunk ${chunkName || "unknown"}:`, error);
      throw error;
    }
  });
}
