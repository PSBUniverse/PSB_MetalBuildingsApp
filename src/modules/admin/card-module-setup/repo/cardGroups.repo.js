const TABLE =
  String(process.env.USER_MASTER_APP_CARD_GROUP_TABLE || "").trim() || "psb_m_appcardgroup";

export async function fetchCardGroups(supabase) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card groups");
  }
}

export async function fetchCardGroupsByAppId(supabase, appId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("app_id", appId)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card groups");
  }
}

export async function fetchCardGroupById(supabase, groupId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("group_id", groupId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card group");
  }
}

export async function createCardGroup(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create card group");
  }
}

export async function updateCardGroupById(supabase, groupId, updates) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("group_id", groupId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update card group");
  }
}

export async function deleteCardGroupById(supabase, groupId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("group_id", groupId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate card group");
  }
}

export async function hardDeleteCardGroupById(supabase, groupId) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("group_id", groupId);

    if (error) throw error;
    return { groupId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete card group");
  }
}

export async function updateCardGroupOrderBatch(supabase, orderedIds) {
  const results = [];

  for (let index = 0; index < orderedIds.length; index++) {
    const groupId = orderedIds[index];
    const { data, error } = await supabase
      .from(TABLE)
      .update({ display_order: index + 1 })
      .eq("group_id", groupId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update card group order");
    }

    results.push(data);
  }

  return results;
}
