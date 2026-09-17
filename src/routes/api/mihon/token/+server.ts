import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { generateMihonToken } from '$lib/server/mihon';

export const GET = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const userId = locals.user.id;

  const { data, error } = await safeQuery(
    db.select({id: schema.mihonTokens.id,
      deviceName: schema.mihonTokens.deviceName,
      createdAt: schema.mihonTokens.createdAt,
      expiresAt: schema.mihonTokens.expiresAt})
    .from(schema.mihonTokens)
    .where(and(eq(schema.mihonTokens.userId, userId), eq(schema.mihonTokens.revoked, false)))
    .orderBy(desc(schema.mihonTokens.createdAt))
  );

  if (error) {
    return json({ error: 'Erro ao carregar tokens' }, { status: 500 });
  }

  return json({ tokens: data || [] });
};

export const POST = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const userId = locals.user.id;

  let deviceName = 'Mihon App';
  try {
    const body = await request.json();
    if (body.deviceName && typeof body.deviceName === 'string') {
      deviceName = body.deviceName.slice(0, 50);
    }
  } catch {
    // Body optional
  }

  try {
    const { token, expiresAt } = await generateMihonToken(userId, deviceName);
    return json({token, expiresAt: expiresAt});
  } catch (err) {
    return json({ error: (err as Error).message || 'Erro ao gerar token' }, { status: 500 });
  }
};

export const DELETE = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const userId = locals.user.id;

  let tokenId = '';
  try {
    const body = await request.json();
    tokenId = body.id;
  } catch {
    return json({ error: 'ID do token  obrigatrio' }, { status: 400 });
  }

  if (!tokenId) {
    return json({ error: 'ID do token  obrigatrio' }, { status: 400 });
  }

  const { error } = await safeQuery(
    db.update(schema.mihonTokens)
      .set({ revoked: true })
      .where(and(eq(schema.mihonTokens.id, tokenId), eq(schema.mihonTokens.userId, userId)))
  );

  if (error) {
    return json({ error: 'Erro ao revogar token' }, { status: 500 });
  }

  return json({ ok: true });
};
