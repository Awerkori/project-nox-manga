import { error } from '@sveltejs/kit';
import { executeYugabyteSql } from './yugabyte';

export async function inviteEditor(locals: App.Locals, email: string, platformEnv?: any) {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) error(400, 'Informe um e-mail válido.');

  await executeYugabyteSql(
    `INSERT INTO public.editor_invites (created_by, email, created_at)
     VALUES ($1, $2, now())
     ON CONFLICT DO NOTHING;`,
    [locals.user?.id || null, targetEmail],
    platformEnv
  );
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
    }
  } catch (err: any) {
    console.error('[CLAIM_INVITE_ERROR]', err?.message || err);
  }
}
