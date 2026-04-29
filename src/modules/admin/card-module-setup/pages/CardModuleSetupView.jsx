"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Card, InlineEditCell, Input, Modal, TableZ, toastError, toastSuccess } from "@/shared/components/ui";
import {
  parseId, isSameId, compareText, buildOrderSignature,
  mapGroupRow, mapCardRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_GROUP_PREFIX, TEMP_CARD_PREFIX, createTempId,
  isTempGroupId, isTempCardId, createEmptyBatchState, executeBatchSave,
} from "../data/cardModuleSetup.data.js";

// ─── HOOK: useGroupActions ─────────────────────────────────

function useGroupActions({
  isSaving, isMutatingAction, selectedApp, appGroups, allCards, orderedGroups,
  selectedGroup, dialog, groupDraft, pendingDeactivatedGroupIds,
  setOrderedGroups, setAllCards, setPendingBatch, setDialog, setGroupDraft, updateQueryParams,
}) {
  const openAddGroupDialog = useCallback(() => {
    if (isSaving || isMutatingAction) return;
    if (!selectedApp?.app_id) { toastError("Select an application first."); return; }
    setGroupDraft({ name: "", desc: "", icon: "" });
    setDialog({ kind: "add-group", target: { app_id: selectedApp.app_id }, nextIsActive: true });
  }, [isMutatingAction, isSaving, selectedApp, setDialog, setGroupDraft]);

  const openEditGroupDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    setGroupDraft({ name: String(row?.group_name || ""), desc: String(row?.group_desc || ""), icon: String(row?.group_icon || row?.icon || "") });
    setDialog({ kind: "edit-group", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDialog, setGroupDraft]);

  const openToggleGroupDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    const groupId = String(row?.group_id ?? "");
    if (pendingDeactivatedGroupIds.has(groupId)) {
      const linkedCardIds = allCards.filter((c) => isSameId(c?.group_id, groupId)).map((c) => String(c?.card_id ?? ""));
      setPendingBatch((prev) => ({
        ...prev,
        groupDeactivations: (prev.groupDeactivations || []).filter((id) => !isSameId(id, groupId)),
        cardDeactivations: (prev.cardDeactivations || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
      }));
      toastSuccess("Card group deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-group", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [allCards, isMutatingAction, isSaving, pendingDeactivatedGroupIds, setDialog, setPendingBatch]);

  const openDeactivateGroupDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    setDialog({ kind: "deactivate-group", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDialog]);

  const submitAddGroup = useCallback(() => {
    const groupName = String(groupDraft.name || "").trim();
    if (!groupName) { toastError("Group name is required."); return; }
    const groupDesc = String(groupDraft.desc || "").trim();
    const groupIcon = String(groupDraft.icon || "").trim() || "bi-collection";
    const tempGroupId = createTempId(TEMP_GROUP_PREFIX);
    setOrderedGroups((prev) => [...prev, mapGroupRow({
      group_id: tempGroupId, app_id: selectedApp?.app_id, group_name: groupName,
      group_desc: groupDesc, icon: groupIcon, is_active: true, display_order: appGroups.length + 1,
    }, prev.length)]);
    setPendingBatch((prev) => ({ ...prev, groupCreates: [...prev.groupCreates, {
      tempId: tempGroupId, payload: { app_id: selectedApp?.app_id, group_name: groupName, group_desc: groupDesc, icon: groupIcon, is_active: true },
    }]}));
    updateQueryParams({ group: tempGroupId }); setDialog(EMPTY_DIALOG); setGroupDraft({ name: "", desc: "", icon: "" });
    toastSuccess("Card group staged for Save Batch.", "Batching");
  }, [appGroups.length, groupDraft, selectedApp, setDialog, setGroupDraft, setOrderedGroups, setPendingBatch, updateQueryParams]);

  const submitEditGroup = useCallback(() => {
    const row = dialog?.target;
    if (!row?.group_id) { toastError("Invalid card group."); return; }
    const groupName = String(groupDraft.name || "").trim();
    if (!groupName) { toastError("Group name is required."); return; }
    const groupDesc = String(groupDraft.desc || "").trim();
    const groupIcon = String(groupDraft.icon || "").trim() || "bi-collection";
    const groupId = row.group_id;
    setOrderedGroups((prev) => prev.map((g, i) => isSameId(g?.group_id, groupId)
      ? mapGroupRow({ ...g, group_name: groupName, group_desc: groupDesc, icon: groupIcon }, i) : g));
    setPendingBatch((prev) => {
      if (isTempGroupId(groupId)) {
        return { ...prev, groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId) ? { ...e, payload: { ...e.payload, group_name: groupName, group_desc: groupDesc, icon: groupIcon } } : e), groupUpdates: removeObjectKey(prev.groupUpdates, groupId) };
      }
      return { ...prev, groupUpdates: { ...prev.groupUpdates, [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { group_name: groupName, group_desc: groupDesc, icon: groupIcon }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card group update staged for Save Batch.", "Batching");
  }, [dialog, groupDraft, setDialog, setOrderedGroups, setPendingBatch]);

  const submitToggleGroup = useCallback(() => {
    const row = dialog?.target; const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.group_id) { toastError("Invalid card group."); return; }
    const groupId = row.group_id;
    setOrderedGroups((prev) => prev.map((g, i) => isSameId(g?.group_id, groupId) ? mapGroupRow({ ...g, is_active: nextIsActive }, i) : g));
    setPendingBatch((prev) => {
      if (isTempGroupId(groupId)) {
        return { ...prev, groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e), groupUpdates: removeObjectKey(prev.groupUpdates, groupId) };
      }
      return { ...prev, groupUpdates: { ...prev.groupUpdates, [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { is_active: nextIsActive }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Card group ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setDialog, setOrderedGroups, setPendingBatch]);

  const submitDeactivateGroup = useCallback(() => {
    const row = dialog?.target;
    if (!row?.group_id) { toastError("Invalid card group."); return; }
    const groupId = row.group_id;
    const linkedCardIds = allCards.filter((c) => isSameId(c?.group_id, groupId)).map((c) => String(c?.card_id ?? ""));

    if (isTempGroupId(groupId)) {
      const nextGroups = orderedGroups.filter((g) => !isSameId(g?.group_id, groupId)).map((g, i) => ({ ...g, display_order: i + 1 }));
      setOrderedGroups(nextGroups);
      setAllCards((prev) => prev.filter((c) => !isSameId(c?.group_id, groupId)));
      setPendingBatch((prev) => ({
        ...prev, groupCreates: prev.groupCreates.filter((e) => !isSameId(e?.tempId, groupId)),
        groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        groupDeactivations: (prev.groupDeactivations || []).filter((id) => !isSameId(id, groupId)),
        cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.payload?.group_id, groupId)),
        cardUpdates: linkedCardIds.reduce((m, id) => removeObjectKey(m, id), prev.cardUpdates),
        cardDeactivations: (prev.cardDeactivations || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
      }));
      if (isSameId(selectedGroup?.group_id, groupId)) {
        const remaining = nextGroups.filter((g) => isSameId(g?.app_id, selectedApp?.app_id));
        updateQueryParams({ group: remaining[0]?.group_id ?? null });
      }
      setDialog(EMPTY_DIALOG); toastSuccess("Card group deactivation staged for Save Batch.", "Batching"); return;
    }

    setPendingBatch((prev) => {
      const nextCardDeactivations = linkedCardIds.reduce((ids, id) => appendUniqueId(ids, id), prev.cardDeactivations || []);
      return { ...prev, groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        groupDeactivations: appendUniqueId(prev.groupDeactivations, groupId),
        cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.payload?.group_id, groupId)),
        cardUpdates: linkedCardIds.reduce((m, id) => removeObjectKey(m, id), prev.cardUpdates),
        cardDeactivations: nextCardDeactivations,
      };
    });
    setDialog(EMPTY_DIALOG); toastSuccess("Card group deactivation staged for Save Batch.", "Batching");
  }, [allCards, dialog, orderedGroups, selectedApp, selectedGroup, setAllCards, setDialog, setOrderedGroups, setPendingBatch, updateQueryParams]);

  const stageHardDeleteGroup = useCallback((row) => {
    const groupId = String(row?.group_id ?? "");
    if (!groupId || isSaving || isMutatingAction) return;
    const linkedCardIds = allCards.filter((c) => isSameId(c?.group_id, groupId)).map((c) => String(c?.card_id ?? ""));

    if (isTempGroupId(groupId)) {
      const nextGroups = orderedGroups.filter((g) => !isSameId(g?.group_id, groupId)).map((g, i) => ({ ...g, display_order: i + 1 }));
      setOrderedGroups(nextGroups);
      setAllCards((prev) => prev.filter((c) => !isSameId(c?.group_id, groupId)));
      setPendingBatch((prev) => ({
        ...prev, groupCreates: prev.groupCreates.filter((e) => !isSameId(e?.tempId, groupId)),
        groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.payload?.group_id, groupId)),
        cardUpdates: linkedCardIds.reduce((m, id) => removeObjectKey(m, id), prev.cardUpdates),
        cardDeactivations: (prev.cardDeactivations || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
        cardHardDeletes: (prev.cardHardDeletes || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
      }));
      if (isSameId(selectedGroup?.group_id, groupId)) {
        const remaining = nextGroups.filter((g) => isSameId(g?.app_id, selectedApp?.app_id));
        updateQueryParams({ group: remaining[0]?.group_id ?? null });
      }
      toastSuccess("Staged card group removed.", "Batching"); return;
    }

    setPendingBatch((prev) => ({
      ...prev, groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
      groupDeactivations: (prev.groupDeactivations || []).filter((id) => !isSameId(id, groupId)),
      groupHardDeletes: appendUniqueId(prev.groupHardDeletes || [], groupId),
      cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.payload?.group_id, groupId)),
      cardUpdates: linkedCardIds.reduce((m, id) => removeObjectKey(m, id), prev.cardUpdates),
      cardDeactivations: (prev.cardDeactivations || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
      cardHardDeletes: linkedCardIds.reduce(
        (ids, id) => isTempCardId(id) ? ids : appendUniqueId(ids, id),
        (prev.cardHardDeletes || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
      ),
    }));
    toastSuccess("Card group deletion staged for Save Batch.", "Batching");
  }, [allCards, isMutatingAction, isSaving, orderedGroups, selectedApp, selectedGroup, setAllCards, setOrderedGroups, setPendingBatch, updateQueryParams]);

  const unstageHardDeleteGroup = useCallback((row) => {
    const groupId = String(row?.group_id ?? "");
    if (!groupId || isSaving || isMutatingAction) return;
    const linkedCardIds = allCards.filter((c) => isSameId(c?.group_id, groupId)).map((c) => String(c?.card_id ?? ""));
    setPendingBatch((prev) => ({
      ...prev, groupHardDeletes: (prev.groupHardDeletes || []).filter((id) => !isSameId(id, groupId)),
      cardHardDeletes: (prev.cardHardDeletes || []).filter((id) => !linkedCardIds.some((lr) => isSameId(lr, id))),
    }));
    toastSuccess("Card group deletion un-staged.", "Batching");
  }, [allCards, isMutatingAction, isSaving, setPendingBatch]);

  return {
    openAddGroupDialog, openEditGroupDialog, openToggleGroupDialog, openDeactivateGroupDialog,
    submitAddGroup, submitEditGroup, submitToggleGroup, submitDeactivateGroup, stageHardDeleteGroup, unstageHardDeleteGroup,
  };
}

// ─── HOOK: useCardActions ──────────────────────────────────

function useCardActions({
  isSaving, isMutatingAction, isSelectedGroupPendingDeactivation,
  selectedGroup, selectedApp, selectedGroupCards, pendingDeactivatedCardIds,
  dialog, cardDraft, setAllCards, setPendingBatch, setDialog, setCardDraft,
}) {
  const openAddCardDialog = useCallback(() => {
    if (isSaving || isMutatingAction) return;
    if (!selectedGroup?.group_id) { toastError("Select a card group before adding a card."); return; }
    if (isSelectedGroupPendingDeactivation) { toastError("Selected group is staged for deactivation. Save or cancel batch before adding a card."); return; }
    setCardDraft({ name: "", desc: "", route_path: "", icon: "" });
    setDialog({ kind: "add-card", target: { group_id: selectedGroup.group_id, group_name: selectedGroup.group_name, app_id: selectedApp?.app_id }, nextIsActive: true });
  }, [isMutatingAction, isSaving, isSelectedGroupPendingDeactivation, selectedApp, selectedGroup, setCardDraft, setDialog]);

  const openEditCardDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    setCardDraft({ name: String(row?.card_name || ""), desc: String(row?.card_desc || ""), route_path: String(row?.route_path || ""), icon: String(row?.card_icon || row?.icon || "") });
    setDialog({ kind: "edit-card", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setCardDraft, setDialog]);

  const openToggleCardDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    const cardId = String(row?.card_id ?? "");
    if (pendingDeactivatedCardIds.has(cardId)) {
      setPendingBatch((prev) => ({ ...prev, cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)) }));
      toastSuccess("Card deactivation un-staged.", "Batching"); return;
    }
    setDialog({ kind: "toggle-card", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSaving, pendingDeactivatedCardIds, setDialog, setPendingBatch]);

  const openDeactivateCardDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    setDialog({ kind: "deactivate-card", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDialog]);

  const submitAddCard = useCallback(() => {
    const target = dialog?.target;
    if (!target?.group_id) { toastError("Select a card group before adding a card."); return; }
    const cardName = String(cardDraft.name || "").trim();
    if (!cardName) { toastError("Card name is required."); return; }
    const cardDesc = String(cardDraft.desc || "").trim();
    const routePath = String(cardDraft.route_path || "").trim() || "#";
    const cardIcon = String(cardDraft.icon || "").trim() || "bi-grid-3x3-gap";
    const tempCardId = createTempId(TEMP_CARD_PREFIX);
    setAllCards((prev) => [...prev, mapCardRow({
      card_id: tempCardId, group_id: target.group_id, app_id: target.app_id,
      card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon,
      is_active: true, display_order: selectedGroupCards.length + 1,
    }, prev.length)]);
    setPendingBatch((prev) => ({ ...prev, cardCreates: [...prev.cardCreates, {
      tempId: tempCardId, payload: { group_id: target.group_id, app_id: target.app_id, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon, is_active: true },
    }]}));
    setDialog(EMPTY_DIALOG); setCardDraft({ name: "", desc: "", route_path: "", icon: "" });
    toastSuccess("Card staged for Save Batch.", "Batching");
  }, [cardDraft, dialog, selectedGroupCards.length, setAllCards, setCardDraft, setDialog, setPendingBatch]);

  const submitEditCard = useCallback(() => {
    const row = dialog?.target;
    if (!row?.card_id) { toastError("Invalid card."); return; }
    const cardName = String(cardDraft.name || "").trim();
    if (!cardName) { toastError("Card name is required."); return; }
    const cardDesc = String(cardDraft.desc || "").trim();
    const routePath = String(cardDraft.route_path || "").trim() || "#";
    const cardIcon = String(cardDraft.icon || "").trim() || "bi-grid-3x3-gap";
    const cardId = row.card_id;
    setAllCards((prev) => prev.map((c, i) => isSameId(c?.card_id, cardId) ? mapCardRow({ ...c, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon }, i) : c));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev, cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId) ? { ...e, payload: { ...e.payload, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon } } : e), cardUpdates: removeObjectKey(prev.cardUpdates, cardId) };
      }
      return { ...prev, cardUpdates: { ...prev.cardUpdates, [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card update staged for Save Batch.", "Batching");
  }, [cardDraft, dialog, setAllCards, setDialog, setPendingBatch]);

  const submitToggleCard = useCallback(() => {
    const row = dialog?.target; const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.card_id) { toastError("Invalid card."); return; }
    const cardId = row.card_id;
    setAllCards((prev) => prev.map((c, i) => isSameId(c?.card_id, cardId) ? mapCardRow({ ...c, is_active: nextIsActive }, i) : c));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev, cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e), cardUpdates: removeObjectKey(prev.cardUpdates, cardId) };
      }
      return { ...prev, cardUpdates: { ...prev.cardUpdates, [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { is_active: nextIsActive }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Card ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setAllCards, setDialog, setPendingBatch]);

  const submitDeactivateCard = useCallback(() => {
    const row = dialog?.target;
    if (!row?.card_id) { toastError("Invalid card."); return; }
    const cardId = row.card_id;
    if (isTempCardId(cardId)) setAllCards((items) => items.filter((c) => !isSameId(c?.card_id, cardId)));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev, cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.tempId, cardId)), cardUpdates: removeObjectKey(prev.cardUpdates, cardId), cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)) };
      }
      return { ...prev, cardUpdates: removeObjectKey(prev.cardUpdates, cardId), cardDeactivations: appendUniqueId(prev.cardDeactivations, cardId) };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card deactivation staged for Save Batch.", "Batching");
  }, [dialog, setAllCards, setDialog, setPendingBatch]);

  const stageHardDeleteCard = useCallback((row) => {
    const cardId = String(row?.card_id ?? "");
    if (!cardId || isSaving || isMutatingAction) return;
    if (isTempCardId(cardId)) {
      setAllCards((prev) => prev.filter((c) => !isSameId(c?.card_id, cardId)));
      setPendingBatch((prev) => ({ ...prev, cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.tempId, cardId)), cardUpdates: removeObjectKey(prev.cardUpdates, cardId) }));
      toastSuccess("Staged card removed.", "Batching"); return;
    }
    setPendingBatch((prev) => ({
      ...prev, cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)),
      cardUpdates: removeObjectKey(prev.cardUpdates, cardId), cardHardDeletes: appendUniqueId(prev.cardHardDeletes || [], cardId),
    }));
    toastSuccess("Card deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSaving, setAllCards, setPendingBatch]);

  const unstageHardDeleteCard = useCallback((row) => {
    const cardId = String(row?.card_id ?? "");
    if (!cardId || isSaving || isMutatingAction) return;
    setPendingBatch((prev) => ({ ...prev, cardHardDeletes: (prev.cardHardDeletes || []).filter((id) => !isSameId(id, cardId)) }));
    toastSuccess("Card deletion un-staged.", "Batching");
  }, [isMutatingAction, isSaving, setPendingBatch]);

  return {
    openAddCardDialog, openEditCardDialog, openToggleCardDialog, openDeactivateCardDialog,
    submitAddCard, submitEditCard, submitToggleCard, submitDeactivateCard, stageHardDeleteCard, unstageHardDeleteCard,
  };
}

