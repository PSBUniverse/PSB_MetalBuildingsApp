import {
  createUserMasterRow,
  deleteUserMasterById,
  fetchApplicationRows,
  fetchCompanyRows,
  fetchDepartmentRows,
  fetchRoleRows,
  fetchStatusRows,
  fetchUserAccessRows,
  fetchUserMasterById,
  fetchUserMasterRows,
  updateUserMasterById,
  createUserAccessRow,
  deactivateAllUserAccessRows,
  deactivateUserAccessRows,
  updateUserAccessRows,
} from "../repo/userMasterSetup.repo.js";
import {
  mapApplications,
  mapCompanies,
  mapDepartments,
  mapRoles,
  mapStatuses,
  mapUserAccessRows,
  mapUserMasterDetail,
  mapUserMasterRows,
} from "../model/userMasterSetup.model.js";

const USER_WRITABLE_FIELDS = [
  "auth_user_id",
  "email",
  "username",
  "first_name",
  "middle_name",
  "last_name",
  "phone",
  "address",
  "position",
  "hire_date",
  "comp_id",
  "dept_id",
  "status_id",
  "is_active",
];

const AUTH_LIST_PAGE_SIZE = 200;
const AUTH_LIST_MAX_PAGES = 10;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase();
  return text || null;
}

function normalizePassword(value) {
  return String(value ?? "").trim();
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return false;
  }

  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text === "" ? null : text;
}

function normalizeLookupId(value) {
  const normalized = normalizeOptionalText(value);
  return normalized === null ? null : String(normalized);
}

function usernameToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 48);
}

function usernameFromEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return "";
  }

  const localPart = normalized.split("@")[0] || "";
  return usernameToken(localPart);
}

function deriveDisplayName(source) {
  const firstName = normalizeText(source?.first_name);
  const middleName = normalizeText(source?.middle_name);
  const lastName = normalizeText(source?.last_name);
  const composed = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

  if (composed) {
    return composed;
  }

  return normalizeText(source?.username || source?.user_name);
}

async function resolveUniqueUsername(supabase, preferredUsername, excludeUserId = null) {
  const baseUsername = usernameToken(preferredUsername) || `user_${Date.now().toString(36)}`;

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseUsername : `${baseUsername}_${index}`;
    const { data, error } = await supabase
      .from("psb_s_user")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to validate username uniqueness.");
    }

    if (!data) {
      return candidate;
    }

    if (hasValue(excludeUserId) && String(data.user_id) === String(excludeUserId)) {
      return candidate;
    }
  }

  return `${baseUsername}_${Date.now().toString(36).slice(-4)}`;
}

async function listAuthUsers(supabase) {
  const users = [];

  for (let page = 1; page <= AUTH_LIST_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_LIST_PAGE_SIZE,
    });

    if (error) {
      throw new Error(error.message || "Failed to load auth users.");
    }

    const currentPageUsers = Array.isArray(data?.users) ? data.users : [];
    users.push(...currentPageUsers);

    const lastPage = Number(data?.lastPage);
    if (currentPageUsers.length < AUTH_LIST_PAGE_SIZE || (Number.isFinite(lastPage) && page >= lastPage)) {
      break;
    }
  }

  return users;
}

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const authUsers = await listAuthUsers(supabase);
  return authUsers.find((user) => normalizeEmail(user?.email) === normalizedEmail) || null;
}

