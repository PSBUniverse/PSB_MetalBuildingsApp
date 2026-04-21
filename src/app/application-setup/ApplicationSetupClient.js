"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Card, Input, Modal, SetupTable, toastError, toastSuccess } from "@/shared/components/ui";
import {
  getApplicationDescription,
  getApplicationDisplayName,
  getApplicationDisplayOrder,
  isApplicationActive,
} from "@/modules/application-setup/model/application.model.js";
import {
  getRoleDescription,
  getRoleDisplayName,
  isRoleActive,
} from "@/modules/application-setup/model/role.model.js";

function parseAppId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  const asNumber = Number(text);
  return Number.isFinite(asNumber) ? asNumber : text;
}

function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function buildOrderSignature(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => String(row?.app_id || "")).join("|");
}

function mapApplicationRow(app, index) {
  return {
    ...app,
    id: app?.app_id ?? `app-${index}`,
    app_name: getApplicationDisplayName(app),
    app_desc: getApplicationDescription(app),
    app_order: getApplicationDisplayOrder(app, index + 1),
    is_active_bool: isApplicationActive(app),
  };
}

function mapRoleRow(role, index) {
  return {
    ...role,
    id: role?.role_id ?? `role-${index}`,
    role_name: getRoleDisplayName(role),
    role_desc: getRoleDescription(role),
    is_active_bool: isRoleActive(role),
  };
}

function resolveErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return fallbackMessage;
}

const EMPTY_DIALOG = {
  kind: null,
  target: null,
  nextIsActive: null,
};

const TEMP_APP_PREFIX = "tmp-app-";
const TEMP_ROLE_PREFIX = "tmp-role-";

function createEmptyBatchState() {
  return {
    appCreates: [],
    appUpdates: {},
    appDeactivations: [],
    roleCreates: [],
    roleUpdates: {},
    roleDeactivations: [],
  };
}

function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTempApplicationId(value) {
  return String(value ?? "").startsWith(TEMP_APP_PREFIX);
}

function isTempRoleId(value) {
  return String(value ?? "").startsWith(TEMP_ROLE_PREFIX);
}

function removeObjectKey(objectValue, keyToRemove) {
  const normalizedKey = String(keyToRemove ?? "");
  const nextObject = {};

  Object.entries(objectValue || {}).forEach(([key, value]) => {
    if (key !== normalizedKey) {
      nextObject[key] = value;
    }
  });

  return nextObject;
}

function mergeUpdatePatch(previousPatch, nextPatch) {
  const mergedPatch = {
    ...(previousPatch || {}),
  };

  Object.entries(nextPatch || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      mergedPatch[key] = value;
    }
  });

  return mergedPatch;
}

function appendUniqueId(idList, value) {
  const normalizedValue = String(value ?? "");

  if (!normalizedValue) {
    return Array.isArray(idList) ? [...idList] : [];
  }

  const existing = Array.isArray(idList) ? idList : [];
  if (existing.some((entry) => isSameId(entry, normalizedValue))) {
    return [...existing];
  }

  return [...existing, normalizedValue];
}

