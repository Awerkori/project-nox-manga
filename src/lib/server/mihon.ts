import { privileged } from '$lib/server/db';

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

export async function verifyMihonAuth(request: Request): Promise<MihonAuthResult> {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9_\-]+)$/i);

  if (!match) {
    return { authenticated: false, user: null, ageStatus: 'UNKNOWN' };
  }

  const rawToken = match[1];
  const hash = await hashToken(rawToken);

  const admin = privileged();
  const { data, error } = await admin
    .from('mihon_tokens')
    .select('id, user_id, expires_at, revoked, members(id, username, age_status, xp, is_test)')
    .eq('token_hash', hash)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data || !data.members) {
    return { authenticated: false, user: null, ageStatus: 'UNKNOWN', error: 'Token inválido ou expirado' };
  }

  const member = Array.isArray(data.members) ? data.members[0] : data.members;
  return {
    authenticated: true,
    user: member as unknown as MihonUser,
    ageStatus: (member as { age_status?: 'UNKNOWN' | 'MINOR' | 'ADULT' }).age_status || 'UNKNOWN'
  };
}

export async function generateMihonToken(userId: string, deviceName = 'Mihon App'): Promise<{ token: string; expiresAt: string }> {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = `nox_mh_${randomHex}`;
  const hash = await hashToken(token);

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 180); // 180 days validity
  const expiresAt = expiresDate.toISOString();

  const admin = privileged();
  const { error } = await admin.from('mihon_tokens').insert({
    user_id: userId,
    token_hash: hash,
    token_type: 'access',
    device_name: deviceName,
    expires_at: expiresAt
  });

  if (error) throw new Error('Não foi possível registrar o token.');
  return { token, expiresAt };
}