async function findAuthUserById(supabase, authUserId) {
  const normalizedAuthUserId = normalizeText(authUserId);

  if (!normalizedAuthUserId) {
    return null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(normalizedAuthUserId);
  if (error) {
    return null;
  }

  return data?.user || null;
}

function mergeRowWithAuthUser(row, authUser) {
  if (!authUser) {
    return row;
  }

  const merged = {
    ...row,
  };

  if (!hasValue(merged.auth_user_id) && hasValue(authUser?.id)) {
    merged.auth_user_id = authUser.id;
  }

  if (!hasValue(merged.email) && hasValue(authUser?.email)) {
    merged.email = authUser.email;
  }

  if (!hasValue(merged.username)) {
    const metadataUsername = usernameToken(authUser?.user_metadata?.username || "");
    const emailUsername = usernameFromEmail(authUser?.email);
    const fallbackUsername = metadataUsername || emailUsername;
    if (fallbackUsername) {
      merged.username = fallbackUsername;
    }
  }

  if (!hasOwn(merged, "is_active") && hasOwn(authUser?.user_metadata || {}, "is_active")) {
    merged.is_active = normalizeBoolean(authUser.user_metadata.is_active);
  }

  if (!hasValue(merged.last_login_at) && hasValue(authUser?.last_sign_in_at)) {
    merged.last_login_at = authUser.last_sign_in_at;
  }

  return merged;
}

async function enrichSingleRowWithAuthUser(supabase, row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  const byAuthId = await findAuthUserById(supabase, row.auth_user_id);
  const byEmail = byAuthId || await findAuthUserByEmail(supabase, row.email);
  const authUser = byEmail || null;

  if (!authUser) {
    return row;
  }

  let nextRow = mergeRowWithAuthUser(row, authUser);

  if (!hasValue(row.auth_user_id) && hasValue(row.user_id)) {
    try {
      const synced = await updateUserMasterById(supabase, row.user_id, {
        auth_user_id: authUser.id,
      });
      nextRow = mergeRowWithAuthUser(synced, authUser);
    } catch {
      nextRow = {
        ...nextRow,
        auth_user_id: authUser.id,
      };
    }
  }

  return nextRow;
}

async function enrichRowsWithAuthUsers(supabase, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeRows.length === 0) {
    return [];
  }

  let authUsers = [];

  try {
    authUsers = await listAuthUsers(supabase);
  } catch {
    return safeRows;
  }

  const authById = new Map();
  const authByEmail = new Map();

  authUsers.forEach((user) => {
    const authUserId = normalizeText(user?.id);
    const authEmail = normalizeEmail(user?.email);

    if (authUserId) {
      authById.set(authUserId, user);
    }

    if (authEmail) {
      authByEmail.set(authEmail, user);
    }
  });

  const nextRows = [];

  for (const row of safeRows) {
    const authUserId = normalizeText(row?.auth_user_id);
    const rowEmail = normalizeEmail(row?.email);
    const authUser = authById.get(authUserId) || authByEmail.get(rowEmail) || null;

    if (!authUser) {
      nextRows.push(row);
      continue;
    }

    let nextRow = mergeRowWithAuthUser(row, authUser);

    if (!authUserId && hasValue(row?.user_id)) {
      try {
        const synced = await updateUserMasterById(supabase, row.user_id, {
          auth_user_id: authUser.id,
        });
        nextRow = mergeRowWithAuthUser(synced, authUser);
      } catch {
        nextRow = {
          ...nextRow,
          auth_user_id: authUser.id,
        };
      }
    }

    nextRows.push(nextRow);
  }

  return nextRows;
}

function buildAuthMetadata(payload) {
  const metadata = {};

  if (hasOwn(payload, "username") && hasValue(payload.username)) {
    metadata.username = usernameToken(payload.username);
  }

  const displayName = deriveDisplayName(payload);
  if (displayName) {
    metadata.full_name = displayName;
  }

  if (hasOwn(payload, "first_name") && hasValue(payload.first_name)) {
    metadata.first_name = normalizeText(payload.first_name);
  }

  if (hasOwn(payload, "last_name") && hasValue(payload.last_name)) {
    metadata.last_name = normalizeText(payload.last_name);
  }

  if (hasOwn(payload, "is_active")) {
    metadata.is_active = normalizeBoolean(payload.is_active);
  }

  return metadata;
}

