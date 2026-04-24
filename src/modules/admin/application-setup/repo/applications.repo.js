/**
 * Applications Repository
 * Handles data access for applications
 */

export async function fetchApplications(supabase) {
  try {
    const { data, error } = await supabase
      .from("psb_s_application")
      .select("*")
      .order("app_id", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch applications");
  }
}

export async function fetchApplicationById(supabase, appId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_application")
      .select("*")
      .eq("app_id", appId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch application");
  }
}

export async function createApplication(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from("psb_s_application")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create application");
  }
}

export async function updateApplicationById(supabase, appId, updates) {
  try {
    const { data, error } = await supabase
      .from("psb_s_application")
      .update(updates)
      .eq("app_id", appId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update application");
  }
}

export async function deleteApplicationById(supabase, appId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_application")
      .update({ is_active: false })
      .eq("app_id", appId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate application");
  }
}

export async function hardDeleteApplicationById(supabase, appId) {
  try {
    const { error } = await supabase
      .from("psb_s_application")
      .delete()
      .eq("app_id", appId);

    if (error) throw error;
    return { appId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete application");
  }
}

export async function updateApplicationOrderBatch(supabase, orderUpdates, orderField = "display_order") {
  const safeUpdates = Array.isArray(orderUpdates) ? orderUpdates : [];

  for (const update of safeUpdates) {
    const appId = update?.appId;
    const displayOrder = Number(update?.displayOrder);

    if ((appId === undefined || appId === null || appId === "") || !Number.isFinite(displayOrder)) {
      continue;
    }

    try {
      const { error } = await supabase
        .from("psb_s_application")
        .update({ [orderField]: displayOrder })
        .eq("app_id", appId);

      if (error) {
        throw error;
      }
    } catch (err) {
      throw new Error(err.message || "Failed to update application order");
    }
  }

  return {
    updatedCount: safeUpdates.length,
    orderField,
  };
}
