import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
export const load = async ({ locals, url }) => {
  const profile = locals.user
    ? (await locals.db.from('members').select('*').eq('id', locals.user.id).maybeSingle()).data
    : null;
  const unread = locals.user
    ? (await locals.db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null))
        .count || 0
    : 0;
  const publicClient = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: settings } = await publicClient.rpc('public_settings');
  const config: Record<string, string> = Object.fromEntries(
    (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
  );
  return { profile, role: locals.role, unread, pathname: url.pathname, config };
};
