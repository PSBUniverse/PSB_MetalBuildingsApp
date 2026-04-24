/**
 * Roles Repository
 * Handles data access for roles
 */

export async function fetchAllRoles(supabase) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .select("*")
      .order("role_name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch roles");
  }
}

export async function fetchRolesByAppId(supabase, appId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .select("*")
      .eq("app_id", appId)
      .order("role_name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch roles");
  }
}

export async function createRole(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create role");
  }
}

export async function fetchRoleById(supabase, roleId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .select("*")
      .eq("role_id", roleId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch role");
  }
}

export async function updateRoleById(supabase, roleId, updates) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .update(updates)
      .eq("role_id", roleId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update role");
  }
}

export async function deleteRoleById(supabase, roleId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_role")
      .update({ is_active: false })
      .eq("role_id", roleId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate role");
  }
}

export async function hardDeleteRoleById(supabase, roleId) {
  try {
    const { error } = await supabase
      .from("psb_s_role")
      .delete()
      .eq("role_id", roleId);

    if (error) throw error;
    return { roleId };
  } catch (err) {
    throw new Error(err.message || "Failed to permanently delete role");
  }
}
