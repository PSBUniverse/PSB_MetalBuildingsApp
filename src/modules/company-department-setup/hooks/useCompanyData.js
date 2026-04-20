/**
 * useCompanyData Hook
 * Facade for loading company data through services.
 */

import { getSupabase } from "../utils/supabase.js";
import { getCompanyList } from "../services/companyDepartmentSetup.service.js";

export async function useCompanyData() {
  const supabase = await getSupabase();

  const companies = await getCompanyList(supabase);
  const selectedCompanyId = companies[0]?.comp_id ?? null;

  return {
    companies,
    selectedCompanyId,
  };
}
