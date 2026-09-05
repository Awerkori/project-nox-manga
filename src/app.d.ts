import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
declare global {
  namespace App {
    interface Locals {
      db: SupabaseClient<Database>;
      user: User | null;
      role: string | null;
    }
  }
}
export {};
