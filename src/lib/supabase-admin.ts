import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import type { Database } from "@/supabase/types";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!cachedClient) {
    const url = getEnv("SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    cachedClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedClient;
}

export function getSupabaseAdminTyped(): SupabaseClient<Database> {
  return getSupabaseAdmin() as SupabaseClient<Database>;
}
