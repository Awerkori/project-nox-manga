import { createClient } from '@supabase/supabase-js';
import { databaseConfig } from './config';
import { error } from '@sveltejs/kit';
export async function inviteEditor(locals: App.Locals, email: string) {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const {
    data: { session }
  } = await locals.db.auth.getSession();
  if (!session) error(401, 'Entre novamente para autorizar a staff.');
  const { url, key } = databaseConfig();
  const caller = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: problem } = await caller.rpc('invite_editor', { p_email: email });
  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);
}
export async function claimInvite(locals: App.Locals) {
  const {
    data: { session }
  } = await locals.db.auth.getSession();
  if (!session) return;
  const { url, key } = databaseConfig();
  const caller = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await caller.rpc('claim_editor_invite');
  if (error) console.error('Editor invite could not be checked:', error.code);
}
