import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';

export const POST = async ({ request, locals }) => {
  const currentUserId = member(locals);
  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();
  const unblock = body.action === 'unblock';

  if (!targetUserId) {
    error(400, 'Usuário alvo não informado.');
  }

  if (targetUserId === currentUserId) {
    error(400, 'Você não pode bloquear a si mesmo.');
  }

  if (unblock) {
    const { error: delErr } = await locals.db
      .from('user_blocks')
      .delete()
      .eq('user_id', currentUserId)
      .eq('blocked_id', targetUserId);

    if (delErr) error(500, delErr.message);
    return json({ blocked: false });
  } else {
    // Unfollow in both directions when blocking
    await locals.db
      .from('user_follows')
      .delete()
      .or(`and(follower_id.eq.${currentUserId},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${currentUserId})`);

    const { error: insErr } = await locals.db
      .from('user_blocks')
      .insert({ user_id: currentUserId, blocked_id: targetUserId })
      .select()
      .single();

    if (insErr && insErr.code !== '23505') {
      error(500, insErr.message);
    }
    return json({ blocked: true });
  }
};
