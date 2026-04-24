import {
  fetchCardGroups,
  fetchCardGroupsByAppId,
  createCardGroup,
  updateCardGroupById,
  deleteCardGroupById,
  hardDeleteCardGroupById,
  updateCardGroupOrderBatch,
} from "../repo/cardGroups.repo.js";
import {
  fetchAllCards,
  createCard,
  updateCardById,
  deleteCardById,
  hardDeleteCardById,
  updateCardOrderBatch,
} from "../repo/cards.repo.js";
import {
  deactivateCardRoleAccessByCardId,
  hardDeleteCardRoleAccessByCardId,
} from "../repo/cardRoleAccess.repo.js";

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function getCardGroupList(supabase) {
  const rows = await fetchCardGroups(supabase);
  return (Array.isArray(rows) ? rows : []).sort((a, b) => {
    const orderDiff = Number(a?.display_order || 0) - Number(b?.display_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.group_name || "").localeCompare(String(b?.group_name || ""));
  });
}

export async function getCardGroupListByAppId(supabase, appId) {
  const rows = await fetchCardGroupsByAppId(supabase, appId);
  return (Array.isArray(rows) ? rows : []).sort((a, b) => {
    const orderDiff = Number(a?.display_order || 0) - Number(b?.display_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.group_name || "").localeCompare(String(b?.group_name || ""));
  });
}

export async function getCardList(supabase) {
  const rows = await fetchAllCards(supabase);
  return (Array.isArray(rows) ? rows : []).sort((a, b) => {
    const orderDiff = Number(a?.display_order || 0) - Number(b?.display_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.card_name || "").localeCompare(String(b?.card_name || ""));
  });
}

export async function buildCardModuleSetupViewModel(supabase) {
  const [cardGroups, cards] = await Promise.all([
    getCardGroupList(supabase),
    getCardList(supabase),
  ]);

  return { cardGroups, cards };
}

export async function getCardModuleSetupViewModel(supabase) {
  return buildCardModuleSetupViewModel(supabase);
}

export async function createCardGroupRecord(supabase, payload) {
  const groupName = normalizeText(payload?.group_name);
  if (!groupName) {
    throw new Error("Card group name is required.");
  }

  const appId = payload?.app_id;
  if (appId === undefined || appId === null || appId === "") {
    throw new Error("Application ID is required.");
  }

  const insertPayload = {
    app_id: appId,
    group_name: groupName,
    group_desc: normalizeText(payload?.group_desc),
    icon: normalizeText(payload?.icon, "bi-collection"),
    is_active: payload?.is_active !== undefined ? payload.is_active : true,
  };

  if (payload?.display_order !== undefined) {
    insertPayload.display_order = payload.display_order;
  } else {
    const existingGroups = await fetchCardGroupsByAppId(supabase, appId);
    const maxOrder = existingGroups.reduce(
      (max, row) => Math.max(max, Number(row?.display_order || 0)),
      0,
    );
    insertPayload.display_order = maxOrder + 1;
  }

  return createCardGroup(supabase, insertPayload);
}

export async function updateCardGroupRecord(supabase, groupId, updates) {
  if (groupId === undefined || groupId === null || groupId === "") {
    throw new Error("Card group ID is required.");
  }

  const patch = {};

  if (updates?.group_name !== undefined) {
    const name = normalizeText(updates.group_name);
    if (!name) throw new Error("Card group name cannot be empty.");
    patch.group_name = name;
  }

  if (updates?.group_desc !== undefined) {
    patch.group_desc = normalizeText(updates.group_desc);
  }

  if (updates?.icon !== undefined) {
    patch.icon = normalizeText(updates.icon, "bi-collection");
  }

  if (updates?.is_active !== undefined) {
    patch.is_active = updates.is_active;
  }

  if (updates?.display_order !== undefined) {
    patch.display_order = updates.display_order;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update.");
  }

  return updateCardGroupById(supabase, groupId, patch);
}

export async function deleteCardGroupRecord(supabase, groupId) {
  if (groupId === undefined || groupId === null || groupId === "") {
    throw new Error("Card group ID is required.");
  }

  const linkedCards = await fetchAllCards(supabase);
  const groupCards = linkedCards.filter(
    (card) => String(card?.group_id ?? "") === String(groupId),
  );

  for (const card of groupCards) {
    await deleteCardById(supabase, card.card_id);
    await deactivateCardRoleAccessByCardId(supabase, card.card_id).catch(() => {});
  }

  return deleteCardGroupById(supabase, groupId);
}

