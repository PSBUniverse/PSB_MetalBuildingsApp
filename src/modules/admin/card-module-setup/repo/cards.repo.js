const TABLE =
  String(process.env.USER_MASTER_APP_CARD_TABLE || "").trim() || "psb_s_appcard";

export async function fetchAllCards(supabase) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch cards");
  }
}

export async function fetchCardsByGroupId(supabase, groupId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("group_id", groupId)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch cards");
  }
}

export async function fetchCardById(supabase, cardId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("card_id", cardId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card");
  }
}

export async function createCard(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create card");
  }
}

export async function updateCardById(supabase, cardId, updates) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("card_id", cardId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update card");
  }
}

export async function deleteCardById(supabase, cardId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("card_id", cardId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate card");
  }
}

export async function hardDeleteCardById(supabase, cardId) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("card_id", cardId);

    if (error) throw error;
    return { cardId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete card");
  }
}

export async function updateCardOrderBatch(supabase, orderedIds) {
  const results = [];

  for (let index = 0; index < orderedIds.length; index++) {
    const cardId = orderedIds[index];
    const { data, error } = await supabase
      .from(TABLE)
      .update({ display_order: index + 1 })
      .eq("card_id", cardId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update card order");
    }

    results.push(data);
  }

  return results;
}
