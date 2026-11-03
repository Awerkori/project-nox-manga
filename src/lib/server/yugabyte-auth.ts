import { executeYugabyteSql } from './yugabyte';
import type { Cookies } from '@sveltejs/kit';

export interface DecodedAuthToken {
  sub: string;
  email?: string;
  exp?: number;
  role?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email: string;
    aud?: string;
    role?: string;
    email_confirmed_at?: string | null;
    app_metadata?: Record<string, any>;
    user_metadata?: Record<string, any>;
  };
}

export const AUTH_COOKIE_NAME = 'nox-auth-token';
export const LEGACY_AUTH_COOKIE_NAME = 'sb-izregkwaqdygwioqzwwo-auth-token';

export function getAuthSecrets(platformEnv?: any): string[] {
  const secrets = new Set<string>();
  const add = (s?: string) => {
    if (s && typeof s === 'string' && s.trim()) secrets.add(s.trim());
  };
  add(platformEnv?.AUTH_SECRET);
  add(platformEnv?.JWT_SECRET);
  add(platformEnv?.BETTER_AUTH_SECRET);
  add(platformEnv?.SUPABASE_JWT_SECRET);
  add(platformEnv?.SUPABASE_SERVICE_ROLE_KEY);
  if (typeof process !== 'undefined' && process.env) {
    add(process.env.AUTH_SECRET);
    add(process.env.JWT_SECRET);
    add(process.env.BETTER_AUTH_SECRET);
    add(process.env.SUPABASE_JWT_SECRET);
    add(process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return Array.from(secrets);
}

export function getAuthSecret(platformEnv?: any): string {
  const secrets = getAuthSecrets(platformEnv);
  if (secrets.length === 0) {
    throw new Error('AUTH_SECRET_MISSING: Nenhum segredo criptográfico de autenticação configurado no ambiente.');
  }
  return secrets[0];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jwksCache = new Map<string, { key: CryptoKey; cachedAt: number }>();

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign a standard HS256 JWT using Web Crypto API (works in CF Workers and Node)
 */
export async function signSessionJwt(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigBytes = new Uint8Array(sig);
  let binarySig = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    binarySig += String.fromCharCode(sigBytes[i]);
  }
  const sigB64 = btoa(binarySig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sigB64}`;
}

/**
 * Verify HS256 JWT signature, algorithm, payload claims, and expiration
 */
export async function verifySessionJwt(token: string, secret: string): Promise<DecodedAuthToken | null> {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // 1. Strict header validation: algorithm MUST be HS256
    const headerJson = base64UrlDecode(parts[0]);
    const header = JSON.parse(headerJson);
    if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
      return null;
    }

    // 2. Strict payload validation
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as DecodedAuthToken;
    if (!payload || typeof payload !== 'object' || !payload.sub || typeof payload.sub !== 'string' || !UUID_REGEX.test(payload.sub)) {
      return null;
    }

    // Reject anonymous tokens masquerading as user sessions
    if ((payload as any).role === 'anon' || payload.aud === 'anon') {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    // Expiration is MANDATORY for session security
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return null;
    }
    // Issued at sanity: allow up to 300s clock skew into future, reject far future
    if ((payload as any).iat !== undefined && (typeof (payload as any).iat !== 'number' || (payload as any).iat > nowSec + 300)) {
      return null;
    }
    if ((payload as any).nbf !== undefined && (typeof (payload as any).nbf !== 'number' || (payload as any).nbf > nowSec + 60)) {
      return null;
    }

    // 3. Cryptographic HMAC signature check
    const data = `${parts[0]}.${parts[1]}`;
    let sigBase64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4 !== 0) {
      sigBase64 += '=';
    }
    const binarySig = atob(sigBase64);
    const sigBytes = Uint8Array.from(binarySig, (c) => c.charCodeAt(0));

    const key = await getHmacKey(secret);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!isValid) return null;

    return payload;
  } catch {
    return null;
  }
}

async function verifyWithJwks(_token: string, _platformEnv?: any): Promise<DecodedAuthToken | null> {
  // Supabase JWKS decoupled - native Yugabyte auth uses Web Crypto HMAC
  return null;
}

/**
 * Verify JWT signature across all candidate environment secrets (HS256) and JWKS (RS256/ES256)
 */
export async function verifySessionJwtAny(token: string, platformEnv?: any): Promise<DecodedAuthToken | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    if (header?.alg === 'RS256' || header?.alg === 'ES256') {
      return await verifyWithJwks(token, platformEnv);
    }
  } catch {
    return null;
  }

  const secrets = getAuthSecrets(platformEnv);
  for (const secret of secrets) {
    const verified = await verifySessionJwt(token, secret);
    if (verified) return verified;
  }
  return null;
}

/**
 * Direct authoritative YugabyteDB password authentication
 */
export async function authenticateWithYugabyte(
  email: string,
  pass: string,
  platformEnv?: any
): Promise<{ success: boolean; session?: AuthSession; error?: any }> {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(pass || '');

  if (!trimmedEmail || !rawPassword) {
    return {
      success: false,
      error: { message: 'Informe seu e-mail e senha para continuar.', status: 400 }
    };
  }

  try {
    const res = await executeYugabyteSql(
      `SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
              (encrypted_password IS NOT NULL AND encrypted_password != '' AND encrypted_password = crypt($2, encrypted_password)) AS matched
       FROM auth.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1;`,
      [trimmedEmail, rawPassword],
      platformEnv
    );

    const userRow = res.rows[0];
    if (!userRow || !userRow.matched) {
      return {
        success: false,
        error: { message: 'Não foi possível entrar. Confira o e-mail, a senha e a confirmação da conta.', status: 400 }
      };
    }

    if (!userRow.email_confirmed_at) {
      return {
        success: false,
        error: {
          message: 'Verifique seu e-mail para continuar.',
          unconfirmed: true,
          status: 400
        }
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 60 * 24 * 30; // 30 days
    const exp = nowSec + expiresIn;
    const secret = getAuthSecret(platformEnv);

    const tokenPayload = {
      aud: 'authenticated',
      exp,
      sub: userRow.id,
      email: userRow.email,
      phone: '',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: userRow.raw_user_meta_data || {},
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: nowSec }],
      session_id: crypto.randomUUID()
    };

    const accessToken = await signSessionJwt(tokenPayload, secret);
    const refreshToken = crypto.randomUUID();

    const session: AuthSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: exp,
      user: {
        id: userRow.id,
        email: userRow.email,
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: userRow.email_confirmed_at,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: userRow.raw_user_meta_data || {}
      }
    };

    return { success: true, session };
  } catch (err: any) {
    console.error('[YUGABYTE_AUTH_ERROR]', err?.message || err);
    return {
      success: false,
      error: { message: 'Não foi possível processar o login no momento. Tente novamente em instantes.', status: 500 }
    };
  }
}

/**
 * Set the standard base64-encoded cookie recognized by @supabase/ssr and session-cache
 */
export function setAuthCookie(cookies: Cookies, session: AuthSession, isSecure: boolean): void {
  // Clear any stale chunked cookies (.0, .1, etc.) and legacy cookies before writing the fresh session
  if (typeof cookies.getAll === 'function') {
    for (const c of cookies.getAll()) {
      if (/^sb-.*-auth-token(?:\.\d+)?$/.test(c.name) || c.name === LEGACY_AUTH_COOKIE_NAME) {
        cookies.delete(c.name, { path: '/' });
      }
    }
  }
  try {
    cookies.delete(LEGACY_AUTH_COOKIE_NAME, { path: '/' });
  } catch {}

  const jsonStr = JSON.stringify(session);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  const cookieVal = `base64-${b64}`;

  cookies.set(AUTH_COOKIE_NAME, cookieVal, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: session.expires_in
  });
}

/**
 * Clear all Supabase and Nox auth cookies
 */
export function clearAllAuthCookies(cookies: Cookies): void {
  try {
    cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
    cookies.delete(LEGACY_AUTH_COOKIE_NAME, { path: '/' });
    cookies.delete('nox-auth-token', { path: '/' });
  } catch {}

  if (typeof cookies.getAll === 'function') {
    for (const c of cookies.getAll()) {
      if (/^sb-.*-auth-token(?:\.\d+)?$/.test(c.name) || c.name === AUTH_COOKIE_NAME || c.name === LEGACY_AUTH_COOKIE_NAME || c.name === 'nox-auth-token') {
        cookies.delete(c.name, { path: '/' });
      }
    }
  }
}

/**
 * Direct authoritative YugabyteDB user registration
 */
export async function registerWithYugabyte(
  email: string,
  pass: string,
  rawUsername: string,
  displayName: string,
  platformEnv?: any
): Promise<{ success: boolean; user?: any; error?: any }> {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(pass || '');
  const username = String(rawUsername || '').trim().toLowerCase();
  const name = String(displayName || '').trim() || username;

  if (!trimmedEmail || !rawPassword || !username) {
    return {
      success: false,
      error: { message: 'Dados incompletos para cadastro.', status: 400 }
    };
  }

  try {
    // 1. Check email collision
    const existingEmail = await executeYugabyteSql(
      `SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
      [trimmedEmail],
      platformEnv
    );
    if (existingEmail.rows && existingEmail.rows.length > 0) {
      return {
        success: false,
        error: { message: 'Este e-mail já está cadastrado.', status: 400 }
      };
    }

    // 2. Check username collision
    const existingUsername = await executeYugabyteSql(
      `SELECT id FROM members WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
      [username],
      platformEnv
    );
    if (existingUsername.rows && existingUsername.rows.length > 0) {
      return {
        success: false,
        error: { message: `O nome de usuário @${username} já está em uso.`, status: 400 }
      };
    }

    const userId = crypto.randomUUID();
    const metadata = JSON.stringify({ username, display_name: name });
    const appMetadata = JSON.stringify({ provider: 'email', providers: ['email'] });

    await executeYugabyteSql(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
       VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), NULL, $4::jsonb, $5::jsonb);`,
      [userId, trimmedEmail, rawPassword, metadata, appMetadata],
      platformEnv
    );

    await executeYugabyteSql(
      `INSERT INTO members (id, username, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name;`,
      [userId, username, name],
      platformEnv
    );

    await executeYugabyteSql(
      `INSERT INTO access_roles (user_id, role, suspended)
       VALUES ($1, 'USER', false)
       ON CONFLICT (user_id) DO NOTHING;`,
      [userId],
      platformEnv
    );

    return {
      success: true,
      user: { id: userId, email: trimmedEmail, username, display_name: name, unconfirmed: true }
    };
  } catch (err: any) {
    console.error('[YUGABYTE_SIGNUP_ERROR]', err?.message || err);
    return {
      success: false,
      error: { message: 'Não foi possível cadastrar no momento. Tente novamente.', status: 500 }
    };
  }
}