async function syncAuthUserFromPayload(supabase, authUserId, payload, options = {}) {
  const normalizedAuthUserId = normalizeText(authUserId);

  if (!normalizedAuthUserId) {
    return;
  }

  const updatePayload = {};
  const normalizedEmail = hasOwn(payload, "email") ? normalizeEmail(payload.email) : null;

  if (normalizedEmail) {
    updatePayload.email = normalizedEmail;
  }

  const metadata = buildAuthMetadata(payload);
  if (Object.keys(metadata).length > 0) {
    updatePayload.user_metadata = metadata;
  }

  if (options?.syncPassword === true) {
    const normalizedPassword = normalizePassword(payload?.password);
    if (normalizedPassword) {
      updatePayload.password = normalizedPassword;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(normalizedAuthUserId, updatePayload);
  if (error) {
    throw new Error(error.message || "Failed to sync auth user.");
  }
}

async function resolveOrCreateAuthUserId(supabase, payload) {
  const existingAuthUserId = normalizeText(payload?.auth_user_id);

  if (existingAuthUserId) {
    return {
      authUserId: existingAuthUserId,
      createdAuthUserId: null,
    };
  }

  const email = normalizeEmail(payload?.email);
  if (!email) {
    return {
      authUserId: null,
      createdAuthUserId: null,
    };
  }

  const existingAuthUser = await findAuthUserByEmail(supabase, email);
  if (existingAuthUser?.id) {
    return {
      authUserId: existingAuthUser.id,
      createdAuthUserId: null,
    };
  }

  const normalizedPassword = normalizePassword(payload?.password);
  if (!normalizedPassword) {
    throw new Error("Password is required to create auth user.");
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: normalizedPassword,
    email_confirm: true,
    user_metadata: buildAuthMetadata(payload),
  });

  if (error || !data?.user?.id) {
    throw new Error(error?.message || "Failed to create auth user.");
  }

  return {
    authUserId: data.user.id,
    createdAuthUserId: data.user.id,
  };
}

function buildWritablePayload(source, { includeDefaultActive } = { includeDefaultActive: false }) {
  const payload = {};

  USER_WRITABLE_FIELDS.forEach((field) => {
    if (!hasOwn(source, field)) {
      return;
    }

    if (field === "is_active") {
      payload.is_active = normalizeBoolean(source[field]);
      return;
    }

    if (field === "email") {
      payload.email = normalizeEmail(source[field]);
      return;
    }

    if (field.endsWith("_id")) {
      payload[field] = normalizeOptionalText(source[field]);
      return;
    }

    payload[field] = normalizeOptionalText(source[field]);
  });

  if (includeDefaultActive && !hasOwn(payload, "is_active")) {
    payload.is_active = true;
  }

  return payload;
}

function assertValidPayload(payload, message) {
  if (!payload || Object.keys(payload).length === 0) {
    throw new Error(message);
  }
}

async function loadLookupData(supabase) {
  const [companyRows, departmentRows, statusRows, applicationRows, roleRows] = await Promise.all([
    fetchCompanyRows(supabase),
    fetchDepartmentRows(supabase),
    fetchStatusRows(supabase),
    fetchApplicationRows(supabase),
    fetchRoleRows(supabase),
  ]);

  return {
    companies: mapCompanies(companyRows).filter((row) => row.is_active),
    departments: mapDepartments(departmentRows).filter((row) => row.is_active),
    statuses: mapStatuses(statusRows).filter((row) => row.is_active),
    applications: mapApplications(applicationRows).filter((row) => row.is_active),
    roles: mapRoles(roleRows).filter((row) => row.is_active),
  };
}

function createLookupMaps(lookups) {
  const companyById = new Map();
  const departmentById = new Map();
  const statusById = new Map();

  (lookups?.companies || []).forEach((row) => {
    if (row?.comp_id !== undefined && row?.comp_id !== null) {
      companyById.set(String(row.comp_id), row);
    }
  });

  (lookups?.departments || []).forEach((row) => {
    if (row?.dept_id !== undefined && row?.dept_id !== null) {
      departmentById.set(String(row.dept_id), row);
    }
  });

  (lookups?.statuses || []).forEach((row) => {
    if (row?.status_id !== undefined && row?.status_id !== null) {
      statusById.set(String(row.status_id), row);
    }
  });

  return {
    companyById,
    departmentById,
    statusById,
  };
}

function mergeRowWithLookupLabels(row, lookupMaps) {
  const compId = normalizeLookupId(row?.comp_id);
  const deptId = normalizeLookupId(row?.dept_id);
  const statusId = normalizeLookupId(row?.status_id);

  const company = compId ? lookupMaps.companyById.get(compId) : null;
  const department = deptId ? lookupMaps.departmentById.get(deptId) : null;
  const status = statusId ? lookupMaps.statusById.get(statusId) : null;

  return {
    ...row,
    comp_name: company?.label || row?.comp_name || row?.company_name || null,
    dept_name: department?.label || row?.dept_name || row?.department_name || null,
    sts_name: status?.label || row?.sts_name || row?.status_name || row?.status || null,
    status_name: status?.label || row?.status_name || row?.sts_name || row?.status || null,
  };
}

function mergeRowsWithLookupLabels(rows, lookups) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const lookupMaps = createLookupMaps(lookups);
  return safeRows.map((row) => mergeRowWithLookupLabels(row, lookupMaps));
}

async function assertRoleBelongsToApplication(supabase, appId, roleId) {
  const normalizedAppId = normalizeOptionalText(appId);
  const normalizedRoleId = normalizeOptionalText(roleId);

  if (!normalizedAppId || !normalizedRoleId) {
    throw new Error("Application and role are required.");
  }

  const roleRows = await fetchRoleRows(supabase, {
    appId: normalizedAppId,
  });

  const matchedRole = roleRows.find((row) => String(row?.role_id) === String(normalizedRoleId));
  if (!matchedRole) {
    throw new Error("Selected role does not belong to the selected application.");
  }
}

async function mapSingleAccessRow(supabase, row) {
  const lookupData = await loadLookupData(supabase);
  return mapUserAccessRows([row], {
    applications: lookupData.applications,
    roles: lookupData.roles,
  })[0] || null;
}

