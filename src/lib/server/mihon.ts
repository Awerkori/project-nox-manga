import { executeYugabyteSql } from './yugabyte';

export async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface MihonUser {
  id: string;
  username: string;
  age_status: 'UNKNOWN' | 'MINOR' | 'ADULT';
  xp: number;
  is_test: boolean;
}

export interface MihonAuthResult {
  authenticated: boolean;
  user: MihonUser | null;
  ageStatus: 'UNKNOWN' | 'MINOR' | 'ADULT';
  error?: string;
}

const MIHON_AUTH_CACHE_TTL_MS = 60_000;
const MAX_MIHON_AUTH_CACHE = 500;
const mihonAuthCache = new Map<string, { timestamp: number; result: MihonAuthResult }>();

export function invalidateMihonTokenCache(tokenHash?: string) {
  if (tokenHash) {
    mihonAuthCache.delete(tokenHash);
  } else {
    mihonAuthCache.clear();
  }
}

export async function verifyMihonAuth(request: Request, platformEnv?: any): Promise<MihonAuthResult> {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9_\-]+)$/i);

  if (!match) {
    return { authenticated: false, user: null, ageStatus: 'UNKNOWN' };
  }

  const rawToken = match[1];
  const hash = await hashToken(rawToken);

  const cached = mihonAuthCache.get(hash);
  if (cached && Date.now() - cached.timestamp < MIHON_AUTH_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const res = await executeYugabyteSql(
      `SELECT t.id, t.user_id, t.expires_at, t.revoked,
              m.id AS member_id, m.username, m.age_status, m.xp, m.is_test
       FROM public.mihon_tokens t
       JOIN public.members m ON m.id = t.user_id
       WHERE t.token_hash = $1
         AND t.revoked = false
         AND t.expires_at > now()
       LIMIT 1;`,
      [hash],
      platformEnv
    );

    const row = res.rows[0];
    if (!row) {
      return { authenticated: false, user: null, ageStatus: 'UNKNOWN', error: 'Token inválido ou expirado' };
    }

    const member: MihonUser = {
      id: row.member_id || row.user_id,
      username: row.username,
      age_status: row.age_status || 'UNKNOWN',
      xp: row.xp || 0,
      is_test: Boolean(row.is_test)
    };

    const authResult: MihonAuthResult = {
      authenticated: true,
      user: member,
      ageStatus: member.age_status || 'UNKNOWN'
    };

    if (mihonAuthCache.size >= MAX_MIHON_AUTH_CACHE) {
      const oldestKey = mihonAuthCache.keys().next().value;
      if (oldestKey) mihonAuthCache.delete(oldestKey);
    }
    mihonAuthCache.set(hash, { timestamp: Date.now(), result: authResult });
    return authResult;
  } catch (err: any) {
    return { authenticated: false, user: null, ageStatus: 'UNKNOWN', error: 'Erro ao verificar token' };
  }
}

export async function generateMihonToken(userId: string, deviceName = 'Mihon App', platformEnv?: any): Promise<{ token: string; expiresAt: string }> {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = `nox_mh_${randomHex}`;
  const hash = await hashToken(token);

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 180); // 180 days validity
  const expiresAt = expiresDate.toISOString();

  await executeYugabyteSql(
    `INSERT INTO public.mihon_tokens (user_id, token_hash, token_type, device_name, expires_at)
     VALUES ($1, $2, 'access', $3, $4::timestamptz);`,
    [userId, hash, deviceName, expiresAt],
    platformEnv
  );

  return { token, expiresAt };
}

/**
 * RFC 9110 compliant weak comparison function for If-None-Match headers.
 * Compares incoming If-None-Match header (which may contain weak prefix W/, quotes, or multiple tags)
 * against the target representation entity tag.
 */
export function matchesETag(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const trimmed = ifNoneMatch.trim();
  if (!trimmed) return false;
  if (trimmed === '*') return true;
  const cleanEtag = etag.replace(/^W\//, '');
  const tags = trimmed.split(',').map((t) => t.trim().replace(/^W\//, ''));
  return tags.includes(cleanEtag);
}
