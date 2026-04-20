/**
 * Companies Repository
 * Handles data access for companies.
 */

export async function fetchCompanies(supabase) {
  try {
    const { data, error } = await supabase
      .from("psb_s_company")
      .select("*")
      .order("comp_id", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(err.message || "Failed to fetch companies");
  }
}

export async function fetchCompanyById(supabase, compId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_company")
      .select("*")
      .eq("comp_id", compId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to fetch company");
  }
}

export async function createCompany(supabase, payload) {
  try {
    const { data, error } = await supabase
      .from("psb_s_company")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to create company");
  }
}

export async function updateCompanyById(supabase, compId, updates) {
  try {
    const { data, error } = await supabase
      .from("psb_s_company")
      .update(updates)
      .eq("comp_id", compId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to update company");
  }
}

export async function deleteCompanyById(supabase, compId) {
  try {
    const { data, error } = await supabase
      .from("psb_s_company")
      .update({ is_active: false })
      .eq("comp_id", compId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to deactivate company");
  }
}
