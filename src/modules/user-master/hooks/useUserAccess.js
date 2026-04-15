"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchUserAccess,
  getUserAccessQueryKey,
} from "@/modules/user-master/cache/user-master.query";

const ACCESS_STALE_TIME_MS = 2 * 60 * 1000;
const ACCESS_GC_TIME_MS = 20 * 60 * 1000;

export function useUserAccess(options = {}) {
  const { appKey = null, enabled = true } = options;

  const queryKey = useMemo(() => getUserAccessQueryKey(appKey), [appKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchUserAccess(appKey),
    enabled,
    staleTime: ACCESS_STALE_TIME_MS,
    gcTime: ACCESS_GC_TIME_MS,
    retry: (failureCount, error) => {
      const status = Number(error?.status || 0);
      if (status === 401 || status === 403) {
        return false;
      }

      return failureCount < 2;
    },
  });

  const payload = query.data || null;

  return {
    loading: query.isLoading,
    refreshing: query.isFetching && !query.isLoading,
    error: query.error || null,
    session: payload?.session || null,
    user: payload?.user || null,
    access: payload?.access || null,
    accountInactive: Boolean(payload?.accountInactive),
    statusRestricted: Boolean(payload?.statusRestricted),
    limitedAccess: Boolean(payload?.limitedAccess),
    isAuthenticated: Boolean(payload?.session?.userId),
    refetch: query.refetch,
  };
}
