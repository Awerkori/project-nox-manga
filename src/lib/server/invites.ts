import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
export async function claimInvite(locals: App.Locals) {
  const {
    data: { session }
  } = await locals.db.auth.getSession();
  if (!session) return;
  const caller = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await caller.rpc('claim_editor_invite');
  if (error) console.error('Editor invite could not be checked:', error.code);
}
