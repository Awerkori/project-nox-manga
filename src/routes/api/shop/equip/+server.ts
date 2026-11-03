import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const KIND_TO_COLUMN: Record<string, string> = {
  AVATAR_FRAME: 'avatar_frame_id',
  FRAME: 'avatar_frame_id',
  TITLE: 'equipped_title_id',
  BADGE: 'equipped_badge_id',
  PROFILE_BANNER: 'equipped_banner_id',
  BANNER: 'equipped_banner_id',
  COMMENT_BANNER: 'equipped_comment_banner_id',
  NAME_COLOR: 'name_color',
  COLOR: 'name_color',
  MEDAL: 'equipped_medal_id'
};

export const POST = async ({ request, locals, platform }: any) => {
  member(locals);
  if (!locals.user?.id) {
    error(401, 'Entre em sua conta para equipar cosméticos.');
  }

  const body = await request.json().catch(() => ({}));
  let kind = String(body.kind || '').trim().toUpperCase();
  const itemId = String(body.itemId || '').trim();
  const userId = locals.user.id;

  // Infer kind from item if not provided
  if (!kind && itemId) {
    const baseItemId = itemId.includes(':') ? itemId.split(':')[0] : itemId;
    const itemRes = await executeYugabyteSql<{ kind: string }>(
      `SELECT kind FROM shop_items WHERE id = $1 LIMIT 1;`,
      [baseItemId],
      platform?.env
    );
    if (itemRes.rows[0]?.kind) {
      kind = itemRes.rows[0].kind.toUpperCase();
    }
  }

  if (!kind || !KIND_TO_COLUMN[kind]) {
    error(400, 'Tipo de cosmético inválido ou não suportado.');
  }

  const targetColumn = KIND_TO_COLUMN[kind];

  // If itemId is empty or 'default', user is unequipping
  const isUnequip = !itemId || itemId === 'default' || itemId === 'none';

  if (!isUnequip) {
    const baseItemId = itemId.includes(':') ? itemId.split(':')[0] : itemId;

    // Check ownership in member_inventory or if it is a free default item (price_xp = 0)
    const invRes = await executeYugabyteSql(
      `SELECT item_id FROM member_inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1;`,
      [userId, baseItemId],
      platform?.env
    );

    if (invRes.rows.length === 0) {
      // Check if it's a default 0-cost item
      const freeItemRes = await executeYugabyteSql<{ price_xp: number }>(
        `SELECT price_xp FROM shop_items WHERE id = $1 LIMIT 1;`,
        [baseItemId],
        platform?.env
      );
      const isFree = freeItemRes.rows[0] && Number(freeItemRes.rows[0].price_xp) === 0;
      if (!isFree) {
        error(403, 'Você não possui este cosmético no seu inventário.');
      }
    }
  }

  const finalValue = isUnequip ? null : itemId;

  // Update primary column
  await executeYugabyteSql(
    `UPDATE members SET ${targetColumn} = $1 WHERE id = $2;`,
    [finalValue, userId],
    platform?.env
  );

  // Synchronize comment banner if equipping profile banner or comment banner
  if (kind === 'PROFILE_BANNER' || kind === 'COMMENT_BANNER') {
    await executeYugabyteSql(
      `UPDATE members SET equipped_comment_banner_id = $1, equipped_banner_id = $1 WHERE id = $2;`,
      [finalValue, userId],
      platform?.env
    );
  }

  invalidateUserSession(userId);

  return json({
    ok: true,
    kind,
    equipped: !isUnequip,
    item_id: finalValue
  });
};
