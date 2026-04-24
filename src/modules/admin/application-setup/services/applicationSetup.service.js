/**
 * Application Setup Service
 * Contains business/orchestration logic for the application setup module.
 */

import {
  createApplication,
  deleteApplicationById,
  hardDeleteApplicationById,
  fetchApplicationById,
  fetchApplications,
  updateApplicationById,
  updateApplicationOrderBatch,
} from "../repo/applications.repo.js";
import {
  createRole,
  deleteRoleById,
  hardDeleteRoleById,
  fetchAllRoles,
  fetchRolesByAppId,
  updateRoleById,
} from "../repo/roles.repo.js";
import {
  getApplicationDisplayName,
  getApplicationDisplayOrder,
} from "../model/application.model.js";

const ORDER_FIELD_CANDIDATES = [
  "display_order",
  "app_order",
  "sort_order",
  "order_no",
];

function resolveOrderField(applications) {
  const sample = Array.isArray(applications) && applications.length > 0 ? applications[0] : null;

  if (!sample || typeof sample !== "object") {
    return ORDER_FIELD_CANDIDATES[0];
  }

  for (const candidate of ORDER_FIELD_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(sample, candidate)) {
      return candidate;
    }
  }

  return ORDER_FIELD_CANDIDATES[0];
}

export async function getApplicationList(supabase) {
  const applications = await fetchApplications(supabase);
  return applications
    .sort((left, right) => {
      const orderDiff = getApplicationDisplayOrder(left, Number.MAX_SAFE_INTEGER)
        - getApplicationDisplayOrder(right, Number.MAX_SAFE_INTEGER);

      if (orderDiff !== 0) return orderDiff;

      return getApplicationDisplayName(left).localeCompare(getApplicationDisplayName(right));
    });
}

export async function getRoleList(supabase) {
  return fetchAllRoles(supabase);
}

export function buildApplicationSetupViewModel(applications, roles) {
  const safeApplications = Array.isArray(applications) ? applications : [];
  const safeRoles = Array.isArray(roles) ? roles : [];

  const selectedApp = safeApplications[0] || null;
  const selectedAppId = selectedApp?.app_id;

  const appRoles = selectedApp
    ? safeRoles.filter((role) => String(role.app_id || "") === String(selectedAppId || ""))
    : [];

  return {
    applications: safeApplications,
    roles: safeRoles,
    selectedApp,
    selectedAppId,
    appRoles,
  };
}

export async function getApplicationSetupViewModel(supabase) {
  const applications = await getApplicationList(supabase);
  const roles = await getRoleList(supabase);

  return buildApplicationSetupViewModel(applications, roles);
}

export async function saveApplicationOrder(supabase, appIds) {
  const requestedIds = (Array.isArray(appIds) ? appIds : [])
    .map((id) => (typeof id === "string" && id.trim() !== "" && Number.isFinite(Number(id)) ? Number(id) : id))
    .filter((id) => id !== undefined && id !== null && id !== "");

  if (requestedIds.length === 0) {
    throw new Error("No applications supplied for ordering.");
  }

  const applications = await fetchApplications(supabase);
  const orderField = resolveOrderField(applications);
  const applicationIds = new Set(applications.map((app) => String(app?.app_id ?? "")));
  const invalidIds = requestedIds.filter((id) => !applicationIds.has(String(id)));

  if (invalidIds.length > 0) {
    throw new Error("One or more applications are invalid for order updates.");
  }

  const orderUpdates = requestedIds.map((appId, index) => ({
    appId,
    displayOrder: index + 1,
  }));

  const result = await updateApplicationOrderBatch(supabase, orderUpdates, orderField);

  return {
    orderField,
    updatedCount: result.updatedCount,
  };
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text;
}

function sanitizeOptionalText(value) {
  const text = normalizeText(value);
  return text === "" ? null : text;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return !(text === "false" || text === "0" || text === "n" || text === "no" || text === "f");
}

export async function updateApplicationRecord(supabase, appId, updates) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates || {}, "app_name")) {
    const name = normalizeText(updates.app_name);
    if (!name) {
      throw new Error("Application name is required.");
    }

    payload.app_name = name;
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "app_desc")) {
    payload.app_desc = sanitizeOptionalText(updates.app_desc);
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "is_active")) {
    payload.is_active = normalizeBoolean(updates.is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No valid application updates supplied.");
  }

  return updateApplicationById(supabase, appId, payload);
}

export async function deleteApplicationRecord(supabase, appId) {
  const roles = await fetchRolesByAppId(supabase, appId);

  for (const role of roles) {
    await deleteRoleById(supabase, role.role_id);
  }

  await deleteApplicationById(supabase, appId);

  return {
    deletedRoleCount: roles.length,
    deactivatedRoleCount: roles.length,
    deactivated: true,
    appId,
  };
}

export async function updateRoleRecord(supabase, roleId, updates) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates || {}, "role_name")) {
    const roleName = normalizeText(updates.role_name);
    if (!roleName) {
      throw new Error("Role name is required.");
    }

    payload.role_name = roleName;
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "role_desc")) {
    payload.role_desc = sanitizeOptionalText(updates.role_desc);
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, "is_active")) {
    payload.is_active = normalizeBoolean(updates.is_active);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No valid role updates supplied.");
  }

  return updateRoleById(supabase, roleId, payload);
}

export async function deleteRoleRecord(supabase, roleId) {
  await deleteRoleById(supabase, roleId);
  return {
    roleId,
    deactivated: true,
    deleted: true,
  };
}

export async function hardDeleteApplicationRecord(supabase, appId) {
  const roles = await fetchRolesByAppId(supabase, appId);

  for (const role of roles) {
    await hardDeleteRoleById(supabase, role.role_id);
  }

  await hardDeleteApplicationById(supabase, appId);

  return {
    appId,
    deletedRoleCount: roles.length,
    permanentlyDeleted: true,
  };
}

export async function hardDeleteRoleRecord(supabase, roleId) {
  await hardDeleteRoleById(supabase, roleId);
  return {
    roleId,
    permanentlyDeleted: true,
  };
}

export async function createRoleRecord(supabase, payload) {
  const appId = payload?.app_id;
  const roleName = normalizeText(payload?.role_name);
  const roleDesc = sanitizeOptionalText(payload?.role_desc);
  const isActive = Object.prototype.hasOwnProperty.call(payload || {}, "is_active")
    ? normalizeBoolean(payload?.is_active)
    : true;

  if (appId === undefined || appId === null || appId === "") {
    throw new Error("Application id is required.");
  }

  if (!roleName) {
    throw new Error("Role name is required.");
  }

  await fetchApplicationById(supabase, appId);

  return createRole(supabase, {
    app_id: appId,
    role_name: roleName,
    role_desc: roleDesc,
    is_active: isActive,
  });
}

export async function createApplicationRecord(supabase, payload) {
  const appName = normalizeText(payload?.app_name);
  const appDesc = sanitizeOptionalText(payload?.app_desc);
  const isActive = Object.prototype.hasOwnProperty.call(payload || {}, "is_active")
    ? normalizeBoolean(payload?.is_active)
    : true;

  if (!appName) {
    throw new Error("Application name is required.");
  }

  const applications = await fetchApplications(supabase);
  const orderField = resolveOrderField(applications);
  const nextOrder = applications.reduce(
    (maxOrder, app) => Math.max(maxOrder, getApplicationDisplayOrder(app, 0)),
    0,
  ) + 1;

  return createApplication(supabase, {
    app_name: appName,
    app_desc: appDesc,
    is_active: isActive,
    [orderField]: nextOrder,
  });
}