function StatusBadge({ isActive }) {
  return (
    <Badge bg={isActive ? "success" : "primary"} text="light">
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export default function ApplicationSetupClient({
  applications = [],
  roles = [],
  initialSelectedAppId = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const seedApplications = useMemo(
    () =>
      (Array.isArray(applications) ? applications : [])
        .map((app, index) => mapApplicationRow(app, index))
        .sort((left, right) => {
          const orderDiff = Number(left.app_order || 0) - Number(right.app_order || 0);

          if (orderDiff !== 0) {
            return orderDiff;
          }

          return compareText(left.app_name, right.app_name);
        }),
    [applications],
  );

  const seedRoles = useMemo(
    () => (Array.isArray(roles) ? roles : []).map((role, index) => mapRoleRow(role, index)),
    [roles],
  );

  const [orderedApplications, setOrderedApplications] = useState(seedApplications);
  const [allRoles, setAllRoles] = useState(seedRoles);
  const [persistedOrderSignature, setPersistedOrderSignature] = useState(buildOrderSignature(seedApplications));
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [pendingBatch, setPendingBatch] = useState(createEmptyBatchState());
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [applicationDraft, setApplicationDraft] = useState({ name: "", desc: "" });
  const [roleDraft, setRoleDraft] = useState({ name: "", desc: "" });

  useEffect(() => {
    setOrderedApplications(seedApplications);
    setAllRoles(seedRoles);
    setPersistedOrderSignature(buildOrderSignature(seedApplications));
    setIsSavingOrder(false);
    setIsMutatingAction(false);
    setPendingBatch(createEmptyBatchState());
    setDialog(EMPTY_DIALOG);
    setApplicationDraft({ name: "", desc: "" });
    setRoleDraft({ name: "", desc: "" });
  }, [seedApplications, seedRoles]);

  const currentOrderSignature = useMemo(
    () => buildOrderSignature(orderedApplications),
    [orderedApplications],
  );

  const hasOrderChanges = persistedOrderSignature !== currentOrderSignature;

  const pendingSummary = useMemo(() => {
    const applicationAdded = pendingBatch.appCreates.length;
    const applicationEdited = Object.keys(pendingBatch.appUpdates || {}).length;
    const applicationDeactivated = pendingBatch.appDeactivations.length;
    const roleAdded = pendingBatch.roleCreates.length;
    const roleEdited = Object.keys(pendingBatch.roleUpdates || {}).length;
    const roleDeactivated = pendingBatch.roleDeactivations.length;
    const rowOrderChanged = hasOrderChanges ? 1 : 0;

    return {
      applicationAdded,
      applicationEdited,
      applicationDeactivated,
      roleAdded,
      roleEdited,
      roleDeactivated,
      rowOrderChanged,
      total:
        applicationAdded
        + applicationEdited
        + applicationDeactivated
        + roleAdded
        + roleEdited
        + roleDeactivated
        + rowOrderChanged,
    };
  }, [hasOrderChanges, pendingBatch]);

  const hasPendingChanges = pendingSummary.total > 0;

  const pendingDeactivatedAppIds = useMemo(
    () => new Set((pendingBatch.appDeactivations || []).map((id) => String(id ?? ""))),
    [pendingBatch.appDeactivations],
  );

  const pendingDeactivatedRoleIds = useMemo(
    () => new Set((pendingBatch.roleDeactivations || []).map((id) => String(id ?? ""))),
    [pendingBatch.roleDeactivations],
  );

  const selectedAppId = useMemo(() => {
    const appFromQuery = parseAppId(searchParams?.get("app"));

    if (appFromQuery !== null) {
      return appFromQuery;
    }

    if (initialSelectedAppId !== null && initialSelectedAppId !== undefined && initialSelectedAppId !== "") {
      return initialSelectedAppId;
    }

    return orderedApplications[0]?.app_id ?? null;
  }, [initialSelectedAppId, orderedApplications, searchParams]);

  const selectedApp = useMemo(
    () =>
      orderedApplications.find((app) => isSameId(app?.app_id, selectedAppId))
      ?? orderedApplications[0]
      ?? null,
    [orderedApplications, selectedAppId],
  );

  const isSelectedAppPendingDeactivation = useMemo(
    () => pendingDeactivatedAppIds.has(String(selectedApp?.app_id ?? "")),
    [pendingDeactivatedAppIds, selectedApp?.app_id],
  );

  const selectedAppRoles = useMemo(
    () =>
      allRoles
        .filter((role) => isSameId(role?.app_id, selectedApp?.app_id))
        .sort((left, right) => compareText(left.role_name, right.role_name)),
    [allRoles, selectedApp?.app_id],
  );

  const decoratedApplications = useMemo(() => {
    const createdIds = new Set((pendingBatch.appCreates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatedIds = new Set(Object.keys(pendingBatch.appUpdates || {}));
    const deactivatedIds = new Set((pendingBatch.appDeactivations || []).map((entry) => String(entry ?? "")));

    return orderedApplications.map((row) => {
      const id = String(row?.app_id ?? "");

      if (deactivatedIds.has(id)) {
        return {
          ...row,
          __batchState: "deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "created",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "updated",
        };
      }

      return {
        ...row,
        __batchState: "none",
      };
    });
  }, [orderedApplications, pendingBatch.appCreates, pendingBatch.appDeactivations, pendingBatch.appUpdates]);

  const decoratedSelectedAppRoles = useMemo(() => {
    const createdIds = new Set((pendingBatch.roleCreates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatedIds = new Set(Object.keys(pendingBatch.roleUpdates || {}));
    const deactivatedIds = new Set((pendingBatch.roleDeactivations || []).map((entry) => String(entry ?? "")));

    return selectedAppRoles.map((row) => {
      const id = String(row?.role_id ?? "");

      if (deactivatedIds.has(id)) {
        return {
          ...row,
          __batchState: "deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "created",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "updated",
        };
      }

      return {
        ...row,
        __batchState: "none",
      };
    });
  }, [pendingBatch.roleCreates, pendingBatch.roleDeactivations, pendingBatch.roleUpdates, selectedAppRoles]);

  const updateSelectedApplicationInQuery = useCallback(
    (appId) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || "");

      if (appId === undefined || appId === null || appId === "") {
        nextParams.delete("app");
      } else {
        nextParams.set("app", String(appId));
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleApplicationRowClick = useCallback(
    (row) => {
      updateSelectedApplicationInQuery(row?.app_id);
    },
    [updateSelectedApplicationInQuery],
  );

  const requestJson = useCallback(async (url, options, fallbackMessage) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok === false) {
      throw new Error(resolveErrorMessage(payload, fallbackMessage));
    }

    return payload;
  }, []);

  const handleApplicationReorder = useCallback((nextRows) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    const normalizedRows = (Array.isArray(nextRows) ? nextRows : []).map((row, index) => ({
      ...row,
      app_order: index + 1,
      display_order: index + 1,
    }));

    setOrderedApplications(normalizedRows);
  }, [isMutatingAction, isSavingOrder]);

  const handleCancelOrderChanges = useCallback(() => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setOrderedApplications(seedApplications);
    setAllRoles(seedRoles);
    setPendingBatch(createEmptyBatchState());
    setPersistedOrderSignature(buildOrderSignature(seedApplications));
    setDialog(EMPTY_DIALOG);
    setApplicationDraft({ name: "", desc: "" });
    setRoleDraft({ name: "", desc: "" });
    updateSelectedApplicationInQuery(seedApplications[0]?.app_id ?? null);
  }, [
    isMutatingAction,
    isSavingOrder,
    seedApplications,
    seedRoles,
    updateSelectedApplicationInQuery,
  ]);

  const handleSaveOrderChanges = useCallback(async () => {
    if (!hasPendingChanges || isSavingOrder || isMutatingAction) {
      return;
    }

    setIsSavingOrder(true);
    setIsMutatingAction(true);

    try {
      const appIdMap = new Map();
      const deactivatedAppSet = new Set((pendingBatch.appDeactivations || []).map((id) => String(id ?? "")));
      const deactivatedRoleSet = new Set((pendingBatch.roleDeactivations || []).map((id) => String(id ?? "")));

      for (const createEntry of pendingBatch.appCreates || []) {
        const payload = await requestJson(
          "/api/application-setup/applications",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createEntry.payload),
          },
          "Failed to create application.",
        );

        const createdId = payload?.application?.app_id;

        if (createdId === undefined || createdId === null || createdId === "") {
          throw new Error("Created application response is invalid.");
        }

        appIdMap.set(String(createEntry.tempId), createdId);
      }

      for (const [appId, updates] of Object.entries(pendingBatch.appUpdates || {})) {
        if (deactivatedAppSet.has(String(appId))) {
          continue;
        }

        const updateKeys = Object.keys(updates || {});
        if (updateKeys.length === 0) {
          continue;
        }

        const resolvedAppId = appIdMap.get(String(appId)) ?? appId;

        await requestJson(
          `/api/application-setup/applications/${encodeURIComponent(String(resolvedAppId))}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          },
          "Failed to update application.",
        );
      }

      for (const createEntry of pendingBatch.roleCreates || []) {
        const draftAppId = createEntry?.payload?.app_id;
        const resolvedAppId = appIdMap.get(String(draftAppId ?? "")) ?? draftAppId;

        if (resolvedAppId === undefined || resolvedAppId === null || resolvedAppId === "") {
          continue;
        }

        if (deactivatedAppSet.has(String(resolvedAppId))) {
          continue;
        }

        await requestJson(
          "/api/application-setup/roles",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...createEntry.payload,
              app_id: resolvedAppId,
            }),
          },
          "Failed to create role.",
        );
      }

      for (const [roleId, updates] of Object.entries(pendingBatch.roleUpdates || {})) {
        if (deactivatedRoleSet.has(String(roleId))) {
          continue;
        }

        const updateKeys = Object.keys(updates || {});
        if (updateKeys.length === 0) {
          continue;
        }

        await requestJson(
          `/api/application-setup/roles/${encodeURIComponent(String(roleId))}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          },
          "Failed to update role.",
        );
      }

      for (const roleId of pendingBatch.roleDeactivations || []) {
        if (isTempRoleId(roleId)) {
          continue;
        }

        await requestJson(
          `/api/application-setup/roles/${encodeURIComponent(String(roleId))}`,
          {
            method: "DELETE",
          },
          "Failed to deactivate role.",
        );
      }

      for (const appId of pendingBatch.appDeactivations || []) {
        if (isTempApplicationId(appId)) {
          continue;
        }

        await requestJson(
          `/api/application-setup/applications/${encodeURIComponent(String(appId))}`,
          {
            method: "DELETE",
          },
          "Failed to deactivate application.",
        );
      }

      const orderedPersistedAppIds = orderedApplications
        .map((app) => app?.app_id)
        .map((appId) => appIdMap.get(String(appId ?? "")) ?? appId)
        .filter((appId) => appId !== undefined && appId !== null && appId !== "")
        .filter((appId) => !deactivatedAppSet.has(String(appId)))
        .filter((appId) => !isTempApplicationId(appId));

      if (orderedPersistedAppIds.length > 0) {
        await requestJson(
          "/api/application-setup/order",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ appIds: orderedPersistedAppIds }),
          },
          "Failed to save application order.",
        );
      }

      setPersistedOrderSignature(currentOrderSignature);
      setPendingBatch(createEmptyBatchState());

      const selectedKey = String(selectedApp?.app_id ?? "");
      const selectedResolved = appIdMap.get(selectedKey) ?? selectedApp?.app_id ?? null;
      const nextSelectedId =
        selectedResolved && !deactivatedAppSet.has(String(selectedResolved))
          ? selectedResolved
          : (orderedPersistedAppIds[0] ?? null);

      updateSelectedApplicationInQuery(nextSelectedId);
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally {
      setIsMutatingAction(false);
      setIsSavingOrder(false);
    }
  }, [
    currentOrderSignature,
    hasPendingChanges,
    isMutatingAction,
    isSavingOrder,
    orderedApplications,
    pendingBatch,
    pendingSummary.total,
    requestJson,
    router,
    selectedApp?.app_id,
    updateSelectedApplicationInQuery,
  ]);

  const closeDialog = useCallback(() => {
    if (isMutatingAction) {
      return;
    }

    setDialog(EMPTY_DIALOG);
  }, [isMutatingAction]);

  const openEditApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setApplicationDraft({
      name: String(row?.app_name || ""),
      desc: String(row?.app_desc || ""),
    });

    setDialog({
      kind: "edit-application",
      target: row,
      nextIsActive: null,
    });
  }, [isMutatingAction, isSavingOrder]);

  const openToggleApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setDialog({
      kind: "toggle-application",
      target: row,
      nextIsActive: !Boolean(row?.is_active_bool),
    });
  }, [isMutatingAction, isSavingOrder]);

  const openDeactivateApplicationDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setDialog({
      kind: "deactivate-application",
      target: row,
      nextIsActive: null,
    });
  }, [isMutatingAction, isSavingOrder]);

  const openAddApplicationDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setApplicationDraft({
      name: "",
      desc: "",
    });

    setDialog({
      kind: "add-application",
      target: null,
      nextIsActive: true,
    });
  }, [isMutatingAction, isSavingOrder]);

  const openEditRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setRoleDraft({
      name: String(row?.role_name || ""),
      desc: String(row?.role_desc || ""),
    });

    setDialog({
      kind: "edit-role",
      target: row,
      nextIsActive: null,
    });
  }, [isMutatingAction, isSavingOrder]);

  const openToggleRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setDialog({
      kind: "toggle-role",
      target: row,
      nextIsActive: !Boolean(row?.is_active_bool),
    });
  }, [isMutatingAction, isSavingOrder]);

  const openDeactivateRoleDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    setDialog({
      kind: "deactivate-role",
      target: row,
      nextIsActive: null,
    });
  }, [isMutatingAction, isSavingOrder]);

  const openAddRoleDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) {
      return;
    }

    if (!selectedApp?.app_id) {
      toastError("Select an application before adding a role.");
      return;
    }

    if (isSelectedAppPendingDeactivation) {
      toastError("Selected application is staged for deactivation. Save or cancel batch before adding a role.");
      return;
    }

    setRoleDraft({
      name: "",
      desc: "",
    });

    setDialog({
      kind: "add-role",
      target: {
        app_id: selectedApp.app_id,
        app_name: selectedApp.app_name,
      },
      nextIsActive: true,
    });
  }, [
    isMutatingAction,
    isSavingOrder,
    isSelectedAppPendingDeactivation,
    selectedApp?.app_id,
    selectedApp?.app_name,
  ]);

  const submitAddApplication = useCallback(() => {
    const appName = String(applicationDraft.name || "").trim();

    if (!appName) {
      toastError("Application name is required.");
      return;
    }
    const appDesc = String(applicationDraft.desc || "").trim();
    const tempAppId = createTempId(TEMP_APP_PREFIX);

    setOrderedApplications((previous) => [
      ...previous,
      mapApplicationRow(
        {
          app_id: tempAppId,
          app_name: appName,
          app_desc: appDesc,
          is_active: true,
          app_order: previous.length + 1,
          display_order: previous.length + 1,
        },
        previous.length,
      ),
    ]);

    setPendingBatch((previous) => ({
      ...previous,
      appCreates: [
        ...previous.appCreates,
        {
          tempId: tempAppId,
          payload: {
            app_name: appName,
            app_desc: appDesc,
            is_active: true,
          },
        },
      ],
    }));

    updateSelectedApplicationInQuery(tempAppId);
    setDialog(EMPTY_DIALOG);
    setApplicationDraft({ name: "", desc: "" });
    toastSuccess("Application staged for Save Batch.", "Batching");
  }, [applicationDraft.desc, applicationDraft.name, updateSelectedApplicationInQuery]);

  const submitEditApplication = useCallback(() => {
    const row = dialog?.target;

    if (!row?.app_id) {
      toastError("Invalid application.");
      return;
    }

    const appName = String(applicationDraft.name || "").trim();
    if (!appName) {
      toastError("Application name is required.");
      return;
    }
    const appDesc = String(applicationDraft.desc || "").trim();
    const appId = row.app_id;

    setOrderedApplications((previous) =>
      previous.map((app, index) => {
        if (!isSameId(app?.app_id, appId)) {
          return app;
        }

        return mapApplicationRow(
          {
            ...app,
            app_name: appName,
            app_desc: appDesc,
          },
          index,
        );
      }),
    );

    setPendingBatch((previous) => {
      if (isTempApplicationId(appId)) {
        return {
          ...previous,
          appCreates: previous.appCreates.map((entry) => {
            if (!isSameId(entry?.tempId, appId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                app_name: appName,
                app_desc: appDesc,
              },
            };
          }),
          appUpdates: removeObjectKey(previous.appUpdates, appId),
        };
      }

      return {
        ...previous,
        appUpdates: {
          ...previous.appUpdates,
          [String(appId)]: mergeUpdatePatch(previous.appUpdates?.[String(appId)], {
            app_name: appName,
            app_desc: appDesc,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Application update staged for Save Batch.", "Batching");
  }, [applicationDraft.desc, applicationDraft.name, dialog]);

  const submitToggleApplication = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);

    if (!row?.app_id) {
      toastError("Invalid application.");
      return;
    }
    const appId = row.app_id;

    setOrderedApplications((previous) =>
      previous.map((app, index) => {
        if (!isSameId(app?.app_id, appId)) {
          return app;
        }

        return mapApplicationRow(
          {
            ...app,
            is_active: nextIsActive,
          },
          index,
        );
      }),
    );

    setPendingBatch((previous) => {
      if (isTempApplicationId(appId)) {
        return {
          ...previous,
          appCreates: previous.appCreates.map((entry) => {
            if (!isSameId(entry?.tempId, appId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                is_active: nextIsActive,
              },
            };
          }),
          appUpdates: removeObjectKey(previous.appUpdates, appId),
        };
      }

      return {
        ...previous,
        appUpdates: {
          ...previous.appUpdates,
          [String(appId)]: mergeUpdatePatch(previous.appUpdates?.[String(appId)], {
            is_active: nextIsActive,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(`Application ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateApplication = useCallback(() => {
    const row = dialog?.target;

    if (!row?.app_id) {
      toastError("Invalid application.");
      return;
    }
    const appId = row.app_id;
    const linkedRoleIds = allRoles
      .filter((role) => isSameId(role?.app_id, appId))
      .map((role) => String(role?.role_id ?? ""));

    if (isTempApplicationId(appId)) {
      const nextApplications = orderedApplications
        .filter((app) => !isSameId(app?.app_id, appId))
        .map((app, index) => ({
          ...app,
          app_order: index + 1,
          display_order: index + 1,
        }));

      setOrderedApplications(nextApplications);
      setAllRoles((previous) => previous.filter((role) => !isSameId(role?.app_id, appId)));

      setPendingBatch((previous) => ({
        ...previous,
        appCreates: previous.appCreates.filter((entry) => !isSameId(entry?.tempId, appId)),
        appUpdates: removeObjectKey(previous.appUpdates, appId),
        appDeactivations: (previous.appDeactivations || []).filter((deactivatedId) => !isSameId(deactivatedId, appId)),
        roleCreates: previous.roleCreates.filter((entry) => !isSameId(entry?.payload?.app_id, appId)),
        roleUpdates: linkedRoleIds.reduce(
          (mapValue, roleId) => removeObjectKey(mapValue, roleId),
          previous.roleUpdates,
        ),
        roleDeactivations: (previous.roleDeactivations || []).filter(
          (roleId) => !linkedRoleIds.some((linkedRoleId) => isSameId(linkedRoleId, roleId)),
        ),
      }));

      if (isSameId(selectedApp?.app_id, appId)) {
        updateSelectedApplicationInQuery(nextApplications[0]?.app_id ?? null);
      }

      setDialog(EMPTY_DIALOG);
      toastSuccess("Application deactivation staged for Save Batch.", "Batching");
      return;
    }

    setPendingBatch((previous) => {
      const nextRoleDeactivations = linkedRoleIds.reduce(
        (ids, roleId) => appendUniqueId(ids, roleId),
        previous.roleDeactivations || [],
      );

      return {
        ...previous,
        appUpdates: removeObjectKey(previous.appUpdates, appId),
        appDeactivations: appendUniqueId(previous.appDeactivations, appId),
        roleCreates: previous.roleCreates.filter((entry) => !isSameId(entry?.payload?.app_id, appId)),
        roleUpdates: linkedRoleIds.reduce(
          (mapValue, roleId) => removeObjectKey(mapValue, roleId),
          previous.roleUpdates,
        ),
        roleDeactivations: nextRoleDeactivations,
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Application deactivation staged for Save Batch.", "Batching");
  }, [allRoles, dialog, orderedApplications, selectedApp?.app_id, updateSelectedApplicationInQuery]);

  const submitEditRole = useCallback(() => {
    const row = dialog?.target;

    if (!row?.role_id) {
      toastError("Invalid role.");
      return;
    }

    const roleName = String(roleDraft.name || "").trim();
    if (!roleName) {
      toastError("Role name is required.");
      return;
    }
    const roleDesc = String(roleDraft.desc || "").trim();
    const roleId = row.role_id;

    setAllRoles((previous) =>
      previous.map((role, index) => {
        if (!isSameId(role?.role_id, roleId)) {
          return role;
        }

        return mapRoleRow(
          {
            ...role,
            role_name: roleName,
            role_desc: roleDesc,
          },
          index,
        );
      }),
    );

    setPendingBatch((previous) => {
      if (isTempRoleId(roleId)) {
        return {
          ...previous,
          roleCreates: previous.roleCreates.map((entry) => {
            if (!isSameId(entry?.tempId, roleId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                role_name: roleName,
                role_desc: roleDesc,
              },
            };
          }),
          roleUpdates: removeObjectKey(previous.roleUpdates, roleId),
        };
      }

      return {
        ...previous,
        roleUpdates: {
          ...previous.roleUpdates,
          [String(roleId)]: mergeUpdatePatch(previous.roleUpdates?.[String(roleId)], {
            role_name: roleName,
            role_desc: roleDesc,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Role update staged for Save Batch.", "Batching");
  }, [dialog, roleDraft.desc, roleDraft.name]);

  const submitToggleRole = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);

    if (!row?.role_id) {
      toastError("Invalid role.");
      return;
    }
    const roleId = row.role_id;

    setAllRoles((previous) =>
      previous.map((role, index) => {
        if (!isSameId(role?.role_id, roleId)) {
          return role;
        }

        return mapRoleRow(
          {
            ...role,
            is_active: nextIsActive,
          },
          index,
        );
      }),
    );

    setPendingBatch((previous) => {
      if (isTempRoleId(roleId)) {
        return {
          ...previous,
          roleCreates: previous.roleCreates.map((entry) => {
            if (!isSameId(entry?.tempId, roleId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                is_active: nextIsActive,
              },
            };
          }),
          roleUpdates: removeObjectKey(previous.roleUpdates, roleId),
        };
      }

      return {
        ...previous,
        roleUpdates: {
          ...previous.roleUpdates,
          [String(roleId)]: mergeUpdatePatch(previous.roleUpdates?.[String(roleId)], {
            is_active: nextIsActive,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(`Role ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateRole = useCallback(() => {
    const row = dialog?.target;

    if (!row?.role_id) {
      toastError("Invalid role.");
      return;
    }
    const roleId = row.role_id;

    if (isTempRoleId(roleId)) {
      setAllRoles((items) => items.filter((role) => !isSameId(role?.role_id, roleId)));
    }

    setPendingBatch((previous) => {
      if (isTempRoleId(roleId)) {
        return {
          ...previous,
          roleCreates: previous.roleCreates.filter((entry) => !isSameId(entry?.tempId, roleId)),
          roleUpdates: removeObjectKey(previous.roleUpdates, roleId),
          roleDeactivations: (previous.roleDeactivations || []).filter((deactivatedId) => !isSameId(deactivatedId, roleId)),
        };
      }

      return {
        ...previous,
        roleUpdates: removeObjectKey(previous.roleUpdates, roleId),
        roleDeactivations: appendUniqueId(previous.roleDeactivations, roleId),
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Role deactivation staged for Save Batch.", "Batching");
  }, [dialog]);

  const submitAddRole = useCallback(() => {
    const target = dialog?.target;

    if (!target?.app_id) {
      toastError("Select an application before adding a role.");
      return;
    }

    const roleName = String(roleDraft.name || "").trim();
    if (!roleName) {
      toastError("Role name is required.");
      return;
    }
    const roleDesc = String(roleDraft.desc || "").trim();
    const tempRoleId = createTempId(TEMP_ROLE_PREFIX);

    setAllRoles((previous) => [
      ...previous,
      mapRoleRow(
        {
          role_id: tempRoleId,
          app_id: target.app_id,
          role_name: roleName,
          role_desc: roleDesc,
          is_active: true,
        },
        previous.length,
      ),
    ]);

    setPendingBatch((previous) => ({
      ...previous,
      roleCreates: [
        ...previous.roleCreates,
        {
          tempId: tempRoleId,
          payload: {
            app_id: target.app_id,
            role_name: roleName,
            role_desc: roleDesc,
            is_active: true,
          },
        },
      ],
    }));

    setDialog(EMPTY_DIALOG);
    setRoleDraft({ name: "", desc: "" });
    toastSuccess("Role staged for Save Batch.", "Batching");
  }, [dialog, roleDraft.desc, roleDraft.name]);

  const applicationColumns = useMemo(
    () => [
      {
        key: "app_name",
        label: "Application Name",
        width: "30%",
        render: (row) => {
          const batchState = String(row?.__batchState || "");
          const markerText =
            batchState === "deleted"
              ? "Deactivated"
              : (batchState === "created" ? "New" : (batchState === "updated" ? "Edited" : ""));
          const markerClass =
            batchState === "deleted"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "created"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "updated" ? "psb-batch-marker psb-batch-marker-edited" : ""));
          const textClassName = [
            isSameId(row?.app_id, selectedApp?.app_id) ? "fw-semibold text-primary" : "",
            batchState === "deleted" ? "text-decoration-line-through" : "",
          ].filter(Boolean).join(" ");

          return (
            <span className={textClassName}>
              {row?.app_name || "--"}
              {markerText ? <span className={markerClass}>{markerText}</span> : null}
            </span>
          );
        },
      },
      {
        key: "app_order",
        label: "Order",
        width: "10%",
        align: "center",
      },
      {
        key: "app_desc",
        label: "Description",
        width: "38%",
      },
      {
        key: "is_active_bool",
        label: "Active",
        width: "12%",
        align: "center",
        render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
      },
    ],
    [selectedApp?.app_id],
  );

  const roleColumns = useMemo(
    () => [
      {
        key: "role_name",
        label: "Role Name",
        width: "30%",
        render: (row) => {
          const batchState = String(row?.__batchState || "");
          const markerText =
            batchState === "deleted"
              ? "Deactivated"
              : (batchState === "created" ? "New" : (batchState === "updated" ? "Edited" : ""));
          const markerClass =
            batchState === "deleted"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "created"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "updated" ? "psb-batch-marker psb-batch-marker-edited" : ""));

          return (
            <span className={batchState === "deleted" ? "text-decoration-line-through" : ""}>
              {row?.role_name || "--"}
              {markerText ? <span className={markerClass}>{markerText}</span> : null}
            </span>
          );
        },
      },
      {
        key: "role_desc",
        label: "Description",
        width: "44%",
      },
      {
        key: "is_active_bool",
        label: "Active",
        width: "16%",
        align: "center",
        render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
      },
    ],
    [],
  );

  const applicationActions = useMemo(
    () => [
      {
        key: "edit-application",
        label: "Edit",
        type: "secondary",
        icon: "pencil-square",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedAppIds.has(String(row?.app_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openEditApplicationDialog(row),
      },
      {
        key: "disable-application",
        label: "Disable",
        type: "secondary",
        icon: "slash-circle",
        visible: (row) => Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedAppIds.has(String(row?.app_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openToggleApplicationDialog(row),
      },
      {
        key: "enable-application",
        label: "Enable",
        type: "secondary",
        icon: "check-circle",
        visible: (row) => !Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedAppIds.has(String(row?.app_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openToggleApplicationDialog(row),
      },
      {
        key: "deactivate-application",
        label: "Deactivate",
        type: "danger",
        icon: "trash",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedAppIds.has(String(row?.app_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openDeactivateApplicationDialog(row),
      },
    ],
    [
      isMutatingAction,
      isSavingOrder,
      openDeactivateApplicationDialog,
      openEditApplicationDialog,
      openToggleApplicationDialog,
      pendingDeactivatedAppIds,
    ],
  );

  const roleActions = useMemo(
    () => [
      {
        key: "edit-role",
        label: "Edit",
        type: "secondary",
        icon: "pencil-square",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedRoleIds.has(String(row?.role_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openEditRoleDialog(row),
      },
      {
        key: "disable-role",
        label: "Disable",
        type: "secondary",
        icon: "slash-circle",
        visible: (row) => Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedRoleIds.has(String(row?.role_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openToggleRoleDialog(row),
      },
      {
        key: "enable-role",
        label: "Enable",
        type: "secondary",
        icon: "check-circle",
        visible: (row) => !Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedRoleIds.has(String(row?.role_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openToggleRoleDialog(row),
      },
      {
        key: "deactivate-role",
        label: "Deactivate",
        type: "danger",
        icon: "trash",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedRoleIds.has(String(row?.role_id ?? ""));
          return isSavingOrder || isMutatingAction || isPendingDeactivation;
        },
        onClick: (row) => openDeactivateRoleDialog(row),
      },
    ],
    [
      isMutatingAction,
      isSavingOrder,
      openDeactivateRoleDialog,
      openEditRoleDialog,
      openToggleRoleDialog,
      pendingDeactivatedRoleIds,
    ],
  );

  const dialogTitle =
    dialog.kind === "add-application"
      ? "Add Application"
      : dialog.kind === "edit-application"
      ? "Edit Application"
      : dialog.kind === "toggle-application"
        ? `${dialog?.nextIsActive ? "Enable" : "Disable"} Application`
        : dialog.kind === "deactivate-application"
          ? "Deactivate Application"
          : dialog.kind === "edit-role"
            ? "Edit Role"
            : dialog.kind === "toggle-role"
              ? `${dialog?.nextIsActive ? "Enable" : "Disable"} Role`
              : dialog.kind === "deactivate-role"
                ? "Deactivate Role"
                : dialog.kind === "add-role"
                  ? "Add Role"
                  : "";

  return (
    <main className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Configuration and Settings</h1>
          <p className="text-muted mb-0">Manage setup tables and mapping assignments for User Master.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span className={`small ${hasPendingChanges ? "text-warning-emphasis fw-semibold" : "text-muted"}`}>
            {isMutatingAction || isSavingOrder
              ? "Saving batch..."
              : (hasPendingChanges ? `${pendingSummary.total} staged change(s)` : "No changes")}
          </span>
          {hasPendingChanges ? (
            <>
              {pendingSummary.applicationAdded + pendingSummary.roleAdded > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-added">
                  +{pendingSummary.applicationAdded + pendingSummary.roleAdded} Added
                </span>
              ) : null}
              {pendingSummary.applicationEdited + pendingSummary.roleEdited > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-edited">
                  ~{pendingSummary.applicationEdited + pendingSummary.roleEdited} Edited
                </span>
              ) : null}
              {pendingSummary.applicationDeactivated + pendingSummary.roleDeactivated > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-deleted">
                  -{pendingSummary.applicationDeactivated + pendingSummary.roleDeactivated} Deactivated
                </span>
              ) : null}
              {pendingSummary.rowOrderChanged > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-order">Reordered</span>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isSavingOrder}
            disabled={!hasPendingChanges || isSavingOrder || isMutatingAction}
            onClick={handleSaveOrderChanges}
          >
            Save Batch
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!hasPendingChanges || isSavingOrder || isMutatingAction}
            onClick={handleCancelOrderChanges}
          >
            Cancel Batch
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSavingOrder || isMutatingAction}
            onClick={openAddApplicationDialog}
          >
            Add Application
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSavingOrder || isMutatingAction || !selectedApp?.app_id || isSelectedAppPendingDeactivation}
            onClick={openAddRoleDialog}
          >
            Add Role
          </Button>
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-6">
          <Card title="Applications" subtitle="Drag the grip icon in Actions to reorder applications.">
            <SetupTable
              columns={applicationColumns}
              rows={decoratedApplications}
              rowIdKey="app_id"
              selectedRowId={selectedApp?.app_id ?? null}
              onRowClick={handleApplicationRowClick}
              actions={applicationActions}
              draggable={!isSavingOrder && !isMutatingAction}
              onReorder={handleApplicationReorder}
              emptyMessage="No applications found."
            />
          </Card>
        </div>

        <div className="col-12 col-xl-6">
          <Card
            title={selectedApp ? `Roles for: ${selectedApp.app_name}` : "Roles"}
            subtitle={selectedApp ? "Application-scoped roles" : "Click an application row to view its roles."}
          >
            {selectedApp ? (
              <SetupTable
                columns={roleColumns}
                rows={decoratedSelectedAppRoles}
                rowIdKey="role_id"
                actions={roleActions}
                emptyMessage="No roles assigned to this application."
              />
            ) : (
              <div className="notice-banner notice-banner-info mb-0">Click an application row to view its roles.</div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        show={Boolean(dialog.kind)}
        onHide={closeDialog}
        title={dialogTitle}
        footer={
          dialog.kind === "add-application" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitAddApplication} loading={isMutatingAction}>
                Add Application
              </Button>
            </>
          ) : dialog.kind === "edit-application" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitEditApplication} loading={isMutatingAction}>
                Save
              </Button>
            </>
          ) : dialog.kind === "edit-role" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitEditRole} loading={isMutatingAction}>
                Save
              </Button>
            </>
          ) : dialog.kind === "add-role" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitAddRole} loading={isMutatingAction}>
                Add Role
              </Button>
            </>
          ) : dialog.kind === "toggle-application" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={submitToggleApplication} loading={isMutatingAction}>
                {dialog?.nextIsActive ? "Enable" : "Disable"}
              </Button>
            </>
          ) : dialog.kind === "toggle-role" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={submitToggleRole} loading={isMutatingAction}>
                {dialog?.nextIsActive ? "Enable" : "Disable"}
              </Button>
            </>
          ) : dialog.kind === "deactivate-application" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={submitDeactivateApplication} loading={isMutatingAction}>
                Deactivate Application
              </Button>
            </>
          ) : dialog.kind === "deactivate-role" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={submitDeactivateRole} loading={isMutatingAction}>
                Deactivate Role
              </Button>
            </>
          ) : null
        }
      >
        {dialog.kind === "add-application" ? (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label mb-1">Application Name</label>
              <Input
                value={applicationDraft.name}
                onChange={(event) =>
                  setApplicationDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter application name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Description</label>
              <Input
                as="textarea"
                rows={3}
                value={applicationDraft.desc}
                onChange={(event) =>
                  setApplicationDraft((previous) => ({
                    ...previous,
                    desc: event.target.value,
                  }))
                }
                placeholder="Enter application description"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "edit-application" ? (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label mb-1">Application Name</label>
              <Input
                value={applicationDraft.name}
                onChange={(event) =>
                  setApplicationDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter application name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Description</label>
              <Input
                as="textarea"
                rows={3}
                value={applicationDraft.desc}
                onChange={(event) =>
                  setApplicationDraft((previous) => ({
                    ...previous,
                    desc: event.target.value,
                  }))
                }
                placeholder="Enter application description"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "edit-role" ? (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label mb-1">Role Name</label>
              <Input
                value={roleDraft.name}
                onChange={(event) =>
                  setRoleDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter role name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Description</label>
              <Input
                as="textarea"
                rows={3}
                value={roleDraft.desc}
                onChange={(event) =>
                  setRoleDraft((previous) => ({
                    ...previous,
                    desc: event.target.value,
                  }))
                }
                placeholder="Enter role description"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "add-role" ? (
          <div className="d-flex flex-column gap-3">
            <div className="small text-muted">
              Creating role for <strong>{dialog?.target?.app_name || "selected application"}</strong>
            </div>
            <div>
              <label className="form-label mb-1">Role Name</label>
              <Input
                value={roleDraft.name}
                onChange={(event) =>
                  setRoleDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter role name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Description</label>
              <Input
                as="textarea"
                rows={3}
                value={roleDraft.desc}
                onChange={(event) =>
                  setRoleDraft((previous) => ({
                    ...previous,
                    desc: event.target.value,
                  }))
                }
                placeholder="Enter role description"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "toggle-application" ? (
          <p className="mb-0">
            {dialog?.nextIsActive ? "Enable" : "Disable"} application <strong>{dialog?.target?.app_name || ""}</strong>?
          </p>
        ) : null}

        {dialog.kind === "toggle-role" ? (
          <p className="mb-0">
            {dialog?.nextIsActive ? "Enable" : "Disable"} role <strong>{dialog?.target?.role_name || ""}</strong>?
          </p>
        ) : null}

        {dialog.kind === "deactivate-application" ? (
          <p className="mb-0 text-danger">
            Deactivate application <strong>{dialog?.target?.app_name || ""}</strong> and all associated roles?
          </p>
        ) : null}

        {dialog.kind === "deactivate-role" ? (
          <p className="mb-0 text-danger">
            Deactivate role <strong>{dialog?.target?.role_name || ""}</strong>?
          </p>
        ) : null}
      </Modal>
    </main>
  );
}
