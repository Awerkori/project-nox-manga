import { createClient } from '@supabase/supabase-js';
import { databaseConfig } from '$lib/server/config';
import { withTimeout } from '$lib/server/resilience';

const DEFAULT_CONFIG: Record<string, string> = {
  site_name: 'Project Nox',
  maintenance: 'false',
  registration_open: 'true'
};

let cachedSettings: { timestamp: number; config: Record<string, string> } = {
  timestamp: Date.now(),
  config: DEFAULT_CONFIG
};
const SETTINGS_CACHE_TTL_MS = 120_000;

export const load = async ({ locals, url, cookies }) => {
  let profile = locals.sessionCache?.profile || null;
  let unread = locals.sessionCache?.unread ?? 0;
  let userScans = locals.sessionCache?.userScans || [];

  if (locals.user && !locals.sessionCache) {
    const [profileRes, unreadRes, userScansRes] = await withTimeout(
      Promise.all([
        locals.db.from('members').select('*').eq('id', locals.user.id).maybeSingle(),
        locals.db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
        locals.db
          .from('scan_members')
          .select('role, scan_id, scans!inner(id, name, slug, logo_id, status)')
          .eq('user_id', locals.user.id)
      ]),
      1500,
      [{ data: null }, { count: 0 }, { data: [] }] as any,
      'layout_user_batch'
    );
    profile =
      profileRes?.data ||
      (locals.authState !== 'ANONYMOUS'
        ? ({
            id: locals.user.id,
            display_name: locals.user.email ? locals.user.email.split('@')[0] : 'Leitor',
            username: locals.user.email ? locals.user.email.split('@')[0] : 'leitor',
            avatar_id: null,
            avatar_frame_id: null,
            role: locals.role || 'LEITOR'
          } as any)
        : null);

    unread = unreadRes?.count || 0;

    userScans =
      userScansRes?.data?.map((m: any) => ({
        role: m.role,
        ...m.scans
      })) || [];
  }

  let config: Record<string, string> = cachedSettings?.config || {};
  if (!cachedSettings || Date.now() - cachedSettings.timestamp > SETTINGS_CACHE_TTL_MS) {
    try {
      const { url: databaseUrl, key } = databaseConfig();
      const publicClient = createClient(databaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const settingsRes = await withTimeout(
        publicClient.rpc('public_settings'),
        1200,
        { data: null } as any,
        'public_settings'
      );
      if (Array.isArray(settingsRes?.data) && settingsRes.data.length > 0) {
        config = Object.fromEntries(
          settingsRes.data.map((s: { key: string; value: string }) => [s.key, s.value])
        );
        cachedSettings = { timestamp: Date.now(), config };
      }
    } catch {
      // Keep stale config if available, otherwise empty
    }
  }

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

  const isPlatformOwner = Boolean(locals.user?.id && (locals.user.id === (process.env.STAFF_OWNER_USER_ID || '732fbe87-5040-41fb-9983-0aedb2af44c8')));
  const effectiveRole = locals.role || (isPlatformOwner ? 'ADMIN' : null);

  if (isPlatformOwner && (!userScans || userScans.length === 0)) {
    userScans = [{
      id: '04872e99-37ad-4d45-aed4-35759d0eae33',
      name: 'Project Nox',
      slug: 'project-nox',
      logo_id: null,
      status: 'ACTIVE',
      role: 'OWNER'
    }];
  }

  return {
    user: locals.user ? { id: locals.user.id, email: locals.user.email } : null,
    profile,
    role: effectiveRole,
    authState: locals.authState,
    unread,
    config,
    ageStatus,
    blurNsfw,
    siteUrl: url.origin,
    userScans
  };
};
