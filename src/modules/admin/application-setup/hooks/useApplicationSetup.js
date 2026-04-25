"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  parseAppId, isSameId, compareText, buildOrderSignature,
  mapApplicationRow, mapRoleRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_APP_PREFIX, createTempId, isTempApplicationId, isTempRoleId,
  createEmptyBatchState, executeBatchSave,
} from "../utils/applicationHelpers";
import { useRoleActions } from "./useRoleActions";

export function useApplicationSetup({ applications = [], roles = [], initialSelectedAppId = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const seedApplications = useMemo(
    () => (Array.isArray(applications) ? applications : [])
      .map((app, i) => mapApplicationRow(app, i))
      .sort((a, b) => {
        const d = Number(a.app_order || 0) - Number(b.app_order || 0);
        return d !== 0 ? d : compareText(a.app_name, b.app_name);
      }),
    [applications],
  );

  const seedRoles = useMemo(
    () => (Array.isArray(roles) ? roles : []).map((r, i) => mapRoleRow(r, i)),
    [roles],
  );

  const [orderedApplications, setOrderedApplications] = useState(seedApplications);
  const [allRoles, setAllRoles] = useState(seedRoles);
  const [persistedOrderSig, setPersistedOrderSig] = useState(buildOrderSignature(seedApplications));
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [pendingBatch, setPendingBatch] = useState(createEmptyBatchState());
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [applicationDraft, setApplicationDraft] = useState({ name: "", desc: "" });
  const [roleDraft, setRoleDraft] = useState({ name: "", desc: "" });
  const [editingAppId, setEditingAppId] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const batchActiveRef = useRef(false);

  useEffect(() => {
    if (batchActiveRef.current) return;
    setOrderedApplications(seedApplications); setAllRoles(seedRoles);
    setPersistedOrderSig(buildOrderSignature(seedApplications));
    setIsSavingOrder(false); setIsMutatingAction(false);
    setPendingBatch(createEmptyBatchState()); setDialog(EMPTY_DIALOG);
    setApplicationDraft({ name: "", desc: "" }); setRoleDraft({ name: "", desc: "" });
    setEditingAppId(null); setEditingRoleId(null);
  }, [seedApplications, seedRoles]);

  const currentOrderSig = useMemo(() => buildOrderSignature(orderedApplications), [orderedApplications]);
  const hasOrderChanges = persistedOrderSig !== currentOrderSig;

  const pendingSummary = useMemo(() => {
    const aA = pendingBatch.appCreates.length;
    const aE = Object.keys(pendingBatch.appUpdates || {}).length;
    const aD = pendingBatch.appDeactivations.length;
    const aH = (pendingBatch.appHardDeletes || []).length;
    const rA = pendingBatch.roleCreates.length;
    const rE = Object.keys(pendingBatch.roleUpdates || {}).length;
    const rD = pendingBatch.roleDeactivations.length;
    const rH = (pendingBatch.roleHardDeletes || []).length;
    const oC = hasOrderChanges ? 1 : 0;
    return {
      applicationAdded: aA, applicationEdited: aE, applicationDeactivated: aD, applicationHardDeleted: aH,
      roleAdded: rA, roleEdited: rE, roleDeactivated: rD, roleHardDeleted: rH, rowOrderChanged: oC,
      total: aA + aE + aD + aH + rA + rE + rD + rH + oC,
    };
  }, [hasOrderChanges, pendingBatch]);

  const hasPendingChanges = pendingSummary.total > 0;

  useEffect(() => { batchActiveRef.current = hasPendingChanges; }, [hasPendingChanges]);

  const pendingDeactivatedAppIds = useMemo(
    () => new Set((pendingBatch.appDeactivations || []).map((id) => String(id ?? ""))),
    [pendingBatch.appDeactivations],
  );
  const pendingDeactivatedRoleIds = useMemo(
    () => new Set((pendingBatch.roleDeactivations || []).map((id) => String(id ?? ""))),
    [pendingBatch.roleDeactivations],
  );
  const pendingHardDeletedAppIds = useMemo(
    () => new Set((pendingBatch.appHardDeletes || []).map((id) => String(id ?? ""))),
    [pendingBatch.appHardDeletes],
  );
  const pendingHardDeletedRoleIds = useMemo(
    () => new Set((pendingBatch.roleHardDeletes || []).map((id) => String(id ?? ""))),
    [pendingBatch.roleHardDeletes],
  );

  const selectedAppId = useMemo(() => {
    const fromQuery = parseAppId(searchParams?.get("app"));
    if (fromQuery !== null) return fromQuery;
    if (initialSelectedAppId != null && initialSelectedAppId !== "") return initialSelectedAppId;
    return orderedApplications[0]?.app_id ?? null;
  }, [initialSelectedAppId, orderedApplications, searchParams]);

  const selectedApp = useMemo(
    () => orderedApplications.find((a) => isSameId(a?.app_id, selectedAppId)) ?? orderedApplications[0] ?? null,
    [orderedApplications, selectedAppId],
  );

  const isSelectedAppPendingDeactivation = useMemo(
    () => pendingDeactivatedAppIds.has(String(selectedApp?.app_id ?? "")),
    [pendingDeactivatedAppIds, selectedApp?.app_id],
  );

  const selectedAppRoles = useMemo(
    () => allRoles.filter((r) => isSameId(r?.app_id, selectedApp?.app_id))
      .sort((a, b) => compareText(a.role_name, b.role_name)),
    [allRoles, selectedApp?.app_id],
  );

  const decoratedApplications = useMemo(() => {
    const cIds = new Set((pendingBatch.appCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.appUpdates || {}));
    const dIds = new Set((pendingBatch.appDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.appHardDeletes || []).map((e) => String(e ?? "")));
    return orderedApplications.map((row) => {
      const id = String(row?.app_id ?? "");
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted" };
      if (dIds.has(id)) return { ...row, __batchState: "deleted" };
      if (cIds.has(id)) return { ...row, __batchState: "created" };
      if (uIds.has(id)) return { ...row, __batchState: "updated" };
      return { ...row, __batchState: "none" };
    });
  }, [orderedApplications, pendingBatch.appCreates, pendingBatch.appDeactivations, pendingBatch.appHardDeletes, pendingBatch.appUpdates]);

  const decoratedSelectedAppRoles = useMemo(() => {
    const cIds = new Set((pendingBatch.roleCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.keys(pendingBatch.roleUpdates || {}));
    const dIds = new Set((pendingBatch.roleDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.roleHardDeletes || []).map((e) => String(e ?? "")));
    return selectedAppRoles.map((row) => {
      const id = String(row?.role_id ?? "");
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted" };
      if (dIds.has(id)) return { ...row, __batchState: "deleted" };
      if (cIds.has(id)) return { ...row, __batchState: "created" };
      if (uIds.has(id)) return { ...row, __batchState: "updated" };
      return { ...row, __batchState: "none" };
    });
  }, [pendingBatch.roleCreates, pendingBatch.roleDeactivations, pendingBatch.roleHardDeletes, pendingBatch.roleUpdates, selectedAppRoles]);

  const updateSelectedApplicationInQuery = useCallback((appId) => {
    const p = new URLSearchParams(searchParams?.toString() || "");
    if (appId == null || appId === "") p.delete("app"); else p.set("app", String(appId));
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleApplicationRowClick = useCallback(
    (row) => updateSelectedApplicationInQuery(row?.app_id),
    [updateSelectedApplicationInQuery],
  );

  const handleApplicationReorder = useCallback((next) => {
    if (isSavingOrder || isMutatingAction) return;
    setOrderedApplications(
      (Array.isArray(next) ? next : []).map((r, i) => ({ ...r, app_order: i + 1, display_order: i + 1 })),
    );
  }, [isMutatingAction, isSavingOrder]);

  const handleCancelOrderChanges = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    batchActiveRef.current = false;
    setOrderedApplications(seedApplications); setAllRoles(seedRoles);
    setPendingBatch(createEmptyBatchState()); setPersistedOrderSig(buildOrderSignature(seedApplications));
    setDialog(EMPTY_DIALOG); setApplicationDraft({ name: "", desc: "" }); setRoleDraft({ name: "", desc: "" });
    setEditingAppId(null); setEditingRoleId(null);
    updateSelectedApplicationInQuery(seedApplications[0]?.app_id ?? null);
  }, [isMutatingAction, isSavingOrder, seedApplications, seedRoles, updateSelectedApplicationInQuery]);

  const handleSaveOrderChanges = useCallback(async () => {
    if (!hasPendingChanges || isSavingOrder || isMutatingAction) return;
    setIsSavingOrder(true); setIsMutatingAction(true);
    try {
      const { appIdMap, deactivatedAppSet, orderedPersistedAppIds } =
        await executeBatchSave(pendingBatch, orderedApplications);
      setPersistedOrderSig(currentOrderSig); setPendingBatch(createEmptyBatchState());
      batchActiveRef.current = false;
      const selKey = String(selectedApp?.app_id ?? "");
      const selResolved = appIdMap.get(selKey) ?? selectedApp?.app_id ?? null;
      const nextSel = selResolved && !deactivatedAppSet.has(String(selResolved))
        ? selResolved : (orderedPersistedAppIds[0] ?? null);
      updateSelectedApplicationInQuery(nextSel);
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally { setIsMutatingAction(false); setIsSavingOrder(false); setEditingAppId(null); setEditingRoleId(null); }
  }, [currentOrderSig, hasPendingChanges, isMutatingAction, isSavingOrder, orderedApplications,
    pendingBatch, pendingSummary.total, router, selectedApp?.app_id, updateSelectedApplicationInQuery]);

  const closeDialog = useCallback(() => { if (!isMutatingAction) setDialog(EMPTY_DIALOG); }, [isMutatingAction]);

  const openEditApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setApplicationDraft({ name: String(row?.app_name || ""), desc: String(row?.app_desc || "") });
    setDialog({ kind: "edit-application", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const openToggleApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const appId = String(row?.app_id ?? "");
    if (pendingDeactivatedAppIds.has(appId)) {
      const linkedRoleIds = allRoles.filter((r) => isSameId(r?.app_id, appId)).map((r) => String(r?.role_id ?? ""));
      setPendingBatch((prev) => ({
        ...prev,
        appDeactivations: (prev.appDeactivations || []).filter((id) => !isSameId(id, appId)),
        roleDeactivations: (prev.roleDeactivations || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
      }));
      toastSuccess("Application deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-application", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [allRoles, isMutatingAction, isSavingOrder, pendingDeactivatedAppIds]);

  const openDeactivateApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setDialog({ kind: "deactivate-application", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const stageHardDeleteApplication = useCallback((row) => {
    const appId = String(row?.app_id ?? "");
    if (!appId || isSavingOrder || isMutatingAction) return;
    const linkedRoleIds = allRoles.filter((r) => isSameId(r?.app_id, appId)).map((r) => String(r?.role_id ?? ""));

    if (isTempApplicationId(appId)) {
      const nextApps = orderedApplications
        .filter((a) => !isSameId(a?.app_id, appId))
        .map((a, i) => ({ ...a, app_order: i + 1, display_order: i + 1 }));
      setOrderedApplications(nextApps);
      setAllRoles((prev) => prev.filter((r) => !isSameId(r?.app_id, appId)));
      setPendingBatch((prev) => ({
        ...prev,
        appCreates: prev.appCreates.filter((e) => !isSameId(e?.tempId, appId)),
        appUpdates: removeObjectKey(prev.appUpdates, appId),
        roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.payload?.app_id, appId)),
        roleUpdates: linkedRoleIds.reduce((m, id) => removeObjectKey(m, id), prev.roleUpdates),
        roleDeactivations: (prev.roleDeactivations || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
        roleHardDeletes: (prev.roleHardDeletes || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
      }));
      if (isSameId(selectedApp?.app_id, appId)) updateSelectedApplicationInQuery(nextApps[0]?.app_id ?? null);
      toastSuccess("Staged application removed.", "Batching");
      return;
    }

    setPendingBatch((prev) => ({
      ...prev,
      appUpdates: removeObjectKey(prev.appUpdates, appId),
      appDeactivations: (prev.appDeactivations || []).filter((id) => !isSameId(id, appId)),
      appHardDeletes: appendUniqueId(prev.appHardDeletes || [], appId),
      roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.payload?.app_id, appId)),
      roleUpdates: linkedRoleIds.reduce((m, id) => removeObjectKey(m, id), prev.roleUpdates),
      roleDeactivations: (prev.roleDeactivations || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
      roleHardDeletes: linkedRoleIds.reduce(
        (ids, id) => isTempRoleId(id) ? ids : appendUniqueId(ids, id),
        (prev.roleHardDeletes || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
      ),
    }));
    toastSuccess("Application deletion staged for Save Batch.", "Batching");
  }, [allRoles, isMutatingAction, isSavingOrder, orderedApplications, selectedApp?.app_id, updateSelectedApplicationInQuery]);

  const unstageHardDeleteApplication = useCallback((row) => {
    const appId = String(row?.app_id ?? "");
    if (!appId || isSavingOrder || isMutatingAction) return;
    const linkedRoleIds = allRoles.filter((r) => isSameId(r?.app_id, appId)).map((r) => String(r?.role_id ?? ""));
    setPendingBatch((prev) => ({
      ...prev,
      appHardDeletes: (prev.appHardDeletes || []).filter((id) => !isSameId(id, appId)),
      roleHardDeletes: (prev.roleHardDeletes || []).filter((id) => !linkedRoleIds.some((lr) => isSameId(lr, id))),
    }));
    toastSuccess("Application deletion un-staged.", "Batching");
  }, [allRoles, isMutatingAction, isSavingOrder]);

  const openAddApplicationDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    setApplicationDraft({ name: "", desc: "" });
    setDialog({ kind: "add-application", target: null, nextIsActive: true });
  }, [isMutatingAction, isSavingOrder]);

  const submitAddApplication = useCallback(() => {
    const appName = String(applicationDraft.name || "").trim();
    if (!appName) { toastError("Application name is required."); return; }
    const appDesc = String(applicationDraft.desc || "").trim();
    const tempAppId = createTempId(TEMP_APP_PREFIX);
    setOrderedApplications((prev) => [
      ...prev,
      mapApplicationRow({
        app_id: tempAppId, app_name: appName, app_desc: appDesc,
        is_active: true, app_order: prev.length + 1, display_order: prev.length + 1,
      }, prev.length),
    ]);
    setPendingBatch((prev) => ({
      ...prev,
      appCreates: [...prev.appCreates, { tempId: tempAppId, payload: { app_name: appName, app_desc: appDesc, is_active: true } }],
    }));
    updateSelectedApplicationInQuery(tempAppId);
    setDialog(EMPTY_DIALOG); setApplicationDraft({ name: "", desc: "" });
    toastSuccess("Application staged for Save Batch.", "Batching");
  }, [applicationDraft, updateSelectedApplicationInQuery]);

  const submitEditApplication = useCallback(() => {
    const row = dialog?.target;
    if (!row?.app_id) { toastError("Invalid application."); return; }
    const appName = String(applicationDraft.name || "").trim();
    if (!appName) { toastError("Application name is required."); return; }
    const appDesc = String(applicationDraft.desc || "").trim();
    const appId = row.app_id;
    setOrderedApplications((prev) => prev.map((a, i) => isSameId(a?.app_id, appId)
      ? mapApplicationRow({ ...a, app_name: appName, app_desc: appDesc }, i) : a));
    setPendingBatch((prev) => {
      if (isTempApplicationId(appId)) {
        return { ...prev,
          appCreates: prev.appCreates.map((e) => isSameId(e?.tempId, appId)
            ? { ...e, payload: { ...e.payload, app_name: appName, app_desc: appDesc } } : e),
          appUpdates: removeObjectKey(prev.appUpdates, appId),
        };
      }
      return { ...prev, appUpdates: { ...prev.appUpdates,
        [String(appId)]: mergeUpdatePatch(prev.appUpdates?.[String(appId)], { app_name: appName, app_desc: appDesc }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Application update staged for Save Batch.", "Batching");
  }, [applicationDraft, dialog]);

  const submitToggleApplication = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.app_id) { toastError("Invalid application."); return; }
    const appId = row.app_id;
    setOrderedApplications((prev) => prev.map((a, i) => isSameId(a?.app_id, appId)
      ? mapApplicationRow({ ...a, is_active: nextIsActive }, i) : a));
    setPendingBatch((prev) => {
      if (isTempApplicationId(appId)) {
        return { ...prev,
          appCreates: prev.appCreates.map((e) => isSameId(e?.tempId, appId)
            ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          appUpdates: removeObjectKey(prev.appUpdates, appId),
        };
      }
      return { ...prev, appUpdates: { ...prev.appUpdates,
        [String(appId)]: mergeUpdatePatch(prev.appUpdates?.[String(appId)], { is_active: nextIsActive }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Application ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateApplication = useCallback(() => {
    const row = dialog?.target;
    if (!row?.app_id) { toastError("Invalid application."); return; }
    const appId = row.app_id;
    const linkedRoleIds = allRoles.filter((r) => isSameId(r?.app_id, appId)).map((r) => String(r?.role_id ?? ""));

    if (isTempApplicationId(appId)) {
      const nextApps = orderedApplications
        .filter((a) => !isSameId(a?.app_id, appId))
        .map((a, i) => ({ ...a, app_order: i + 1, display_order: i + 1 }));
      setOrderedApplications(nextApps);
      setAllRoles((prev) => prev.filter((r) => !isSameId(r?.app_id, appId)));
      setPendingBatch((prev) => ({
        ...prev,
        appCreates: prev.appCreates.filter((e) => !isSameId(e?.tempId, appId)),
        appUpdates: removeObjectKey(prev.appUpdates, appId),
        appDeactivations: (prev.appDeactivations || []).filter((id) => !isSameId(id, appId)),
        roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.payload?.app_id, appId)),
        roleUpdates: linkedRoleIds.reduce((m, id) => removeObjectKey(m, id), prev.roleUpdates),
        roleDeactivations: (prev.roleDeactivations || []).filter(
          (id) => !linkedRoleIds.some((lr) => isSameId(lr, id)),
        ),
      }));
      if (isSameId(selectedApp?.app_id, appId)) updateSelectedApplicationInQuery(nextApps[0]?.app_id ?? null);
      setDialog(EMPTY_DIALOG);
      toastSuccess("Application deactivation staged for Save Batch.", "Batching");
      return;
    }

    setPendingBatch((prev) => {
      const nextRoleDeactivations = linkedRoleIds.reduce(
        (ids, id) => appendUniqueId(ids, id), prev.roleDeactivations || [],
      );
      return {
        ...prev,
        appUpdates: removeObjectKey(prev.appUpdates, appId),
        appDeactivations: appendUniqueId(prev.appDeactivations, appId),
        roleCreates: prev.roleCreates.filter((e) => !isSameId(e?.payload?.app_id, appId)),
        roleUpdates: linkedRoleIds.reduce((m, id) => removeObjectKey(m, id), prev.roleUpdates),
        roleDeactivations: nextRoleDeactivations,
      };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Application deactivation staged for Save Batch.", "Batching");
  }, [allRoles, dialog, orderedApplications, selectedApp?.app_id, updateSelectedApplicationInQuery]);

  const roleActions = useRoleActions({
    isSavingOrder, isMutatingAction, isSelectedAppPendingDeactivation, selectedApp,
    dialog, roleDraft, pendingDeactivatedRoleIds,
    setAllRoles, setPendingBatch, setDialog, setRoleDraft,
  });

  // -- row editing mode
  const startEditingApp = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const id = String(row?.app_id ?? "");
    setEditingAppId((prev) => prev === id ? null : id);
  }, [isMutatingAction, isSavingOrder]);

  const stopEditingApp = useCallback(() => { setEditingAppId(null); }, []);

  const startEditingRole = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const id = String(row?.role_id ?? "");
    setEditingRoleId((prev) => prev === id ? null : id);
  }, [isMutatingAction, isSavingOrder]);

  const stopEditingRole = useCallback(() => { setEditingRoleId(null); }, []);

  // -- inline edit: applications
  const handleInlineEditApplication = useCallback((row, key, value) => {
    const appId = row?.app_id;
    if (!appId || isSavingOrder || isMutatingAction) return;

    setOrderedApplications((prev) =>
      prev.map((a, i) => isSameId(a?.app_id, appId)
        ? mapApplicationRow({ ...a, [key]: value || null }, i) : a),
    );

    setPendingBatch((prev) => {
      if (isTempApplicationId(appId)) {
        return {
          ...prev,
          appCreates: prev.appCreates.map((e) => isSameId(e?.tempId, appId)
            ? { ...e, payload: { ...e.payload, [key]: value || null } } : e),
        };
      }
      return {
        ...prev,
        appUpdates: {
          ...prev.appUpdates,
          [String(appId)]: mergeUpdatePatch(prev.appUpdates?.[String(appId)], { [key]: value || null }),
        },
      };
    });
  }, [isMutatingAction, isSavingOrder]);

  // -- inline edit: roles
  const handleInlineEditRole = useCallback((row, key, value) => {
    const roleId = row?.role_id;
    if (!roleId || isSavingOrder || isMutatingAction) return;

    setAllRoles((prev) =>
      prev.map((r, i) => isSameId(r?.role_id, roleId)
        ? mapRoleRow({ ...r, [key]: value || null }, i) : r),
    );

    setPendingBatch((prev) => {
      if (isTempRoleId(roleId)) {
        return {
          ...prev,
          roleCreates: prev.roleCreates.map((e) => isSameId(e?.tempId, roleId)
            ? { ...e, payload: { ...e.payload, [key]: value || null } } : e),
        };
      }
      return {
        ...prev,
        roleUpdates: {
          ...prev.roleUpdates,
          [String(roleId)]: mergeUpdatePatch(prev.roleUpdates?.[String(roleId)], { [key]: value || null }),
        },
      };
    });
  }, [isMutatingAction, isSavingOrder]);

  return {
    decoratedApplications, decoratedSelectedAppRoles, dialog, applicationDraft, roleDraft,
    isSavingOrder, isMutatingAction, pendingSummary, hasPendingChanges,
    pendingDeactivatedAppIds, pendingDeactivatedRoleIds,
    pendingHardDeletedAppIds, pendingHardDeletedRoleIds,
    selectedApp, isSelectedAppPendingDeactivation,
    setDialog, setApplicationDraft, setRoleDraft,
    handleApplicationRowClick, handleApplicationReorder, handleCancelOrderChanges, handleSaveOrderChanges,
    closeDialog, openEditApplicationDialog, openToggleApplicationDialog,
    openDeactivateApplicationDialog, stageHardDeleteApplication, unstageHardDeleteApplication, openAddApplicationDialog,
    submitAddApplication, submitEditApplication, submitToggleApplication, submitDeactivateApplication,
    handleInlineEditApplication, handleInlineEditRole,
    editingAppId, startEditingApp, stopEditingApp,
    editingRoleId, startEditingRole, stopEditingRole,
    ...roleActions,
  };
}
