import {
  getStatusDescription,
  getStatusDisplayName,
  isStatusActive,
} from "@/modules/admin/status-setup/model/status.model.js";

export function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function resolveErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallbackMessage;
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function mapStatusRow(status, index) {
  return {
    ...status,
    id: status?.status_id ?? `status-${index}`,
    sts_name: getStatusDisplayName(status),
    sts_desc: getStatusDescription(status),
    is_active_bool: isStatusActive(status),
  };
}

export function removeObjectKey(objectValue, keyToRemove) {
  const normalizedKey = String(keyToRemove ?? "");
  const nextObject = {};
  Object.entries(objectValue || {}).forEach(([key, value]) => {
    if (key !== normalizedKey) {
      nextObject[key] = value;
    }
  });
  return nextObject;
}

export function mergeUpdatePatch(previousPatch, nextPatch) {
  const mergedPatch = { ...(previousPatch || {}) };
  Object.entries(nextPatch || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      mergedPatch[key] = value;
    }
  });
  return mergedPatch;
}

export function appendUniqueId(idList, value) {
  const normalizedValue = String(value ?? "");
  if (!normalizedValue) return Array.isArray(idList) ? [...idList] : [];
  const existing = Array.isArray(idList) ? idList : [];
  if (existing.some((entry) => isSameId(entry, normalizedValue))) return [...existing];
  return [...existing, normalizedValue];
}

export const EMPTY_DIALOG = { kind: null, target: null, nextIsActive: null };
export const TEMP_STATUS_PREFIX = "tmp-status-";

export function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempStatusId(value) {
  return String(value ?? "").startsWith(TEMP_STATUS_PREFIX);
}

export function createEmptyStatusChanges() {
  return { creates: [], updates: {}, deactivations: [], hardDeletes: [] };
}

export async function requestJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(resolveErrorMessage(payload, fallbackMessage));
  }
  return payload;
}

export async function executeBatchSave(statusChanges) {
  const deactivatedSet = new Set(
    [...(statusChanges.deactivations || []), ...(statusChanges.hardDeletes || [])].map((id) => String(id ?? "")),
  );
  const tempIdMap = new Map();

  for (const createEntry of statusChanges.creates || []) {
    const payload = await requestJson(
      "/api/admin/status-setup/statuses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createEntry.payload),
      },
      "Failed to create status.",
    );
    const createdId = payload?.status?.status_id;
    if (createdId === undefined || createdId === null || createdId === "") {
      throw new Error("Created status response is invalid.");
    }
    tempIdMap.set(String(createEntry.tempId), createdId);
  }

  for (const [statusId, updates] of Object.entries(statusChanges.updates || {})) {
    const resolvedStatusId = tempIdMap.get(String(statusId)) ?? statusId;
    if (deactivatedSet.has(String(resolvedStatusId))) continue;
    if (isTempStatusId(resolvedStatusId)) continue;
    if (Object.keys(updates || {}).length === 0) continue;

    await requestJson(
      `/api/admin/status-setup/statuses/${encodeURIComponent(String(resolvedStatusId))}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
      "Failed to update status.",
    );
  }

  for (const statusId of statusChanges.deactivations || []) {
    const resolvedStatusId = tempIdMap.get(String(statusId)) ?? statusId;
    if (isTempStatusId(resolvedStatusId)) continue;

    await requestJson(
      `/api/admin/status-setup/statuses/${encodeURIComponent(String(resolvedStatusId))}`,
      { method: "DELETE" },
      "Failed to deactivate status.",
    );
  }

  for (const statusId of statusChanges.hardDeletes || []) {
    const resolvedStatusId = tempIdMap.get(String(statusId)) ?? statusId;
    if (isTempStatusId(resolvedStatusId)) continue;

    await requestJson(
      `/api/admin/status-setup/statuses/${encodeURIComponent(String(resolvedStatusId))}?permanent=true`,
      { method: "DELETE" },
      "Failed to permanently delete status.",
    );
  }
}
