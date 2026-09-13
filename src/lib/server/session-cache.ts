import { withTimeout } from './resilience';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DecodedJwt {
  sub: string;
  email?: string;
  exp?: number;
  role?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface CachedSession {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    isPending?: boolean;
  };
  role: string | null;
  profile: any;
  userScans: any[];
  unread: number;
  cachedAt: number;
  tokenExp?: number;
}

const SESSION_CACHE_TTL_MS = 60_000; // 60 seconds memory window
const sessionCache = new Map<string, CachedSession>();
const activeFlights = new Map<string, Promise<CachedSession>>();

/**
 * Reconstruct full auth cookie string even when chunked into .0, .1, etc.
 * Strictly excludes helper cookies like -code-verifier or -provider.
 */
export function extractFullAuthCookie(cookies: Array<{ name: string; value: string }>): string | null {
  const authCookieRegex = /^sb-[a-zA-Z0-9_-]+-auth-token(?:\.\d+)?$/;
  const authCookies = cookies
    .filter((c) => authCookieRegex.test(c.name))
    .sort((a, b) => {
      const idxA = a.name.includes('.') ? Number(a.name.split('.').pop()) || 0 : 0;
      const idxB = b.name.includes('.') ? Number(b.name.split('.').pop()) || 0 : 0;
      return idxA - idxB;
    });

  if (authCookies.length === 0) return null;
  return authCookies.map((c) => c.value).join('');
}

/**
 * Extract and decode JWT payload from raw cookie value safely
 */
export function decodeSessionJwt(rawCookie: string): { jwt: DecodedJwt | null; accessToken: string } {
  try {
    let raw = rawCookie;
    if (raw.includes('%')) {
      try {
        raw = decodeURIComponent(raw);
      } catch {}
    }
    if (raw.startsWith('base64-')) {
      raw = atob(raw.slice(7));
    }
    let token = '';
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      token = parsed.access_token || '';
    } else if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      token = parsed[0] || '';
    } else {
      token = raw;
    }
    if (!token || !token.includes('.')) return { jwt: null, accessToken: '' };
    const parts = token.split('.');
    if (parts.length < 2) return { jwt: null, accessToken: '' };

    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binaryStr = atob(base64);
    const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonStr) as DecodedJwt;
    return { jwt: payload, accessToken: token };
  } catch {
    return { jwt: null, accessToken: '' };
  }
}

/**
 * Fast hashing for cache keying
 */
function fastHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/**
 * Single-flight session resolver with memory cache and resilient fallback
 */
