import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, or } from 'drizzle-orm';

export const POST = async ({ request, locals }: any) => {
  const currentUserId = locals.user?.id;
  if (!currentUserId) error(401, 'No autorizado');

  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();
  const unblock = body.action === 'unblock';

  if (!targetUserId) {
    error(400, 'Usurio alvo no informado.');
  }

  if (targetUserId === currentUserId) {
    error(400, 'Voc no pode bloquear a si mesmo.');
  }

  if (unblock) {
    const { error: delErr } = await safeQuerySingle(
      db.delete(schema.userBlocks)
        .where(
          and(
            eq(schema.userBlocks.userId, currentUserId),
            eq(schema.userBlocks.blockedId, targetUserId)
          )
        )
        .returning()
    );

    if (delErr) error(500, (delErr as any).message);
    return json({ blocked: false });
  } else {
    // Unfollow in both directions when blocking
    await safeQuery(
      db.delete(schema.userFollows)
        .where(
          or(
            and(
              eq(schema.userFollows.followerId, currentUserId),
              eq(schema.userFollows.followingId, targetUserId)
            ),
            and(
              eq(schema.userFollows.followerId, targetUserId),
              eq(schema.userFollows.followingId, currentUserId)
            )
          )
        )
        .returning()
    );

    const { error: insErr } = await safeQuerySingle(
      db.insert(schema.userBlocks)
        .values({ 
          userId: currentUserId, 
          blockedId: targetUserId,
          createdAt: new Date().toISOString()
        })
        .returning()
    );

    if (insErr) {
      error(500, (insErr as any).message);
    }
    return json({ blocked: true });
  }
};