// ─── HOOK: useCardModuleSetup ──────────────────────────────

function useCardModuleSetup({ applications = [], cardGroups = [], cards = [], initialSelectedAppId = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safeApplications = useMemo(() => Array.isArray(applications) ? applications : [], [applications]);

  const seedCardGroups = useMemo(() =>
    (Array.isArray(cardGroups) ? cardGroups : []).map((g, i) => mapGroupRow(g, i))
      .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.group_name, b.group_name); }),
    [cardGroups]);

  const seedCards = useMemo(() =>
    (Array.isArray(cards) ? cards : []).map((c, i) => mapCardRow(c, i))
      .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.card_name, b.card_name); }),
    [cards]);

  const initialAppId = useMemo(() => {
    if (initialSelectedAppId != null && initialSelectedAppId !== "") return initialSelectedAppId;
    return safeApplications[0]?.app_id ?? null;
  }, [initialSelectedAppId, safeApplications]);

  function buildCardSigMap(groups, cardList) {
    const m = {};
    for (const g of groups) {
      const gid = String(g?.group_id ?? "");
      const gc = cardList.filter((c) => isSameId(c?.group_id, g?.group_id))
        .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.card_name, b.card_name); });
      m[gid] = buildOrderSignature(gc, "card_id");
    }
    return m;
  }

  const [orderedGroups, setOrderedGroups] = useState(seedCardGroups);
  const [allCards, setAllCards] = useState(seedCards);
  const [persistedGroupOrderSig, setPersistedGroupOrderSig] = useState(() =>
    buildOrderSignature(seedCardGroups.filter((g) => isSameId(g?.app_id, initialAppId)), "group_id"));
  const [persistedCardOrderSigs, setPersistedCardOrderSigs] = useState(() =>
    buildCardSigMap(seedCardGroups.filter((g) => isSameId(g?.app_id, initialAppId)), seedCards));
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [pendingBatch, setPendingBatch] = useState(createEmptyBatchState());
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [groupDraft, setGroupDraft] = useState({ name: "", desc: "", icon: "" });
  const [cardDraft, setCardDraft] = useState({ name: "", desc: "", route_path: "", icon: "" });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const batchActiveRef = useRef(false);

  useEffect(() => {
    if (batchActiveRef.current) return;
    setOrderedGroups(seedCardGroups); setAllCards(seedCards);
    const resetGroups = seedCardGroups.filter((g) => isSameId(g?.app_id, initialAppId));
    setPersistedGroupOrderSig(buildOrderSignature(resetGroups, "group_id"));
    setPersistedCardOrderSigs(buildCardSigMap(resetGroups, seedCards));
    setIsSaving(false); setIsMutatingAction(false);
    setPendingBatch(createEmptyBatchState()); setDialog(EMPTY_DIALOG);
    setGroupDraft({ name: "", desc: "", icon: "" }); setCardDraft({ name: "", desc: "", route_path: "", icon: "" });
    setEditingGroupId(null); setEditingCardId(null);
  }, [seedCardGroups, seedCards, initialAppId]);

  const selectedAppId = useMemo(() => {
    const fromQ = parseId(searchParams?.get("app"));
    if (fromQ !== null) return fromQ;
    if (initialSelectedAppId != null && initialSelectedAppId !== "") return initialSelectedAppId;
    return safeApplications[0]?.app_id ?? null;
  }, [initialSelectedAppId, safeApplications, searchParams]);

  const selectedApp = useMemo(
    () => safeApplications.find((a) => isSameId(a?.app_id, selectedAppId)) ?? safeApplications[0] ?? null,
    [safeApplications, selectedAppId]);

  const appGroups = useMemo(
    () => orderedGroups.filter((g) => isSameId(g?.app_id, selectedApp?.app_id)),
    [orderedGroups, selectedApp?.app_id]);

  const currentGroupOrderSig = useMemo(() => buildOrderSignature(appGroups, "group_id"), [appGroups]);
  const hasGroupOrderChanges = persistedGroupOrderSig !== currentGroupOrderSig;

  const selectedGroupId = useMemo(() => {
    const fromQ = parseId(searchParams?.get("group"));
    if (fromQ !== null && appGroups.find((g) => isSameId(g?.group_id, fromQ))) return fromQ;
    return appGroups[0]?.group_id ?? null;
  }, [appGroups, searchParams]);

  const selectedGroup = useMemo(
    () => appGroups.find((g) => isSameId(g?.group_id, selectedGroupId)) ?? appGroups[0] ?? null,
    [appGroups, selectedGroupId]);

  const selectedGroupCards = useMemo(
    () => allCards.filter((c) => isSameId(c?.group_id, selectedGroup?.group_id))
      .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.card_name, b.card_name); }),
    [allCards, selectedGroup?.group_id]);

  const hasCardOrderChanges = useMemo(() => {
    for (const g of appGroups) {
      const gid = String(g?.group_id ?? "");
      const gc = allCards.filter((c) => isSameId(c?.group_id, g?.group_id))
        .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.card_name, b.card_name); });
      if (buildOrderSignature(gc, "card_id") !== (persistedCardOrderSigs[gid] ?? "")) return true;
    }
    return false;
  }, [allCards, appGroups, persistedCardOrderSigs]);

  const pendingSummary = useMemo(() => {
    const gA = pendingBatch.groupCreates.length, gE = Object.keys(pendingBatch.groupUpdates || {}).length;
    const gD = pendingBatch.groupDeactivations.length, gH = (pendingBatch.groupHardDeletes || []).length;
    const cA = pendingBatch.cardCreates.length, cE = Object.keys(pendingBatch.cardUpdates || {}).length;
    const cD = pendingBatch.cardDeactivations.length, cH = (pendingBatch.cardHardDeletes || []).length;
    const oC = (hasGroupOrderChanges ? 1 : 0) + (hasCardOrderChanges ? 1 : 0);
    return { groupAdded: gA, groupEdited: gE, groupDeactivated: gD, groupHardDeleted: gH, cardAdded: cA, cardEdited: cE, cardDeactivated: cD, cardHardDeleted: cH, rowOrderChanged: oC, total: gA + gE + gD + gH + cA + cE + cD + cH + oC };
  }, [hasCardOrderChanges, hasGroupOrderChanges, pendingBatch]);

  const hasPendingChanges = pendingSummary.total > 0;
  useEffect(() => { batchActiveRef.current = hasPendingChanges; }, [hasPendingChanges]);

  const pendingDeactivatedGroupIds = useMemo(() => new Set((pendingBatch.groupDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.groupDeactivations]);
  const pendingDeactivatedCardIds = useMemo(() => new Set((pendingBatch.cardDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.cardDeactivations]);
  const pendingHardDeletedGroupIds = useMemo(() => new Set((pendingBatch.groupHardDeletes || []).map((id) => String(id ?? ""))), [pendingBatch.groupHardDeletes]);
  const pendingHardDeletedCardIds = useMemo(() => new Set((pendingBatch.cardHardDeletes || []).map((id) => String(id ?? ""))), [pendingBatch.cardHardDeletes]);
  const isSelectedGroupPendingDeactivation = useMemo(() => pendingDeactivatedGroupIds.has(String(selectedGroup?.group_id ?? "")), [pendingDeactivatedGroupIds, selectedGroup?.group_id]);

  const decoratedGroups = useMemo(() => {
    const cIds = new Set((pendingBatch.groupCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.groupUpdates || {}));
    const dIds = new Set((pendingBatch.groupDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.groupHardDeletes || []).map((e) => String(e ?? "")));
    return appGroups.map((row) => {
      const id = String(row?.group_id ?? "");
      const oc = row.__originalOrder != null && Number(row.display_order) !== Number(row.__originalOrder);
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted", __previousOrder: oc ? row.__originalOrder : null };
      if (dIds.has(id)) return { ...row, __batchState: "deleted", __previousOrder: oc ? row.__originalOrder : null };
      if (cIds.has(id)) return { ...row, __batchState: "created", __previousOrder: null };
      if (uIds.has(id)) return { ...row, __batchState: "updated", __previousOrder: oc ? row.__originalOrder : null };
      if (oc) return { ...row, __batchState: "reordered", __previousOrder: row.__originalOrder };
      return { ...row, __batchState: "none", __previousOrder: null };
    });
  }, [appGroups, pendingBatch.groupCreates, pendingBatch.groupDeactivations, pendingBatch.groupHardDeletes, pendingBatch.groupUpdates]);

  const decoratedSelectedGroupCards = useMemo(() => {
    const cIds = new Set((pendingBatch.cardCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.cardUpdates || {}));
    const dIds = new Set((pendingBatch.cardDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.cardHardDeletes || []).map((e) => String(e ?? "")));
    return selectedGroupCards.map((row) => {
      const id = String(row?.card_id ?? "");
      const oc = row.__originalOrder != null && Number(row.display_order) !== Number(row.__originalOrder);
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted", __previousOrder: oc ? row.__originalOrder : null };
      if (dIds.has(id)) return { ...row, __batchState: "deleted", __previousOrder: oc ? row.__originalOrder : null };
      if (cIds.has(id)) return { ...row, __batchState: "created", __previousOrder: null };
      if (uIds.has(id)) return { ...row, __batchState: "updated", __previousOrder: oc ? row.__originalOrder : null };
      if (oc) return { ...row, __batchState: "reordered", __previousOrder: row.__originalOrder };
      return { ...row, __batchState: "none", __previousOrder: null };
    });
  }, [pendingBatch.cardCreates, pendingBatch.cardDeactivations, pendingBatch.cardHardDeletes, pendingBatch.cardUpdates, selectedGroupCards]);

  const updateQueryParams = useCallback((updates) => {
    const p = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(updates).forEach(([k, v]) => { if (v == null || v === "") p.delete(k); else p.set(k, String(v)); });
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleApplicationChange = useCallback((event) => {
    const appId = parseId(event.target.value);
    const nextGroups = orderedGroups.filter((g) => isSameId(g?.app_id, appId));
    setPersistedGroupOrderSig(buildOrderSignature(nextGroups, "group_id"));
    setPersistedCardOrderSigs(buildCardSigMap(nextGroups, allCards));
    updateQueryParams({ app: appId, group: null });
  }, [allCards, orderedGroups, updateQueryParams]);

  const handleGroupRowClick = useCallback((row) => updateQueryParams({ group: row?.group_id }), [updateQueryParams]);

  const handleGroupReorder = useCallback((next) => {
    if (isSaving || isMutatingAction) return;
    const normalized = (Array.isArray(next) ? next : []).map((r, i) => ({ ...r, display_order: i + 1 }));
    setOrderedGroups((prev) => {
      const other = prev.filter((g) => !isSameId(g?.app_id, selectedApp?.app_id));
      return [...other, ...normalized];
    });
  }, [isMutatingAction, isSaving, selectedApp?.app_id]);

  const handleCardReorder = useCallback((next) => {
    if (isSaving || isMutatingAction) return;
    const normalized = (Array.isArray(next) ? next : []).map((r, i) => ({ ...r, display_order: i + 1 }));
    setAllCards((prev) => {
      const other = prev.filter((c) => !isSameId(c?.group_id, selectedGroup?.group_id));
      return [...other, ...normalized];
    });
  }, [isMutatingAction, isSaving, selectedGroup?.group_id]);

  const handleCancelBatch = useCallback(() => {
    if (isSaving || isMutatingAction) return;
    batchActiveRef.current = false;
    setOrderedGroups(seedCardGroups); setAllCards(seedCards); setPendingBatch(createEmptyBatchState());
    const cancelGroups = seedCardGroups.filter((g) => isSameId(g?.app_id, selectedApp?.app_id));
    setPersistedGroupOrderSig(buildOrderSignature(cancelGroups, "group_id"));
    setPersistedCardOrderSigs(buildCardSigMap(cancelGroups, seedCards));
    setDialog(EMPTY_DIALOG); setGroupDraft({ name: "", desc: "", icon: "" }); setCardDraft({ name: "", desc: "", route_path: "", icon: "" });
    setEditingGroupId(null); setEditingCardId(null);
    updateQueryParams({ group: cancelGroups[0]?.group_id ?? null });
  }, [isMutatingAction, isSaving, seedCardGroups, seedCards, selectedApp?.app_id, updateQueryParams]);

  const handleSaveBatch = useCallback(async () => {
    if (!hasPendingChanges || isSaving || isMutatingAction) return;
    setIsSaving(true); setIsMutatingAction(true);
    try {
      const { groupIdMap, deactivatedGroupSet, orderedPersistedGroupIds } =
        await executeBatchSave(pendingBatch, appGroups, allCards, persistedCardOrderSigs);
      setPersistedGroupOrderSig(currentGroupOrderSig);
      const nextSigMap = {};
      for (const g of appGroups) {
        const gid = String(g?.group_id ?? "");
        const gc = allCards.filter((c) => isSameId(c?.group_id, g?.group_id))
          .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.card_name, b.card_name); });
        nextSigMap[gid] = buildOrderSignature(gc, "card_id");
      }
      setPersistedCardOrderSigs(nextSigMap); setPendingBatch(createEmptyBatchState());
      batchActiveRef.current = false;
      const selKey = String(selectedGroup?.group_id ?? "");
      const selResolved = groupIdMap.get(selKey) ?? selectedGroup?.group_id ?? null;
      const nextSelGid = selResolved && !deactivatedGroupSet.has(String(selResolved)) ? selResolved : (orderedPersistedGroupIds[0] ?? null);
      updateQueryParams({ group: nextSelGid });
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally { setIsMutatingAction(false); setIsSaving(false); setEditingGroupId(null); setEditingCardId(null); }
  }, [allCards, appGroups, currentGroupOrderSig, hasPendingChanges, isMutatingAction, isSaving,
    pendingBatch, pendingSummary.total, persistedCardOrderSigs, router, selectedGroup?.group_id, updateQueryParams]);

  const closeDialog = useCallback(() => { if (!isMutatingAction) setDialog(EMPTY_DIALOG); }, [isMutatingAction]);

  const groupActions = useGroupActions({
    isSaving, isMutatingAction, selectedApp, appGroups, allCards, orderedGroups,
    selectedGroup, dialog, groupDraft, pendingDeactivatedGroupIds,
    setOrderedGroups, setAllCards, setPendingBatch, setDialog, setGroupDraft, updateQueryParams,
  });

  const cardActions = useCardActions({
    isSaving, isMutatingAction, isSelectedGroupPendingDeactivation,
    selectedGroup, selectedApp, selectedGroupCards, pendingDeactivatedCardIds,
    dialog, cardDraft, setAllCards, setPendingBatch, setDialog, setCardDraft,
  });

  const startEditingGroup = useCallback((row) => { if (isSaving || isMutatingAction) return; const id = String(row?.group_id ?? ""); setEditingGroupId((prev) => prev === id ? null : id); }, [isMutatingAction, isSaving]);
  const stopEditingGroup = useCallback(() => { setEditingGroupId(null); }, []);
  const startEditingCard = useCallback((row) => { if (isSaving || isMutatingAction) return; const id = String(row?.card_id ?? ""); setEditingCardId((prev) => prev === id ? null : id); }, [isMutatingAction, isSaving]);
  const stopEditingCard = useCallback(() => { setEditingCardId(null); }, []);

  const handleInlineEditGroup = useCallback((row, key, value) => {
    const groupId = row?.group_id;
    if (!groupId || isSaving || isMutatingAction) return;
    setOrderedGroups((prev) => prev.map((g, i) => isSameId(g?.group_id, groupId) ? mapGroupRow({ ...g, [key]: value || null }, i) : g));
    setPendingBatch((prev) => {
      if (isTempGroupId(groupId)) return { ...prev, groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId) ? { ...e, payload: { ...e.payload, [key]: value || null } } : e) };
      return { ...prev, groupUpdates: { ...prev.groupUpdates, [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { [key]: value || null }) } };
    });
  }, [isMutatingAction, isSaving]);

  const handleInlineEditCard = useCallback((row, key, value) => {
    const cardId = row?.card_id;
    if (!cardId || isSaving || isMutatingAction) return;
    setAllCards((prev) => prev.map((c, i) => isSameId(c?.card_id, cardId) ? mapCardRow({ ...c, [key]: value || null }, i) : c));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) return { ...prev, cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId) ? { ...e, payload: { ...e.payload, [key]: value || null } } : e) };
      return { ...prev, cardUpdates: { ...prev.cardUpdates, [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { [key]: value || null }) } };
    });
  }, [isMutatingAction, isSaving]);

  return {
    safeApplications, decoratedGroups, decoratedSelectedGroupCards,
    dialog, groupDraft, cardDraft, isSaving, isMutatingAction,
    pendingSummary, hasPendingChanges,
    pendingDeactivatedGroupIds, pendingDeactivatedCardIds,
    pendingHardDeletedGroupIds, pendingHardDeletedCardIds,
    selectedApp, selectedGroup, isSelectedGroupPendingDeactivation,
    setDialog, setGroupDraft, setCardDraft,
    handleApplicationChange, handleGroupRowClick,
    handleGroupReorder, handleCardReorder, handleCancelBatch, handleSaveBatch,
    closeDialog, handleInlineEditGroup, handleInlineEditCard,
    editingGroupId, startEditingGroup, stopEditingGroup,
    editingCardId, startEditingCard, stopEditingCard,
    ...groupActions, ...cardActions,
  };
}

