"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  parseId, isSameId, compareText, buildOrderSignature,
  mapGroupRow, mapCardRow, mergeUpdatePatch,
  EMPTY_DIALOG, createEmptyBatchState, executeBatchSave,
  isTempGroupId, isTempCardId,
} from "../utils/cardModuleHelpers";
import { useGroupActions } from "./useGroupActions";
import { useCardActions } from "./useCardActions";

export function useCardModuleSetup({ applications = [], cardGroups = [], cards = [], initialSelectedAppId = null }) {
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

  useEffect(() => {
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
    const gD = pendingBatch.groupDeactivations.length, cA = pendingBatch.cardCreates.length;
    const cE = Object.keys(pendingBatch.cardUpdates || {}).length, cD = pendingBatch.cardDeactivations.length;
    const oC = (hasGroupOrderChanges ? 1 : 0) + (hasCardOrderChanges ? 1 : 0);
    return { groupAdded: gA, groupEdited: gE, groupDeactivated: gD, cardAdded: cA, cardEdited: cE, cardDeactivated: cD, rowOrderChanged: oC, total: gA + gE + gD + cA + cE + cD + oC };
  }, [hasCardOrderChanges, hasGroupOrderChanges, pendingBatch]);

  const hasPendingChanges = pendingSummary.total > 0;
  const pendingDeactivatedGroupIds = useMemo(() => new Set((pendingBatch.groupDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.groupDeactivations]);
  const pendingDeactivatedCardIds = useMemo(() => new Set((pendingBatch.cardDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.cardDeactivations]);
  const isSelectedGroupPendingDeactivation = useMemo(() => pendingDeactivatedGroupIds.has(String(selectedGroup?.group_id ?? "")), [pendingDeactivatedGroupIds, selectedGroup?.group_id]);

  const decoratedGroups = useMemo(() => {
    const cIds = new Set((pendingBatch.groupCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.groupUpdates || {}));
    const dIds = new Set((pendingBatch.groupDeactivations || []).map((e) => String(e ?? "")));
    return appGroups.map((row) => {
      const id = String(row?.group_id ?? "");
      const oc = row.__originalOrder != null && Number(row.display_order) !== Number(row.__originalOrder);
      if (dIds.has(id)) return { ...row, __batchState: "deleted", __previousOrder: oc ? row.__originalOrder : null };
      if (cIds.has(id)) return { ...row, __batchState: "created", __previousOrder: null };
      if (uIds.has(id)) return { ...row, __batchState: "updated", __previousOrder: oc ? row.__originalOrder : null };
      if (oc) return { ...row, __batchState: "reordered", __previousOrder: row.__originalOrder };
      return { ...row, __batchState: "none", __previousOrder: null };
    });
  }, [appGroups, pendingBatch.groupCreates, pendingBatch.groupDeactivations, pendingBatch.groupUpdates]);

  const decoratedSelectedGroupCards = useMemo(() => {
    const cIds = new Set((pendingBatch.cardCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.cardUpdates || {}));
    const dIds = new Set((pendingBatch.cardDeactivations || []).map((e) => String(e ?? "")));
    return selectedGroupCards.map((row) => {
      const id = String(row?.card_id ?? "");
      const oc = row.__originalOrder != null && Number(row.display_order) !== Number(row.__originalOrder);
      if (dIds.has(id)) return { ...row, __batchState: "deleted", __previousOrder: oc ? row.__originalOrder : null };
      if (cIds.has(id)) return { ...row, __batchState: "created", __previousOrder: null };
      if (uIds.has(id)) return { ...row, __batchState: "updated", __previousOrder: oc ? row.__originalOrder : null };
      if (oc) return { ...row, __batchState: "reordered", __previousOrder: row.__originalOrder };
      return { ...row, __batchState: "none", __previousOrder: null };
    });
  }, [pendingBatch.cardCreates, pendingBatch.cardDeactivations, pendingBatch.cardUpdates, selectedGroupCards]);

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
    selectedGroup, dialog, groupDraft,
    setOrderedGroups, setAllCards, setPendingBatch, setDialog, setGroupDraft, updateQueryParams,
  });

  const cardActions = useCardActions({
    isSaving, isMutatingAction, isSelectedGroupPendingDeactivation,
    selectedGroup, selectedApp, selectedGroupCards,
    dialog, cardDraft, setAllCards, setPendingBatch, setDialog, setCardDraft,
  });

  // -- row editing mode
  const startEditingGroup = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    const id = String(row?.group_id ?? "");
    setEditingGroupId((prev) => prev === id ? null : id);
  }, [isMutatingAction, isSaving]);

  const stopEditingGroup = useCallback(() => { setEditingGroupId(null); }, []);

  const startEditingCard = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    const id = String(row?.card_id ?? "");
    setEditingCardId((prev) => prev === id ? null : id);
  }, [isMutatingAction, isSaving]);

  const stopEditingCard = useCallback(() => { setEditingCardId(null); }, []);

  // -- inline edit: groups
  const handleInlineEditGroup = useCallback((row, key, value) => {
    const groupId = row?.group_id;
    if (!groupId || isSaving || isMutatingAction) return;
    if (pendingDeactivatedGroupIds.has(String(groupId))) return;

    setOrderedGroups((prev) =>
      prev.map((g, i) => isSameId(g?.group_id, groupId)
        ? mapGroupRow({ ...g, [key]: value || null }, i) : g),
    );

    setPendingBatch((prev) => {
      if (isTempGroupId(groupId)) {
        return {
          ...prev,
          groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId)
            ? { ...e, payload: { ...e.payload, [key]: value || null } } : e),
        };
      }
      return {
        ...prev,
        groupUpdates: {
          ...prev.groupUpdates,
          [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { [key]: value || null }),
        },
      };
    });
  }, [isMutatingAction, isSaving, pendingDeactivatedGroupIds]);

  // -- inline edit: cards
  const handleInlineEditCard = useCallback((row, key, value) => {
    const cardId = row?.card_id;
    if (!cardId || isSaving || isMutatingAction) return;
    if (pendingDeactivatedCardIds.has(String(cardId))) return;

    setAllCards((prev) =>
      prev.map((c, i) => isSameId(c?.card_id, cardId)
        ? mapCardRow({ ...c, [key]: value || null }, i) : c),
    );

    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return {
          ...prev,
          cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId)
            ? { ...e, payload: { ...e.payload, [key]: value || null } } : e),
        };
      }
      return {
        ...prev,
        cardUpdates: {
          ...prev.cardUpdates,
          [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { [key]: value || null }),
        },
      };
    });
  }, [isMutatingAction, isSaving, pendingDeactivatedCardIds]);

  return {
    safeApplications, decoratedGroups, decoratedSelectedGroupCards,
    dialog, groupDraft, cardDraft, isSaving, isMutatingAction,
    pendingSummary, hasPendingChanges,
    pendingDeactivatedGroupIds, pendingDeactivatedCardIds,
    selectedApp, selectedGroup, isSelectedGroupPendingDeactivation,
    setDialog, setGroupDraft, setCardDraft,
    handleApplicationChange, handleGroupRowClick,
    handleGroupReorder, handleCardReorder, handleCancelBatch, handleSaveBatch,
    closeDialog,
    handleInlineEditGroup, handleInlineEditCard,
    editingGroupId, startEditingGroup, stopEditingGroup,
    editingCardId, startEditingCard, stopEditingCard,
    ...groupActions,
    ...cardActions,
  };
}
