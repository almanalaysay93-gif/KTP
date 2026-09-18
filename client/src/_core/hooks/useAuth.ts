import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  persistSupervisorCache,
  restoreSupervisorCache,
  purgeSupervisorCache,
} from "@/lib/queryPersister";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const restoredUserIdRef = useRef<number | null>(null);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      queryClient.clear();
      purgeSupervisorCache();
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, queryClient, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only. startLogin() mints the nonce + cookie itself.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  // Hydrate cache once supervisor auth is confirmed (DL6)
  useEffect(() => {
    const user = state.user;
    if (user && user.role === "admin" && restoredUserIdRef.current !== user.id) {
      restoredUserIdRef.current = user.id;
      restoreSupervisorCache(queryClient, user.id);
    }
  }, [state.user, queryClient]);

  // Persist supervisor cache on successful query updates
  useEffect(() => {
    const user = state.user;
    if (!user || user.role !== "admin") return;

    let timeoutId: any = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        if (timeoutId) clearTimeout(timeoutId);
        // Debounce write by 500ms to batch rapid query resolutions
        timeoutId = setTimeout(() => {
          persistSupervisorCache(queryClient, user.id);
        }, 500);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.user, queryClient]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
