import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';

export const POST = async ({ request, locals }: any) => {
  const currentUserId = locals.user?.id;
  if (!currentUserId) error(401, 'Não autorizado');

  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body.targetUserId || '').trim();

  if (!targetUserId) {
    error(400, 'Usuário alvo não fornecido.');
  }

  const { data: existing, error: findError } = await safeQuerySingle(
    db.select()
      .from(schema.userFollows)
      .where(
        and(
          eq(schema.userFollows.followerId, currentUserId),
          eq(schema.userFollows.followingId, targetUserId)
        )
      )
  );

  if (findError) error(500, findError.message);

  if (existing) {
    const { error: delErr } = await safeQuerySingle(
      db.delete(schema.userFollows)
        .where(
          and(
            eq(schema.userFollows.followerId, currentUserId),
            eq(schema.userFollows.followingId, targetUserId)
          )
        )
        .returning()
    );
    if (delErr) error(500, delErr.message);
    return json({ following: false });
  } else {
    const { error: insErr } = await safeQuerySingle(
      db.insert(schema.userFollows)
        .values({ 
          followerId: currentUserId, 
          followingId: targetUserId,
          createdAt: new Date().toISOString()
        })
        .returning()
    );
    if (insErr) {
       return json({ following: false });
    }
    return json({ following: true });
  }
};