export async function getUserMasterSetupViewModel(supabase, options = {}) {
  const lookupData = await loadLookupData(supabase);

  let rows = [];

  try {
    rows = await fetchUserMasterRows(supabase, {
      ...options,
      includeInactive: true,
    });
  } catch {
    rows = [];
  }

  rows = await enrichRowsWithAuthUsers(supabase, rows);
  rows = mergeRowsWithLookupLabels(rows, lookupData);

  const users = mapUserMasterRows(rows);

  return {
    users,
    totalUsers: users.length,
  };
}

export async function getUserMasterLookups(supabase) {
  return loadLookupData(supabase);
}

export async function getUserMasterRecordById(supabase, userId) {
  const record = await fetchUserMasterById(supabase, userId);
  const lookupData = await loadLookupData(supabase);

  let enriched = await enrichSingleRowWithAuthUser(supabase, record);
  enriched = mergeRowWithLookupLabels(enriched, createLookupMaps(lookupData));

  return mapUserMasterDetail(enriched);
}

export async function createUserMasterRecord(supabase, payload) {
  const createPayload = buildWritablePayload(payload, { includeDefaultActive: true });
  const normalizedPassword = normalizePassword(payload?.password);

  if (!normalizedPassword) {
    throw new Error("Password is required for new users.");
  }

  createPayload.email = normalizeEmail(createPayload.email);
  if (!createPayload.email) {
    throw new Error("Email is required.");
  }

  const preferredUsername =
    usernameToken(createPayload.username)
    || usernameFromEmail(createPayload.email)
    || usernameToken(deriveDisplayName(createPayload));

  createPayload.username = await resolveUniqueUsername(supabase, preferredUsername);

  assertValidPayload(createPayload, "No valid user payload supplied.");

  const authResolution = await resolveOrCreateAuthUserId(supabase, {
    ...createPayload,
    password: normalizedPassword,
  });

  if (authResolution.authUserId) {
    createPayload.auth_user_id = authResolution.authUserId;
  }

  let created = null;

  try {
    created = await createUserMasterRow(supabase, createPayload);
  } catch (error) {
    if (authResolution.createdAuthUserId) {
      await supabase.auth.admin.deleteUser(authResolution.createdAuthUserId).catch(() => {});
    }

    throw error;
  }

  if (authResolution.authUserId) {
    await syncAuthUserFromPayload(
      supabase,
      authResolution.authUserId,
      {
        ...createPayload,
        password: normalizedPassword,
      },
      {
        syncPassword: true,
      },
    ).catch(() => {});
  }

  const lookupData = await loadLookupData(supabase);
  let enriched = await enrichSingleRowWithAuthUser(supabase, created);
  enriched = mergeRowsWithLookupLabels([enriched], lookupData)[0] || enriched;

  return mapUserMasterRows([enriched])[0] || null;
}

export async function updateUserMasterRecord(supabase, userId, updates) {
  const existingRecord = await fetchUserMasterById(supabase, userId);
  const updatePayload = buildWritablePayload(updates, { includeDefaultActive: false });
  const normalizedPassword = normalizePassword(updates?.password);

  if (hasOwn(updatePayload, "email")) {
    updatePayload.email = normalizeEmail(updatePayload.email);

    if (!updatePayload.email) {
      throw new Error("Email is required.");
    }
  }

  if (hasOwn(updatePayload, "username")) {
    const preferredUsername = usernameToken(updatePayload.username);
    if (!preferredUsername) {
      throw new Error("Username is required.");
    }

    updatePayload.username = await resolveUniqueUsername(supabase, preferredUsername, userId);
  }

  if (!hasOwn(updatePayload, "username") && !hasValue(existingRecord?.username) && hasOwn(updatePayload, "email")) {
    const preferredUsername =
      usernameFromEmail(updatePayload.email)
      || usernameToken(
        deriveDisplayName({
          ...existingRecord,
          ...updates,
        }),
      );

    updatePayload.username = await resolveUniqueUsername(supabase, preferredUsername, userId);
  }

  if (!hasValue(existingRecord?.auth_user_id) && hasOwn(updatePayload, "email") && updatePayload.email) {
    const existingAuthUser = await findAuthUserByEmail(supabase, updatePayload.email);
    if (existingAuthUser?.id) {
      updatePayload.auth_user_id = existingAuthUser.id;
    }
  }

  assertValidPayload(updatePayload, "No valid user updates supplied.");

  const updated = await updateUserMasterById(supabase, userId, updatePayload);
  const resolvedAuthUserId =
    normalizeText(updated?.auth_user_id)
    || normalizeText(existingRecord?.auth_user_id)
    || normalizeText(updatePayload?.auth_user_id);

  if (resolvedAuthUserId) {
    const syncPayload = {
      ...existingRecord,
      ...updatePayload,
      ...updated,
    };

    if (normalizedPassword) {
      syncPayload.password = normalizedPassword;
    }

    await syncAuthUserFromPayload(supabase, resolvedAuthUserId, syncPayload, {
      syncPassword: Boolean(normalizedPassword),
    }).catch(() => {});
  }

  const lookupData = await loadLookupData(supabase);
  let enriched = await enrichSingleRowWithAuthUser(supabase, updated);
  enriched = mergeRowsWithLookupLabels([enriched], lookupData)[0] || enriched;

  return mapUserMasterRows([enriched])[0] || null;
}

