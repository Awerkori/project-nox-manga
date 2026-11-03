import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: any) => {
  member(locals);
  if (!locals.user?.id) {
    error(401, 'Entre em sua conta para realizar compras.');
  }

  const body = await request.json().catch(() => ({}));
  const itemId = String(body.itemId || '').trim();

  if (!itemId) {
    error(400, 'Identificador do item não fornecido.');
  }

  const userId = locals.user.id;

  // 1. Fetch item definition from YugabyteDB
  const itemRes = await executeYugabyteSql<{
    id: string;
    name: string;
    price_xp: number;
    min_level: number;
    is_active: boolean;
  }>(
    `SELECT id, name, price_xp, min_level, is_active FROM shop_items WHERE id = $1 LIMIT 1;`,
    [itemId],
    platform?.env
  );

  const item = itemRes.rows[0];
  if (!item) {
    error(404, 'Item não encontrado no catálogo.');
  }

  if (item.is_active === false) {
    error(400, 'Este item não está disponível no momento.');
  }

  // 2. Check if user already owns this item
  const invRes = await executeYugabyteSql(
    `SELECT item_id FROM member_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1;`,
    [userId, itemId],
    platform?.env
  );

  if (invRes.rows.length > 0) {
    return json({ ok: true, item_id: itemId, message: 'Item já adquirido.' });
  }

  // 3. Check user balance and level
  const memberRes = await executeYugabyteSql<{ id: string; xp: number }>(
    `SELECT id, COALESCE(xp, 0) AS xp FROM members WHERE id = $1 LIMIT 1;`,
    [userId],
    platform?.env
  );

  const memberRow = memberRes.rows[0];
  if (!memberRow) {
    error(404, 'Perfil de usuário não encontrado.');
  }

  const currentXp = Number(memberRow.xp) || 0;
  const priceXp = Number(item.price_xp) || 0;
  const minLevel = Number(item.min_level) || 1;
  const userLevel = Math.floor(Math.sqrt(1 + currentXp / 50));

  if (userLevel < minLevel) {
    error(400, `Nível insuficiente. Você precisa do Nível ${minLevel} para desbloquear este item.`);
  }

  if (priceXp > 0 && currentXp < priceXp) {
    error(400, 'XP insuficiente para adquirir este cosmético.');
  }

  // 4. Atomic deduct and inventory insert
  if (priceXp > 0) {
    const updateRes = await executeYugabyteSql(
      `UPDATE members SET xp = xp - $1 WHERE id = $2 AND xp >= $1 RETURNING xp;`,
      [priceXp, userId],
      platform?.env
    );
    if (updateRes.rows.length === 0) {
      error(400, 'Saldo de XP insuficiente.');
    }
  }

  await executeYugabyteSql(
    `INSERT INTO member_inventory (user_id, item_id, acquired_at, origin)
     VALUES ($1, $2, NOW(), 'SHOP')
     ON CONFLICT (user_id, item_id) DO NOTHING;`,
    [userId, itemId],
    platform?.env
  );

  invalidateUserSession(userId);

  return json({
    ok: true,
    item_id: itemId,
    price_xp: priceXp,
    remaining_xp: Math.max(0, currentXp - priceXp)
  });
};
