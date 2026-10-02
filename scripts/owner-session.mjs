import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
export async function ownerCookies(origin = 'http://127.0.0.1:5173') {
  if (!process.env.PUBLIC_SUPABASE_URL || !process.env.PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('OWNER_SESSION_UNAVAILABLE: configure a legitimate Supabase QA session; synthetic JWTs are prohibited.');
  }
  try {
    const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    let email = 'awerkori@gmail.com';
    const linkPromise = admin.auth.admin.generateLink({ type: 'magiclink', email });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth API timeout')), 2000));
    const { data: link, error } = await Promise.race([linkPromise, timeoutPromise]);
    if (error || !link) throw new Error(`OWNER_SESSION_UNAVAILABLE: magic-link generation failed (${error?.message || 'no link'}).`);

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
    if (authError) throw new Error(`OWNER_SESSION_UNAVAILABLE: magic-link verification failed (${authError.message}).`);

    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }));
  } catch (error) {
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