export async function deleteUserMasterRecord(supabase, userId) {
  const revokedAccessRows = await deactivateAllUserAccessRows(supabase, userId);
  const updated = await deleteUserMasterById(supabase, userId);
  const resolvedAuthUserId = normalizeText(updated?.auth_user_id);

  if (resolvedAuthUserId) {
    await syncAuthUserFromPayload(
      supabase,
      resolvedAuthUserId,
      {
        ...updated,
        is_active: false,
      },
      {
        syncPassword: false,
      },
    ).catch(() => {});
  }

  const lookupData = await loadLookupData(supabase);
  let enriched = await enrichSingleRowWithAuthUser(supabase, updated);
  enriched = mergeRowsWithLookupLabels([enriched], lookupData)[0] || enriched;

  const user = mapUserMasterRows([enriched])[0] || null;

  return {
    userId,
    user,
    revokedAccessCount: revokedAccessRows.length,
    deactivated: true,
    deleted: true,
  };
}

export async function getUserMasterAccessViewModel(supabase, userId, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [lookupData, accessRows] = await Promise.all([
    loadLookupData(supabase),
    fetchUserAccessRows(supabase, userId, {
      includeInactive,
    }),
  ]);

  const mappedRows = mapUserAccessRows(accessRows, {
    applications: lookupData.applications,
    roles: lookupData.roles,
  });

  return {
    accessRows: includeInactive ? mappedRows : mappedRows.filter((row) => row.is_active),
  };
}

export async function createUserMasterAccessRecord(supabase, userId, payload) {
  const appId = normalizeOptionalText(payload?.app_id);
  const roleId = normalizeOptionalText(payload?.role_id);

  if (!appId || !roleId) {
    throw new Error("Application and role are required.");
  }

  await assertRoleBelongsToApplication(supabase, appId, roleId);

  const created = await createUserAccessRow(supabase, {
    user_id: userId,
    app_id: appId,
    role_id: roleId,
    is_active: hasOwn(payload, "is_active") ? normalizeBoolean(payload.is_active) : true,
  });

  return mapSingleAccessRow(supabase, created);
}

export async function updateUserMasterAccessRecord(supabase, userId, payload) {
  const originalAppId = normalizeOptionalText(payload?.original_app_id ?? payload?.app_id);
  const originalRoleId = normalizeOptionalText(payload?.original_role_id ?? payload?.role_id);
  const nextAppId = normalizeOptionalText(payload?.app_id);
  const nextRoleId = normalizeOptionalText(payload?.role_id);

  if (!originalAppId || !originalRoleId || !nextAppId || !nextRoleId) {
    throw new Error("Original and next application/role values are required.");
  }

  await assertRoleBelongsToApplication(supabase, nextAppId, nextRoleId);

  const updatedRows = await updateUserAccessRows(supabase, userId, originalAppId, originalRoleId, {
    app_id: nextAppId,
    role_id: nextRoleId,
    is_active: hasOwn(payload, "is_active") ? normalizeBoolean(payload.is_active) : true,
  });

  if (updatedRows.length === 0) {
    throw new Error("Access mapping not found.");
  }

  return mapSingleAccessRow(supabase, updatedRows[0]);
}

export async function deleteUserMasterAccessRecord(supabase, userId, payload) {
  const appId = normalizeOptionalText(payload?.app_id);
  const roleId = normalizeOptionalText(payload?.role_id);

  if (!appId || !roleId) {
    throw new Error("Application and role are required.");
  }

  const updatedRows = await deactivateUserAccessRows(supabase, userId, appId, roleId);

  if (updatedRows.length === 0) {
    throw new Error("Access mapping not found.");
  }

  const access = await mapSingleAccessRow(supabase, updatedRows[0]);

  return {
    deactivated: true,
    access,
  };
}
