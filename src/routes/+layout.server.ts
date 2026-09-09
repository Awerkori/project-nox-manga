import { createClient } from '@supabase/supabase-js';
import { databaseConfig } from '$lib/server/config';
export const load = async ({ locals, url, cookies }) => {
  const profile = locals.user
    ? (await locals.db.from('members').select('*').eq('id', locals.user.id).maybeSingle()).data
    : null;
  const unread = locals.user
    ? (await locals.db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null))
        .count || 0
    : 0;
  const { url: databaseUrl, key } = databaseConfig();
  const publicClient = createClient(databaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: settings } = await publicClient.rpc('public_settings');
  const config: Record<string, string> = Object.fromEntries(
    (settings || []).map((s: { key: string; value: string }) => [s.key, s.value])
  );

  const rawAgeCookie = cookies.get('nox-age-status');
  const ageStatus: 'UNKNOWN' | 'MINOR' | 'ADULT' =
    profile?.age_status === 'ADULT' || profile?.age_status === 'MINOR'
      ? profile.age_status
      : rawAgeCookie === 'ADULT' || rawAgeCookie === 'MINOR'
        ? rawAgeCookie
        : 'UNKNOWN';

  const blurNsfw: boolean =
    ageStatus === 'MINOR'
      ? true
      : profile
        ? profile.blur_nsfw
        : cookies.get('nox-blur-nsfw') !== 'false';

  return {
    profile,
    role: locals.role,
    unread,
    pathname: url.pathname,
    config,
    ageStatus,
    blurNsfw,
    siteUrl: url.origin
  };
};
