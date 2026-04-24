import {
  getApplicationDescription,
  getApplicationDisplayName,
  getApplicationDisplayOrder,
  isApplicationActive,
} from "@/modules/admin/application-setup/model/application.model.js";
import {
  getRoleDescription,
  getRoleDisplayName,
  isRoleActive,
} from "@/modules/admin/application-setup/model/role.model.js";

export function parseAppId(value) {
  if (value === undefined || value === null || value === "") return null;
  const asNumber = Number(String(value).trim());
  return Number.isFinite(asNumber) ? asNumber : String(value).trim();
}

export function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base", numeric: true });
}

export function buildOrderSignature(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => String(r?.app_id || "")).join("|");
}

export function mapApplicationRow(app, index) {
  return {
    ...app,
    id: app?.app_id ?? `app-${index}`,
    app_name: getApplicationDisplayName(app),
    app_desc: getApplicationDescription(app),
    app_order: getApplicationDisplayOrder(app, index + 1),
    is_active_bool: isApplicationActive(app),
  };
}

export function mapRoleRow(role, index) {
  return {
    ...role,
    id: role?.role_id ?? `role-${index}`,
    role_name: getRoleDisplayName(role),
    role_desc: getRoleDescription(role),
    is_active_bool: isRoleActive(role),
  };
}

function resolveErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallback;
}

export const EMPTY_DIALOG = { kind: null, target: null, nextIsActive: null };
export const TEMP_APP_PREFIX = "tmp-app-";
export const TEMP_ROLE_PREFIX = "tmp-role-";

export function createEmptyBatchState() {
  return { appCreates: [], appUpdates: {}, appDeactivations: [], appHardDeletes: [], roleCreates: [], roleUpdates: {}, roleDeactivations: [], roleHardDeletes: [] };
}

export function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempApplicationId(v) { return String(v ?? "").startsWith(TEMP_APP_PREFIX); }
export function isTempRoleId(v) { return String(v ?? "").startsWith(TEMP_ROLE_PREFIX); }

export function removeObjectKey(obj, key) {
  const k = String(key ?? "");
  const next = {};
  Object.entries(obj || {}).forEach(([k2, v]) => { if (k2 !== k) next[k2] = v; });
  return next;
}

export function mergeUpdatePatch(prev, patch) {
  const merged = { ...(prev || {}) };
  Object.entries(patch || {}).forEach(([k, v]) => { if (v !== undefined) merged[k] = v; });
  return merged;
}

export function appendUniqueId(list, value) {
  const v = String(value ?? "");
  if (!v) return Array.isArray(list) ? [...list] : [];
  const arr = Array.isArray(list) ? list : [];
  if (arr.some((e) => isSameId(e, v))) return [...arr];
  return [...arr, v];
}

async function requestJson(url, options, fallback) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(resolveErrorMessage(payload, fallback));
  return payload;
}

export async function executeBatchSave(pendingBatch, orderedApplications) {
  const appIdMap = new Map();
  const deactivatedAppSet = new Set(
    [...(pendingBatch.appDeactivations || []), ...(pendingBatch.appHardDeletes || [])].map((id) => String(id ?? "")),
  );
  const deactivatedRoleSet = new Set(
    [...(pendingBatch.roleDeactivations || []), ...(pendingBatch.roleHardDeletes || [])].map((id) => String(id ?? "")),
  );

  for (const entry of pendingBatch.appCreates || []) {
    const res = await requestJson("/api/admin/application-setup/applications", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.payload),
    }, "Failed to create application.");
    const id = res?.application?.app_id;
    if (id == null || id === "") throw new Error("Created application response is invalid.");
    appIdMap.set(String(entry.tempId), id);
  }

  for (const [appId, updates] of Object.entries(pendingBatch.appUpdates || {})) {
    if (deactivatedAppSet.has(String(appId)) || !Object.keys(updates || {}).length) continue;
    const resolved = appIdMap.get(String(appId)) ?? appId;
    await requestJson(`/api/admin/application-setup/applications/${encodeURIComponent(String(resolved))}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    }, "Failed to update application.");
  }

  for (const entry of pendingBatch.roleCreates || []) {
    const draftAppId = entry?.payload?.app_id;
    const resolved = appIdMap.get(String(draftAppId ?? "")) ?? draftAppId;
    if (!resolved || deactivatedAppSet.has(String(resolved))) continue;
    await requestJson("/api/admin/application-setup/roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry.payload, app_id: resolved }),
    }, "Failed to create role.");
  }

  for (const [roleId, updates] of Object.entries(pendingBatch.roleUpdates || {})) {
    if (deactivatedRoleSet.has(String(roleId)) || !Object.keys(updates || {}).length) continue;
    await requestJson(`/api/admin/application-setup/roles/${encodeURIComponent(String(roleId))}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    }, "Failed to update role.");
  }

  for (const roleId of pendingBatch.roleDeactivations || []) {
    if (isTempRoleId(roleId)) continue;
    await requestJson(`/api/admin/application-setup/roles/${encodeURIComponent(String(roleId))}`, {
      method: "DELETE",
    }, "Failed to deactivate role.");
  }

  for (const appId of pendingBatch.appDeactivations || []) {
    if (isTempApplicationId(appId)) continue;
    await requestJson(`/api/admin/application-setup/applications/${encodeURIComponent(String(appId))}`, {
      method: "DELETE",
    }, "Failed to deactivate application.");
  }

  for (const roleId of pendingBatch.roleHardDeletes || []) {
    if (isTempRoleId(roleId)) continue;
    await requestJson(`/api/admin/application-setup/roles/${encodeURIComponent(String(roleId))}?permanent=true`, {
      method: "DELETE",
    }, "Failed to permanently delete role.");
  }

  for (const appId of pendingBatch.appHardDeletes || []) {
    if (isTempApplicationId(appId)) continue;
    await requestJson(`/api/admin/application-setup/applications/${encodeURIComponent(String(appId))}?permanent=true`, {
      method: "DELETE",
    }, "Failed to permanently delete application.");
  }

  const orderedPersistedAppIds = orderedApplications
    .map((app) => app?.app_id)
    .map((id) => appIdMap.get(String(id ?? "")) ?? id)
    .filter((id) => id != null && id !== "")
    .filter((id) => !deactivatedAppSet.has(String(id)))
    .filter((id) => !isTempApplicationId(id));

  if (orderedPersistedAppIds.length > 0) {
    await requestJson("/api/admin/application-setup/order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appIds: orderedPersistedAppIds }),
    }, "Failed to save application order.");
  }

  return { appIdMap, deactivatedAppSet, orderedPersistedAppIds };
}