// ─── SUB-COMPONENTS ────────────────────────────────────────

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(bs) {
  const map = {
    hardDeleted: { t: "Deleted", c: "psb-batch-marker psb-batch-marker-deleted" },
    deleted: { t: "Deactivated", c: "psb-batch-marker psb-batch-marker-deleted" },
    created: { t: "New", c: "psb-batch-marker psb-batch-marker-new" },
    updated: { t: "Edited", c: "psb-batch-marker psb-batch-marker-edited" },
    reordered: { t: "Reordered", c: "psb-batch-marker psb-batch-marker-reordered" },
  };
  return map[bs] || { t: "", c: "" };
}

function CardModuleHeader({ safeApplications, selectedApp, hasPendingChanges, pendingSummary, isSaving, isMutatingAction, isSelectedGroupPendingDeactivation, selectedGroup, handleSaveBatch, handleCancelBatch, handleApplicationChange, openAddGroupDialog, openAddCardDialog }) {
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Card Module Setup</h1>
          <p className="text-muted mb-0">Manage card groups and cards for each application.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span className={`small ${hasPendingChanges ? "text-warning-emphasis fw-semibold" : "text-muted"}`}>
            {isMutatingAction || isSaving ? "Saving batch..." : hasPendingChanges ? `${pendingSummary.total} staged change(s)` : "No changes"}
          </span>
          {hasPendingChanges ? (
            <>
              {pendingSummary.groupAdded + pendingSummary.cardAdded > 0 ? <span className="psb-batch-chip psb-batch-chip-added">+{pendingSummary.groupAdded + pendingSummary.cardAdded} Added</span> : null}
              {pendingSummary.groupEdited + pendingSummary.cardEdited > 0 ? <span className="psb-batch-chip psb-batch-chip-edited">~{pendingSummary.groupEdited + pendingSummary.cardEdited} Edited</span> : null}
              {pendingSummary.groupDeactivated + pendingSummary.cardDeactivated > 0 ? <span className="psb-batch-chip psb-batch-chip-deleted">-{pendingSummary.groupDeactivated + pendingSummary.cardDeactivated} Deactivated</span> : null}
              {pendingSummary.rowOrderChanged > 0 ? <span className="psb-batch-chip psb-batch-chip-order">Reordered</span> : null}
            </>
          ) : null}
          <Button type="button" size="sm" variant="secondary" loading={isSaving} disabled={!hasPendingChanges || isSaving || isMutatingAction} onClick={handleSaveBatch}>Save Batch</Button>
          <Button type="button" size="sm" variant="ghost" disabled={!hasPendingChanges || isSaving || isMutatingAction} onClick={handleCancelBatch}>Cancel Batch</Button>
          <Button type="button" size="sm" variant="primary" disabled={isSaving || isMutatingAction || !selectedApp?.app_id} onClick={openAddGroupDialog}>Add Group</Button>
          <Button type="button" size="sm" variant="primary" disabled={isSaving || isMutatingAction || !selectedGroup?.group_id || isSelectedGroupPendingDeactivation} onClick={openAddCardDialog}>Add Card</Button>
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label mb-1 fw-semibold small">Application</label>
        <select className="form-select form-select-sm" style={{ maxWidth: 340 }} value={String(selectedApp?.app_id ?? "")} onChange={handleApplicationChange} disabled={isSaving || isMutatingAction}>
          {safeApplications.length === 0 ? <option value="">No applications available</option> : null}
          {safeApplications.map((app) => (
            <option key={app.app_id} value={String(app.app_id)}>{app.app_name || app.name || `App ${app.app_id}`}</option>
          ))}
        </select>
      </div>
    </>
  );
}

