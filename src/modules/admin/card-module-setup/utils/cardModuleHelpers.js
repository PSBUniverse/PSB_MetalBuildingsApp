import {
  getCardGroupDescription, getCardGroupDisplayName, getCardGroupDisplayOrder,
  getCardGroupIcon, isCardGroupActive,
} from "@/modules/admin/card-module-setup/model/cardGroup.model.js";
import {
  getCardDescription, getCardDisplayName, getCardDisplayOrder,
  getCardIcon, getCardRoutePath, isCardActive,
} from "@/modules/admin/card-module-setup/model/card.model.js";

export function parseId(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : String(value).trim();
}

export function isSameId(l, r) { return String(l ?? "") === String(r ?? ""); }

export function compareText(l, r) {
  return String(l || "").localeCompare(String(r || ""), undefined, { sensitivity: "base", numeric: true });
}

export function buildOrderSignature(rows, idKey) {
  return (Array.isArray(rows) ? rows : []).map((r) => String(r?.[idKey] || "")).join("|");
}

export function mapGroupRow(group, index) {
  const order = getCardGroupDisplayOrder(group, index + 1);
  return {
    ...group,
    id: group?.group_id ?? `grp-${index}`,
    group_name: getCardGroupDisplayName(group),
    group_desc: getCardGroupDescription(group),
    group_icon: getCardGroupIcon(group),
    display_order: order,
    __originalOrder: order,
    is_active_bool: isCardGroupActive(group),
  };
}

export function mapCardRow(card, index) {
  const order = getCardDisplayOrder(card, index + 1);
  return {
    ...card,
    id: card?.card_id ?? `card-${index}`,
    card_name: getCardDisplayName(card),
    card_desc: getCardDescription(card),
    route_path: getCardRoutePath(card),
    card_icon: getCardIcon(card),
    display_order: order,
    __originalOrder: order,
    is_active_bool: isCardActive(card),
  };
}

function resolveErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallback;
}

export const EMPTY_DIALOG = { kind: null, target: null, nextIsActive: null };
export const TEMP_GROUP_PREFIX = "tmp-grp-";
export const TEMP_CARD_PREFIX = "tmp-card-";

export function createEmptyBatchState() {
  return { groupCreates: [], groupUpdates: {}, groupDeactivations: [], groupHardDeletes: [], cardCreates: [], cardUpdates: {}, cardDeactivations: [], cardHardDeletes: [] };
}

export function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempGroupId(v) { return String(v ?? "").startsWith(TEMP_GROUP_PREFIX); }
export function isTempCardId(v) { return String(v ?? "").startsWith(TEMP_CARD_PREFIX); }

export function removeObjectKey(obj, key) {
  const k = String(key ?? "");
  const next = {};
  Object.entries(obj || {}).forEach(([k2, v]) => { if (k2 !== k) next[k2] = v; });
  return next;
}

