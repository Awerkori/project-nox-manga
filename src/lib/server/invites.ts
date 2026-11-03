import { createClient } from '@supabase/supabase-js';
import { databaseConfig } from './config';
import { error } from '@sveltejs/kit';
import { executeYugabyteSql } from './yugabyte';

export async function inviteEditor(locals: App.Locals, email: string, platformEnv?: any) {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) error(400, 'Informe um e-mail válido.');

  try {
    await executeYugabyteSql(
      `INSERT INTO public.editor_invites (created_by, email, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT DO NOTHING;`,
      [locals.user?.id || null, targetEmail],
      platformEnv
    );
    return;
  } catch {
    // Fallback to legacy RPC
  }

  if (locals.db?.auth?.getSession) {
    try {
      const {
        data: { session }
      } = await locals.db.auth.getSession();
      if (!session) error(401, 'Entre novamente para autorizar a staff.');
      const { url, key } = databaseConfig();
      const caller = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { error: problem } = await caller.rpc('invite_editor', { p_email: targetEmail });
      if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);
    } catch (e: any) {
      if (e?.status) throw e;
    }
  }
}

export async function claimInvite(locals: App.Locals, platformEnv?: any) {
  if (!locals.user?.id || !locals.user?.email) return;

  try {
    const inviteRes = await executeYugabyteSql(
      `SELECT email FROM public.editor_invites WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
      [locals.user.email],
      platformEnv
    );
    if (inviteRes.rows && inviteRes.rows.length > 0) {
      await executeYugabyteSql(
        `UPDATE public.access_roles SET role = 'EDITOR' WHERE user_id = $1 AND role = 'USER';`,
        [locals.user.id],
        platformEnv
      );
      await executeYugabyteSql(
        `DELETE FROM public.editor_invites WHERE LOWER(email) = LOWER($1);`,
        [locals.user.email],
        platformEnv
      );
      return;
    }
  } catch {
    // Secondary fallback to legacy GoTrue RPC if in test double
  }

  if (locals.db?.auth?.getSession) {
    try {
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
    } catch {}
  }
}
