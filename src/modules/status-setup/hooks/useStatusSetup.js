"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId,
  compareText,
  normalizeText,
  mapStatusRow,
  removeObjectKey,
  mergeUpdatePatch,
  appendUniqueId,
  EMPTY_DIALOG,
  TEMP_STATUS_PREFIX,
  createTempId,
  isTempStatusId,
  createEmptyStatusChanges,
  executeBatchSave,
} from "../utils/statusHelpers";

export function useStatusSetup({ statuses = [] }) {
  const router = useRouter();

  // -- seed
  const seedStatuses = useMemo(
    () =>
      (Array.isArray(statuses) ? statuses : [])
        .map((status, index) => mapStatusRow(status, index))
        .sort((left, right) => compareText(left.sts_name, right.sts_name)),
    [statuses],
  );

  // -- state
  const [orderedStatuses, setOrderedStatuses] = useState(seedStatuses);
  const [statusChanges, setStatusChanges] = useState(createEmptyStatusChanges());
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [statusDraft, setStatusDraft] = useState({ name: "", desc: "" });
  const [editingStatusId, setEditingStatusId] = useState(null);

  // -- reset on prop change
  useEffect(() => {
    setOrderedStatuses(seedStatuses);
    setStatusChanges(createEmptyStatusChanges());
    setDialog(EMPTY_DIALOG);
    setStatusDraft({ name: "", desc: "" });
    setIsMutatingAction(false);
    setIsSavingBatch(false);
    setEditingStatusId(null);
  }, [seedStatuses]);

  // -- computed
  const pendingSummary = useMemo(() => {
    const added = statusChanges.creates.length;
    const edited = Object.keys(statusChanges.updates || {}).length;
    const deactivated = statusChanges.deactivations.length;
    return { added, edited, deactivated, total: added + edited + deactivated };
  }, [statusChanges]);

  const hasPendingChanges = pendingSummary.total > 0;

  const pendingDeactivatedStatusIds = useMemo(
    () => new Set((statusChanges.deactivations || []).map((id) => String(id ?? ""))),
    [statusChanges.deactivations],
  );

  const decoratedStatuses = useMemo(() => {
    const createdIds = new Set((statusChanges.creates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatesMap = statusChanges.updates || {};
    const deactivatedIds = new Set((statusChanges.deactivations || []).map((entry) => String(entry ?? "")));

    return orderedStatuses.map((row) => {
      const id = String(row?.status_id ?? "");

      if (deactivatedIds.has(id)) return { ...row, __batchState: "deleted" };
      if (createdIds.has(id)) return { ...row, __batchState: "created" };

      const updates = updatesMap[id];
      if (updates) {
        const hasIsActive = Object.prototype.hasOwnProperty.call(updates, "is_active");
        const hasOtherFields = Object.keys(updates).some((k) => k !== "is_active");

        if (hasIsActive && !hasOtherFields) {
          return { ...row, __batchState: updates.is_active ? "activated" : "deactivated" };
        }
        if (hasIsActive && hasOtherFields) {
          return { ...row, __batchState: updates.is_active ? "activated" : "deactivated" };
        }
        return { ...row, __batchState: "updated" };
      }

      return { ...row, __batchState: "none" };
    });
  }, [statusChanges.creates, statusChanges.deactivations, statusChanges.updates, orderedStatuses]);

  // -- dialog actions
  const closeDialog = useCallback(() => {
    if (isMutatingAction || isSavingBatch) return;
    setDialog(EMPTY_DIALOG);
  }, [isMutatingAction, isSavingBatch]);

  const openAddStatusDialog = useCallback(() => {
    if (isMutatingAction || isSavingBatch) return;
    setStatusDraft({ name: "", desc: "" });
    setDialog({ kind: "add-status", target: null, nextIsActive: true });
  }, [isMutatingAction, isSavingBatch]);

  const openEditStatusDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) return;
    setStatusDraft({
      name: String(row?.sts_name || ""),
      desc: String(row?.sts_desc === "--" ? "" : (row?.sts_desc || "")),
    });
    setDialog({ kind: "edit-status", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  const openToggleStatusDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) return;
    setDialog({ kind: "toggle-status", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingBatch]);

  const openDeactivateStatusDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) return;
    setDialog({ kind: "deactivate-status", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  // -- batch actions
  const handleCancelBatch = useCallback(() => {
    if (isMutatingAction || isSavingBatch || !hasPendingChanges) return;
    setOrderedStatuses(seedStatuses);
    setStatusChanges(createEmptyStatusChanges());
    setDialog(EMPTY_DIALOG);
    setStatusDraft({ name: "", desc: "" });
    setEditingStatusId(null);
    toastSuccess("Batch changes canceled.", "Batching");
  }, [hasPendingChanges, isMutatingAction, isSavingBatch, seedStatuses]);

  const handleSaveBatch = useCallback(async () => {
    if (!hasPendingChanges || isSavingBatch || isMutatingAction) return;

    setIsSavingBatch(true);
    setIsMutatingAction(true);

    try {
      await executeBatchSave(statusChanges);
      setStatusChanges(createEmptyStatusChanges());
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally {
      setIsMutatingAction(false);
      setIsSavingBatch(false);
      setEditingStatusId(null);
    }
  }, [
    hasPendingChanges,
    isMutatingAction,
    isSavingBatch,
    pendingSummary.total,
    router,
    statusChanges,
  ]);

  // -- submit handlers
  const submitAddStatus = useCallback(() => {
    const statusName = normalizeText(statusDraft.name);
    if (!statusName) { toastError("Status name is required."); return; }

    const tempStatusId = createTempId(TEMP_STATUS_PREFIX);
    const statusDesc = normalizeText(statusDraft.desc);

    setOrderedStatuses((previous) => [
      ...previous,
      mapStatusRow({ status_id: tempStatusId, sts_name: statusName, sts_desc: statusDesc || null, is_active: true }, previous.length),
    ]);

    setStatusChanges((previous) => ({
      ...previous,
      creates: [...previous.creates, { tempId: tempStatusId, payload: { sts_name: statusName, sts_desc: statusDesc || null, is_active: true } }],
    }));

    setDialog(EMPTY_DIALOG);
    setStatusDraft({ name: "", desc: "" });
    toastSuccess("Status staged for Save Batch.", "Batching");
  }, [statusDraft.desc, statusDraft.name]);

  const submitEditStatus = useCallback(() => {
    const row = dialog?.target;
    if (!row?.status_id) { toastError("Invalid status."); return; }

    const statusName = normalizeText(statusDraft.name);
    if (!statusName) { toastError("Status name is required."); return; }

    const statusDesc = normalizeText(statusDraft.desc);
    const statusId = row.status_id;

    setOrderedStatuses((previous) =>
      previous.map((status, index) => {
        if (!isSameId(status?.status_id, statusId)) return status;
        return mapStatusRow({ ...status, sts_name: statusName, sts_desc: statusDesc || null }, index);
      }),
    );

    setStatusChanges((previous) => {
      if (isTempStatusId(statusId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, statusId)) return entry;
            return { ...entry, payload: { ...entry.payload, sts_name: statusName, sts_desc: statusDesc || null } };
          }),
        };
      }
      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(statusId)]: mergeUpdatePatch(previous.updates?.[String(statusId)], { sts_name: statusName, sts_desc: statusDesc || null }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    setStatusDraft({ name: "", desc: "" });
    toastSuccess("Status edit staged for Save Batch.", "Batching");
  }, [dialog?.target, statusDraft.desc, statusDraft.name]);

  const submitToggleStatus = useCallback(() => {
    const row = dialog?.target;
    if (!row?.status_id) { toastError("Invalid status."); return; }

    const statusId = row.status_id;
    const nextIsActive = Boolean(dialog?.nextIsActive);

    setOrderedStatuses((previous) =>
      previous.map((status, index) => {
        if (!isSameId(status?.status_id, statusId)) return status;
        return mapStatusRow({ ...status, is_active: nextIsActive }, index);
      }),
    );

    setStatusChanges((previous) => {
      if (isTempStatusId(statusId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, statusId)) return entry;
            return { ...entry, payload: { ...entry.payload, is_active: nextIsActive } };
          }),
        };
      }
      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(statusId)]: mergeUpdatePatch(previous.updates?.[String(statusId)], { is_active: nextIsActive }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(
      nextIsActive ? "Status enabled — staged for Save Batch." : "Status disabled — staged for Save Batch.",
      "Batching",
    );
  }, [dialog?.nextIsActive, dialog?.target]);

  const submitDeactivateStatus = useCallback(() => {
    const row = dialog?.target;
    if (!row?.status_id) { toastError("Invalid status."); return; }

    const statusId = row.status_id;

    if (isTempStatusId(statusId)) {
      setOrderedStatuses((previous) =>
        previous.filter((status) => !isSameId(status?.status_id, statusId)),
      );
      setStatusChanges((previous) => ({
        ...previous,
        creates: previous.creates.filter((entry) => !isSameId(entry?.tempId, statusId)),
        updates: removeObjectKey(previous.updates, String(statusId)),
      }));
      setDialog(EMPTY_DIALOG);
      toastSuccess("Staged status removed.", "Batching");
      return;
    }

    setStatusChanges((previous) => ({
      ...previous,
      deactivations: appendUniqueId(previous.deactivations, statusId),
    }));

    setDialog(EMPTY_DIALOG);
    toastSuccess("Status deactivation staged for Save Batch.", "Batching");
  }, [dialog?.target]);

  // -- row editing mode
  const startEditingStatus = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) return;
    const id = String(row?.status_id ?? "");
    setEditingStatusId((prev) => prev === id ? null : id);
  }, [isMutatingAction, isSavingBatch]);

  const stopEditingStatus = useCallback(() => {
    setEditingStatusId(null);
  }, []);

  // -- inline edit
  const handleInlineEdit = useCallback((row, key, value) => {
    const statusId = row?.status_id;
    if (!statusId) return;

    const isPendingDeactivation = pendingDeactivatedStatusIds.has(String(statusId));
    if (isPendingDeactivation || isMutatingAction || isSavingBatch) return;

    setOrderedStatuses((previous) =>
      previous.map((status, index) => {
        if (!isSameId(status?.status_id, statusId)) return status;
        return mapStatusRow({ ...status, [key]: value || null }, index);
      }),
    );

    setStatusChanges((previous) => {
      if (isTempStatusId(statusId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, statusId)) return entry;
            return { ...entry, payload: { ...entry.payload, [key]: value || null } };
          }),
        };
      }
      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(statusId)]: mergeUpdatePatch(previous.updates?.[String(statusId)], { [key]: value || null }),
        },
      };
    });
  }, [isMutatingAction, isSavingBatch, pendingDeactivatedStatusIds]);

  return {
    // state
    decoratedStatuses,
    dialog,
    statusDraft,
    isSavingBatch,
    isMutatingAction,
    pendingSummary,
    hasPendingChanges,
    pendingDeactivatedStatusIds,

    // setters
    setDialog,
    setStatusDraft,

    // dialog actions
    closeDialog,
    openAddStatusDialog,
    openEditStatusDialog,
    openToggleStatusDialog,
    openDeactivateStatusDialog,

    // batch actions
    handleCancelBatch,
    handleSaveBatch,

    // submit handlers
    submitAddStatus,
    submitEditStatus,
    submitToggleStatus,
    submitDeactivateStatus,

    // inline edit
    editingStatusId,
    startEditingStatus,
    stopEditingStatus,
    handleInlineEdit,
  };
}
