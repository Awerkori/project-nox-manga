import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: any) => {
  if (!locals.user?.id) {
    error(401, 'Entre em uma conta confirmada para continuar.');
  }
  const currentUserId = locals.user.id;
  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();
  const unblock = body.action === 'unblock';

  if (!targetUserId) {
    error(400, 'Usuário alvo não informado.');
  }

  if (targetUserId === currentUserId) {
    error(400, 'Você não pode bloquear a si mesmo.');
  }

  try {
    if (unblock) {
      await executeYugabyteSql(
        `DELETE FROM public.user_blocks WHERE user_id = $1 AND blocked_id = $2;`,
        [currentUserId, targetUserId],
        platform?.env
      );
      return json({ blocked: false });
    } else {
      // Unfollow in both directions when blocking
      await executeYugabyteSql(
        `DELETE FROM public.user_follows 
         WHERE (follower_id = $1 AND following_id = $2)
            OR (follower_id = $2 AND following_id = $1);`,
        [currentUserId, targetUserId],
        platform?.env
      );

      await executeYugabyteSql(
        `INSERT INTO public.user_blocks (user_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, blocked_id) DO NOTHING;`,
        [currentUserId, targetUserId],
        platform?.env
      );
      return json({ blocked: true });
    }
  } catch (err: any) {
    console.error('[BLOCK_ERROR]', err);
    error(500, 'Erro ao processar bloqueio.');
  }
};