export async function saveCardGroupOrder(supabase, groupIds) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return { updatedCount: 0, orderField: "display_order" };
  }

  const results = await updateCardGroupOrderBatch(supabase, groupIds);
  return { updatedCount: results.length, orderField: "display_order" };
}

export async function createCardRecord(supabase, payload) {
  const cardName = normalizeText(payload?.card_name);
  if (!cardName) {
    throw new Error("Card name is required.");
  }

  const groupId = payload?.group_id;
  if (groupId === undefined || groupId === null || groupId === "") {
    throw new Error("Group ID is required.");
  }

  const insertPayload = {
    group_id: groupId,
    app_id: payload?.app_id,
    card_name: cardName,
    card_desc: normalizeText(payload?.card_desc),
    route_path: normalizeText(payload?.route_path, "#"),
    icon: normalizeText(payload?.icon, "bi-grid-3x3-gap"),
    is_active: payload?.is_active !== undefined ? payload.is_active : true,
  };

  if (payload?.display_order !== undefined) {
    insertPayload.display_order = payload.display_order;
  } else {
    const existingCards = await fetchAllCards(supabase);
    const groupCards = existingCards.filter(
      (card) => String(card?.group_id ?? "") === String(groupId),
    );
    const maxOrder = groupCards.reduce(
      (max, row) => Math.max(max, Number(row?.display_order || 0)),
      0,
    );
    insertPayload.display_order = maxOrder + 1;
  }

  return createCard(supabase, insertPayload);
}

export async function updateCardRecord(supabase, cardId, updates) {
  if (cardId === undefined || cardId === null || cardId === "") {
    throw new Error("Card ID is required.");
  }

  const patch = {};

  if (updates?.card_name !== undefined) {
    const name = normalizeText(updates.card_name);
    if (!name) throw new Error("Card name cannot be empty.");
    patch.card_name = name;
  }

  if (updates?.card_desc !== undefined) {
    patch.card_desc = normalizeText(updates.card_desc);
  }

  if (updates?.route_path !== undefined) {
    patch.route_path = normalizeText(updates.route_path, "#");
  }

  if (updates?.icon !== undefined) {
    patch.icon = normalizeText(updates.icon, "bi-grid-3x3-gap");
  }

  if (updates?.is_active !== undefined) {
    patch.is_active = updates.is_active;
  }

  if (updates?.display_order !== undefined) {
    patch.display_order = updates.display_order;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update.");
  }

  return updateCardById(supabase, cardId, patch);
}

export async function deleteCardRecord(supabase, cardId) {
  if (cardId === undefined || cardId === null || cardId === "") {
    throw new Error("Card ID is required.");
  }

  await deactivateCardRoleAccessByCardId(supabase, cardId).catch(() => {});
  return deleteCardById(supabase, cardId);
}

export async function hardDeleteCardGroupRecord(supabase, groupId) {
  if (groupId === undefined || groupId === null || groupId === "") {
    throw new Error("Card group ID is required.");
  }

  const linkedCards = await fetchAllCards(supabase);
  const groupCards = linkedCards.filter(
    (card) => String(card?.group_id ?? "") === String(groupId),
  );

  for (const card of groupCards) {
    await hardDeleteCardRoleAccessByCardId(supabase, card.card_id).catch(() => {});
    await hardDeleteCardById(supabase, card.card_id);
  }

  await hardDeleteCardGroupById(supabase, groupId);

  return {
    groupId,
    deletedCardCount: groupCards.length,
    permanentlyDeleted: true,
  };
}

export async function hardDeleteCardRecord(supabase, cardId) {
  if (cardId === undefined || cardId === null || cardId === "") {
    throw new Error("Card ID is required.");
  }

  await hardDeleteCardRoleAccessByCardId(supabase, cardId).catch(() => {});
  await hardDeleteCardById(supabase, cardId);

  return {
    cardId,
    permanentlyDeleted: true,
  };
}

export async function saveCardOrder(supabase, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { updatedCount: 0, orderField: "display_order" };
  }

  const results = await updateCardOrderBatch(supabase, cardIds);
  return { updatedCount: results.length, orderField: "display_order" };
}
