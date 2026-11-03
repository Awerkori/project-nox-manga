import { describe, it, expect } from 'vitest';
import { signSessionJwt, verifySessionJwt, getAuthSecret, setAuthCookie, AUTH_COOKIE_NAME, clearAllAuthCookies } from '../src/lib/server/yugabyte-auth';
import { decodeSessionJwt } from '../src/lib/server/session-cache';

describe('yugabyte-auth JWT and cookie handling', () => {
  it('signs and verifies HS256 JWT tokens using Web Crypto', async () => {
    const secret = getAuthSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      sub: '014ae9db-a1f2-48d6-9922-766799c265ea',
      email: '0nlyanimer@gmail.com',
      role: 'authenticated',
      exp: nowSec + 3600
    };

    const token = await signSessionJwt(payload, secret);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifySessionJwt(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.email).toBe(payload.email);
  });

  it('rejects tampered tokens', async () => {
    const secret = getAuthSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-1', exp: nowSec + 3600 };
    const token = await signSessionJwt(payload, secret);

    const tampered = token.slice(0, -4) + 'zzzz';
    const result = await verifySessionJwt(tampered, secret);
    expect(result).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const secret = getAuthSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-1', exp: nowSec - 10 }; // expired 10s ago
    const token = await signSessionJwt(payload, secret);

    const result = await verifySessionJwt(token, secret);
    expect(result).toBeNull();
  });

  it('formats cookies compatible with @supabase/ssr base64- prefix and session-cache', async () => {
    const secret = getAuthSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-test-uuid', email: 'test@nox.org', exp: nowSec + 3600 };
    const token = await signSessionJwt(payload, secret);

    const session = {
      access_token: token,
      refresh_token: 'refresh-token-uuid',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: nowSec + 3600,
      user: { id: payload.sub, email: payload.email }
    };

    let setCookieName = '';
    let setCookieVal = '';
    const mockCookies: any = {
      set: (name: string, val: string) => {
        setCookieName = name;
        setCookieVal = val;
      }
    };

    setAuthCookie(mockCookies, session, true);
    expect(setCookieName).toBe(AUTH_COOKIE_NAME);
    expect(setCookieVal.startsWith('base64-')).toBe(true);

    const decoded = decodeSessionJwt(setCookieVal);
    expect(decoded.jwt).not.toBeNull();
    expect(decoded.jwt?.sub).toBe(payload.sub);
    expect(decoded.accessToken).toBe(token);
  });

  it('cleans all auth cookies on logout', () => {
    const cookiesDeleted: string[] = [];
    const mockCookies: any = {
      getAll: () => [
        { name: AUTH_COOKIE_NAME, value: 'val' },
        { name: `${AUTH_COOKIE_NAME}.0`, value: 'val' },
        { name: 'other_cookie', value: '123' }
      ],
      delete: (name: string) => {
        cookiesDeleted.push(name);
      }
    };

    clearAllAuthCookies(mockCookies);
    expect(cookiesDeleted).toContain(AUTH_COOKIE_NAME);
    expect(cookiesDeleted).toContain(`${AUTH_COOKIE_NAME}.0`);
    expect(cookiesDeleted).not.toContain('other_cookie');
  });
});
