import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: any) => {
  if (!locals.user?.id) {
    error(401, 'Entre em uma conta confirmada para continuar.');
  }
  const currentUserId = locals.user.id;
  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();

  if (!targetUserId) {
    error(400, 'Usuário alvo não fornecido.');
  }

  if (targetUserId === currentUserId) {
    error(400, 'Você não pode seguir a si mesmo.');
  }

  try {
    const existing = await executeYugabyteSql(
      `SELECT 1 FROM public.user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1;`,
      [currentUserId, targetUserId],
      platform?.env
    );

    if (existing.rows && existing.rows.length > 0) {
      await executeYugabyteSql(
        `DELETE FROM public.user_follows WHERE follower_id = $1 AND following_id = $2;`,
        [currentUserId, targetUserId],
        platform?.env
      );
      return json({ following: false });
    } else {
      await executeYugabyteSql(
        `INSERT INTO public.user_follows (follower_id, following_id, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT (follower_id, following_id) DO NOTHING;`,
        [currentUserId, targetUserId],
        platform?.env
      );
      return json({ following: true });
    }
  } catch (err: any) {
    console.error('[FOLLOW_ERROR]', err);
    error(500, 'Erro ao atualizar seguidor.');
  }
};
