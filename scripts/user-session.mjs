import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
process.loadEnvFile('.env');

export async function userCookiesByEmail(email, origin = 'http://127.0.0.1:5173') {
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
