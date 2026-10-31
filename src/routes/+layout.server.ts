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

// Uploaded (image/GIF) avatar frames need their asset + framing metadata on every
// page where an equipped frame can appear (comments, profiles, header...).
type CustomFrame = { id: string; asset_url: string; style_data: Record<string, any> };
let cachedCustomFrames: { timestamp: number; frames: CustomFrame[] } = { timestamp: 0, frames: [] };
const CUSTOM_FRAMES_TTL_MS = 120_000;
let customFramesFlight: Promise<void> | null = null;
let settingsFlight: Promise<void> | null = null;

export const load = async ({ locals, url, cookies }) => {
  const now = Date.now();
  const needFrames = now - cachedCustomFrames.timestamp > CUSTOM_FRAMES_TTL_MS;
  const needSettings = !cachedSettings || now - cachedSettings.timestamp > SETTINGS_CACHE_TTL_MS;
  const needUserFallback = Boolean(locals.user && !locals.sessionCache);

  const framesTask = !needFrames
    ? Promise.resolve()
    : (customFramesFlight ??= (async () => {
        try {
          const res = await withTimeout(
            locals.db
              .from('shop_items')
              .select('id, asset_url, style_data')
              .eq('kind', 'AVATAR_FRAME')
              .neq('asset_url', ''),
            1200,
            { data: null } as any,
            'custom_frames'
          );
          if (Array.isArray(res?.data)) {
            cachedCustomFrames = {
              timestamp: Date.now(),
              frames: res.data
                .filter((f: any) => f.asset_url)
                .map((f: any) => ({ id: f.id, asset_url: f.asset_url, style_data: f.style_data || {} }))
            };
          }
        } catch {
          // Keep stale frames; procedural frames don't depend on this.
        } finally {
          customFramesFlight = null;
        }
      })());

  const settingsTask = !needSettings
    ? Promise.resolve()
    : (settingsFlight ??= (async () => {
        try {
          databaseConfig();
          const settingsRes = await withTimeout(
            locals.db.rpc('public_settings'),
            1200,
            { data: null } as any,
            'public_settings'
          );
          if (Array.isArray(settingsRes?.data) && settingsRes.data.length > 0) {
            const nextConfig = Object.fromEntries(
              settingsRes.data.map((s: { key: string; value: string }) => [s.key, s.value])
            );
            cachedSettings = { timestamp: Date.now(), config: nextConfig };
          }
        } catch {
          // Keep stale config if available, otherwise default
        } finally {
          settingsFlight = null;
        }
      })());

  const userFallbackTask = !needUserFallback
    ? Promise.resolve(null)
    : withTimeout(
        Promise.all([
          locals.db.from('members').select('*').eq('id', locals.user!.id).maybeSingle(),
          locals.db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', locals.user!.id).is('read_at', null),
          locals.db
            .from('scan_members')
            .select('role, scan_id, scans!inner(id, name, slug, logo_id, status)')
            .eq('user_id', locals.user!.id)
        ]),
        1500,
        [{ data: null }, { count: 0 }, { data: [] }] as any,
        'layout_user_batch'
      );

  const [, , userBatch] = await Promise.all([framesTask, settingsTask, userFallbackTask]);

  let profile = locals.sessionCache?.profile || null;
  let unread = locals.sessionCache?.unread ?? 0;
  let userScans = locals.sessionCache?.userScans || [];

  if (locals.user && !locals.sessionCache && userBatch) {
    const [profileRes, unreadRes, userScansRes] = userBatch;
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

  const config: Record<string, string> = cachedSettings?.config || {};

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

  if (profile) {
    (profile as any).role = effectiveRole || (profile as any).role || 'LEITOR';
  }

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
    userScans,
    customFrames: cachedCustomFrames.frames
  };
};
