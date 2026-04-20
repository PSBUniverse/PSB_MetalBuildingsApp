/**
 * Departments Repository
 * Handles data access for departments.
 */

export async function fetchAllDepartments(supabase) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .select("*")
      .order("dept_name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch departments");
  }
}

export async function fetchDepartmentsByCompanyId(supabase, compId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .select("*")
      .eq("comp_id", compId)
      .order("dept_name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch departments");
  }
}

export async function createDepartment(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create department");
  }
}

export async function fetchDepartmentById(supabase, deptId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .select("*")
      .eq("dept_id", deptId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch department");
  }
}

export async function updateDepartmentById(supabase, deptId, updates) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .update(updates)
      .eq("dept_id", deptId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update department");
  }
}

export async function deleteDepartmentById(supabase, deptId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_department")
      .update({ is_active: false })
      .eq("dept_id", deptId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate department");
  }
}