function GroupTable({ decoratedGroups, selectedGroup, isSaving, isMutatingAction, pendingDeactivatedGroupIds, handleGroupRowClick, handleGroupReorder, editingGroupId, onStartEditing, onStopEditing, onInlineEdit, openToggleGroupDialog, openDeactivateGroupDialog, stageHardDeleteGroup, onUndoBatchAction }) {
  const columns = useMemo(() => [
    { key: "display_order", label: "Order", width: "10%", sortable: true, align: "center", render: (row) => {
      const prev = row?.__previousOrder;
      return (<span>{row?.display_order ?? "--"}{prev != null ? <> <span className="psb-batch-marker psb-batch-marker-edited">was {prev}</span></> : null}</span>);
    }},
    { key: "group_name", label: "Group Name", width: "35%", sortable: true, render: (row) => {
      const m = batchMarker(row?.__batchState || ""); const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction; const isSelected = isSameId(row?.group_id, selectedGroup?.group_id);
      return (<span className={isSelected ? "fw-semibold text-primary" : ""}><InlineEditCell value={row?.group_name || ""} onCommit={(val) => onInlineEdit?.(row, "group_name", val)} onCancel={onStopEditing} disabled={editDisabled} />{m.t ? <span className={m.c}>{m.t}</span> : null}</span>);
    }},
    { key: "group_desc", label: "Description", width: "28%", sortable: true, render: (row) => {
      const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return <InlineEditCell value={row?.group_desc || ""} onCommit={(val) => onInlineEdit?.(row, "group_desc", val)} onCancel={onStopEditing} disabled={editDisabled} />;
    }},
    { key: "group_icon", label: "Icon", width: "12%", sortable: false, align: "center", defaultVisible: false, render: (row) => {
      const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return <InlineEditCell value={row?.group_icon || row?.icon || ""} onCommit={(val) => onInlineEdit?.(row, "icon", val)} onCancel={onStopEditing} disabled={editDisabled} placeholder="bi-collection" />;
    }},
    { key: "is_active_bool", label: "Active", width: "10%", sortable: true, align: "center", render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} /> },
  ], [editingGroupId, isMutatingAction, isSaving, onInlineEdit, onStopEditing, selectedGroup?.group_id]);

  const actions = useMemo(() => [
    { key: "edit-group", label: "Edit", type: "secondary", icon: "pen", visible: (r) => String(r?.group_id ?? "") !== String(editingGroupId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-group", label: "Cancel", type: "secondary", icon: "xmark", visible: (r) => String(r?.group_id ?? "") === String(editingGroupId ?? ""), onClick: () => onStopEditing() },
    { key: "restore-group", label: "Restore", type: "secondary", icon: "rotate-left", visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedGroupIds.has(String(r?.group_id ?? ""))) && String(r?.group_id ?? "") !== String(editingGroupId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => openToggleGroupDialog(r) },
    { key: "deactivate-group", label: "Deactivate", type: "secondary", icon: "ban", visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")) && String(r?.group_id ?? "") !== String(editingGroupId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => openDeactivateGroupDialog(r) },
    { key: "delete-group", label: "Delete", type: "danger", icon: "trash", visible: (r) => String(r?.group_id ?? "") !== String(editingGroupId ?? ""), confirm: true, confirmMessage: (r) => `Permanently delete ${r?.group_name || "this group"}? This action cannot be undone.`, disabled: () => isSaving || isMutatingAction, onClick: (r) => stageHardDeleteGroup(r) },
  ], [editingGroupId, isMutatingAction, isSaving, onStartEditing, onStopEditing, openDeactivateGroupDialog, openToggleGroupDialog, pendingDeactivatedGroupIds, stageHardDeleteGroup]);

  return (
    <Card title="Card Groups" subtitle="Drag the grip icon in Actions to reorder groups.">
      <TableZ columns={columns} data={decoratedGroups} rowIdKey="group_id" selectedRowId={selectedGroup?.group_id ?? null} onRowClick={handleGroupRowClick} actions={actions} draggable={!isSaving && !isMutatingAction} onReorder={handleGroupReorder} emptyMessage="No card groups found for this application." onUndoBatchAction={onUndoBatchAction} />
    </Card>
  );
}

function CardPanel({ selectedGroup, decoratedSelectedGroupCards, isSaving, isMutatingAction, pendingDeactivatedCardIds, handleCardReorder, editingCardId, onStartEditing, onStopEditing, onInlineEdit, openToggleCardDialog, openDeactivateCardDialog, stageHardDeleteCard, onUndoBatchAction }) {
  const columns = useMemo(() => [
    { key: "display_order", label: "Order", width: "8%", sortable: true, align: "center", render: (row) => {
      const prev = row?.__previousOrder;
      return (<span>{row?.display_order ?? "--"}{prev != null ? <> <span className="psb-batch-marker psb-batch-marker-edited">was {prev}</span></> : null}</span>);
    }},
    { key: "card_name", label: "Card Name", width: "25%", sortable: true, render: (row) => {
      const m = batchMarker(row?.__batchState || ""); const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return (<span><InlineEditCell value={row?.card_name || ""} onCommit={(val) => onInlineEdit?.(row, "card_name", val)} onCancel={onStopEditing} disabled={editDisabled} />{m.t ? <span className={m.c}>{m.t}</span> : null}</span>);
    }},
    { key: "card_desc", label: "Description", width: "20%", sortable: true, defaultVisible: false, render: (row) => {
      const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return <InlineEditCell value={row?.card_desc || ""} onCommit={(val) => onInlineEdit?.(row, "card_desc", val)} onCancel={onStopEditing} disabled={editDisabled} />;
    }},
    { key: "route_path", label: "Route", width: "25%", sortable: true, render: (row) => {
      const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return <InlineEditCell value={row?.route_path || ""} onCommit={(val) => onInlineEdit?.(row, "route_path", val)} onCancel={onStopEditing} disabled={editDisabled} placeholder="#" />;
    }},
    { key: "card_icon", label: "Icon", width: "10%", sortable: false, align: "center", defaultVisible: false, render: (row) => {
      const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? ""); const editDisabled = !isEditing || isSaving || isMutatingAction;
      return <InlineEditCell value={row?.card_icon || row?.icon || ""} onCommit={(val) => onInlineEdit?.(row, "icon", val)} onCancel={onStopEditing} disabled={editDisabled} placeholder="bi-grid-3x3-gap" />;
    }},
    { key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center", render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} /> },
  ], [editingCardId, isMutatingAction, isSaving, onInlineEdit, onStopEditing]);

  const actions = useMemo(() => [
    { key: "edit-card", label: "Edit", type: "secondary", icon: "pen", visible: (r) => String(r?.card_id ?? "") !== String(editingCardId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-card", label: "Cancel", type: "secondary", icon: "xmark", visible: (r) => String(r?.card_id ?? "") === String(editingCardId ?? ""), onClick: () => onStopEditing() },
    { key: "restore-card", label: "Restore", type: "secondary", icon: "rotate-left", visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedCardIds.has(String(r?.card_id ?? ""))) && String(r?.card_id ?? "") !== String(editingCardId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => openToggleCardDialog(r) },
    { key: "deactivate-card", label: "Deactivate", type: "secondary", icon: "ban", visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedCardIds.has(String(r?.card_id ?? "")) && String(r?.card_id ?? "") !== String(editingCardId ?? ""), disabled: () => isSaving || isMutatingAction, onClick: (r) => openDeactivateCardDialog(r) },
    { key: "delete-card", label: "Delete", type: "danger", icon: "trash", visible: (r) => String(r?.card_id ?? "") !== String(editingCardId ?? ""), confirm: true, confirmMessage: (r) => `Permanently delete ${r?.card_name || "this card"}? This action cannot be undone.`, disabled: () => isSaving || isMutatingAction, onClick: (r) => stageHardDeleteCard(r) },
  ], [editingCardId, isMutatingAction, isSaving, onStartEditing, onStopEditing, openDeactivateCardDialog, openToggleCardDialog, pendingDeactivatedCardIds, stageHardDeleteCard]);

  return (
    <Card title={selectedGroup ? `Cards for: ${selectedGroup.group_name}` : "Cards"} subtitle={selectedGroup ? "Drag rows to reorder cards within the group" : "Click a card group row to view its cards."}>
      {selectedGroup ? (
        <TableZ columns={columns} data={decoratedSelectedGroupCards} rowIdKey="card_id" actions={actions} emptyMessage="No cards assigned to this group." draggable={!isSaving && !isMutatingAction} onReorder={handleCardReorder} onUndoBatchAction={onUndoBatchAction} />
      ) : (
        <div className="notice-banner notice-banner-info mb-0">Click a card group row to view its cards.</div>
      )}
    </Card>
  );
}

function CardModuleDialog({ dialog, groupDraft, cardDraft, isMutatingAction, setGroupDraft, setCardDraft, closeDialog, submitAddGroup, submitEditGroup, submitToggleGroup, submitDeactivateGroup, submitAddCard, submitEditCard, submitToggleCard, submitDeactivateCard }) {
  const kind = dialog?.kind;
  const dialogTitle = useMemo(() => {
    const titles = { "add-group": "Add Card Group", "edit-group": "Edit Card Group", "toggle-group": `${dialog?.nextIsActive ? "Enable" : "Disable"} Card Group`, "deactivate-group": "Deactivate Card Group", "add-card": "Add Card", "edit-card": "Edit Card", "toggle-card": `${dialog?.nextIsActive ? "Enable" : "Disable"} Card`, "deactivate-card": "Deactivate Card" };
    return titles[kind] || "";
  }, [kind, dialog?.nextIsActive]);

  if (!kind) return null;
  const isBusy = isMutatingAction;
  const submitMap = { "add-group": submitAddGroup, "edit-group": submitEditGroup, "toggle-group": submitToggleGroup, "deactivate-group": submitDeactivateGroup, "add-card": submitAddCard, "edit-card": submitEditCard, "toggle-card": submitToggleCard, "deactivate-card": submitDeactivateCard };
  const fc = { "add-group": { label: "Add Group", variant: "primary" }, "edit-group": { label: "Save", variant: "primary" }, "add-card": { label: "Add Card", variant: "primary" }, "edit-card": { label: "Save", variant: "primary" }, "toggle-group": { label: dialog?.nextIsActive ? "Enable" : "Disable", variant: "secondary" }, "toggle-card": { label: dialog?.nextIsActive ? "Enable" : "Disable", variant: "secondary" }, "deactivate-group": { label: "Deactivate Group", variant: "danger" }, "deactivate-card": { label: "Deactivate Card", variant: "danger" } }[kind] || { label: "OK", variant: "primary" };
  const footer = (<><Button type="button" variant="ghost" onClick={closeDialog} disabled={isBusy}>Cancel</Button><Button type="button" variant={fc.variant} onClick={submitMap[kind]} loading={isBusy}>{fc.label}</Button></>);
  const isGroupForm = kind === "add-group" || kind === "edit-group";
  const isCardForm = kind === "add-card" || kind === "edit-card";

  return (
    <Modal show onHide={closeDialog} title={dialogTitle} footer={footer}>
      {isGroupForm ? (
        <div className="d-flex flex-column gap-3">
          <div><label className="form-label mb-1">Group Name</label><Input value={groupDraft.name} onChange={(e) => setGroupDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Enter group name" autoFocus /></div>
          <div><label className="form-label mb-1">Description</label><Input as="textarea" rows={3} value={groupDraft.desc} onChange={(e) => setGroupDraft((p) => ({ ...p, desc: e.target.value }))} placeholder="Enter group description" /></div>
          <div><label className="form-label mb-1">Icon</label><Input value={groupDraft.icon} onChange={(e) => setGroupDraft((p) => ({ ...p, icon: e.target.value }))} placeholder="e.g. bi-collection" /></div>
        </div>
      ) : null}
      {isCardForm ? (
        <div className="d-flex flex-column gap-3">
          {kind === "add-card" ? <div className="small text-muted">Creating card for <strong>{dialog?.target?.group_name || "selected group"}</strong></div> : null}
          <div><label className="form-label mb-1">Card Name</label><Input value={cardDraft.name} onChange={(e) => setCardDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Enter card name" autoFocus /></div>
          <div><label className="form-label mb-1">Description</label><Input as="textarea" rows={3} value={cardDraft.desc} onChange={(e) => setCardDraft((p) => ({ ...p, desc: e.target.value }))} placeholder="Enter card description" /></div>
          <div><label className="form-label mb-1">Route Path</label><Input value={cardDraft.route_path} onChange={(e) => setCardDraft((p) => ({ ...p, route_path: e.target.value }))} placeholder="e.g. /my-module" /></div>
          <div><label className="form-label mb-1">Icon</label><Input value={cardDraft.icon} onChange={(e) => setCardDraft((p) => ({ ...p, icon: e.target.value }))} placeholder="e.g. bi-grid-3x3-gap" /></div>
        </div>
      ) : null}
      {kind === "toggle-group" ? <p className="mb-0">{dialog?.nextIsActive ? "Enable" : "Disable"} card group <strong>{dialog?.target?.group_name || ""}</strong>?</p> : null}
      {kind === "toggle-card" ? <p className="mb-0">{dialog?.nextIsActive ? "Enable" : "Disable"} card <strong>{dialog?.target?.card_name || ""}</strong>?</p> : null}
      {kind === "deactivate-group" ? <p className="mb-0 text-danger">Deactivate card group <strong>{dialog?.target?.group_name || ""}</strong> and all associated cards?</p> : null}
      {kind === "deactivate-card" ? <p className="mb-0 text-danger">Deactivate card <strong>{dialog?.target?.card_name || ""}</strong>?</p> : null}
    </Modal>
  );
}

// ─── MAIN VIEW (default export) ────────────────────────────

export default function CardModuleSetupView({ applications, cardGroups, cards, initialSelectedAppId }) {
  const h = useCardModuleSetup({ applications, cardGroups, cards, initialSelectedAppId });

  return (
    <main className="container py-4">
      <CardModuleHeader
        safeApplications={h.safeApplications} selectedApp={h.selectedApp}
        hasPendingChanges={h.hasPendingChanges} pendingSummary={h.pendingSummary}
        isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
        isSelectedGroupPendingDeactivation={h.isSelectedGroupPendingDeactivation}
        selectedGroup={h.selectedGroup}
        handleSaveBatch={h.handleSaveBatch} handleCancelBatch={h.handleCancelBatch}
        handleApplicationChange={h.handleApplicationChange}
        openAddGroupDialog={h.openAddGroupDialog} openAddCardDialog={h.openAddCardDialog}
      />
      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-5">
          <GroupTable
            decoratedGroups={h.decoratedGroups} selectedGroup={h.selectedGroup}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedGroupIds={h.pendingDeactivatedGroupIds}
            handleGroupRowClick={h.handleGroupRowClick} handleGroupReorder={h.handleGroupReorder}
            editingGroupId={h.editingGroupId} onStartEditing={h.startEditingGroup} onStopEditing={h.stopEditingGroup}
            onInlineEdit={h.handleInlineEditGroup}
            openToggleGroupDialog={h.openToggleGroupDialog} openDeactivateGroupDialog={h.openDeactivateGroupDialog}
            stageHardDeleteGroup={h.stageHardDeleteGroup} onUndoBatchAction={h.unstageHardDeleteGroup}
          />
        </div>
        <div className="col-12 col-xl-7">
          <CardPanel
            selectedGroup={h.selectedGroup} decoratedSelectedGroupCards={h.decoratedSelectedGroupCards}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedCardIds={h.pendingDeactivatedCardIds}
            handleCardReorder={h.handleCardReorder}
            editingCardId={h.editingCardId} onStartEditing={h.startEditingCard} onStopEditing={h.stopEditingCard}
            onInlineEdit={h.handleInlineEditCard}
            openToggleCardDialog={h.openToggleCardDialog} openDeactivateCardDialog={h.openDeactivateCardDialog}
            stageHardDeleteCard={h.stageHardDeleteCard} onUndoBatchAction={h.unstageHardDeleteCard}
          />
        </div>
      </div>
      <CardModuleDialog
        dialog={h.dialog} groupDraft={h.groupDraft} cardDraft={h.cardDraft}
        isMutatingAction={h.isMutatingAction}
        setGroupDraft={h.setGroupDraft} setCardDraft={h.setCardDraft} closeDialog={h.closeDialog}
        submitAddGroup={h.submitAddGroup} submitEditGroup={h.submitEditGroup}
        submitToggleGroup={h.submitToggleGroup} submitDeactivateGroup={h.submitDeactivateGroup}
        submitAddCard={h.submitAddCard} submitEditCard={h.submitEditCard}
        submitToggleCard={h.submitToggleCard} submitDeactivateCard={h.submitDeactivateCard}
      />
    </main>
  );
}
