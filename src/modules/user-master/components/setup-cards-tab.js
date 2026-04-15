"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Form, Modal, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { toastError, toastSuccess } from "@/shared/utils/toast";
import { compareApplicationsByOrder } from "@/shared/utils/application-order";
import { normalizeRoutePath } from "@/shared/utils/route-path";
import {
  createCacheKey,
  getOrFetchCached,
  invalidateCacheByPrefix,
} from "@/core/cache/adapters/browser-cache.adapter";

const ADMIN_APP_KEY = "admin-config";
const SETUP_CARDS_CACHE_NAMESPACE = "user-master";
const SETUP_CARDS_CACHE_TTL_MS = 2 * 60 * 1000;
const SETUP_CARDS_CACHE_PREFIX = createCacheKey("setup-cards", ADMIN_APP_KEY);
const TEMP_GROUP_ID_PREFIX = "tmp-group-";
const TEMP_CARD_ID_PREFIX = "tmp-card-";
const DRAG_CONTEXT_INITIAL = Object.freeze({
  kind: "",
  sourceGroupId: "",
  sourceCardId: "",
  targetGroupId: "",
  targetCardId: "",
});

function buildSetupCardsCacheKey(appId) {
  return createCacheKey(SETUP_CARDS_CACHE_PREFIX, appId);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function asText(value) {
  return String(value ?? "").trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function moveArrayItem(items, sourceIndex, targetIndex) {
  const nextItems = Array.isArray(items) ? [...items] : [];
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= nextItems.length ||
    targetIndex >= nextItems.length ||
    sourceIndex === targetIndex
  ) {
    return nextItems;
  }

  const [moved] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, moved);
  return nextItems;
}

function resequenceDisplayOrder(items) {
  return (items || []).map((item, index) => ({
    ...item,
    display_order: index + 1,
  }));
}

function emptyGroupDraft() {
  return {
    group_id: null,
    group_name: "",
    group_desc: "",
    icon: "",
    display_order: 0,
    is_active: true,
  };
}

function emptyCardDraft() {
  return {
    card_id: null,
    group_id: null,
    card_name: "",
    card_desc: "",
    route_path: "",
    icon: "",
    display_order: 0,
    is_active: true,
    role_ids: [],
  };
}

function isTempGroupId(groupId) {
  return String(groupId || "").startsWith(TEMP_GROUP_ID_PREFIX);
}

function isTempCardId(cardId) {
  return String(cardId || "").startsWith(TEMP_CARD_ID_PREFIX);
}

function normalizeRoleIds(values) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value !== "")
    )
  ).sort((left, right) => left.localeCompare(right));
}

function roleIdsEqual(left, right) {
  const normalizedLeft = normalizeRoleIds(left);
  const normalizedRight = normalizeRoleIds(right);

  if (normalizedLeft.length !== normalizedRight.length) return false;

  for (let index = 0; index < normalizedLeft.length; index += 1) {
    if (normalizedLeft[index] !== normalizedRight[index]) {
      return false;
    }
  }

  return true;
}

function cloneCardRecord(card = {}) {
  const fallbackRoleIds = Array.isArray(card?.roles)
    ? card.roles.map((role) => String(role?.role_id || "")).filter(Boolean)
    : [];

  return {
    card_id: card?.card_id ?? null,
    group_id: card?.group_id ?? null,
    app_id: card?.app_id ?? null,
    card_name: asText(card?.card_name),
    card_desc: asText(card?.card_desc),
    route_path: normalizeRoutePath(card?.route_path),
    icon: asText(card?.icon),
    display_order: asNumber(card?.display_order, 0),
    is_active: card?.is_active !== false,
    role_ids: normalizeRoleIds(
      Array.isArray(card?.role_ids) ? card.role_ids : fallbackRoleIds
    ),
    roles: Array.isArray(card?.roles) ? [...card.roles] : [],
    __pendingRemove: Boolean(card?.__pendingRemove),
  };
}

function cloneGroupRecord(group = {}) {
  const cards = Array.isArray(group?.cards) ? group.cards.map(cloneCardRecord) : [];

  return {
    group_id: group?.group_id ?? null,
    app_id: group?.app_id ?? null,
    group_name: asText(group?.group_name),
    group_desc: asText(group?.group_desc),
    icon: asText(group?.icon),
    display_order: asNumber(group?.display_order, 0),
    is_active: group?.is_active !== false,
    cards,
    __pendingRemove: Boolean(group?.__pendingRemove),
  };
}

function cloneGroupRecords(groups = []) {
  return Array.isArray(groups) ? groups.map(cloneGroupRecord) : [];
}

function toComparableSnapshot(groups = []) {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    group_id: String(group?.group_id ?? ""),
    group_name: asText(group?.group_name),
    group_desc: asText(group?.group_desc),
    icon: asText(group?.icon),
    display_order: asNumber(group?.display_order, 0),
    is_active: Boolean(group?.is_active),
    __pendingRemove: Boolean(group?.__pendingRemove),
    cards: (Array.isArray(group?.cards) ? group.cards : []).map((card) => ({
      card_id: String(card?.card_id ?? ""),
      group_id: String(card?.group_id ?? ""),
      card_name: asText(card?.card_name),
      card_desc: asText(card?.card_desc),
      route_path: normalizeRoutePath(card?.route_path),
      icon: asText(card?.icon),
      display_order: asNumber(card?.display_order, 0),
      is_active: Boolean(card?.is_active),
      role_ids: normalizeRoleIds(card?.role_ids),
      __pendingRemove: Boolean(card?.__pendingRemove),
    })),
  }));
}

function sortByDisplayOrder(items = [], idKey) {
  return [...items].sort((left, right) => {
    const orderDiff = asNumber(left?.display_order, 0) - asNumber(right?.display_order, 0);
    if (orderDiff !== 0) return orderDiff;

    return String(left?.[idKey] ?? "").localeCompare(String(right?.[idKey] ?? ""));
  });
}

