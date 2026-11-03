import { withTimeout } from './resilience';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { getAuthSecrets, verifySessionJwt, verifySessionJwtAny, AUTH_COOKIE_NAME } from '$lib/server/yugabyte-auth';

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

const SESSION_CACHE_TTL_MS = 60_000; // 60s window (invalidated immediately on mutations via invalidateUserSession)
const VERIFIED_TOKEN_TTL_MS = 300_000; // 5m verified JWT signature cache
const sessionCache = new Map<string, CachedSession>();
const activeFlights = new Map<string, Promise<CachedSession>>();
const verifiedTokens = new Map<string, { userId: string; expiresAt: number }>();

function decodeBase64Safe(str: string): string {
  let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reconstruct full auth cookie string even when chunked into .0, .1, etc.
 * Strictly avoids concatenating unchunked and chunked cookies together or merging different cookie roots.
 */
export function extractFullAuthCookie(cookies: Array<{ name: string; value: string }>): string | null {
  if (!Array.isArray(cookies) || cookies.length === 0) return null;
  const authCookieRegex = /^sb-[a-zA-Z0-9_-]+-auth-token(?:\.\d+)?$/;
  const authCookies = cookies.filter((c) => authCookieRegex.test(c.name) && c.value);
  if (authCookies.length === 0) return null;

  // 1. Prioritize canonical AUTH_COOKIE_NAME unchunked if valid
  const canonicalUnchunked = authCookies.find((c) => c.name === AUTH_COOKIE_NAME);
  if (canonicalUnchunked?.value) {
    const test = decodeSessionJwt(canonicalUnchunked.value);
    if (test.jwt) return canonicalUnchunked.value;
  }

  // 2. Check other unchunked cookies that decode to valid JWT
  const unchunkedList = authCookies.filter((c) => !c.name.includes('.'));
  for (const c of unchunkedList) {
    const test = decodeSessionJwt(c.value);
    if (test.jwt) return c.value;
  }

  // 3. If chunked cookies exist, group by base name and join only chunks belonging to the same root cookie
  const chunked = authCookies.filter((c) => c.name.includes('.'));
  if (chunked.length > 0) {
    const grouped = new Map<string, Array<{ name: string; value: string }>>();
    for (const c of chunked) {
      const baseName = c.name.replace(/\.\d+$/, '');
      if (!grouped.has(baseName)) grouped.set(baseName, []);
      grouped.get(baseName)!.push(c);
    }

    const baseNames = Array.from(grouped.keys()).sort((a, b) => {
      if (a === AUTH_COOKIE_NAME) return -1;
      if (b === AUTH_COOKIE_NAME) return 1;
      return 0;
    });

    for (const baseName of baseNames) {
      const list = grouped.get(baseName)!;
      list.sort((a, b) => {
        const idxA = Number(a.name.split('.').pop()) || 0;
        const idxB = Number(b.name.split('.').pop()) || 0;
        return idxA - idxB;
      });
      const joined = list.map((c) => c.value).join('');
      const test = decodeSessionJwt(joined);
      if (test.jwt) return joined;
    }
  }

  return unchunkedList[0] ? unchunkedList[0].value : null;
}

/**
 * Extract and decode JWT payload from raw cookie value safely with algorithm and claims check
 */
export function decodeSessionJwt(rawCookie: string): { jwt: DecodedJwt | null; accessToken: string } {
  try {
    if (!rawCookie || typeof rawCookie !== 'string') return { jwt: null, accessToken: '' };
    let raw = rawCookie.trim();
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      raw = raw.slice(1, -1).trim();
    }
    if (raw.includes('%')) {
      try {
        raw = decodeURIComponent(raw);
      } catch {
        // Keep raw cookie value when percent-decoding fails
      }
    }
    if (raw.startsWith('base64-')) {
      raw = decodeBase64Safe(raw.slice(7));
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
    if (parts.length !== 3) return { jwt: null, accessToken: '' };

    // Decode and validate header
    const headerJson = decodeBase64Safe(parts[0]);
    const header = JSON.parse(headerJson);
    if (!header || typeof header !== 'object' || !['HS256', 'RS256', 'ES256'].includes(header.alg)) {
      return { jwt: null, accessToken: '' };
    }

    // Decode and validate payload
    const jsonStr = decodeBase64Safe(parts[1]);
    const payload = JSON.parse(jsonStr) as DecodedJwt;

    if (!payload || typeof payload !== 'object' || !payload.sub || typeof payload.sub !== 'string') {
      return { jwt: null, accessToken: '' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp !== undefined && (typeof payload.exp !== 'number' || payload.exp <= nowSec)) {
      return { jwt: null, accessToken: '' };
    }

    return { jwt: payload, accessToken: token };
  } catch {
    return { jwt: null, accessToken: '' };
  }
}

/**
 * Single-flight session resolver with memory cache and resilient fallback
 */
export async function resolveSessionData(
  db: SupabaseClient<any>,
  decoded: DecodedJwt,
  accessToken: string,
  platformEnv?: any
): Promise<CachedSession> {
  // Only the exact verified token may reuse a cached identity.
  const cacheKey = accessToken;
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
    let identityVerified = false;
    try {
      const tokenExpMs = decoded.exp ? decoded.exp * 1000 : now + VERIFIED_TOKEN_TTL_MS;
      if (tokenExpMs <= now) {
        throw new Error('SESSION_NOT_VERIFIED');
      }
      const cachedVerification = verifiedTokens.get(accessToken);
      if (cachedVerification && cachedVerification.userId === decoded.sub && cachedVerification.expiresAt > now) {
        identityVerified = true;
      } else {
        // Fast-path: Web Crypto local HMAC verification across all configured secrets
        const verifiedByJwt = await verifySessionJwtAny(accessToken, platformEnv);
        if (verifiedByJwt && verifiedByJwt.sub === decoded.sub) {
          identityVerified = true;
        }

        // Secondary fallback for legacy/external Supabase sessions if not yet verified
        if (!identityVerified && db?.auth?.getUser) {
          const verified = await withTimeout(
            db.auth.getUser(accessToken),
            1000,
            null,
            'session_verify_user'
          );
          if (verified?.data?.user && verified.data.user.id === decoded.sub) {
            identityVerified = true;
          }
        }

        // Cryptographic verification is MANDATORY: never accept an identity merely
        // because its UUID exists in the members database table.
        if (!identityVerified) {
          throw new Error('SESSION_NOT_VERIFIED');
        }

        if (verifiedTokens.size > 1000) {
          const oldest = verifiedTokens.keys().next().value;
          if (oldest) verifiedTokens.delete(oldest);
        }
        verifiedTokens.set(accessToken, {
          userId: decoded.sub,
          expiresAt: Math.min(tokenExpMs, now + VERIFIED_TOKEN_TTL_MS)
        });
      }
      const userId = decoded.sub;

      // Run profile, role, scans and unread queries from authoritative YugabyteDB
      let profileData: any = null;
      let roleData: any = null;
      let userScansList: any[] = [];
      let unreadCount = 0;

      try {
        const ybRes = await executeYugabyteSql(
          `SELECT 
             (SELECT row_to_json(m) FROM (SELECT * FROM members WHERE id = $1 LIMIT 1) m) AS profile,
             (SELECT row_to_json(r) FROM (SELECT role, suspended FROM access_roles WHERE user_id = $1 LIMIT 1) r) AS role,
             (SELECT coalesce(json_agg(row_to_json(sc)), '[]'::json) FROM (
                SELECT sm.role, sm.scan_id, s.id, s.name, s.slug, s.logo_id, s.status
                FROM scan_members sm
                JOIN scans s ON s.id = sm.scan_id
                WHERE sm.user_id = $1 AND s.status = 'ACTIVE'
             ) sc) AS scans,
             (SELECT count(*)::int FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS unread_count;`,
          [userId],
          platformEnv
        );

        const row = ybRes.rows[0];
        if (row) {
          if (row.profile !== undefined || row.unread_count !== undefined) {
            profileData = row.profile || null;
            roleData = typeof row.role === 'object' && row.role !== null ? row.role : (row.role ? { role: row.role, suspended: Boolean(row.suspended) } : null);
            userScansList = Array.isArray(row.scans) ? row.scans : [];
            unreadCount = parseInt(row.unread_count || '0', 10);
          } else {
            if (row.role) {
              roleData = typeof row.role === 'object' ? row.role : { role: row.role, suspended: Boolean(row.suspended) };
            }
            if (row.username || row.display_name) {
              profileData = row;
            }
          }
        }
      } catch {
        // Fallback to db.from if YugabyteDB is degraded
      }

      if (!profileData && db?.from) {
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
          400,
          [{ data: null }, { data: null }, { data: [] }, { data: [] }, { count: 0 }] as any,
          'session_resolver_batch'
        );

        profileData = profileRes?.data || null;
        roleData = roleRes?.data || null;
        unreadCount = unreadRes?.count || 0;

        if (Array.isArray(ownedScansRes?.data)) {
          for (const s of ownedScansRes.data) {
            userScansList.push({ ...s, role: 'OWNER' });
          }
        }
        if (Array.isArray(userScansRes?.data)) {
          for (const m of userScansRes.data) {
            if (m.scans) {
              userScansList.push({ ...m.scans, role: m.role });
            }
          }
        }
      }

      let effectiveRole = null;
      if (roleData && !roleData.suspended) {
        effectiveRole = roleData.role;
      }

      // Guarantee platform owner role when DB is degraded or role not explicitly set in table (UUID-based RBAC, never email)
      const isPlatformOwner = Boolean(userId && (userId === (process.env.STAFF_OWNER_USER_ID || '732fbe87-5040-41fb-9983-0aedb2af44c8')));
      if (!effectiveRole && !roleData?.suspended) {
        effectiveRole = isPlatformOwner ? 'ADMIN' : 'USER';
      }

      // Build consolidated user scans preserving official OWNER / ADMIN / MEMBER model
      const scansMap = new Map<string, any>();
      for (const m of userScansList) {
        const scanId = m.id || m.scan_id;
        if (scanId) {
          const existing = scansMap.get(scanId);
          const finalRole = existing?.role === 'OWNER' ? 'OWNER' : m.role;
          scansMap.set(scanId, {
            id: scanId,
            name: m.name,
            slug: m.slug,
            logo_id: m.logo_id,
            status: m.status,
            role: finalRole
          });
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
        profileData || {
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
        unread: unreadCount,
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
    } catch (error) {
      if (!identityVerified) throw error;
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
  for (const [k, session] of sessionCache.entries()) {
    if (session.user.id === userId) {
      sessionCache.delete(k);
    }
  }
  for (const [k, v] of verifiedTokens.entries()) {
    if (v.userId === userId) {
      verifiedTokens.delete(k);
    }
  }
}

/**
 * Clear session cache for a specific access token
 */
export function invalidateToken(token: string) {
  sessionCache.delete(token);
  verifiedTokens.delete(token);
}

/**
 * Reset all session caches (primarily for unit tests and key rotation)
 */
export function clearSessionCache() {
  sessionCache.clear();
  verifiedTokens.clear();
  activeFlights.clear();
}

