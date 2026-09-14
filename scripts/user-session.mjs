import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
process.loadEnvFile('.env');

import fs from 'node:fs';

const CACHE_FILE = '/tmp/nox_auth_cookies_cache.json';
function loadDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveDiskCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch {}
}

const cookieCache = new Map();

export async function userCookiesByEmail(email, origin = 'http://127.0.0.1:5173') {
  const cacheKey = `${email}:${origin}`;
  const diskCache = loadDiskCache();
  if (diskCache[cacheKey] && Date.now() - diskCache[cacheKey].time < 7200_000) {
    return diskCache[cacheKey].cookies;
  }
  const cached = cookieCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 7200_000) {
    return cached.cookies;
  }

  const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  let link, error;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    link = res.data;
    error = res.error;
    if (!error) break;
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
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
  const mappedCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    url: origin,
    httpOnly: true,
    sameSite: 'Lax',
    secure: origin.startsWith('https:')
  }));
  cookieCache.set(cacheKey, { time: Date.now(), cookies: mappedCookies });
  diskCache[cacheKey] = { time: Date.now(), cookies: mappedCookies };
  saveDiskCache(diskCache);
  return mappedCookies;
}

export async function editorCookies(origin = 'http://127.0.0.1:5173') {
  const admin = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: editorRole } = await admin
    .from('access_roles')
    .select('user_id')
    .eq('role', 'EDITOR')
    .eq('suspended', false)
    .limit(1)
    .maybeSingle();
  if (!editorRole) throw new Error('Nenhum editor ativo encontrado no banco público.');
  const {
    data: { user },
    error: userError
  } = await admin.auth.admin.getUserById(editorRole.user_id);
  if (userError || !user?.email) throw new Error('Dados do editor não encontrados.');
  return userCookiesByEmail(user.email, origin);
}
