"use client";

import { useCallback } from "react";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId, mapGroupRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_GROUP_PREFIX, createTempId, isTempGroupId, isTempCardId,
} from "../utils/cardModuleHelpers";

export function useGroupActions({
  isSaving, isMutatingAction, selectedApp, appGroups, allCards, orderedGroups,
  selectedGroup, dialog, groupDraft, pendingDeactivatedGroupIds,
  setOrderedGroups, setAllCards, setPendingBatch, setDialog, setGroupDraft, updateQueryParams,
}) {
  const openAddGroupDialog = useCallback(() => {
    if (isSaving || isMutatingAction) return;
    if (!selectedApp?.app_id) { toastError("Select an application first."); return; }
    setGroupDraft({ name: "", desc: "", icon: "" });
    setDialog({ kind: "add-group", target: { app_id: selectedApp.app_id }, nextIsActive: true });
  }, [isMutatingAction, isSaving, selectedApp?.app_id, setDialog, setGroupDraft]);

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
  }, [appGroups.length, groupDraft, selectedApp?.app_id, setDialog, setGroupDraft, setOrderedGroups, setPendingBatch, updateQueryParams]);

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
        return { ...prev,
          groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId)
            ? { ...e, payload: { ...e.payload, group_name: groupName, group_desc: groupDesc, icon: groupIcon } } : e),
          groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        };
      }
      return { ...prev, groupUpdates: { ...prev.groupUpdates,
        [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { group_name: groupName, group_desc: groupDesc, icon: groupIcon }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Card group update staged for Save Batch.", "Batching");
  }, [dialog, groupDraft, setDialog, setOrderedGroups, setPendingBatch]);

  const submitToggleGroup = useCallback(() => {
    const row = dialog?.target; const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.group_id) { toastError("Invalid card group."); return; }
    const groupId = row.group_id;
    setOrderedGroups((prev) => prev.map((g, i) => isSameId(g?.group_id, groupId)
      ? mapGroupRow({ ...g, is_active: nextIsActive }, i) : g));
    setPendingBatch((prev) => {
      if (isTempGroupId(groupId)) {
        return { ...prev,
          groupCreates: prev.groupCreates.map((e) => isSameId(e?.tempId, groupId)
            ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        };
      }
      return { ...prev, groupUpdates: { ...prev.groupUpdates,
        [String(groupId)]: mergeUpdatePatch(prev.groupUpdates?.[String(groupId)], { is_active: nextIsActive }),
      }};
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
        ...prev,
        groupCreates: prev.groupCreates.filter((e) => !isSameId(e?.tempId, groupId)),
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
      return { ...prev,
        groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
        groupDeactivations: appendUniqueId(prev.groupDeactivations, groupId),
        cardCreates: prev.cardCreates.filter((e) => !isSameId(e?.payload?.group_id, groupId)),
        cardUpdates: linkedCardIds.reduce((m, id) => removeObjectKey(m, id), prev.cardUpdates),
        cardDeactivations: nextCardDeactivations,
      };
    });
    setDialog(EMPTY_DIALOG); toastSuccess("Card group deactivation staged for Save Batch.", "Batching");
  }, [allCards, dialog, orderedGroups, selectedApp?.app_id, selectedGroup?.group_id, setAllCards, setDialog, setOrderedGroups, setPendingBatch, updateQueryParams]);

  const stageHardDeleteGroup = useCallback((row) => {
    const groupId = String(row?.group_id ?? "");
    if (!groupId || isSaving || isMutatingAction) return;
    const linkedCardIds = allCards.filter((c) => isSameId(c?.group_id, groupId)).map((c) => String(c?.card_id ?? ""));

    if (isTempGroupId(groupId)) {
      const nextGroups = orderedGroups.filter((g) => !isSameId(g?.group_id, groupId)).map((g, i) => ({ ...g, display_order: i + 1 }));
      setOrderedGroups(nextGroups);
      setAllCards((prev) => prev.filter((c) => !isSameId(c?.group_id, groupId)));
      setPendingBatch((prev) => ({
        ...prev,
        groupCreates: prev.groupCreates.filter((e) => !isSameId(e?.tempId, groupId)),
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
      toastSuccess("Staged card group removed.", "Batching");
      return;
    }

    setPendingBatch((prev) => ({
      ...prev,
      groupUpdates: removeObjectKey(prev.groupUpdates, groupId),
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
  }, [allCards, isMutatingAction, isSaving, orderedGroups, selectedApp?.app_id, selectedGroup?.group_id, setAllCards, setOrderedGroups, setPendingBatch, updateQueryParams]);

  return {
    openAddGroupDialog, openEditGroupDialog, openToggleGroupDialog, openDeactivateGroupDialog,
    submitAddGroup, submitEditGroup, submitToggleGroup, submitDeactivateGroup, stageHardDeleteGroup,
  };
}
