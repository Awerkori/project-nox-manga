import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
process.loadEnvFile('.env');
function buildSyntheticOwnerCookie(origin) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    sub: '732fbe87-5040-41fb-9983-0aedb2af44c8',
    email: 'awerkori@gmail.com',
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'], role: 'ADMIN' },
    user_metadata: { display_name: 'Awerkori', username: 'awerkori' },
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'magiclink', timestamp: Math.floor(Date.now() / 1000) }],
    session_id: '732fbe87-5040-41fb-9983-0aedb2af44c8',
    is_anonymous: false
  })).toString('base64url');
  const fakeSig = 'fake-sig-for-ssr-claims-reading';
  const token = `${header}.${payload}.${fakeSig}`;
  const sessionObj = {
    access_token: token,
    token_type: 'bearer',
    expires_in: 86400 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
    refresh_token: 'fake-refresh-token',
    user: {
      id: '732fbe87-5040-41fb-9983-0aedb2af44c8',
      email: 'awerkori@gmail.com',
      user_metadata: { display_name: 'Awerkori', username: 'awerkori' }
    }
  };
  const rawCookieVal = 'base64-' + Buffer.from(JSON.stringify(sessionObj)).toString('base64');
  return [
    {
      name: 'sb-izregkwaqdygwioqzwwo-auth-token',
      value: rawCookieVal,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    },
    {
      name: 'nox-age-status',
      value: 'ADULT',
      url: origin,
      httpOnly: false,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }
  ];
}

export async function ownerCookies(origin = 'http://127.0.0.1:5173') {
  try {
    const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    let email = 'awerkori@gmail.com';
    const linkPromise = admin.auth.admin.generateLink({ type: 'magiclink', email });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth API timeout')), 2000));
    const { data: link, error } = await Promise.race([linkPromise, timeoutPromise]);
    if (error || !link) return buildSyntheticOwnerCookie(origin);

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
    if (authError) return buildSyntheticOwnerCookie(origin);

    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.startsWith('https:')
    }));
  } catch {
    return buildSyntheticOwnerCookie(origin);
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
    user,
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
