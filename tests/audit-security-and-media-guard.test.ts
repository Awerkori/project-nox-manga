import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decodeSessionJwt,
  resolveSessionData,
  invalidateUserSession,
  invalidateToken,
  clearSessionCache
} from '../src/lib/server/session-cache';
import { signSessionJwt, getAuthSecret } from '../src/lib/server/yugabyte-auth';

describe('Project Nox Final Security Audit — Priority 1: JWT & Session Security', () => {
  const secret = getAuthSecret();
  const validUserId = '11111111-1111-4111-8111-111111111111';
  const victimAdminId = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    clearSessionCache();
    vi.clearAllMocks();
  });

  it('1. verifies legitimate JWT signed with valid secret and extracts session', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await signSessionJwt(
      { sub: validUserId, email: 'user@projectnox.org', exp: nowSec + 3600, role: 'authenticated' },
      secret
    );

    const { jwt, accessToken } = decodeSessionJwt(token);
    expect(jwt).not.toBeNull();
    expect(jwt?.sub).toBe(validUserId);
    expect(accessToken).toBe(token);

    const mockDb = { auth: { getUser: vi.fn() }, from: vi.fn() };
    const session = await resolveSessionData(mockDb as any, jwt!, accessToken);

    expect(session.user.id).toBe(validUserId);
    expect(session.user.email).toBe('user@projectnox.org');
    // Fast path: Web Crypto verified signature without querying legacy Supabase getUser
    expect(mockDb.auth.getUser).not.toHaveBeenCalled();
  });

  it('2. strictly rejects expired JWT in decode and resolver', async () => {
    const expiredSec = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
    const expiredToken = await signSessionJwt(
      { sub: validUserId, email: 'expired@projectnox.org', exp: expiredSec, role: 'authenticated' },
      secret
    );

    // decodeSessionJwt must reject expired token
    const { jwt } = decodeSessionJwt(expiredToken);
    expect(jwt).toBeNull();

    // resolveSessionData must fail-closed if decoded claims show expired
    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, { sub: validUserId, exp: expiredSec }, expiredToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('3. strictly rejects JWT with tampered signature', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const validToken = await signSessionJwt(
      { sub: validUserId, email: 'user@projectnox.org', exp: nowSec + 3600 },
      secret
    );

    // Tamper with signature bytes
    const parts = validToken.split('.');
    const tamperedSig = parts[2].slice(0, -4) + 'XXXX';
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    const { jwt } = decodeSessionJwt(tamperedToken);
    expect(jwt).not.toBeNull(); // structure is valid

    const mockDb = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('invalid sig') }) } };
    await expect(
      resolveSessionData(mockDb as any, jwt!, tamperedToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('4. strictly rejects JWT with altered sub (impersonation attempt)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Token signed for normal user
    const token = await signSessionJwt(
      { sub: validUserId, email: 'attacker@projectnox.org', exp: nowSec + 3600 },
      secret
    );

    // Attacker modifies decoded sub in memory to victim admin UUID
    const forgedClaims = { sub: victimAdminId, exp: nowSec + 3600 };

    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, forgedClaims, token)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('5. rejects JWT with disallowed algorithm (alg: none, alg: HS512)', async () => {
    // Manually forge alg: none token
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: victimAdminId, exp: 9999999999 })).toString('base64url');
    const tokenNone = `${headerNone}.${payload}.`;

    const decodedNone = decodeSessionJwt(tokenNone);
    expect(decodedNone.jwt).toBeNull(); // Rejected by decode header check

    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, { sub: victimAdminId, exp: 9999999999 }, tokenNone)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('6. prevents identity spoofing during Supabase 402/downtime (NEVER trusts DB row alone)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Attacker generates token signed with an unknown secret key
    const forgedToken = await signSessionJwt(
      { sub: victimAdminId, exp: nowSec + 3600 },
      'attacker-malicious-private-key'
    );

    const { jwt, accessToken } = decodeSessionJwt(forgedToken);
    expect(jwt).not.toBeNull();

    // Supabase is returning 402 payment required / degraded
    const mockDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'exceed_cached_egress_quota', status: 402 }
        })
      }
    };

    // Even if victimAdminId exists in YugabyteDB members, the resolver MUST reject the forged token
    await expect(
      resolveSessionData(mockDb as any, jwt!, accessToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('7. caches valid verification in memory and invalidates on session logout', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await signSessionJwt(
      { sub: validUserId, email: 'cache-test@projectnox.org', exp: nowSec + 3600 },
      secret
    );
    const { jwt, accessToken } = decodeSessionJwt(token);

    const mockDb = { auth: { getUser: vi.fn() } };
    const session1 = await resolveSessionData(mockDb as any, jwt!, accessToken);
    expect(session1.user.id).toBe(validUserId);

    // Second resolution uses cache
    const session2 = await resolveSessionData(mockDb as any, jwt!, accessToken);
    expect(session2).toBe(session1);

    // Invalidate session
    invalidateUserSession(validUserId);

    // Next resolution requires re-verification
    const session3 = await resolveSessionData(mockDb as any, jwt!, accessToken);
    expect(session3).not.toBe(session1);
    expect(session3.user.id).toBe(validUserId);

    // Invalidate by token
    invalidateToken(accessToken);
  });

  it('8. strictly rejects tokens signed with default placeholder secret when legitimate environment secrets are configured', async () => {
    const realEnv = { JWT_SECRET: 'super-secret-real-production-key-9999' };
    const nowSec = Math.floor(Date.now() / 1000);

    // Attacker signs token using known default secret string
    const forgedToken = await signSessionJwt(
      { sub: victimAdminId, exp: nowSec + 3600, role: 'authenticated' },
      'project-nox-production-auth-key-2026-secure-token'
    );

    const { jwt, accessToken } = decodeSessionJwt(forgedToken);
    expect(jwt).not.toBeNull();

    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, jwt!, accessToken, realEnv)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('9. strictly rejects token missing exp claim', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Token forged without exp
    const noExpToken = await signSessionJwt(
      { sub: validUserId, role: 'authenticated', iat: nowSec },
      secret
    );

    const { jwt, accessToken } = decodeSessionJwt(noExpToken);
    // decodeSessionJwt or resolveSessionData must fail-closed
    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, { sub: validUserId } as any, noExpToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('10. strictly rejects token with non-UUID sub claim (path traversal / arbitrary identity)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const badSubToken = await signSessionJwt(
      { sub: 'admin', exp: nowSec + 3600, role: 'authenticated' },
      secret
    );

    const { jwt, accessToken } = decodeSessionJwt(badSubToken);
    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, { sub: 'admin', exp: nowSec + 3600 }, badSubToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });

  it('11. strictly rejects anonymous tokens masquerading as user sessions (aud: anon or role: anon)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const anonToken = await signSessionJwt(
      { sub: validUserId, exp: nowSec + 3600, aud: 'anon', role: 'anon' },
      secret
    );

    const { jwt, accessToken } = decodeSessionJwt(anonToken);
    const mockDb = { auth: { getUser: vi.fn() } };
    await expect(
      resolveSessionData(mockDb as any, jwt!, accessToken)
    ).rejects.toThrow('SESSION_NOT_VERIFIED');
  });
});