export async function resolveSessionData(
  db: SupabaseClient<any>,
  decoded: DecodedJwt,
  accessToken: string
): Promise<CachedSession> {
  const cacheKey = decoded.sub + ':' + (decoded.exp || fastHash(accessToken));
  const now = Date.now();

  const cached = sessionCache.get(cacheKey);
  if (cached && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    return cached;
  }

  const existingFlight = activeFlights.get(cacheKey);
  if (existingFlight) {
    return existingFlight;
  }

  const flightPromise = (async () => {
    try {
      const userId = decoded.sub;

      // Run profile, role, scans and unread queries concurrently
      const [profileRes, roleRes, userScansRes, ownedScansRes, unreadRes] = await withTimeout(
        Promise.all([
          db.from('members').select('*').eq('id', userId).maybeSingle(),
          db.from('access_roles').select('role, suspended').eq('user_id', userId).maybeSingle(),
          db
            .from('scan_members')
            .select('role, scan_id, scans!inner(id, name, slug, logo_id, status)')
            .eq('user_id', userId),
          db
            .from('scans')
            .select('id, name, slug, logo_id, status')
            .eq('owner_id', userId)
            .eq('status', 'ACTIVE'),
          db
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null)
        ]),
        2000,
        [{ data: null }, { data: null }, { data: [] }, { data: [] }, { count: 0 }] as any,
        'session_resolver_batch'
      );

      let effectiveRole = null;
      if (roleRes?.data && !roleRes.data.suspended) {
        effectiveRole = roleRes.data.role;
      }

      // Guarantee platform owner role when DB is degraded or role not explicitly set in table (UUID-based RBAC, never email)
      const isPlatformOwner = Boolean(userId && (userId === (process.env.STAFF_OWNER_USER_ID || '732fbe87-5040-41fb-9983-0aedb2af44c8')));
      if (!effectiveRole && isPlatformOwner) {
        effectiveRole = 'ADMIN';
      }

      // Build consolidated user scans preserving official OWNER / ADMIN / MEMBER model
      const scansMap = new Map<string, any>();

      // First add owned scans as OWNER
      if (Array.isArray(ownedScansRes?.data)) {
        for (const s of ownedScansRes.data) {
          scansMap.set(s.id, {
            id: s.id,
            name: s.name,
            slug: s.slug,
            logo_id: s.logo_id,
            status: s.status,
            role: 'OWNER'
          });
        }
      }

      // Merge with scan_members
      if (Array.isArray(userScansRes?.data)) {
        for (const m of userScansRes.data) {
          if (m.scans) {
            const existing = scansMap.get(m.scans.id);
            // OWNER has highest precedence
            const finalRole = existing?.role === 'OWNER' ? 'OWNER' : m.role;
            scansMap.set(m.scans.id, {
              id: m.scans.id,
              name: m.scans.name,
              slug: m.scans.slug,
              logo_id: m.scans.logo_id,
              status: m.scans.status,
              role: finalRole
            });
          }
        }
      }

      // Guarantee official scan for platform owner if DB scan query was degraded
      if (scansMap.size === 0 && isPlatformOwner) {
        scansMap.set('04872e99-37ad-4d45-aed4-35759d0eae33', {
          id: '04872e99-37ad-4d45-aed4-35759d0eae33',
          name: 'Project Nox',
          slug: 'project-nox',
          logo_id: null,
          status: 'ACTIVE',
          role: 'OWNER'
        });
      }

      const consolidatedUserScans = Array.from(scansMap.values());

      const profile =
        profileRes?.data || {
          id: userId,
          display_name: decoded.user_metadata?.display_name || (decoded.email ? decoded.email.split('@')[0] : 'Leitor'),
          username: decoded.user_metadata?.username || (decoded.email ? decoded.email.split('@')[0] : 'leitor'),
          avatar_id: null,
          avatar_frame_id: null,
          role: effectiveRole || 'LEITOR'
        };

      const result: CachedSession = {
        user: {
          id: userId,
          email: decoded.email,
          user_metadata: decoded.user_metadata,
          app_metadata: decoded.app_metadata
        },
        role: effectiveRole,
        profile,
        userScans: consolidatedUserScans,
        unread: unreadRes?.count || 0,
        cachedAt: now,
        tokenExp: decoded.exp
      };

      sessionCache.set(cacheKey, result);

      // Clean old cache entries if map exceeds 500
      if (sessionCache.size > 500) {
        const earliest = now - SESSION_CACHE_TTL_MS;
        for (const [k, v] of sessionCache.entries()) {
          if (v.cachedAt < earliest) sessionCache.delete(k);
        }
      }

      return result;
    } catch {
      // Degraded fallback without breaking auth
      const userId = decoded.sub;
      return {
        user: {
          id: userId,
          email: decoded.email,
          isPending: false
        },
        role: null,
        profile: {
          id: userId,
          display_name: decoded.email ? decoded.email.split('@')[0] : 'Leitor',
          username: decoded.email ? decoded.email.split('@')[0] : 'leitor',
          role: 'LEITOR'
        },
        userScans: [],
        unread: 0,
        cachedAt: now,
        tokenExp: decoded.exp
      };
    } finally {
      activeFlights.delete(cacheKey);
    }
  })();

  activeFlights.set(cacheKey, flightPromise);
  return flightPromise;
}

/**
 * Clear session cache for a specific user (on logout, role update, etc.)
 */
export function invalidateUserSession(userId: string) {
  for (const [k] of sessionCache.entries()) {
    if (k.startsWith(userId + ':')) {
      sessionCache.delete(k);
    }
  }
}
