/**
 * Statuses Repository
 * Handles data access for statuses.
 */

export async function fetchStatuses(supabase) {
  try {
    const { data, error } = await supabase
      .from("psb_s_status")
      .select("*")
      .order("status_id", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch statuses");
  }
}

export async function fetchStatusById(supabase, statusId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_status")
      .select("*")
      .eq("status_id", statusId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch status");
  }
}

export async function createStatus(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from("psb_s_status")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create status");
  }
}

export async function updateStatusById(supabase, statusId, updates) {
  try {
    const { data, error } = await supabase
      .from("psb_s_status")
      .update(updates)
      .eq("status_id", statusId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update status");
  }
}

export async function deleteStatusById(supabase, statusId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_status")
      .update({ is_active: false })
      .eq("status_id", statusId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate status");
  }
}

export async function hardDeleteStatusById(supabase, statusId) {
  try {
    const { error } = await supabase
      .from("psb_s_status")
      .delete()
      .eq("status_id", statusId);

    if (error) throw error;
    return { statusId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete status");
  }
}
