"use client";

import { useCallback } from "react";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId, mapRoleRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_ROLE_PREFIX, createTempId, isTempRoleId,
} from "../utils/applicationHelpers";

export function useRoleActions({
  isSavingOrder, isMutatingAction, isSelectedAppPendingDeactivation, selectedApp,
  dialog, roleDraft, pendingDeactivatedRoleIds,
  setAllRoles, setPendingBatch, setDialog, setRoleDraft,
}) {
  const openEditRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setRoleDraft({ name: String(row?.role_name || ""), desc: String(row?.role_desc || "") });
    setDialog({ kind: "edit-role", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder, setDialog, setRoleDraft]);

  const openToggleRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const roleId = String(row?.role_id ?? "");
    if (pendingDeactivatedRoleIds.has(roleId)) {
      setPendingBatch((prev) => ({
        ...prev,
        roleDeactivations: (prev.roleDeactivations || []).filter((id) => !isSameId(id, roleId)),
      }));
      toastSuccess("Role deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-role", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingOrder, pendingDeactivatedRoleIds, setDialog, setPendingBatch]);

  const openDeactivateRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setDialog({ kind: "deactivate-role", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder, setDialog]);

  const openAddRoleDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    if (!selectedApp?.app_id) { toastError("Select an application before adding a role."); return; }
    if (isSelectedAppPendingDeactivation) {
      toastError("Selected application is staged for deactivation. Save or cancel batch before adding a role.");
      return;
    }
    setRoleDraft({ name: "", desc: "" });
    setDialog({
      kind: "add-role",
      target: { app_id: selectedApp.app_id, app_name: selectedApp.app_name },
      nextIsActive: true,
    });
  }, [isMutatingAction, isSavingOrder, isSelectedAppPendingDeactivation, selectedApp, setDialog, setRoleDraft]);

  const submitEditRole = useCallback(() => {
    const row = dialog?.target;
    if (!row?.role_id) { toastError("Invalid role."); return; }
    const roleName = String(roleDraft.name || "").trim();
    if (!roleName) { toastError("Role name is required."); return; }
    const roleDesc = String(roleDraft.desc || "").trim();
    const roleId = row.role_id;

    setAllRoles((prev) =>
      prev.map((r, i) => isSameId(r?.role_id, roleId)
        ? mapRoleRow({ ...r, role_name: roleName, role_desc: roleDesc }, i) : r),
    );

    setPendingBatch((prev) => {
      if (isTempRoleId(roleId)) {
        return {
          ...prev,
          roleCreates: prev.roleCreates.map((e) => isSameId(e?.tempId, roleId)
            ? { ...e, payload: { ...e.payload, role_name: roleName, role_desc: roleDesc } } : e),
          roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
        };
      }
      return {
        ...prev,
        roleUpdates: {
          ...prev.roleUpdates,
          [String(roleId)]: mergeUpdatePatch(prev.roleUpdates?.[String(roleId)], { role_name: roleName, role_desc: roleDesc }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Role update staged for Save Batch.", "Batching");
  }, [dialog, roleDraft, setAllRoles, setDialog, setPendingBatch]);

  const submitToggleRole = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.role_id) { toastError("Invalid role."); return; }
    const roleId = row.role_id;

    setAllRoles((prev) =>
      prev.map((r, i) => isSameId(r?.role_id, roleId)
        ? mapRoleRow({ ...r, is_active: nextIsActive }, i) : r),
    );

    setPendingBatch((prev) => {
      if (isTempRoleId(roleId)) {
        return {
          ...prev,
          roleCreates: prev.roleCreates.map((e) => isSameId(e?.tempId, roleId)
            ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
        };
      }
      return {
        ...prev,
        roleUpdates: {
          ...prev.roleUpdates,
          [String(roleId)]: mergeUpdatePatch(prev.roleUpdates?.[String(roleId)], { is_active: nextIsActive }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(`Role ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setAllRoles, setDialog, setPendingBatch]);

  const submitDeactivateRole = useCallback(() => {
    const row = dialog?.target;
    if (!row?.role_id) { toastError("Invalid role."); return; }
    const roleId = row.role_id;

    if (isTempRoleId(roleId)) {
      setAllRoles((items) => items.filter((r) => !isSameId(r?.role_id, roleId)));
    }

    setPendingBatch((prev) => {
      if (isTempRoleId(roleId)) {
        return {
          ...prev,
          roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.tempId, roleId)),
          roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
          roleDeactivations: (prev.roleDeactivations || []).filter((id) => !isSameId(id, roleId)),
        };
      }
      return {
        ...prev,
        roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
        roleDeactivations: appendUniqueId(prev.roleDeactivations, roleId),
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Role deactivation staged for Save Batch.", "Batching");
  }, [dialog, setAllRoles, setDialog, setPendingBatch]);

  const submitAddRole = useCallback(() => {
    const target = dialog?.target;
    if (!target?.app_id) { toastError("Select an application before adding a role."); return; }
    const roleName = String(roleDraft.name || "").trim();
    if (!roleName) { toastError("Role name is required."); return; }
    const roleDesc = String(roleDraft.desc || "").trim();
    const tempRoleId = createTempId(TEMP_ROLE_PREFIX);

    setAllRoles((prev) => [
      ...prev,
      mapRoleRow({
        role_id: tempRoleId, app_id: target.app_id, role_name: roleName, role_desc: roleDesc, is_active: true,
      }, prev.length),
    ]);

    setPendingBatch((prev) => ({
      ...prev,
      roleCreates: [
        ...prev.roleCreates,
        { tempId: tempRoleId, payload: { app_id: target.app_id, role_name: roleName, role_desc: roleDesc, is_active: true } },
      ],
    }));

    setDialog(EMPTY_DIALOG);
    setRoleDraft({ name: "", desc: "" });
    toastSuccess("Role staged for Save Batch.", "Batching");
  }, [dialog, roleDraft, setAllRoles, setDialog, setPendingBatch, setRoleDraft]);

  const stageHardDeleteRole = useCallback((row) => {
    const roleId = String(row?.role_id ?? "");
    if (!roleId || isSavingOrder || isMutatingAction) return;

    if (isTempRoleId(roleId)) {
      setAllRoles((prev) => prev.filter((r) => !isSameId(r?.role_id, roleId)));
      setPendingBatch((prev) => ({
        ...prev,
        roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.tempId, roleId)),
        roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
      }));
      toastSuccess("Staged role removed.", "Batching");
      return;
    }

    setPendingBatch((prev) => ({
      ...prev,
      roleDeactivations: (prev.roleDeactivations || []).filter((id) => !isSameId(id, roleId)),
      roleUpdates: removeObjectKey(prev.roleUpdates, roleId),
      roleHardDeletes: appendUniqueId(prev.roleHardDeletes || [], roleId),
    }));
    toastSuccess("Role deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSavingOrder, setAllRoles, setPendingBatch]);

  return {
    openEditRoleDialog, openToggleRoleDialog, openDeactivateRoleDialog, openAddRoleDialog,
    submitEditRole, submitToggleRole, submitDeactivateRole, submitAddRole, stageHardDeleteRole,
  };
}
