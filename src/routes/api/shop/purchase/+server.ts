import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';


export const POST = async ({ request, locals }: any) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const userId = locals.user.id;
  const body = await request.json().catch(() => ({}));
  const itemId = String(body.itemId || '').trim();

  if (!itemId) {
    error(400, 'Identificador do item no fornecido.');
  }

  // Find item
  const { data: item, error: itemErr } = await safeQuerySingle(
    db.select().from(schema.shopItems).where(eq(schema.shopItems.id, itemId))
  );

  if (itemErr) error(500, 'Erro ao buscar item');
  if (!item) error(404, 'Item no encontrado');
  if (!item.isActive) error(400, 'Item no est disponvel para compra');

  // Find member
  const { data: m, error: mErr } = await safeQuerySingle(
    db.select({ xp: schema.members.xp }).from(schema.members).where(eq(schema.members.id, userId))
  );

  if (mErr || !m) error(500, 'Erro ao buscar usurio');

  if (m.xp < item.priceXp) {
    error(400, 'XP insuficiente para comprar este item.');
  }

  // Check if already owns
  const { data: existing } = await safeQuerySingle(
    db.select()
      .from(schema.memberInventory)
      .where(and(eq(schema.memberInventory.userId, userId), eq(schema.memberInventory.itemId, itemId)))
  );

  if (existing) {
    error(400, 'Voc j possui este item.');
  }

  // Do transaction or just two queries
  // 1. Deduct XP
  const { error: updErr } = await safeQuerySingle(
    db.update(schema.members)
      .set({ xp: sql`${schema.members.xp} - ${item.priceXp}` })
      .where(eq(schema.members.id, userId))
      .returning()
  );

  if (updErr) error(500, 'Erro ao processar compra');

  // 2. Add to inventory
  const { error: insErr } = await safeQuerySingle(
    db.insert(schema.memberInventory)
      .values({
        userId,
        itemId,
        acquiredAt: new Date().toISOString(),
        origin: 'SHOP'
      })
      .returning()
  );

  if (insErr) {
    // Ideally we would rollback, but SQLite without a transaction helper from safeQuery is tricky.
    // For now we just return error.
    error(500, 'Erro ao adicionar item ao inventrio');
  }

  return json({ success: true, item });
};
