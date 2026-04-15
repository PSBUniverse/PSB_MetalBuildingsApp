export const USER_MASTER_SESSION_REFRESH_EVENT = "psb:user-master-session-refresh";
export const USER_MASTER_ACCESS_QUERY_KEY_ROOT = ["user-master", "access"];

function normalizeAppKey(appKey) {
  const normalized = String(appKey || "").trim().toLowerCase();
  return normalized || "global";
}

function toSessionUrl(appKey = null) {
  if (!appKey) {
    return "/api/user-master/session";
  }

  return `/api/user-master/session?appKey=${encodeURIComponent(String(appKey))}`;
}

function toError(message, status, payload) {
  const error = new Error(message);
  error.status = status;
  error.payload = payload;
  return error;
}

export function getUserAccessQueryKey(appKey = null) {
  return [...USER_MASTER_ACCESS_QUERY_KEY_ROOT, normalizeAppKey(appKey)];
}

export function getSessionUserIdFromPayload(payload) {
  const userId = payload?.session?.userId;
  return userId === undefined || userId === null ? "" : String(userId);
}

export async function fetchUserAccess(appKey = null) {
  const response = await fetch(toSessionUrl(appKey), {
    method: "GET",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw toError(
      payload?.error || payload?.message || "Unable to load user access",
      response.status,
      payload
    );
  }

  return {
    session: payload?.session || null,
    user: payload?.user || null,
    access: payload?.access || null,
    accountInactive: Boolean(payload?.accountInactive),
    statusRestricted: Boolean(payload?.statusRestricted),
    limitedAccess: Boolean(payload?.limitedAccess),
  };
}

export function seedUserAccessQueryData(queryClient, payload, appKey = null) {
  if (!queryClient || !payload || typeof payload !== "object") {
    return;
  }

  queryClient.setQueryData(getUserAccessQueryKey(appKey), {
    session: payload?.session || null,
    user: payload?.user || null,
    access: payload?.access || null,
    accountInactive: Boolean(payload?.accountInactive),
    statusRestricted: Boolean(payload?.statusRestricted),
    limitedAccess: Boolean(payload?.limitedAccess),
  });
}

export async function invalidateUserAccessQueries(queryClient) {
  if (!queryClient) {
    return;
  }

  await queryClient.invalidateQueries({
    queryKey: USER_MASTER_ACCESS_QUERY_KEY_ROOT,
    refetchType: "active",
  });
}

export function clearUserAccessQueries(queryClient) {
  if (!queryClient) {
    return;
  }

  queryClient.removeQueries({
    queryKey: USER_MASTER_ACCESS_QUERY_KEY_ROOT,
  });
}

export function notifyUserMasterSessionRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(USER_MASTER_SESSION_REFRESH_EVENT));
}
