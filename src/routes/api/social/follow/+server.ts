import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';

export const POST = async ({ request, locals }) => {
  member(locals);
  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();

  if (!targetUserId) {
    error(400, 'Usuário alvo não fornecido.');
  }

  const { data, error: rpcError } = await locals.db.rpc('toggle_follow_user', {
    p_target_user_id: targetUserId
  });

  if (rpcError) {
    error(400, rpcError.message);
  }

  return json(data);
};
