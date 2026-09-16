import { databaseConfig } from '$lib/server/config';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, isNull, count } from 'drizzle-orm';
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
        safeQuerySingle(db.select().from(schema.members).where(eq(schema.members.id, locals.user!.id))),
        safeQuerySingle(db.select({ count: count() }).from(schema.notifications).where(isNull(schema.notifications.readAt))),
        safeQuery(db.select({
            role: schema.scanMembers.role,
            scanId: schema.scanMembers.scanId,
            scans: {
              id: schema.scans.id,
              name: schema.scans.name,
              slug: schema.scans.slug,
              logoId: schema.scans.logoId,
              status: schema.scans.status
            }
          })
          .from(schema.scanMembers)
          .innerJoin(schema.scans, eq(schema.scanMembers.scanId, schema.scans.id))
          .where(eq(schema.scanMembers.userId, locals.user!.id)))
      ]),
      1500,
      [{ data: null }, { count: 0 }, { data: [] }] as any,
      'layout_user_batch'
    );
    profile =
      profileRes?.data ||
      (locals.authState !== 'ANONYMOUS'
        ? ({id: locals.user!.id,
            displayName: locals.user.email ? locals.user.email.split('@')[0] : 'Leitor',
            username: locals.user.email ? locals.user.email.split('@')[0] : 'leitor',
            avatarId: null,
            avatarFrameId: null,
            role: locals.role || 'LEITOR'} as any)
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
       
         
       
      const settingsRes = await withTimeout(
        safeQuery(db.select().from(schema.settings)),
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
    profile?.ageStatus === 'ADULT' || profile?.ageStatus === 'MINOR'
      ? profile.ageStatus
      : rawAgeCookie === 'ADULT' || rawAgeCookie === 'MINOR'
        ? rawAgeCookie
        : 'UNKNOWN';

  const blurNsfw: boolean =
    ageStatus === 'MINOR'
      ? true
      : profile
        ? profile.blurNsfw
        : cookies.get('nox-blur-nsfw') !== 'false';

  const isPlatformOwner = Boolean(locals.user?.id && (locals.user!.id === (process.env.STAFF_OWNER_USER_ID || '732fbe87-5040-41fb-9983-0aedb2af44c8')));
  const effectiveRole = locals.role || (isPlatformOwner ? 'ADMIN' : null);

  if (isPlatformOwner && (!userScans || userScans.length === 0)) {userScans = [{
      id: '04872e99-37ad-4d45-aed4-35759d0eae33',
      name: 'Project Nox',
      slug: 'project-nox',
      logoId: null,
      status: 'ACTIVE',
      role: 'OWNER'}];
  }

  return {
    user: locals.user ? { id: locals.user!.id, email: locals.user.email } : null,
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
