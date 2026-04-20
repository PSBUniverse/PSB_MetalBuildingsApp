/**
 * Safe Supabase Resolver
 *
 * Modules must use this helper instead of calling getSupabase() directly.
 *
 * Why: Modules are loaded at runtime via a dynamic filesystem loader.
 * The shared Supabase singleton in core/supabase/client.js may not be
 * initialized yet at that point, causing "Supabase not initialized" errors.
 *
 * This resolver handles all three cases:
 *   1. Singleton already initialized — return it directly.
 *   2. Singleton not initialized — initialize it with public env keys.
 *   3. No public keys available — fall back to the server admin client.
 */

let moduleSupabaseAdmin = null;

async function getModuleSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration");
  }

  if (!moduleSupabaseAdmin) {
    const { createClient } = await import("@supabase/supabase-js");
    moduleSupabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return moduleSupabaseAdmin;
}

export async function getSupabase() {
  if (typeof window === "undefined") {
    return getModuleSupabaseAdmin();
  }

  const mod = await import("../../../core/supabase/client.js");

  try {
    return mod.getSupabase();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      return mod.initSupabase(url, anonKey);
    }

    return getModuleSupabaseAdmin();
  }
}
