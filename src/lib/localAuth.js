import { USER_MASTER_SESSION_REFRESH_EVENT } from "@/modules/user-master/cache/user-master.query";

const CACHE_NAMESPACE_PREFIX = "psb-cache:psb-universe";
const SESSION_CACHE_KEY = `${CACHE_NAMESPACE_PREFIX}:user-master:session`;
const PROFILE_CACHE_KEY = `${CACHE_NAMESPACE_PREFIX}:user-master:profile`;
const ACCESS_CACHE_KEY = `${CACHE_NAMESPACE_PREFIX}:user-master:access:global`;

export const AUTH_CHANGE_EVENT = USER_MASTER_SESSION_REFRESH_EVENT;

function isBrowser() {
  return typeof window !== "undefined";
}

function readJson(key) {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readCacheData(cacheKey) {
  const cacheEntry = readJson(cacheKey);

  if (!cacheEntry || typeof cacheEntry !== "object") {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(cacheEntry, "data")) {
    return null;
  }

  return cacheEntry.data;
}

function extractUser(profilePayload) {
  if (!profilePayload || typeof profilePayload !== "object") {
    return null;
  }

  if (profilePayload.user && typeof profilePayload.user === "object") {
    return profilePayload.user;
  }

  return profilePayload;
}

function normalizeUserId(userRecord, sessionPayload) {
  const userId =
    userRecord?.user_id ??
    userRecord?.userId ??
    sessionPayload?.userId ??
    null;

  return userId === undefined || userId === null ? "" : String(userId).trim();
}

function resolveIsDevMain(userRecord, accessPayload) {
  const roleKeys = Array.isArray(accessPayload?.roleKeys)
    ? accessPayload.roleKeys.map((value) => String(value || "").trim().toLowerCase())
    : [];

  const userRole = String(userRecord?.role || userRecord?.user_role || "")
    .trim()
    .toLowerCase();

  return Boolean(accessPayload?.isDevMain) || roleKeys.includes("devmain") || userRole === "devmain";
}

export function getStoredUser() {
  const sessionPayload = readCacheData(SESSION_CACHE_KEY) || null;
  const profilePayload = readCacheData(PROFILE_CACHE_KEY) || null;
  const accessPayload = readCacheData(ACCESS_CACHE_KEY) || null;
  const userRecord = extractUser(profilePayload) || {};

  const userId = normalizeUserId(userRecord, sessionPayload);
  if (!userId) {
    return null;
  }

  return {
    userId,
    username: String(userRecord?.username || sessionPayload?.username || "").trim(),
    email: String(userRecord?.email || sessionPayload?.email || "").trim(),
    isDevMain: resolveIsDevMain(userRecord, accessPayload),
  };
}
