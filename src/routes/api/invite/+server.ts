import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
export const POST = async ({ request, locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail inválido');
  // Use the caller's session, never the service key, for role management.
  const {
    data: { session }
  } = await locals.db.auth.getSession();
  if (!session) error(401);
  const caller = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: problem } = await caller.rpc('invite_editor', { p_email: email });
  if (problem) error(400, problem.message);
  return json({
    message:
      'Convite de editor registrado. A permissão será vinculada quando essa pessoa confirmar o e-mail e entrar na conta.'
  });
};
