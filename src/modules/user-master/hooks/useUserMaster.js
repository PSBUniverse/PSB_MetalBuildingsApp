"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateUserAccessQueries,
  notifyUserMasterSessionRefresh,
} from "@/modules/user-master/cache/user-master.query";
import { useUserAccess } from "@/modules/user-master/hooks/useUserAccess";

export function useUserMaster() {
  const queryClient = useQueryClient();
  const {
    loading,
    refreshing,
    error,
    session,
    user,
    access,
    accountInactive,
    statusRestricted,
    limitedAccess,
    isAuthenticated,
    refetch,
  } = useUserAccess();

  const refresh = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);

    if (silent) {
      await invalidateUserAccessQueries(queryClient);
      return;
    }

    await refetch();
  }, [queryClient, refetch]);

  const triggerSessionRefresh = useCallback(() => {
    notifyUserMasterSessionRefresh();
  }, []);

  return {
    loading,
    refreshing,
    error,
    session,
    user,
    access,
    accountInactive,
    statusRestricted,
    limitedAccess,
    refresh,
    triggerSessionRefresh,
    isAuthenticated,
  };
}
