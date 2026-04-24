import { getSupabaseAdmin } from "@/core/supabase/admin";

export const APP_CARD_GROUP_TABLE =
  String(process.env.USER_MASTER_APP_CARD_GROUP_TABLE || "").trim() || "psb_m_appcardgroup";
export const APP_CARD_TABLE =
  String(process.env.USER_MASTER_APP_CARD_TABLE || "").trim() || "psb_s_appcard";
export const APP_CARD_ROLE_ACCESS_TABLE =
  String(process.env.USER_MASTER_APP_CARD_ROLE_ACCESS_TABLE || "").trim() || "psb_m_appcardroleaccess";

export function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function isInactiveFlag(value) {
  if (value === false || value === 0) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "false" || text === "0" || text === "f" || text === "n" || text === "no";
}

export function isActiveRow(record) {
  return !isInactiveFlag(record?.is_active);
}

export function readText(record, fields, fallback = "") {
  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

export function normalizeRoutePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\/+/, "")}`;
}

export function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveApplicationOrder(record, fallbackOrder = Number.MAX_SAFE_INTEGER) {
  const candidates = [record?.display_order, record?.app_order, record?.sort_order, record?.order_no, record?.app_id];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallbackOrder;
}

export async function resolveDbUser(supabaseAdmin, authUser) {
  const { data: byAuthUser, error: byAuthUserError } = await supabaseAdmin
    .from("psb_s_user")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (!byAuthUserError && byAuthUser) return byAuthUser;
  if (!hasValue(authUser?.email)) return null;

  const { data: byEmailUser, error: byEmailUserError } = await supabaseAdmin
    .from("psb_s_user")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle();

  if (byEmailUserError || !byEmailUser) return null;

  const existingAuthUserId = String(byEmailUser.auth_user_id || "").trim();
  const shouldSyncAuthUserId = !hasValue(existingAuthUserId) || existingAuthUserId !== authUser.id;

  if (shouldSyncAuthUserId) {
    const { data: updatedUser } = await supabaseAdmin
      .from("psb_s_user")
      .update({ auth_user_id: authUser.id })
      .eq("user_id", byEmailUser.user_id)
      .select("*")
      .maybeSingle();

    if (updatedUser) return updatedUser;
  }

  return byEmailUser;
}

export async function resolveUserAccessScope(supabaseAdmin, userId) {
  const { data: mappingRows, error: mappingError } = await supabaseAdmin
    .from("psb_m_userapproleaccess")
    .select("*")
    .eq("user_id", userId);

  if (mappingError || !Array.isArray(mappingRows)) {
    return { appIds: [], appOrderById: new Map(), roleIdsByApp: new Map() };
  }

  const activeMappings = mappingRows.filter((row) => row && isActiveRow(row));
  if (activeMappings.length === 0) {
    return { appIds: [], appOrderById: new Map(), roleIdsByApp: new Map() };
  }

  const mappedAppIds = Array.from(
    new Set(activeMappings.map((row) => String(row?.app_id || "").trim()).filter(Boolean)),
  );
  const mappedRoleIds = Array.from(
    new Set(activeMappings.map((row) => String(row?.role_id || "").trim()).filter(Boolean)),
  );

  if (mappedAppIds.length === 0 || mappedRoleIds.length === 0) {
    return { appIds: [], appOrderById: new Map(), roleIdsByApp: new Map() };
  }

  const [{ data: appRows, error: appError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabaseAdmin.from("psb_s_application").select("*").in("app_id", mappedAppIds).eq("is_active", true),
    supabaseAdmin.from("psb_s_role").select("role_id, app_id, is_active").in("role_id", mappedRoleIds).eq("is_active", true),
  ]);

  if (appError || roleError) {
    return { appIds: [], appOrderById: new Map(), roleIdsByApp: new Map() };
  }

  const orderedActiveApps = (Array.isArray(appRows) ? appRows : [])
    .filter((row) => row)
    .sort((left, right) => {
      const orderDiff = resolveApplicationOrder(left) - resolveApplicationOrder(right);
      if (orderDiff !== 0) return orderDiff;
      const leftName = String(left?.app_name || left?.name || "").trim();
      const rightName = String(right?.app_name || right?.name || "").trim();
      return leftName.localeCompare(rightName);
    });

  const activeAppIds = orderedActiveApps.map((row) => String(row?.app_id || "").trim()).filter(Boolean);
  const activeAppSet = new Set(activeAppIds);

  const activeRoleRows = (Array.isArray(roleRows) ? roleRows : []).filter((row) => row && isActiveRow(row));
  const activeRoleIds = new Set(activeRoleRows.map((row) => String(row?.role_id || "").trim()).filter(Boolean));

  const roleIdsByApp = new Map(activeAppIds.map((appId) => [appId, new Set()]));

  activeMappings.forEach((mapping) => {
    const appId = String(mapping?.app_id || "").trim();
    const roleId = String(mapping?.role_id || "").trim();
    if (!activeAppSet.has(appId)) return;
    if (!activeRoleIds.has(roleId)) return;
    if (!roleIdsByApp.has(appId)) roleIdsByApp.set(appId, new Set());
    roleIdsByApp.get(appId).add(roleId);
  });

  const effectiveAppIds = activeAppIds.filter((appId) => {
    const roleSet = roleIdsByApp.get(appId);
    return roleSet instanceof Set && roleSet.size > 0;
  });

  const appOrderById = new Map(
    orderedActiveApps.map((row) => [
      String(row?.app_id || "").trim(),
      resolveApplicationOrder(row, Number.MAX_SAFE_INTEGER),
    ]),
  );

  return { appIds: effectiveAppIds, appOrderById, roleIdsByApp };
}
