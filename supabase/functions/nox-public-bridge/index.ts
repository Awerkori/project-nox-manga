import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { createBridge } from './handler.ts';

const authOptions = { persistSession: false, autoRefreshToken: false };
Deno.serve(
  createBridge({
    async authorize(token) {
      const url = Deno.env.get('NOX_PUBLIC_URL');
      const key = Deno.env.get('NOX_PUBLIC_ANON_KEY');
      if (!url || !key) return null;
      const caller = createClient(url, key, {
        auth: authOptions,
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const {
        data: { user },
        error
      } = await caller.auth.getUser(token);
      if (error || !user) return null;
      const { data: role, error: roleError } = await caller.rpc('current_role');
      return roleError ? null : { role, caller };
    },
    source() {
      // This credential stays inside the original Supabase project, never in Cloudflare.
      return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: authOptions
      });
    }
  })
);
