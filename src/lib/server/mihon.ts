import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { safeQuerySingle, safeQuery } from '$lib/server/db/safe';
import { eq, and, gt } from 'drizzle-orm';

export async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface MihonUser {id: string;
  username: string;
  ageStatus: 'UNKNOWN' | 'MINOR' | 'ADULT';
  xp: number;
  isTest: boolean;}

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

  const { data: row, error } = await safeQuerySingle(
    db.select({
      token: {
        id: schema.mihonTokens.id,
        userId: schema.mihonTokens.userId,
        expiresAt: schema.mihonTokens.expiresAt,
        revoked: schema.mihonTokens.revoked
      },
      member: {
        id: schema.members.id,
        username: schema.members.username,
        ageStatus: schema.members.ageStatus,
        xp: schema.members.xp,
        isTest: schema.members.isTest
      }
    })
    .from(schema.mihonTokens)
    .leftJoin(schema.members, eq(schema.mihonTokens.userId, schema.members.id))
    .where(
      and(
        eq(schema.mihonTokens.tokenHash, hash),
        eq(schema.mihonTokens.revoked, 0),
        gt(schema.mihonTokens.expiresAt, new Date().toISOString())
      )
    )
    .limit(1)
  );

  if (error || !row || !row.member) {
    return { authenticated: false, user: null, ageStatus: 'UNKNOWN', error: 'Token inválido ou expirado' };
  }

  return {authenticated: true,
    user: {
      id: row.member.id,
      username: row.member.username,
      ageStatus: row.member.ageStatus as any,
      xp: row.member.xp,
      isTest: Boolean(row.member.isTest)},
    ageStatus: (row.member.ageStatus as any) || 'UNKNOWN'
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

  const { error } = await safeQuery(
    db.insert(schema.mihonTokens).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hash,
      tokenType: 'access',
      deviceName,
      expiresAt,
      scopes: '[]',
      revoked: 0,
      createdAt: new Date().toISOString()
    })
  );

  if (error) throw new Error('Não foi possível registrar o token.');
  return { token, expiresAt };
}
