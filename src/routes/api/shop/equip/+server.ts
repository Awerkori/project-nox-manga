import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { member } from '$lib/server/db';

export const POST = async ({ request, locals }: any) => {
  const userId = member(locals);
  const body = await request.json().catch(() => ({}));
  let kind = String(body.kind || '').trim();
  const itemId = String(body.itemId || '').trim(); // if empty, unequips

  if (!kind && itemId) {
    const { data: item } = await safeQuerySingle(
      db.select({ kind: schema.shopItems.kind })
        .from(schema.shopItems)
        .where(eq(schema.shopItems.id, itemId))
    );
    if (item?.kind) kind = item.kind;
  }

  if (!kind) {
    error(400, 'Tipo de cosmético não fornecido.');
  }

  if (itemId) {
    // Check if user owns it
    const { data: owns } = await safeQuerySingle(
      db.select()
        .from(schema.memberInventory)
        .where(and(eq(schema.memberInventory.userId, userId), eq(schema.memberInventory.itemId, itemId)))
    );
    if (!owns) {
      error(400, 'Você não possui este item.');
    }
  }

  let updatePayload: any = {};
  switch (kind) {
    case 'TITLE':
      updatePayload = { equippedTitleId: itemId || null };
      break;
    case 'BADGE':
      updatePayload = { equippedBadgeId: itemId || null };
      break;
    case 'AVATAR_FRAME':
      updatePayload = { avatarFrameId: itemId || null };
      break;
    case 'NAME_COLOR':
      // The shop item might actually carry the style_data for name_color?
      // Actually, if it's name color, the ID might be stored or the actual color?
      // Supabase RPC 'equip_cosmetic_item' likely stored itemId in name_color or similar, wait, `nameColor` is text, let's just store itemId.
      updatePayload = { nameColor: itemId || null };
      break;
    case 'PROFILE_BANNER':
      updatePayload = { equippedBannerId: itemId || null };
      break;
    case 'COMMENT_BANNER':
      updatePayload = { equippedCommentBannerId: itemId || null };
      break;
    default:
      error(400, 'Tipo de cosmético desconhecido: ' + kind);
  }

  const { error: updErr } = await safeQuerySingle(
    db.update(schema.members)
      .set(updatePayload)
      .where(eq(schema.members.id, userId))
      .returning()
  );

  if (updErr) {
    error(500, updErr.message);
  }

  return json({ success: true, kind, itemId });
};