export function mergeUpdatePatch(prev, patch) {
  const m = { ...(prev || {}) };
  Object.entries(patch || {}).forEach(([k, v]) => { if (v !== undefined) m[k] = v; });
  return m;
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

export async function executeBatchSave(pendingBatch, appGroups, allCards, persistedCardOrderSignatures) {
  const groupIdMap = new Map();
  const deactivatedGroupSet = new Set(
    [...(pendingBatch.groupDeactivations || []), ...(pendingBatch.groupHardDeletes || [])].map((id) => String(id ?? "")),
  );
  const deactivatedCardSet = new Set(
    [...(pendingBatch.cardDeactivations || []), ...(pendingBatch.cardHardDeletes || [])].map((id) => String(id ?? "")),
  );

  for (const entry of pendingBatch.groupCreates || []) {
    const res = await requestJson("/api/admin/card-module-setup/card-groups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry.payload),
    }, "Failed to create card group.");
    const id = res?.cardGroup?.group_id;
    if (id == null || id === "") throw new Error("Created card group response is invalid.");
    groupIdMap.set(String(entry.tempId), id);
  }

  for (const [gid, updates] of Object.entries(pendingBatch.groupUpdates || {})) {
    if (deactivatedGroupSet.has(String(gid)) || !Object.keys(updates || {}).length) continue;
    const resolved = groupIdMap.get(String(gid)) ?? gid;
    await requestJson(`/api/admin/card-module-setup/card-groups/${encodeURIComponent(String(resolved))}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    }, "Failed to update card group.");
  }

  for (const entry of pendingBatch.cardCreates || []) {
    const draftGid = entry?.payload?.group_id;
    const resolved = groupIdMap.get(String(draftGid ?? "")) ?? draftGid;
    if (!resolved || deactivatedGroupSet.has(String(resolved))) continue;
    await requestJson("/api/admin/card-module-setup/cards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry.payload, group_id: resolved }),
    }, "Failed to create card.");
  }

  for (const [cid, updates] of Object.entries(pendingBatch.cardUpdates || {})) {
    if (deactivatedCardSet.has(String(cid)) || !Object.keys(updates || {}).length) continue;
    await requestJson(`/api/admin/card-module-setup/cards/${encodeURIComponent(String(cid))}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    }, "Failed to update card.");
  }

  for (const cid of pendingBatch.cardDeactivations || []) {
    if (isTempCardId(cid)) continue;
    await requestJson(`/api/admin/card-module-setup/cards/${encodeURIComponent(String(cid))}`, { method: "DELETE" }, "Failed to deactivate card.");
  }

  for (const gid of pendingBatch.groupDeactivations || []) {
    if (isTempGroupId(gid)) continue;
    await requestJson(`/api/admin/card-module-setup/card-groups/${encodeURIComponent(String(gid))}`, { method: "DELETE" }, "Failed to deactivate card group.");
  }

  for (const cid of pendingBatch.cardHardDeletes || []) {
    if (isTempCardId(cid)) continue;
    await requestJson(`/api/admin/card-module-setup/cards/${encodeURIComponent(String(cid))}?permanent=true`, { method: "DELETE" }, "Failed to permanently delete card.");
  }

  for (const gid of pendingBatch.groupHardDeletes || []) {
    if (isTempGroupId(gid)) continue;
    await requestJson(`/api/admin/card-module-setup/card-groups/${encodeURIComponent(String(gid))}?permanent=true`, { method: "DELETE" }, "Failed to permanently delete card group.");
  }

  const orderedPersistedGroupIds = appGroups
    .map((g) => g?.group_id).map((id) => groupIdMap.get(String(id ?? "")) ?? id)
    .filter((id) => id != null && id !== "")
    .filter((id) => !deactivatedGroupSet.has(String(id))).filter((id) => !isTempGroupId(id));

  if (orderedPersistedGroupIds.length > 0) {
    await requestJson("/api/admin/card-module-setup/card-groups-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds: orderedPersistedGroupIds }),
    }, "Failed to save card group order.");
  }

  for (const group of appGroups) {
    const gid = String(group?.group_id ?? "");
    const resolvedGid = groupIdMap.get(gid) ?? group?.group_id;
    if (deactivatedGroupSet.has(String(resolvedGid))) continue;
    const groupCards = allCards
      .filter((c) => isSameId(c?.group_id, group?.group_id))
      .sort((a, b) => {
        const od = Number(a.display_order || 0) - Number(b.display_order || 0);
        return od !== 0 ? od : compareText(a.card_name, b.card_name);
      });
    const currentSig = buildOrderSignature(groupCards, "card_id");
    if (currentSig === (persistedCardOrderSignatures[gid] ?? "")) continue;
    const orderedCardIds = groupCards.map((c) => c?.card_id)
      .filter((id) => id != null && id !== "")
      .filter((id) => !deactivatedCardSet.has(String(id))).filter((id) => !isTempCardId(id));
    if (orderedCardIds.length > 0) {
      await requestJson("/api/admin/card-module-setup/cards-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: orderedCardIds }),
      }, "Failed to save card order.");
    }
  }

  return { groupIdMap, deactivatedGroupSet, orderedPersistedGroupIds };
}
