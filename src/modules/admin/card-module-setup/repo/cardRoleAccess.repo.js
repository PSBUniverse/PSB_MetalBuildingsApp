const TABLE =
  String(process.env.USER_MASTER_APP_CARD_ROLE_ACCESS_TABLE || "").trim() || "psb_m_appcardroleaccess";

export async function fetchCardRoleAccessByCardId(supabase, cardId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("card_id", cardId);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card role access");
  }
}

export async function fetchAllCardRoleAccess(supabase) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*");

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch card role access");
  }
}

export async function deactivateCardRoleAccessByCardId(supabase, cardId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("card_id", cardId)
      .select("*");

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate card role access");
  }
}

export async function hardDeleteCardRoleAccessByCardId(supabase, cardId) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("card_id", cardId);

    if (error) throw error;
    return { cardId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete card role access");
  }
}
