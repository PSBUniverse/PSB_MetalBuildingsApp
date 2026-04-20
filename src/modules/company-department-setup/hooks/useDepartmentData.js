/**
 * useDepartmentData Hook
 * Facade for loading department data through services.
 */

import { getSupabase } from "../utils/supabase.js";
import { getDepartmentList } from "../services/companyDepartmentSetup.service.js";

export async function useDepartmentData() {
  const supabase = await getSupabase();

  const departments = await getDepartmentList(supabase);

  return {
    departments,
  };
}
