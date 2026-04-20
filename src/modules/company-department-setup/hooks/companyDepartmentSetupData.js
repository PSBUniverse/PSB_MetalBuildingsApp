/**
 * Company Department Setup Data Loader
 * Provides the module data contract to the page via services.
 */

import { getSupabase } from "../utils/supabase.js";
import { getCompanyDepartmentSetupViewModel } from "../services/companyDepartmentSetup.service.js";

export async function loadCompanyDepartmentSetupData() {
  const supabase = await getSupabase();

  return getCompanyDepartmentSetupViewModel(supabase);
}
