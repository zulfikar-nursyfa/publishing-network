import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Supabase client using the secret key: bypasses row level security. Only use it after the
 * caller's permission has been checked, and only for work users may not do directly
 * (credentials, publication state, audit entries, invitations).
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
