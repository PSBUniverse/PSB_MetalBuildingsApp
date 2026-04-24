import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import {
  hasValue, isActiveRow, readText, normalizeRoutePath, asNumber,
  resolveDbUser, resolveUserAccessScope,
  APP_CARD_GROUP_TABLE, APP_CARD_TABLE, APP_CARD_ROLE_ACCESS_TABLE,
} from "./dashboardHelpers";

export async function loadAssignedCardsFromDatabase() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    if (!hasValue(accessToken)) return [];

    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData?.user) return [];

    const dbUser = await resolveDbUser(supabaseAdmin, authData.user);
    if (!dbUser?.user_id) return [];

    const accessScope = await resolveUserAccessScope(supabaseAdmin, dbUser.user_id);
    if (!Array.isArray(accessScope.appIds) || accessScope.appIds.length === 0) return [];

    const visibleCards = [];

    for (const appId of accessScope.appIds) {
      const roleSet = accessScope.roleIdsByApp.get(appId);
      if (!(roleSet instanceof Set) || roleSet.size === 0) continue;

      const { data: groupRows, error: groupError } = await supabaseAdmin
        .from(APP_CARD_GROUP_TABLE)
        .select("*")
        .eq("app_id", appId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (groupError || !Array.isArray(groupRows) || groupRows.length === 0) continue;

      const groups = groupRows
        .filter((row) => row && isActiveRow(row))
        .map((row) => ({
          groupId: String(row?.group_id || row?.app_group_id || row?.card_group_id || "").trim(),
          groupName: readText(row, ["group_name", "name", "label"], "Application"),
          groupDescription: readText(row, ["group_desc", "description"], ""),
          groupIcon: readText(row, ["icon"], "bi-collection"),
          groupOrder: asNumber(row?.display_order ?? row?.group_order ?? row?.sort_order ?? row?.order_no, 0),
        }))
        .filter((group) => hasValue(group.groupId));

      if (groups.length === 0) continue;

      const groupIds = groups.map((group) => group.groupId);
      const groupById = new Map(groups.map((group) => [group.groupId, group]));

      const { data: cardRows, error: cardError } = await supabaseAdmin
        .from(APP_CARD_TABLE)
        .select("*")
        .eq("is_active", true)
        .in("group_id", groupIds)
        .order("display_order", { ascending: true });

      if (cardError || !Array.isArray(cardRows) || cardRows.length === 0) continue;

      const cards = cardRows
        .filter((row) => row && isActiveRow(row))
        .map((row) => ({
          cardId: String(row?.card_id || row?.app_card_id || "").trim(),
          groupId: String(row?.group_id || row?.app_group_id || row?.card_group_id || "").trim(),
          appId: String(row?.app_id || row?.application_id || appId).trim(),
          cardName: readText(row, ["card_name", "name", "label"], "Module"),
          cardDescription: readText(row, ["card_desc", "description"], "Open module."),
          routePath: normalizeRoutePath(readText(row, ["route_path", "route", "path", "href"], "#")),
          icon: readText(row, ["icon"], "bi-grid-3x3-gap"),
          cardOrder: asNumber(row?.display_order ?? row?.card_order ?? row?.sort_order ?? row?.order_no, 0),
        }))
        .filter((card) => hasValue(card.cardId) && groupById.has(card.groupId));

      if (cards.length === 0) continue;

      const cardIds = cards.map((card) => card.cardId);

      const { data: cardRoleRows, error: cardRoleError } = await supabaseAdmin
        .from(APP_CARD_ROLE_ACCESS_TABLE)
        .select("*")
        .eq("is_active", true)
        .in("card_id", cardIds);

      if (cardRoleError || !Array.isArray(cardRoleRows)) continue;

      const visibleCardIds = new Set(
        cardRoleRows
          .filter((row) => row && isActiveRow(row))
          .map((row) => ({
            cardId: String(row?.card_id || row?.app_card_id || "").trim(),
            roleId: String(row?.role_id || "").trim(),
          }))
          .filter((mapping) => mapping.cardId && mapping.roleId && roleSet.has(mapping.roleId))
          .map((mapping) => mapping.cardId),
      );

      cards.forEach((card) => {
        if (!visibleCardIds.has(card.cardId)) return;
        const group = groupById.get(card.groupId);
        const appOrder = accessScope.appOrderById.get(appId) ?? Number.MAX_SAFE_INTEGER;
        const totalOrder = appOrder * 1000000 + group.groupOrder * 1000 + card.cardOrder;

        visibleCards.push({
          key: `card-${card.cardId}`,
          name: card.cardName,
          description: card.cardDescription || "Open module.",
          path: card.routePath,
          appId,
          icon: card.icon || "bi-grid-3x3-gap",
          groupName: group?.groupName || "Applications",
          groupDescription: group?.groupDescription || "",
          groupIcon: group?.groupIcon || "bi-collection",
          order: totalOrder,
        });
      });
    }

    return visibleCards.sort((left, right) => left.order - right.order);
  } catch {
    return [];
  }
}

export async function loadAssignedAppsFromDatabase() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    if (!hasValue(accessToken)) return [];

    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData?.user) return [];

    const dbUser = await resolveDbUser(supabaseAdmin, authData.user);
    if (!dbUser?.user_id) return [];

    const { data: mappingRows, error: mappingError } = await supabaseAdmin
      .from("psb_m_userapproleaccess")
      .select("*")
      .eq("user_id", dbUser.user_id);

    if (mappingError) return [];

    const appIds = Array.from(
      new Set(
        (Array.isArray(mappingRows) ? mappingRows : [])
          .filter((row) => row && isActiveRow(row))
          .map((row) => String(row.app_id || "").trim())
          .filter(Boolean),
      ),
    );

    if (appIds.length === 0) return [];

    const { data: appRows, error: appRowsError } = await supabaseAdmin
      .from("psb_s_application")
      .select("*")
      .in("app_id", appIds);

    if (appRowsError || !Array.isArray(appRows)) {
      return appIds.map((appId, index) => ({
        key: `app-${appId}`,
        name: `Application ${appId}`,
        description: "Assigned application.",
        path: "#",
        appId,
        icon: "bi-grid-3x3-gap",
        groupName: "Applications",
        groupDescription: "",
        groupIcon: "bi-collection",
        order: index + 1,
      }));
    }

    const appById = new Map(appRows.map((row) => [String(row?.app_id || "").trim(), row]));

    return appIds
      .map((appId, index) => {
        const appRecord = appById.get(appId) || null;
        return {
          key: `app-${appId}`,
          name: readText(appRecord, ["app_name", "name", "app_code", "code"], `Application ${appId}`),
          description: readText(appRecord, ["app_desc", "description"], "Assigned application."),
          path: normalizeRoutePath(readText(appRecord, ["route_path", "route", "path", "href", "module_path"], "#")),
          appId,
          icon: readText(appRecord, ["icon", "app_icon"], "bi-grid-3x3-gap"),
          groupName: "Applications",
          groupDescription: "",
          groupIcon: "bi-collection",
          order: Number(appRecord?.display_order ?? appRecord?.app_order ?? appRecord?.sort_order ?? appRecord?.order_no ?? index + 1),
        };
      })
      .sort((left, right) => left.order - right.order);
  } catch {
    return [];
  }
}
