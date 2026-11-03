import { databaseConfig } from '$lib/server/config';
import { withTimeout } from '$lib/server/resilience';
import { executeYugabyteSql } from '$lib/server/yugabyte';

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
const MAX_LAYOUT_FLIGHT_AGE_MS = 3_000;
let customFramesFlight: { promise: Promise<void>; startedAt: number } | null = null;
let settingsFlight: { promise: Promise<void>; startedAt: number } | null = null;

export const load = async ({ locals, url, cookies, platform }: any) => {
  const now = Date.now();
  const needFrames = now - cachedCustomFrames.timestamp > CUSTOM_FRAMES_TTL_MS;
  const needSettings = !cachedSettings || now - cachedSettings.timestamp > SETTINGS_CACHE_TTL_MS;
  const needUserFallback = Boolean(locals.user && !locals.sessionCache);

  const framesTask = !needFrames
    ? Promise.resolve()
    : customFramesFlight && now - customFramesFlight.startedAt < MAX_LAYOUT_FLIGHT_AGE_MS
      ? customFramesFlight.promise
      : (() => {
          let run: Promise<void>;
          run = (async () => {
            try {
              const ybRes = await executeYugabyteSql(
                `SELECT id, asset_url, style_data FROM shop_items WHERE kind = 'AVATAR_FRAME' AND asset_url IS NOT NULL AND asset_url != '';`,
                [],
                platform?.env
              );
              if (Array.isArray(ybRes?.rows)) {
                cachedCustomFrames = {
                  timestamp: Date.now(),
                  frames: ybRes.rows
                    .filter((f: any) => f.asset_url)
                    .map((f: any) => ({ id: f.id, asset_url: f.asset_url, style_data: f.style_data || {} }))
                };
              }
            } catch (err: any) {
              console.warn('[LAYOUT_FRAMES_YUGABYTE_WARN]', err?.message || err);
            } finally {
              if (customFramesFlight?.promise === run) customFramesFlight = null;
            }
          })();
          customFramesFlight = { promise: run, startedAt: now };
          return run;
        })();

  const settingsTask = !needSettings
    ? Promise.resolve()
    : settingsFlight && now - settingsFlight.startedAt < MAX_LAYOUT_FLIGHT_AGE_MS
      ? settingsFlight.promise
      : (() => {
          let run: Promise<void>;
          run = (async () => {
            try {
              const ybSettings = await executeYugabyteSql(
                `SELECT key, value FROM settings WHERE key IN ('site_name', 'description', 'contact', 'maintenance', 'registration_open');`,
                [],
                platform?.env
              );
              if (Array.isArray(ybSettings?.rows) && ybSettings.rows.length > 0) {
                const nextConfig = Object.fromEntries(
                  ybSettings.rows.map((s: { key: string; value: string }) => [s.key, s.value])
                );
                cachedSettings = { timestamp: Date.now(), config: nextConfig };
              }
            } catch (err: any) {
              console.warn('[LAYOUT_SETTINGS_YUGABYTE_WARN]', err?.message || err);
            } finally {
              if (settingsFlight?.promise === run) settingsFlight = null;
            }
          })();
          settingsFlight = { promise: run, startedAt: now };
          return run;
        })();

  const userFallbackTask = !needUserFallback
    ? Promise.resolve(null)
    : (async () => {
        try {
          const [ybMem, ybNotif, ybScans] = await Promise.all([
            executeYugabyteSql(`SELECT * FROM members WHERE id = $1 LIMIT 1;`, [locals.user!.id], platform?.env),
            executeYugabyteSql(`SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL;`, [locals.user!.id], platform?.env),
            executeYugabyteSql(
              `SELECT sm.role, sm.scan_id, s.id, s.name, s.slug, s.logo_id, s.status
               FROM scan_members sm
               JOIN scans s ON s.id = sm.scan_id
               WHERE sm.user_id = $1 AND s.status = 'ACTIVE';`,
              [locals.user!.id],
              platform?.env
            )
          ]);
          return [
            { data: ybMem.rows[0] || null },
            { count: parseInt(ybNotif.rows[0]?.count || '0', 10) },
            { data: ybScans.rows || [] }
          ];
        } catch (err: any) {
          console.warn('[LAYOUT_USER_YUGABYTE_WARN]', err?.message || err);
          return [{ data: null }, { count: 0 }, { data: [] }];
        }
      })();

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
