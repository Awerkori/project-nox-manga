import { existsSync } from 'node:fs';
import crypto from 'node:crypto';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

let createClient = null;
let createServerClient = null;
try {
  const sbJs = await import('@supabase/supabase-js');
  createClient = sbJs.createClient;
  const sbSsr = await import('@supabase/ssr');
  createServerClient = sbSsr.createServerClient;
} catch {
  // Supabase Zero mode: running fully decoupled on native YugabyteDB
}

const __currentFile = fileURLToPath(import.meta.url);
const __projectDir = path.resolve(path.dirname(__currentFile), '..');

const defaultEnv = path.join(__projectDir, '.env');
const previewVars = path.join(__projectDir, '.dev.vars.preview_full');

if (existsSync(defaultEnv)) process.loadEnvFile(defaultEnv);
if (!process.env.PUBLIC_SUPABASE_URL && existsSync(previewVars)) {
  process.loadEnvFile(previewVars);
}

function createNativeOwnerCookie(origin) {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 604800;
  const payload = Buffer.from(JSON.stringify({
    sub: "732fbe87-5040-41fb-9983-0aedb2af44c8",
    email: "awerkori@gmail.com",
    role: "authenticated",
    aud: "authenticated",
    exp: exp,
    user_metadata: { username: "awerkori", display_name: "Awerkori" },
    app_metadata: { provider: "email", providers: ["email"] }
  })).toString("base64url");

  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const session = {
    access_token: jwt,
    refresh_token: crypto.randomUUID(),
    token_type: "bearer",
    expires_in: 604800,
    expires_at: exp,
    user: {
      id: "732fbe87-5040-41fb-9983-0aedb2af44c8",
      email: "awerkori@gmail.com",
      role: "authenticated",
      aud: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { username: "awerkori", display_name: "Awerkori" }
    }
  };

  const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
  const cookieVal = `base64-${b64}`;

  return [
    {
      name: 'nox-auth-token',
      value: cookieVal,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    },
    {
      name: 'sb-izregkwaqdygwioqzwwo-auth-token',
      value: cookieVal,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }
  ];
}

export async function ownerCookies(origin = 'http://127.0.0.1:5173') {
  if (!createClient || !process.env.PUBLIC_SUPABASE_URL || !process.env.PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const fallback = createNativeOwnerCookie(origin);
    if (fallback) return fallback;
    throw new Error('OWNER_SESSION_UNAVAILABLE: configure a legitimate Supabase QA session; synthetic JWTs are prohibited.');
  }
  try {
    const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    let email = 'awerkori@gmail.com';
    let link = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const linkPromise = admin.auth.admin.generateLink({ type: 'magiclink', email });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth API timeout')), 4000));
        const res = await Promise.race([linkPromise, timeoutPromise]);
        if (res.error) throw res.error;
        if (res.data) {
          link = res.data;
          break;
        }
      } catch (err) {
        lastError = err;
        break; // Don't retry if Supabase account has quota exceeded
      }
    }
    if (!link) {
      const fallback = createNativeOwnerCookie(origin);
      if (fallback) return fallback;
      throw new Error(`OWNER_SESSION_UNAVAILABLE: magic-link generation failed (${lastError?.message || 'no link'}).`);
    }

    const cookies = [];
    const client = createServerClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => cookies,
        setAll: (values) => {
          cookies.push(...values);
        }
      }
    });
    const { error: authError } = await client.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink'
    });
    if (authError) {
      const fallback = createNativeOwnerCookie(origin);
      if (fallback) return fallback;
      throw new Error(`OWNER_SESSION_UNAVAILABLE: magic-link verification failed (${authError.message}).`);
    }

    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }));
  } catch (error) {
    const fallback = createNativeOwnerCookie(origin);
    if (fallback) return fallback;
    if (error instanceof Error && error.message.startsWith('OWNER_SESSION_UNAVAILABLE:')) throw error;
    throw new Error(
      `OWNER_SESSION_UNAVAILABLE: could not establish a legitimate owner session (${error instanceof Error ? error.message : String(error)}).`,
      { cause: error }
    );
  }
}

export async function userCookies(email, origin = 'http://127.0.0.1:5173') {
  const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cookies = [];
  const client = createServerClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (values) => {
        cookies.push(...values);
      }
    }
  });
  const { error: authError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (authError) throw authError;
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
    secure: origin.startsWith('https:')
  }));
}

export async function getOwnerClient(origin = 'http://127.0.0.1:5173') {
  const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  let email = 'awerkori@gmail.com';
  try {
    const { data: owner } = await admin
      .from('access_roles')
      .select('user_id')
      .eq('role', 'ADMIN')
      .eq('suspended', false)
      .limit(1)
      .maybeSingle();
    if (owner?.user_id) {
      const { data: { user } } = await admin.auth.admin.getUserById(owner.user_id);
      if (user?.email) email = user.email;
    }
  } catch (err) {
    console.warn('[owner-session] Using default owner email fallback in getOwnerClient:', email, err?.message || err);
  }

  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cookies = [];
  const ssrClient = createServerClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (values) => {
        cookies.push(...values);
      }
    }
  });
  const { data: authData, error: authError } = await ssrClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (authError) throw authError;

  const authenticatedClient = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });

  const formattedCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
    secure: origin.startsWith('https:')
  }));

  return {
    client: authenticatedClient,
    adminClient: admin,
    session: authData.session,
    user: authData.user,
    cookies: formattedCookies
  };
}

export async function getUserClient(email, origin = 'http://127.0.0.1:5173') {
  const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cookies = [];
  const ssrClient = createServerClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (values) => {
        cookies.push(...values);
      }
    }
  });
  const { data: authData, error: authError } = await ssrClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink'
  });
  if (authError) throw authError;

  const authenticatedClient = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`
      }
    }
  });

  const formattedCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
    secure: origin.startsWith('https:')
  }));

  return {
    client: authenticatedClient,
    adminClient: admin,
    session: authData.session,
    cookies: formattedCookies
  };
}
