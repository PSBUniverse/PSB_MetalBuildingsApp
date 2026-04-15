import "server-only";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export function getServerSupabaseClient() {
  if (!hasSupabaseAdminConfig || !supabaseAdmin) {
    throw new Error(
      "Missing Supabase environment variables for server client. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabaseAdmin;
}
