import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): null {
  // Supabase completely removed - Project Nox runs 100% on YugabyteDB Aeon
  return null;
}