export default function SetupCardsTab({ applications = [], roles = [] }) {
  const [selectedAppId, setSelectedAppId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [baselineGroups, setBaselineGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [dragContext, setDragContext] = useState({ ...DRAG_CONTEXT_INITIAL });
  const tempIdRef = useRef(0);

  const [groupModal, setGroupModal] = useState({
    show: false,
    mode: "create",
    draft: emptyGroupDraft(),
  });

  const [cardModal, setCardModal] = useState({
    show: false,
    mode: "create",
    draft: emptyCardDraft(),
  });

  const appOptions = useMemo(() => {
    return [...(applications || [])]
      .filter((app) => hasValue(app?.app_id))
      .sort(compareApplicationsByOrder)
      .map((app) => ({
        app_id: app?.app_id,
        app_name: asText(app?.app_name) || `App ${app?.app_id}`,
        is_active: app?.is_active !== false,
      }))
      .filter((app) => hasValue(app.app_id));
  }, [applications]);

  const scopedRoles = useMemo(() => {
    if (!hasValue(selectedAppId)) return [];

    return (roles || [])
      .filter((role) => String(role?.app_id || "") === String(selectedAppId))
      .filter((role) => role?.is_active !== false)
      .sort((a, b) => asText(a?.role_name).localeCompare(asText(b?.role_name)));
  }, [roles, selectedAppId]);

  const roleNameById = useMemo(() => {
    const nextMap = new Map();

    (roles || []).forEach((role) => {
      const roleId = String(role?.role_id || "").trim();
      if (!hasValue(roleId)) return;
      nextMap.set(roleId, asText(role?.role_name) || `Role ${roleId}`);
    });

    return nextMap;
  }, [roles]);

  useEffect(() => {
    if (appOptions.length === 0) {
      setSelectedAppId("");
      return;
    }

    const exists = appOptions.some((item) => String(item.app_id) === String(selectedAppId));
    if (!hasValue(selectedAppId) || !exists) {
      setSelectedAppId(String(appOptions[0].app_id));
    }
  }, [appOptions, selectedAppId]);

  async function callApi(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || payload?.error || `${method} failed (${response.status})`);
    }

    return payload;
  }

  const loadGroups = useCallback(async (appId, options = {}) => {
    if (!hasValue(appId)) {
      setGroups([]);
      setExpandedGroups({});
      return;
    }

    const forceFresh = Boolean(options.forceFresh);

    setLoading(true);

    try {
      const cacheResult = await getOrFetchCached({
        key: buildSetupCardsCacheKey(appId),
        namespace: SETUP_CARDS_CACHE_NAMESPACE,
        ttlMs: SETUP_CARDS_CACHE_TTL_MS,
        forceFresh,
        allowStaleOnError: true,
        fetcher: async () => {
          const response = await fetch(
            `/api/setup/cards?app_id=${encodeURIComponent(appId)}&appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

          const payload = await response.json().catch(() => []);
          if (!response.ok) {
            throw new Error(payload?.message || "Unable to load card setup.");
          }

          return Array.isArray(payload) ? payload : [];
        },
      });

      const nextGroups = cloneGroupRecords(Array.isArray(cacheResult?.data) ? cacheResult.data : []);
      setGroups(nextGroups);
      setBaselineGroups(cloneGroupRecords(nextGroups));

      if (nextGroups.length > 0) {
        const firstGroupId = String(nextGroups[0].group_id);
        setExpandedGroups({ [firstGroupId]: true });
      } else {
        setExpandedGroups({});
      }
    } catch (error) {
      toastError(error?.message || "Unable to load card setup.", "Setup Cards");
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateSetupCardsCache = useCallback((appId = null) => {
    if (hasValue(appId)) {
      invalidateCacheByPrefix(buildSetupCardsCacheKey(appId), {
        namespace: SETUP_CARDS_CACHE_NAMESPACE,
      });
      return;
    }

    invalidateCacheByPrefix(SETUP_CARDS_CACHE_PREFIX, {
      namespace: SETUP_CARDS_CACHE_NAMESPACE,
    });
  }, []);

  useEffect(() => {
    if (!hasValue(selectedAppId)) return;
    void loadGroups(selectedAppId);
  }, [loadGroups, selectedAppId]);

  const diff = useMemo(() => {
    const groupDiffById = new Map();
    const cardDiffByKey = new Map();

    const baselineGroupsById = new Map(
      (baselineGroups || []).map((group) => [String(group?.group_id), group])
    );

    let newGroups = 0;
    let modifiedGroups = 0;
    let removedGroups = 0;
    let newCards = 0;
    let modifiedCards = 0;
    let removedCards = 0;

    for (const group of groups || []) {
      const groupId = String(group?.group_id || "");
      const baselineGroup = baselineGroupsById.get(groupId);
      const groupIsNew = isTempGroupId(groupId) || !baselineGroup;
      const groupIsPendingRemove = Boolean(group?.__pendingRemove);

      const changedColumns = new Set();

      if (!groupIsNew && baselineGroup) {
        if (asText(group?.group_name) !== asText(baselineGroup?.group_name)) changedColumns.add("group_name");
        if (asText(group?.group_desc) !== asText(baselineGroup?.group_desc)) changedColumns.add("group_desc");
        if (asText(group?.icon) !== asText(baselineGroup?.icon)) changedColumns.add("icon");
        if (asNumber(group?.display_order, 0) !== asNumber(baselineGroup?.display_order, 0)) {
          changedColumns.add("display_order");
        }
        if (Boolean(group?.is_active) !== Boolean(baselineGroup?.is_active)) changedColumns.add("is_active");
      }

      const groupIsChanged = groupIsNew || changedColumns.size > 0;

      if (groupIsPendingRemove) {
        if (!groupIsNew) {
          removedGroups += 1;
        }
      } else if (groupIsNew) {
        newGroups += 1;
      } else if (changedColumns.size > 0) {
        modifiedGroups += 1;
      }

      const baselineCardsById = new Map(
        (Array.isArray(baselineGroup?.cards) ? baselineGroup.cards : []).map((card) => [
          String(card?.card_id),
          card,
        ])
      );

      for (const card of Array.isArray(group?.cards) ? group.cards : []) {
        const cardId = String(card?.card_id || "");
        const baselineCard = baselineCardsById.get(cardId);
        const cardIsNew = isTempCardId(cardId) || !baselineCard;
        const cardIsPendingRemove = groupIsPendingRemove || Boolean(card?.__pendingRemove);

        const cardChangedColumns = new Set();

        if (!cardIsNew && baselineCard) {
          if (asText(card?.card_name) !== asText(baselineCard?.card_name)) cardChangedColumns.add("card_name");
          if (asText(card?.card_desc) !== asText(baselineCard?.card_desc)) cardChangedColumns.add("card_desc");
          if (normalizeRoutePath(card?.route_path) !== normalizeRoutePath(baselineCard?.route_path)) {
            cardChangedColumns.add("route_path");
          }
          if (asText(card?.icon) !== asText(baselineCard?.icon)) cardChangedColumns.add("icon");
          if (asNumber(card?.display_order, 0) !== asNumber(baselineCard?.display_order, 0)) {
            cardChangedColumns.add("display_order");
          }
          if (Boolean(card?.is_active) !== Boolean(baselineCard?.is_active)) cardChangedColumns.add("is_active");
          if (!roleIdsEqual(card?.role_ids, baselineCard?.role_ids)) cardChangedColumns.add("role_ids");
        }

        const cardIsChanged = cardIsNew || cardChangedColumns.size > 0;

        if (cardIsPendingRemove) {
          if (!cardIsNew) {
            removedCards += 1;
          }
        } else if (cardIsNew) {
          newCards += 1;
        } else if (cardChangedColumns.size > 0) {
          modifiedCards += 1;
        }

        cardDiffByKey.set(`${groupId}:${cardId}`, {
          isNew: cardIsNew,
          isChanged: cardIsChanged,
          isPendingRemove: cardIsPendingRemove,
          changedColumns: cardChangedColumns,
        });
      }

      groupDiffById.set(groupId, {
        isNew: groupIsNew,
        isChanged: groupIsChanged,
        isPendingRemove: groupIsPendingRemove,
        changedColumns,
      });
    }

    const hasPendingChanges =
      JSON.stringify(toComparableSnapshot(groups)) !==
      JSON.stringify(toComparableSnapshot(baselineGroups));

    const summary = hasPendingChanges
      ? `${newGroups} new groups, ${modifiedGroups} modified groups, ${removedGroups} removed groups; ${newCards} new cards, ${modifiedCards} modified cards, ${removedCards} removed cards`
      : "No changes";

    return {
      groupDiffById,
      cardDiffByKey,
      hasPendingChanges,
      summary,
    };
  }, [baselineGroups, groups]);

  const toggleGroupExpanded = useCallback((groupId) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [String(groupId)]: !previous[String(groupId)],
    }));
  }, []);

  const clearDragContext = useCallback(() => {
    setDragContext({ ...DRAG_CONTEXT_INITIAL });
  }, []);

  const buildTempGroupId = useCallback(() => {
    tempIdRef.current += 1;
    return `${TEMP_GROUP_ID_PREFIX}${Date.now()}-${tempIdRef.current}`;
  }, []);

  const buildTempCardId = useCallback(() => {
    tempIdRef.current += 1;
    return `${TEMP_CARD_ID_PREFIX}${Date.now()}-${tempIdRef.current}`;
  }, []);

  const validateDraftBeforeSave = useCallback(() => {
    const activeGroups = (groups || []).filter((group) => !group?.__pendingRemove);

    const seenGroupOrders = new Set();

    for (const group of activeGroups) {
      if (!hasValue(group?.group_name)) {
        return "Every group must have a group name before saving.";
      }

      const groupOrder = String(asNumber(group?.display_order, 0));
      if (seenGroupOrders.has(groupOrder)) {
        return `Duplicate group order ${groupOrder} detected. Please make orders unique.`;
      }
      seenGroupOrders.add(groupOrder);

      const activeCards = (Array.isArray(group?.cards) ? group.cards : []).filter(
        (card) => !card?.__pendingRemove
      );

      const seenCardOrders = new Set();

      for (const card of activeCards) {
        if (!hasValue(card?.card_name)) {
          return "Every card must have a card name before saving.";
        }

        if (!hasValue(normalizeRoutePath(card?.route_path))) {
          return "Every card must have a launch URL before saving.";
        }

        if (Boolean(card?.is_active) && group?.is_active === false) {
          return "Active cards are not allowed under an inactive group.";
        }

        const cardOrder = String(asNumber(card?.display_order, 0));
        if (seenCardOrders.has(cardOrder)) {
          return `Duplicate card order ${cardOrder} detected in group ${group?.group_name || group?.group_id}.`;
        }
        seenCardOrders.add(cardOrder);
      }
    }

    return null;
  }, [groups]);

  const handleGroupDragStart = useCallback(
    (groupId, event) => {
      if (saving) return;

      const sourceGroupId = String(groupId || "");
      if (!hasValue(sourceGroupId)) return;

      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", sourceGroupId);
      }

      setDragContext({
        ...DRAG_CONTEXT_INITIAL,
        kind: "group",
        sourceGroupId,
      });
    },
    [saving]
  );

  const handleGroupDragOver = useCallback(
    (targetGroupId, event) => {
      if (dragContext.kind !== "group") return;

      const targetId = String(targetGroupId || "");
      if (!hasValue(targetId) || targetId === dragContext.sourceGroupId) return;

      event.preventDefault();
      if (event?.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      setDragContext((previous) =>
        previous.targetGroupId === targetId
          ? previous
          : {
              ...previous,
              targetGroupId: targetId,
            }
      );
    },
    [dragContext.kind, dragContext.sourceGroupId]
  );

  const handleGroupDrop = useCallback(
    async (targetGroupId, event) => {
      event.preventDefault();

      const sourceGroupId = String(dragContext.sourceGroupId || "");
      const targetId = String(targetGroupId || "");

      if (
        dragContext.kind !== "group" ||
        !hasValue(sourceGroupId) ||
        !hasValue(targetId)
      ) {
        clearDragContext();
        return;
      }

      if (sourceGroupId === targetId) {
        clearDragContext();
        return;
      }

      const currentGroups = Array.isArray(groups) ? groups : [];
      const sourceIndex = currentGroups.findIndex(
        (group) => String(group?.group_id) === sourceGroupId
      );
      const targetIndex = currentGroups.findIndex(
        (group) => String(group?.group_id) === targetId
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        clearDragContext();
        return;
      }

      const reorderedGroups = moveArrayItem(currentGroups, sourceIndex, targetIndex);
      const reorderedWithOrder = resequenceDisplayOrder(reorderedGroups);
      const previousOrderById = new Map(
        currentGroups.map((group) => [
          String(group?.group_id),
          asNumber(group?.display_order, 0),
        ])
      );

      const changedGroups = reorderedWithOrder.filter(
        (group) =>
          previousOrderById.get(String(group?.group_id)) !==
          asNumber(group?.display_order, 0)
      );

      setGroups(reorderedWithOrder);
      clearDragContext();

      if (changedGroups.length > 0) {
        toastSuccess("Group reorder staged. Save Batch to apply.", "Setup Cards");
      }
    },
    [clearDragContext, dragContext.kind, dragContext.sourceGroupId, groups]
  );

  const handleCardDragStart = useCallback(
    (groupId, cardId, event) => {
      if (saving) return;

      const sourceGroupId = String(groupId || "");
      const sourceCardId = String(cardId || "");
      if (!hasValue(sourceGroupId) || !hasValue(sourceCardId)) return;

      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${sourceGroupId}:${sourceCardId}`);
      }

      setDragContext({
        ...DRAG_CONTEXT_INITIAL,
        kind: "card",
        sourceGroupId,
        sourceCardId,
        targetGroupId: sourceGroupId,
      });
    },
    [saving]
  );

  const handleCardDragOver = useCallback(
    (targetGroupId, targetCardId, event) => {
      if (dragContext.kind !== "card") return;

      const targetGroup = String(targetGroupId || "");
      const targetCard = String(targetCardId || "");
      if (!hasValue(targetGroup) || !hasValue(targetCard)) return;
      if (dragContext.sourceGroupId !== targetGroup) return;
      if (dragContext.sourceCardId === targetCard) return;

      event.preventDefault();
      if (event?.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      setDragContext((previous) =>
        previous.targetGroupId === targetGroup && previous.targetCardId === targetCard
          ? previous
          : {
              ...previous,
              targetGroupId: targetGroup,
              targetCardId: targetCard,
            }
      );
    },
    [dragContext.kind, dragContext.sourceCardId, dragContext.sourceGroupId]
  );

  const handleCardDrop = useCallback(
    async (targetGroupId, targetCardId, event) => {
      event.preventDefault();

      const sourceGroupId = String(dragContext.sourceGroupId || "");
      const sourceCardId = String(dragContext.sourceCardId || "");
      const targetGroup = String(targetGroupId || "");
      const targetCard = String(targetCardId || "");

      if (
        dragContext.kind !== "card" ||
        !hasValue(sourceGroupId) ||
        !hasValue(sourceCardId) ||
        !hasValue(targetGroup) ||
        !hasValue(targetCard)
      ) {
        clearDragContext();
        return;
      }

      if (sourceGroupId !== targetGroup) {
        clearDragContext();
        toastError("Drag cards within the same group to reorder.", "Setup Cards");
        return;
      }

      if (sourceCardId === targetCard) {
        clearDragContext();
        return;
      }

      const targetGroupRecord = (groups || []).find(
        (group) => String(group?.group_id) === targetGroup
      );
      const currentCards = Array.isArray(targetGroupRecord?.cards)
        ? targetGroupRecord.cards
        : [];

      const sourceIndex = currentCards.findIndex(
        (card) => String(card?.card_id) === sourceCardId
      );
      const targetIndex = currentCards.findIndex(
        (card) => String(card?.card_id) === targetCard
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        clearDragContext();
        return;
      }

      const reorderedCards = moveArrayItem(currentCards, sourceIndex, targetIndex);
      const reorderedWithOrder = resequenceDisplayOrder(reorderedCards);
      const previousOrderById = new Map(
        currentCards.map((card) => [String(card?.card_id), asNumber(card?.display_order, 0)])
      );

      const changedCards = reorderedWithOrder.filter(
        (card) =>
          previousOrderById.get(String(card?.card_id)) !==
          asNumber(card?.display_order, 0)
      );

      setGroups((previous) =>
        (previous || []).map((group) =>
          String(group?.group_id) === targetGroup
            ? {
                ...group,
                cards: reorderedWithOrder,
              }
            : group
        )
      );

      clearDragContext();

      if (changedCards.length > 0) {
        toastSuccess("Card reorder staged. Save Batch to apply.", "Setup Cards");
      }
    },
    [clearDragContext, dragContext.kind, dragContext.sourceCardId, dragContext.sourceGroupId, groups]
  );

  const openCreateGroup = useCallback(() => {
    const nextOrder =
      groups.reduce((max, item) => Math.max(max, asNumber(item?.display_order, 0)), 0) + 1;

    setGroupModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyGroupDraft(),
        display_order: nextOrder,
      },
    });
  }, [groups]);

  const openEditGroup = useCallback((group) => {
    setGroupModal({
      show: true,
      mode: "edit",
      draft: {
        group_id: group?.group_id,
        group_name: asText(group?.group_name),
        group_desc: asText(group?.group_desc),
        icon: asText(group?.icon),
        display_order: asNumber(group?.display_order, 0),
        is_active: group?.is_active !== false,
      },
    });
  }, []);

  const closeGroupModal = useCallback(() => {
    setGroupModal((previous) => ({
      ...previous,
      show: false,
    }));
  }, []);

  const submitGroupModal = useCallback(
    async (event) => {
      event.preventDefault();
      if (!hasValue(selectedAppId)) return;

      const draft = groupModal.draft;
      if (!hasValue(draft.group_name)) {
        toastError("Group name is required.", "Setup Cards");
        return;
      }

      if (groupModal.mode === "create") {
        const nextGroupId = buildTempGroupId();

        setGroups((previous) => {
          const nextGroups = [
            ...(previous || []),
            {
              group_id: nextGroupId,
              app_id: selectedAppId,
              group_name: asText(draft.group_name),
              group_desc: asText(draft.group_desc),
              icon: asText(draft.icon),
              display_order: asNumber(draft.display_order, 0),
              is_active: Boolean(draft.is_active),
              cards: [],
              __pendingRemove: false,
            },
          ];

          return sortByDisplayOrder(nextGroups, "group_id");
        });
      } else {
        const targetGroupId = String(draft.group_id || "");
        setGroups((previous) =>
          sortByDisplayOrder(
            (previous || []).map((group) =>
              String(group?.group_id) !== targetGroupId
                ? group
                : {
                    ...group,
                    group_name: asText(draft.group_name),
                    group_desc: asText(draft.group_desc),
                    icon: asText(draft.icon),
                    display_order: asNumber(draft.display_order, 0),
                    is_active: Boolean(draft.is_active),
                    cards:
                      Boolean(draft.is_active) || !Array.isArray(group.cards)
                        ? group.cards
                        : group.cards.map((card) => ({ ...card, is_active: false })),
                  }
            ),
            "group_id"
          )
        );
      }

      closeGroupModal();
      toastSuccess(
        groupModal.mode === "create"
          ? "Group staged. Save Batch to apply."
          : "Group update staged. Save Batch to apply.",
        "Setup Cards"
      );
    },
    [buildTempGroupId, closeGroupModal, groupModal.draft, groupModal.mode, selectedAppId]
  );

  const toggleGroupActive = useCallback(
    async (group, nextValue) => {
      if (!group?.group_id) return;

      const groupId = String(group.group_id);

      setGroups((previous) =>
        (previous || []).map((current) => {
          if (String(current?.group_id) !== groupId) return current;

          const nextActive = Boolean(nextValue);

          return {
            ...current,
            is_active: nextActive,
            cards: !nextActive
              ? (current.cards || []).map((card) => ({ ...card, is_active: false }))
              : current.cards,
          };
        })
      );

      toastSuccess("Group active state staged. Save Batch to apply.", "Setup Cards");
    },
    []
  );

  const removeGroup = useCallback(
    async (group) => {
      if (!group?.group_id) return;

      const groupId = String(group.group_id);
      const groupDiff = diff.groupDiffById.get(groupId);
      const isUndo = Boolean(groupDiff?.isPendingRemove);
      const okay = window.confirm(
        isUndo
          ? `Undo deletion for group \"${group.group_name || group.group_id}\"?`
          : `Delete group \"${group.group_name || group.group_id}\"?`
      );
      if (!okay) return;

      if (isTempGroupId(groupId)) {
        setGroups((previous) => (previous || []).filter((current) => String(current?.group_id) !== groupId));
        toastSuccess("Staged group removed.", "Setup Cards");
        return;
      }

      setGroups((previous) =>
        (previous || []).map((current) =>
          String(current?.group_id) !== groupId
            ? current
            : {
                ...current,
                __pendingRemove: !Boolean(current?.__pendingRemove),
              }
        )
      );

      toastSuccess(
        isUndo
          ? "Group deletion unstaged."
          : "Group deletion staged. Save Batch to apply.",
        "Setup Cards"
      );
    },
    [diff.groupDiffById]
  );

  const openCreateCard = useCallback((group) => {
    const cards = Array.isArray(group?.cards) ? group.cards : [];
    const nextOrder = cards.reduce((max, card) => Math.max(max, asNumber(card?.display_order, 0)), 0) + 1;

    setCardModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyCardDraft(),
        group_id: group?.group_id,
        display_order: nextOrder,
      },
    });
  }, []);

  const openEditCard = useCallback((card) => {
    const roleIds = Array.isArray(card?.role_ids)
      ? card.role_ids.map((value) => String(value))
      : Array.isArray(card?.roles)
      ? card.roles.map((item) => String(item?.role_id || "")).filter(Boolean)
      : [];

    setCardModal({
      show: true,
      mode: "edit",
      draft: {
        card_id: card?.card_id,
        group_id: card?.group_id,
        card_name: asText(card?.card_name),
        card_desc: asText(card?.card_desc),
        route_path: normalizeRoutePath(card?.route_path),
        icon: asText(card?.icon),
        display_order: asNumber(card?.display_order, 0),
        is_active: card?.is_active !== false,
        role_ids: roleIds,
      },
    });
  }, []);

  const closeCardModal = useCallback(() => {
    setCardModal((previous) => ({
      ...previous,
      show: false,
    }));
  }, []);

  const submitCardModal = useCallback(
    async (event) => {
      event.preventDefault();
      if (!hasValue(selectedAppId)) return;

      const draft = cardModal.draft;

      if (!hasValue(draft.group_id)) {
        toastError("A parent group is required.", "Setup Cards");
        return;
      }

      if (!hasValue(draft.card_name)) {
        toastError("Card name is required.", "Setup Cards");
        return;
      }

      const normalizedRoutePath = normalizeRoutePath(draft.route_path);

      if (!hasValue(normalizedRoutePath)) {
        toastError("Launch URL is required.", "Setup Cards");
        return;
      }

      const targetGroupId = String(draft.group_id || "");

      if (cardModal.mode === "create") {
        const nextCardId = buildTempCardId();

        setGroups((previous) =>
          (previous || []).map((group) => {
            if (String(group?.group_id) !== targetGroupId) return group;

            const nextCards = sortByDisplayOrder(
              [
                ...(Array.isArray(group.cards) ? group.cards : []),
                {
                  card_id: nextCardId,
                  app_id: selectedAppId,
                  group_id: targetGroupId,
                  card_name: asText(draft.card_name),
                  card_desc: asText(draft.card_desc),
                  route_path: normalizedRoutePath,
                  icon: asText(draft.icon),
                  display_order: asNumber(draft.display_order, 0),
                  is_active: Boolean(draft.is_active) && Boolean(group?.is_active),
                  role_ids: normalizeRoleIds(draft.role_ids),
                  roles: [],
                  __pendingRemove: false,
                },
              ],
              "card_id"
            );

            return {
              ...group,
              cards: nextCards,
            };
          })
        );
      } else {
        const targetCardId = String(draft.card_id || "");

        setGroups((previous) =>
          (previous || []).map((group) => {
            const currentCards = Array.isArray(group?.cards) ? group.cards : [];

            if (String(group?.group_id) !== targetGroupId) {
              return group;
            }

            const updatedCards = currentCards.map((card) =>
              String(card?.card_id) !== targetCardId
                ? card
                : {
                    ...card,
                    group_id: targetGroupId,
                    card_name: asText(draft.card_name),
                    card_desc: asText(draft.card_desc),
                    route_path: normalizedRoutePath,
                    icon: asText(draft.icon),
                    display_order: asNumber(draft.display_order, 0),
                    is_active: Boolean(draft.is_active) && Boolean(group?.is_active),
                    role_ids: normalizeRoleIds(draft.role_ids),
                  }
            );

            return {
              ...group,
              cards: sortByDisplayOrder(updatedCards, "card_id"),
            };
          })
        );
      }

      closeCardModal();
      toastSuccess(
        cardModal.mode === "create"
          ? "Card staged. Save Batch to apply."
          : "Card update staged. Save Batch to apply.",
        "Setup Cards"
      );
    },
    [buildTempCardId, cardModal.draft, cardModal.mode, closeCardModal, selectedAppId]
  );

  const toggleCardActive = useCallback(
    async (card, nextValue) => {
      if (!card?.card_id) return;

      const groupId = String(card.group_id || "");
      const cardId = String(card.card_id || "");

      setGroups((previous) =>
        (previous || []).map((group) => {
          if (String(group?.group_id) !== groupId) return group;

          return {
            ...group,
            cards: (Array.isArray(group.cards) ? group.cards : []).map((currentCard) =>
              String(currentCard?.card_id) !== cardId
                ? currentCard
                : {
                    ...currentCard,
                    is_active: Boolean(nextValue),
                  }
            ),
          };
        })
      );

      toastSuccess("Card active state staged. Save Batch to apply.", "Setup Cards");
    },
    []
  );

  const removeCard = useCallback(
    async (card) => {
      if (!card?.card_id) return;

      const groupId = String(card.group_id || "");
      const cardId = String(card.card_id || "");
      const cardDiff = diff.cardDiffByKey.get(`${groupId}:${cardId}`);
      const isUndo = Boolean(cardDiff?.isPendingRemove);
      const okay = window.confirm(
        isUndo
          ? `Undo deletion for card \"${card.card_name || card.card_id}\"?`
          : `Delete card \"${card.card_name || card.card_id}\"?`
      );
      if (!okay) return;

      setGroups((previous) =>
        (previous || []).map((group) => {
          if (String(group?.group_id) !== groupId) return group;

          if (isTempCardId(cardId)) {
            return {
              ...group,
              cards: (group.cards || []).filter(
                (currentCard) => String(currentCard?.card_id) !== cardId
              ),
            };
          }

          return {
            ...group,
            cards: (group.cards || []).map((currentCard) =>
              String(currentCard?.card_id) !== cardId
                ? currentCard
                : {
                    ...currentCard,
                    __pendingRemove: !Boolean(currentCard?.__pendingRemove),
                  }
            ),
          };
        })
      );

      toastSuccess(
        isUndo
          ? "Card deletion unstaged."
          : "Card deletion staged. Save Batch to apply.",
        "Setup Cards"
      );
    },
    [diff.cardDiffByKey]
  );

  const cancelBatchChanges = useCallback(() => {
    if (!diff.hasPendingChanges) return;

    setGroups(cloneGroupRecords(baselineGroups));
    clearDragContext();
    setGroupModal({
      show: false,
      mode: "create",
      draft: emptyGroupDraft(),
    });
    setCardModal({
      show: false,
      mode: "create",
      draft: emptyCardDraft(),
    });
    toastSuccess("Staged changes discarded.", "Setup Cards");
  }, [baselineGroups, clearDragContext, diff.hasPendingChanges]);

  const saveBatchChanges = useCallback(async () => {
    if (!hasValue(selectedAppId)) return;
    if (!diff.hasPendingChanges) return;

    const validationMessage = validateDraftBeforeSave();
    if (validationMessage) {
      toastError(validationMessage, "Setup Cards");
      return;
    }

    setSaving(true);

    try {
      const baselineGroupById = new Map(
        (baselineGroups || []).map((group) => [String(group?.group_id), group])
      );
      const draftGroups = Array.isArray(groups) ? groups : [];

      const tempGroupIdMap = new Map();
      const deletedCardIds = new Set();

      const activeDraftGroups = draftGroups.filter((group) => !group?.__pendingRemove);

      const existingActiveGroups = activeDraftGroups.filter(
        (group) => !isTempGroupId(group?.group_id) && baselineGroupById.has(String(group?.group_id))
      );

      const changedGroupOrders = existingActiveGroups.filter((group) => {
        const baseline = baselineGroupById.get(String(group?.group_id));
        return asNumber(group?.display_order, 0) !== asNumber(baseline?.display_order, 0);
      });

      if (changedGroupOrders.length > 0) {
        const groupOrderMax = Math.max(
          0,
          ...activeDraftGroups.map((group) => asNumber(group?.display_order, 0)),
          ...existingActiveGroups.map((group) => {
            const baseline = baselineGroupById.get(String(group?.group_id));
            return asNumber(baseline?.display_order, 0);
          })
        );

        const tempBaseOrder = groupOrderMax + 1000;

        for (const [index, group] of changedGroupOrders.entries()) {
          await callApi(`/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`, "PATCH", {
            entity: "group",
            group_id: group.group_id,
            display_order: tempBaseOrder + index,
          });
        }
      }

      const newGroups = sortByDisplayOrder(
        activeDraftGroups.filter((group) => isTempGroupId(group?.group_id)),
        "group_id"
      );

      for (const group of newGroups) {
        const createResult = await callApi(
          `/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "POST",
          {
            entity: "group",
            app_id: selectedAppId,
            group_name: asText(group.group_name),
            group_desc: asText(group.group_desc),
            icon: asText(group.icon),
            display_order: asNumber(group.display_order, 0),
            is_active: Boolean(group.is_active),
          }
        );

        const persistedGroupId = createResult?.data?.group?.group_id;
        if (!hasValue(persistedGroupId)) {
          throw new Error("Group was created without a group_id response.");
        }

        tempGroupIdMap.set(String(group.group_id), String(persistedGroupId));
      }

      for (const group of existingActiveGroups) {
        const baseline = baselineGroupById.get(String(group?.group_id));
        const updates = {};

        if (asText(group?.group_name) !== asText(baseline?.group_name)) {
          updates.group_name = asText(group?.group_name);
        }
        if (asText(group?.group_desc) !== asText(baseline?.group_desc)) {
          updates.group_desc = asText(group?.group_desc);
        }
        if (asText(group?.icon) !== asText(baseline?.icon)) {
          updates.icon = asText(group?.icon);
        }
        if (asNumber(group?.display_order, 0) !== asNumber(baseline?.display_order, 0)) {
          updates.display_order = asNumber(group?.display_order, 0);
        }
        if (Boolean(group?.is_active) !== Boolean(baseline?.is_active)) {
          updates.is_active = Boolean(group?.is_active);
        }

        if (Object.keys(updates).length === 0) {
          continue;
        }

        await callApi(`/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`, "PATCH", {
          entity: "group",
          group_id: group.group_id,
          ...updates,
        });
      }

      for (const draftGroup of activeDraftGroups) {
        const draftGroupId = String(draftGroup?.group_id || "");
        const resolvedGroupId =
          tempGroupIdMap.get(draftGroupId) || String(draftGroup?.group_id || "");

        if (!hasValue(resolvedGroupId)) {
          throw new Error("Unable to resolve group id for card batch save.");
        }

        const baselineGroup = baselineGroupById.get(draftGroupId);
        const baselineCardsById = new Map(
          (Array.isArray(baselineGroup?.cards) ? baselineGroup.cards : []).map((card) => [
            String(card?.card_id),
            card,
          ])
        );

        const draftCards = Array.isArray(draftGroup?.cards) ? draftGroup.cards : [];

        const cardsToDelete = draftCards.filter(
          (card) =>
            Boolean(card?.__pendingRemove) &&
            !isTempCardId(card?.card_id) &&
            baselineCardsById.has(String(card?.card_id))
        );

        for (const card of cardsToDelete) {
          const cardId = String(card?.card_id || "");
          if (!hasValue(cardId) || deletedCardIds.has(cardId)) continue;

          await callApi(
            `/api/setup/cards?entity=card&card_id=${encodeURIComponent(cardId)}&appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            "DELETE"
          );
          deletedCardIds.add(cardId);
        }

        const activeCards = draftCards.filter((card) => !card?.__pendingRemove);

        const existingActiveCards = activeCards.filter(
          (card) => !isTempCardId(card?.card_id) && baselineCardsById.has(String(card?.card_id))
        );

        const changedCardOrders = existingActiveCards.filter((card) => {
          const baselineCard = baselineCardsById.get(String(card?.card_id));
          return asNumber(card?.display_order, 0) !== asNumber(baselineCard?.display_order, 0);
        });

        if (changedCardOrders.length > 0) {
          const cardOrderMax = Math.max(
            0,
            ...activeCards.map((card) => asNumber(card?.display_order, 0)),
            ...(Array.isArray(baselineGroup?.cards)
              ? baselineGroup.cards.map((card) => asNumber(card?.display_order, 0))
              : [0])
          );

          const tempCardOrderBase = cardOrderMax + 1000;

          for (const [index, card] of changedCardOrders.entries()) {
            await callApi(`/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`, "PATCH", {
              entity: "card",
              card_id: card.card_id,
              display_order: tempCardOrderBase + index,
            });
          }
        }

        const newCards = sortByDisplayOrder(
          activeCards.filter((card) => isTempCardId(card?.card_id)),
          "card_id"
        );

        for (const card of newCards) {
          await callApi(`/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`, "POST", {
            entity: "card",
            app_id: selectedAppId,
            group_id: resolvedGroupId,
            card_name: asText(card.card_name),
            card_desc: asText(card.card_desc),
            route_path: normalizeRoutePath(card.route_path),
            icon: asText(card.icon),
            display_order: asNumber(card.display_order, 0),
            is_active: Boolean(card.is_active),
            role_ids: normalizeRoleIds(card.role_ids),
          });
        }

        for (const card of existingActiveCards) {
          const baselineCard = baselineCardsById.get(String(card?.card_id));
          const updates = {};

          if (asText(card?.card_name) !== asText(baselineCard?.card_name)) {
            updates.card_name = asText(card?.card_name);
          }
          if (asText(card?.card_desc) !== asText(baselineCard?.card_desc)) {
            updates.card_desc = asText(card?.card_desc);
          }
          if (normalizeRoutePath(card?.route_path) !== normalizeRoutePath(baselineCard?.route_path)) {
            updates.route_path = normalizeRoutePath(card?.route_path);
          }
          if (asText(card?.icon) !== asText(baselineCard?.icon)) {
            updates.icon = asText(card?.icon);
          }
          if (asNumber(card?.display_order, 0) !== asNumber(baselineCard?.display_order, 0)) {
            updates.display_order = asNumber(card?.display_order, 0);
          }
          if (Boolean(card?.is_active) !== Boolean(baselineCard?.is_active)) {
            updates.is_active = Boolean(card?.is_active);
          }
          if (!roleIdsEqual(card?.role_ids, baselineCard?.role_ids)) {
            updates.role_ids = normalizeRoleIds(card?.role_ids);
          }

          if (Object.keys(updates).length === 0) {
            continue;
          }

          await callApi(`/api/setup/cards?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`, "PATCH", {
            entity: "card",
            card_id: card.card_id,
            group_id: resolvedGroupId,
            ...updates,
          });
        }
      }

      const groupsToDelete = draftGroups.filter(
        (group) =>
          Boolean(group?.__pendingRemove) &&
          !isTempGroupId(group?.group_id) &&
          baselineGroupById.has(String(group?.group_id))
      );

      for (const group of groupsToDelete) {
        const groupId = String(group?.group_id || "");
        if (!hasValue(groupId)) continue;

        const baselineGroup = baselineGroupById.get(groupId);
        const baselineCards = Array.isArray(baselineGroup?.cards) ? baselineGroup.cards : [];

        for (const card of baselineCards) {
          const cardId = String(card?.card_id || "");
          if (!hasValue(cardId) || deletedCardIds.has(cardId)) continue;

          await callApi(
            `/api/setup/cards?entity=card&card_id=${encodeURIComponent(cardId)}&appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            "DELETE"
          );
          deletedCardIds.add(cardId);
        }

        await callApi(
          `/api/setup/cards?entity=group&group_id=${encodeURIComponent(groupId)}&appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "DELETE"
        );
      }

      invalidateSetupCardsCache(selectedAppId);
      await loadGroups(selectedAppId, { forceFresh: true });
      toastSuccess("Batch changes saved.", "Setup Cards");
    } catch (error) {
      toastError(error?.message || "Unable to save staged changes.", "Setup Cards");
      await loadGroups(selectedAppId, { forceFresh: true });
    } finally {
      setSaving(false);
    }
  }, [
    baselineGroups,
    diff.hasPendingChanges,
    groups,
    invalidateSetupCardsCache,
    loadGroups,
    selectedAppId,
    validateDraftBeforeSave,
  ]);

  if (appOptions.length === 0) {
    return <div className="notice-banner notice-banner-warning">No applications are available.</div>;
  }

  return (
    <div className="setup-cards-shell">
      <Tabs
        id="setup-cards-app-tabs"
        activeKey={selectedAppId}
        onSelect={(key) => setSelectedAppId(String(key || ""))}
        className="mb-3 setup-cards-app-tabs"
      >
        {appOptions.map((app) => (
          <Tab
            key={`setup-cards-app-${app.app_id}`}
            eventKey={String(app.app_id)}
            title={
              <span className="d-inline-flex align-items-center gap-1">
                <span>{app.app_name}</span>
                {!app.is_active ? <Badge bg="secondary">Inactive</Badge> : null}
              </span>
            }
          >
            <Card className="setup-cards-panel border-0 shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">Card Groups</div>
                  <div className="small text-muted">Manage hierarchy for this application only.</div>
                </div>
                <div className="d-flex gap-2">
                  <span
                    className={`small align-self-center setup-change-summary ${
                      diff.hasPendingChanges ? "is-dirty" : ""
                    }`}
                  >
                    {diff.summary}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-success"
                    onClick={() => void saveBatchChanges()}
                    disabled={!diff.hasPendingChanges || loading || saving}
                  >
                    {saving ? "Saving..." : "Save Batch"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={cancelBatchChanges}
                    disabled={!diff.hasPendingChanges || loading || saving}
                  >
                    Cancel Batch
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => {
                      if (
                        diff.hasPendingChanges &&
                        !window.confirm("Discard staged changes and refresh from server?")
                      ) {
                        return;
                      }
                      void loadGroups(selectedAppId, { forceFresh: true });
                    }}
                    disabled={loading || saving}
                  >
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={openCreateGroup}
                    disabled={loading || saving}
                  >
                    + Add Group
                  </Button>
                </div>
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <Spinner size="sm" animation="border" />
                    <span>Loading card groups...</span>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="notice-banner notice-banner-muted">
                    No card groups found for this application.
                  </div>
                ) : (
                  <div className="setup-cards-groups-stack">
                    {groups.map((group) => {
                      const groupId = String(group.group_id);
                      const isExpanded = Boolean(expandedGroups[groupId]);
                      const groupDiff = diff.groupDiffById.get(groupId) || {
                        isNew: false,
                        isChanged: false,
                        isPendingRemove: false,
                        changedColumns: new Set(),
                      };
                      const groupStateClass = groupDiff.isPendingRemove
                        ? "is-pending-remove"
                        : groupDiff.isNew
                        ? "is-new"
                        : groupDiff.isChanged
                        ? "is-modified"
                        : "";

                      return (
                        <Card
                          key={`setup-group-${groupId}`}
                          className={`setup-cards-group-card ${
                            dragContext.kind === "group" &&
                            dragContext.targetGroupId === groupId
                              ? "is-drop-target"
                              : ""
                          } ${groupStateClass}`}
                          onDragOver={(event) => {
                            if (groupDiff.isPendingRemove) return;
                            handleGroupDragOver(group.group_id, event);
                          }}
                          onDrop={(event) => {
                            if (groupDiff.isPendingRemove) return;
                            void handleGroupDrop(group.group_id, event);
                          }}
                        >
                          <Card.Header className="setup-cards-group-header">
                            <div className="setup-cards-group-title-wrap">
                              <Button
                                type="button"
                                variant="link"
                                className="setup-cards-group-toggle"
                                onClick={() => toggleGroupExpanded(group.group_id)}
                              >
                                <i
                                  className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"}`}
                                  aria-hidden="true"
                                />
                                <span className="setup-cards-group-title">{group.group_name || "Group"}</span>
                              </Button>

                              <div className="small text-muted setup-cards-group-desc">
                                {group.group_desc || "No description"}
                              </div>
                            </div>

                            <div className="setup-cards-group-controls">
                              <div className="d-flex align-items-center gap-2 setup-cards-drag-indicator">
                                <span
                                  className={`setup-cards-drag-handle ${
                                    saving || groupDiff.isPendingRemove ? "is-disabled" : ""
                                  }`}
                                  draggable={!saving && !groupDiff.isPendingRemove}
                                  onDragStart={(event) => handleGroupDragStart(group.group_id, event)}
                                  onDragEnd={clearDragContext}
                                  title="Drag to reorder group"
                                  aria-label="Drag to reorder group"
                                >
                                  <i className="bi bi-grip-vertical" aria-hidden="true" />
                                </span>
                                <span
                                  className={`small text-muted ${
                                    groupDiff.changedColumns.has("display_order") ? "setup-cards-value-changed" : ""
                                  }`}
                                >
                                  Order {asNumber(group.display_order, 0)}
                                </span>
                              </div>

                              <Form.Check
                                type="switch"
                                id={`setup-group-active-${groupId}`}
                                label="Active"
                                checked={Boolean(group.is_active)}
                                onChange={(event) => void toggleGroupActive(group, event.target.checked)}
                                disabled={saving || groupDiff.isPendingRemove}
                                className={
                                  groupDiff.changedColumns.has("is_active") ? "setup-cards-switch-changed" : ""
                                }
                              />

                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={() => openEditGroup(group)}
                                disabled={saving || groupDiff.isPendingRemove}
                              >
                                Edit
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline-dark"
                                onClick={() => openCreateCard(group)}
                                disabled={saving || groupDiff.isPendingRemove}
                              >
                                + Add Card
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant={groupDiff.isPendingRemove ? "outline-warning" : "outline-danger"}
                                onClick={() => void removeGroup(group)}
                                disabled={saving}
                              >
                                {groupDiff.isPendingRemove ? "Undo Delete" : "Delete"}
                              </Button>
                            </div>
                          </Card.Header>

                          {isExpanded ? (
                            <Card.Body className="setup-cards-group-body">
                              {Array.isArray(group.cards) && group.cards.length > 0 ? (
                                <Table size="sm" bordered hover className="admin-data-table setup-cards-table mb-0">
                                  <thead>
                                    <tr>
                                      <th>Card Name</th>
                                      <th>Route Path</th>
                                      <th>Roles</th>
                                      <th>Order</th>
                                      <th>Active</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.cards.map((card) => {
                                      const cardRoleNames = normalizeRoleIds(card.role_ids)
                                        .map((roleId) => roleNameById.get(String(roleId)) || `Role ${roleId}`)
                                        .filter(Boolean);
                                      const isCardDropTarget =
                                        dragContext.kind === "card" &&
                                        dragContext.targetGroupId === groupId &&
                                        dragContext.targetCardId === String(card.card_id);
                                      const cardDiffKey = `${groupId}:${String(card.card_id)}`;
                                      const cardDiff = diff.cardDiffByKey.get(cardDiffKey) || {
                                        isNew: false,
                                        isChanged: false,
                                        isPendingRemove: false,
                                        changedColumns: new Set(),
                                      };

                                      const rowStateClass = cardDiff.isPendingRemove
                                        ? "setup-row-pending-remove"
                                        : cardDiff.isNew
                                        ? "setup-row-new"
                                        : cardDiff.isChanged
                                        ? "setup-row-modified"
                                        : "";

                                      return (
                                        <tr
                                          key={`setup-card-${card.card_id}`}
                                          className={`${isCardDropTarget ? "setup-cards-card-drop-target" : ""} ${rowStateClass}`}
                                          onDragOver={(event) => {
                                            if (cardDiff.isPendingRemove) return;
                                            handleCardDragOver(group.group_id, card.card_id, event);
                                          }}
                                          onDrop={(event) => {
                                            if (cardDiff.isPendingRemove) return;
                                            void handleCardDrop(group.group_id, card.card_id, event);
                                          }}
                                        >
                                          <td
                                            className={
                                              cardDiff.changedColumns.has("card_name") ||
                                              cardDiff.changedColumns.has("card_desc")
                                                ? "setup-cell-changed"
                                                : ""
                                            }
                                          >
                                            <div className="fw-semibold">{card.card_name || "Card"}</div>
                                            <div className="small text-muted">{card.card_desc || "No description"}</div>
                                          </td>
                                          <td className={cardDiff.changedColumns.has("route_path") ? "setup-cell-changed" : ""}>
                                            {normalizeRoutePath(card.route_path) || "--"}
                                          </td>
                                          <td className={cardDiff.changedColumns.has("role_ids") ? "setup-cell-changed" : ""}>
                                            {cardRoleNames.length > 0
                                              ? cardRoleNames.join(", ")
                                              : "--"}
                                          </td>
                                          <td className={cardDiff.changedColumns.has("display_order") ? "setup-cell-changed" : ""}>
                                            <div className="d-flex align-items-center gap-2">
                                              <span className="small text-muted">{asNumber(card.display_order, 0)}</span>
                                              <span
                                                className={`setup-cards-drag-handle setup-cards-drag-handle-inline ${
                                                  saving || !group.is_active || groupDiff.isPendingRemove || cardDiff.isPendingRemove
                                                    ? "is-disabled"
                                                    : ""
                                                }`}
                                                draggable={
                                                  !saving &&
                                                  Boolean(group.is_active) &&
                                                  !groupDiff.isPendingRemove &&
                                                  !cardDiff.isPendingRemove
                                                }
                                                onDragStart={(event) =>
                                                  handleCardDragStart(group.group_id, card.card_id, event)
                                                }
                                                onDragEnd={clearDragContext}
                                                title={
                                                  group.is_active
                                                    ? "Drag to reorder card"
                                                    : "Activate group to reorder cards"
                                                }
                                                aria-label="Drag to reorder card"
                                              >
                                                <i className="bi bi-grip-vertical" aria-hidden="true" />
                                              </span>
                                            </div>
                                          </td>
                                          <td className={cardDiff.changedColumns.has("is_active") ? "setup-cell-changed" : ""}>
                                            <Form.Check
                                              type="switch"
                                              id={`setup-card-active-${card.card_id}`}
                                              label=""
                                              checked={Boolean(card.is_active)}
                                              onChange={(event) =>
                                                void toggleCardActive(card, event.target.checked)
                                              }
                                              disabled={
                                                saving ||
                                                !group.is_active ||
                                                groupDiff.isPendingRemove ||
                                                cardDiff.isPendingRemove
                                              }
                                            />
                                          </td>
                                          <td>
                                            <div className="d-flex gap-1">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={() => openEditCard(card)}
                                                disabled={saving || groupDiff.isPendingRemove || cardDiff.isPendingRemove}
                                              >
                                                Edit
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant={cardDiff.isPendingRemove ? "outline-warning" : "outline-danger"}
                                                onClick={() => void removeCard(card)}
                                                disabled={saving}
                                              >
                                                {cardDiff.isPendingRemove ? "Undo Delete" : "Delete"}
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </Table>
                              ) : (
                                <div className="setup-cards-empty">No cards in this group.</div>
                              )}
                            </Card.Body>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Tab>
        ))}
      </Tabs>

      <Modal show={groupModal.show} onHide={closeGroupModal} centered>
        <Form onSubmit={submitGroupModal}>
          <Modal.Header closeButton>
            <Modal.Title>{groupModal.mode === "create" ? "Add Group" : "Edit Group"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Group Name</Form.Label>
              <Form.Control
                value={groupModal.draft.group_name}
                onChange={(event) =>
                  setGroupModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, group_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={groupModal.draft.group_desc}
                onChange={(event) =>
                  setGroupModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, group_desc: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Display Order</Form.Label>
              <Form.Control
                type="number"
                value={groupModal.draft.display_order}
                onChange={(event) =>
                  setGroupModal((previous) => ({
                    ...previous,
                    draft: {
                      ...previous.draft,
                      display_order: asNumber(event.target.value, 0),
                    },
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(groupModal.draft.is_active)}
              onChange={(event) =>
                setGroupModal((previous) => ({
                  ...previous,
                  draft: { ...previous.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeGroupModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {groupModal.mode === "create" ? "Stage Group" : "Stage Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={cardModal.show} onHide={closeCardModal} centered>
        <Form onSubmit={submitCardModal}>
          <Modal.Header closeButton>
            <Modal.Title>{cardModal.mode === "create" ? "Add Card" : "Edit Card"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Card Name</Form.Label>
              <Form.Control
                value={cardModal.draft.card_name}
                onChange={(event) =>
                  setCardModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, card_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={cardModal.draft.card_desc}
                onChange={(event) =>
                  setCardModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, card_desc: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Launch URL</Form.Label>
              <Form.Control
                value={cardModal.draft.route_path}
                onChange={(event) =>
                  setCardModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, route_path: event.target.value },
                  }))
                }
                placeholder="/dashboard or module:gutter/dashboard"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Icon</Form.Label>
              <Form.Control
                value={cardModal.draft.icon}
                onChange={(event) =>
                  setCardModal((previous) => ({
                    ...previous,
                    draft: { ...previous.draft, icon: event.target.value },
                  }))
                }
                placeholder="bi-file-earmark"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Display Order</Form.Label>
              <Form.Control
                type="number"
                value={cardModal.draft.display_order}
                onChange={(event) =>
                  setCardModal((previous) => ({
                    ...previous,
                    draft: {
                      ...previous.draft,
                      display_order: asNumber(event.target.value, 0),
                    },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Roles</Form.Label>
              {scopedRoles.length === 0 ? (
                <div className="notice-banner notice-banner-muted mb-0">
                  No roles available for assignment.
                </div>
              ) : (
                <div className="setup-cards-role-checklist">
                  {scopedRoles.map((role) => {
                    const roleId = String(role.role_id);
                    const checked = Array.isArray(cardModal.draft.role_ids)
                      ? cardModal.draft.role_ids.includes(roleId)
                      : false;

                    return (
                      <Form.Check
                        key={`setup-card-role-${roleId}`}
                        id={`setup-card-role-check-${roleId}`}
                        type="checkbox"
                        label={asText(role.role_name) || `Role ${roleId}`}
                        checked={checked}
                        onChange={(event) => {
                          const isChecked = event.target.checked;
                          setCardModal((previous) => {
                            const current = Array.isArray(previous.draft.role_ids)
                              ? previous.draft.role_ids.map((value) => String(value))
                              : [];

                            const nextRoleIds = isChecked
                              ? Array.from(new Set([...current, roleId]))
                              : current.filter((value) => value !== roleId);

                            return {
                              ...previous,
                              draft: { ...previous.draft, role_ids: nextRoleIds },
                            };
                          });
                        }}
                      />
                    );
                  })}
                </div>
              )}
              <Form.Text className="text-muted">
                {scopedRoles.length === 0
                  ? "No roles available for assignment."
                  : "Select one or more roles for this card."}
              </Form.Text>
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(cardModal.draft.is_active)}
              onChange={(event) =>
                setCardModal((previous) => ({
                  ...previous,
                  draft: { ...previous.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeCardModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {cardModal.mode === "create" ? "Stage Card" : "Stage Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
