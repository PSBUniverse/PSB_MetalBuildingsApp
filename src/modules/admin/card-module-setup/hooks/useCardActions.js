"use client";

import { useCallback } from "react";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId, mapCardRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_CARD_PREFIX, createTempId, isTempCardId,
} from "../utils/cardModuleHelpers";

export function useCardActions({
  isSaving, isMutatingAction, isSelectedGroupPendingDeactivation,
  selectedGroup, selectedApp, selectedGroupCards, pendingDeactivatedCardIds,
  dialog, cardDraft, setAllCards, setPendingBatch, setDialog, setCardDraft,
}) {
  const openAddCardDialog = useCallback(() => {
    if (isSaving || isMutatingAction) return;
    if (!selectedGroup?.group_id) { toastError("Select a card group before adding a card."); return; }
    if (isSelectedGroupPendingDeactivation) {
      toastError("Selected group is staged for deactivation. Save or cancel batch before adding a card."); return;
    }
    setCardDraft({ name: "", desc: "", route_path: "", icon: "" });
    setDialog({
      kind: "add-card",
      target: { group_id: selectedGroup.group_id, group_name: selectedGroup.group_name, app_id: selectedApp?.app_id },
      nextIsActive: true,
    });
  }, [isMutatingAction, isSaving, isSelectedGroupPendingDeactivation, selectedApp, selectedGroup, setCardDraft, setDialog]);

  const openEditCardDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    setCardDraft({
      name: String(row?.card_name || ""), desc: String(row?.card_desc || ""),
      route_path: String(row?.route_path || ""), icon: String(row?.card_icon || row?.icon || ""),
    });
    setDialog({ kind: "edit-card", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setCardDraft, setDialog]);

  const openToggleCardDialog = useCallback((row) => {
    if (isSaving || isMutatingAction) return;
    const cardId = String(row?.card_id ?? "");
    if (pendingDeactivatedCardIds.has(cardId)) {
      setPendingBatch((prev) => ({
        ...prev,
        cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)),
      }));
      toastSuccess("Card deactivation un-staged.", "Batching");
      return;
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

    setAllCards((prev) => [
      ...prev,
      mapCardRow({
        card_id: tempCardId, group_id: target.group_id, app_id: target.app_id,
        card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon,
        is_active: true, display_order: selectedGroupCards.length + 1,
      }, prev.length),
    ]);
    setPendingBatch((prev) => ({
      ...prev,
      cardCreates: [...prev.cardCreates, {
        tempId: tempCardId,
        payload: { group_id: target.group_id, app_id: target.app_id, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon, is_active: true },
      }],
    }));
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

    setAllCards((prev) => prev.map((c, i) => isSameId(c?.card_id, cardId)
      ? mapCardRow({ ...c, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon }, i) : c));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev,
          cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId)
            ? { ...e, payload: { ...e.payload, card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon } } : e),
          cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
        };
      }
      return { ...prev, cardUpdates: { ...prev.cardUpdates,
        [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { card_name: cardName, card_desc: cardDesc, route_path: routePath, icon: cardIcon }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card update staged for Save Batch.", "Batching");
  }, [cardDraft, dialog, setAllCards, setDialog, setPendingBatch]);

  const submitToggleCard = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.card_id) { toastError("Invalid card."); return; }
    const cardId = row.card_id;

    setAllCards((prev) => prev.map((c, i) => isSameId(c?.card_id, cardId)
      ? mapCardRow({ ...c, is_active: nextIsActive }, i) : c));
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev,
          cardCreates: prev.cardCreates.map((e) => isSameId(e?.tempId, cardId)
            ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
        };
      }
      return { ...prev, cardUpdates: { ...prev.cardUpdates,
        [String(cardId)]: mergeUpdatePatch(prev.cardUpdates?.[String(cardId)], { is_active: nextIsActive }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Card ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setAllCards, setDialog, setPendingBatch]);

  const submitDeactivateCard = useCallback(() => {
    const row = dialog?.target;
    if (!row?.card_id) { toastError("Invalid card."); return; }
    const cardId = row.card_id;

    if (isTempCardId(cardId)) {
      setAllCards((items) => items.filter((c) => !isSameId(c?.card_id, cardId)));
    }
    setPendingBatch((prev) => {
      if (isTempCardId(cardId)) {
        return { ...prev,
          cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.tempId, cardId)),
          cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
          cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)),
        };
      }
      return { ...prev,
        cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
        cardDeactivations: appendUniqueId(prev.cardDeactivations, cardId),
      };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card deactivation staged for Save Batch.", "Batching");
  }, [dialog, setAllCards, setDialog, setPendingBatch]);

  const stageHardDeleteCard = useCallback((row) => {
    const cardId = String(row?.card_id ?? "");
    if (!cardId || isSaving || isMutatingAction) return;

    if (isTempCardId(cardId)) {
      setAllCards((prev) => prev.filter((c) => !isSameId(c?.card_id, cardId)));
      setPendingBatch((prev) => ({
        ...prev,
        cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.tempId, cardId)),
        cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
      }));
      toastSuccess("Staged card removed.", "Batching");
      return;
    }

    setPendingBatch((prev) => ({
      ...prev,
      cardDeactivations: (prev.cardDeactivations || []).filter((id) => !isSameId(id, cardId)),
      cardUpdates: removeObjectKey(prev.cardUpdates, cardId),
      cardHardDeletes: appendUniqueId(prev.cardHardDeletes || [], cardId),
    }));
    toastSuccess("Card deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSaving, setAllCards, setPendingBatch]);

  const unstageHardDeleteCard = useCallback((row) => {
    const cardId = String(row?.card_id ?? "");
    if (!cardId || isSaving || isMutatingAction) return;
    setPendingBatch((prev) => ({
      ...prev,
      cardHardDeletes: (prev.cardHardDeletes || []).filter((id) => !isSameId(id, cardId)),
    }));
    toastSuccess("Card deletion un-staged.", "Batching");
  }, [isMutatingAction, isSaving, setPendingBatch]);

  return {
    openAddCardDialog, openEditCardDialog, openToggleCardDialog, openDeactivateCardDialog,
    submitAddCard, submitEditCard, submitToggleCard, submitDeactivateCard, stageHardDeleteCard, unstageHardDeleteCard,
  };
}
