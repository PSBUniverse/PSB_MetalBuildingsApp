"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const batchActiveRef = useRef(false);

  // -- reset on prop change
  useEffect(() => {
    if (batchActiveRef.current) return;
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
    const hardDeleted = (statusChanges.hardDeletes || []).length;
    return { added, edited, deactivated, hardDeleted, total: added + edited + deactivated + hardDeleted };
  }, [statusChanges]);

  const hasPendingChanges = pendingSummary.total > 0;

  useEffect(() => { batchActiveRef.current = hasPendingChanges; }, [hasPendingChanges]);

  const pendingDeactivatedStatusIds = useMemo(
    () => new Set((statusChanges.deactivations || []).map((id) => String(id ?? ""))),
    [statusChanges.deactivations],
  );

  const pendingHardDeletedStatusIds = useMemo(
    () => new Set((statusChanges.hardDeletes || []).map((id) => String(id ?? ""))),
    [statusChanges.hardDeletes],
  );

  const decoratedStatuses = useMemo(() => {
    const createdIds = new Set((statusChanges.creates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatesMap = statusChanges.updates || {};
    const deactivatedIds = new Set((statusChanges.deactivations || []).map((entry) => String(entry ?? "")));
    const hardDeletedIds = new Set((statusChanges.hardDeletes || []).map((entry) => String(entry ?? "")));

    return orderedStatuses.map((row) => {
      const id = String(row?.status_id ?? "");

      if (hardDeletedIds.has(id)) return { ...row, __batchState: "hardDeleted" };
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
  }, [statusChanges.creates, statusChanges.deactivations, statusChanges.hardDeletes, statusChanges.updates, orderedStatuses]);

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
    const statusId = String(row?.status_id ?? "");
    if (pendingDeactivatedStatusIds.has(statusId)) {
      setStatusChanges((prev) => ({
        ...prev,
        deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, statusId)),
      }));
      toastSuccess("Status deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-status", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingBatch, pendingDeactivatedStatusIds]);

  const openDeactivateStatusDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) return;
    setDialog({ kind: "deactivate-status", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  const stageHardDeleteStatus = useCallback((row) => {
    const statusId = String(row?.status_id ?? "");
    if (!statusId || isMutatingAction || isSavingBatch) return;

    if (isTempStatusId(statusId)) {
      setOrderedStatuses((prev) => prev.filter((s) => !isSameId(s?.status_id, statusId)));
      setStatusChanges((prev) => ({
        ...prev,
        creates: prev.creates.filter((e) => !isSameId(e?.tempId, statusId)),
        updates: removeObjectKey(prev.updates, statusId),
      }));
      toastSuccess("Staged status removed.", "Batching");
      return;
    }

    setStatusChanges((prev) => ({
      ...prev,
      deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, statusId)),
      updates: removeObjectKey(prev.updates, String(statusId)),
      hardDeletes: appendUniqueId(prev.hardDeletes || [], statusId),
    }));
    toastSuccess("Status deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSavingBatch]);

  const unstageHardDeleteStatus = useCallback((row) => {
    const statusId = String(row?.status_id ?? "");
    if (!statusId || isMutatingAction || isSavingBatch) return;
    setStatusChanges((prev) => ({
      ...prev,
      hardDeletes: (prev.hardDeletes || []).filter((id) => !isSameId(id, statusId)),
    }));
    toastSuccess("Status deletion un-staged.", "Batching");
  }, [isMutatingAction, isSavingBatch]);

  // -- batch actions
  const handleCancelBatch = useCallback(() => {
    if (isMutatingAction || isSavingBatch || !hasPendingChanges) return;
    batchActiveRef.current = false;
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
      batchActiveRef.current = false;
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

    if (isMutatingAction || isSavingBatch) return;

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
  }, [isMutatingAction, isSavingBatch]);

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
    pendingHardDeletedStatusIds,

    // setters
    setDialog,
    setStatusDraft,

    // dialog actions
    closeDialog,
    openAddStatusDialog,
    openEditStatusDialog,
    openToggleStatusDialog,
    openDeactivateStatusDialog,
    stageHardDeleteStatus,
    unstageHardDeleteStatus,

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
