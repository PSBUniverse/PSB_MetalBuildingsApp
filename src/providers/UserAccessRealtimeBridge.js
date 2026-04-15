"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  USER_MASTER_ACCESS_QUERY_KEY_ROOT,
  USER_MASTER_SESSION_REFRESH_EVENT,
  getSessionUserIdFromPayload,
  invalidateUserAccessQueries,
} from "@/modules/user-master/cache/user-master.query";

const USER_ACCESS_WATCH_TABLES = [
  "psb_m_userapproleaccess",
  "psb_m_users",
  "psb_m_userroles",
  "psb_m_application",
  "psb_m_status",
];

function getChangedUserId(payload) {
  const candidate = payload?.new?.user_id ?? payload?.old?.user_id;
  return candidate === undefined || candidate === null ? "" : String(candidate);
}

function shouldInvalidateForCurrentSession(queryClient, changedUserId) {
  if (!changedUserId) {
    return true;
  }

  const accessQueries = queryClient.getQueriesData({
    queryKey: USER_MASTER_ACCESS_QUERY_KEY_ROOT,
  });

  return accessQueries.some(([, payload]) => {
    return getSessionUserIdFromPayload(payload) === changedUserId;
  });
}

export default function UserAccessRealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleRefreshEvent = () => {
      void invalidateUserAccessQueries(queryClient);
    };

    window.addEventListener(USER_MASTER_SESSION_REFRESH_EVENT, handleRefreshEvent);

    return () => {
      window.removeEventListener(USER_MASTER_SESSION_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!supabaseClient) {
      return undefined;
    }

    const channel = supabaseClient.channel("psb-user-access-realtime");

    USER_ACCESS_WATCH_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload) => {
          const changedUserId = getChangedUserId(payload);
          if (!shouldInvalidateForCurrentSession(queryClient, changedUserId)) {
            return;
          }

          void invalidateUserAccessQueries(queryClient);
        }
      );
    });

    channel.subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
