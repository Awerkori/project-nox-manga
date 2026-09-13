import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
export type AuthState = 'ANONYMOUS' | 'AUTH_PENDING' | 'AUTHENTICATED' | 'AUTH_ERROR';

declare global {
  namespace App {
    interface Locals {
      db: SupabaseClient<Database>;
      user: User | null;
      role: string | null;
      authState: AuthState;
      authError?: string;
      sessionCache?: any;
    }
  }
}
export {};
