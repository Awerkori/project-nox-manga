import { json, error } from '@sveltejs/kit';
import { member, privileged } from '$lib/server/db';
import { storeImage, RateLimitError } from '$lib/server/media';
import { normalizeAvatarCrop } from '$lib/avatar';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: { request: Request; locals: App.Locals; platform?: any }) => {
  const userId = member(locals);
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) error(400, 'Selecione uma imagem.');

  const crop = normalizeAvatarCrop({
    x: formData.get('crop_x'),
    y: formData.get('crop_y'),
    zoom: formData.get('crop_zoom')
  });

  let image;
  try {
    image = await storeImage(formData, userId, 'avatar');
  } catch (err) {
    if (err instanceof RateLimitError) {
      return json(
        { message: 'Muitas requisições. Aguarde alguns instantes.', retryAfter: err.retryAfter },
        { status: 429, headers: { 'retry-after': String(err.retryAfter) } }
      );
    }
    console.error('API_AVATAR_STORE_ERROR:', err);
    throw err;
  }

  let ybSuccess = false;
  try {
    const ybRes = await executeYugabyteSql(
      `UPDATE public.members SET avatar_id = $1, avatar_crop = $2 WHERE id = $3`,
      [image.id, JSON.stringify(crop), userId],
      platform?.env
    );
    if (ybRes && ybRes.rowCount > 0) {
      ybSuccess = true;
    }
    await executeYugabyteSql(
      `UPDATE public."user" SET image = $1, "updatedAt" = NOW() WHERE id = $2`,
      [`/media/${image.id}`, userId],
      platform?.env
    ).catch(() => {});
  } catch (ybProblem) {
    console.warn('api_avatar_yugabyte_update_warning', ybProblem);
  }

  // Best-effort sync to legacy Supabase
  try {
    await privileged()
      .from('members')
      .update({ avatar_id: image.id, avatar_crop: crop })
      .eq('id', userId);
  } catch (supaProblem) {
    // Non-fatal if Supabase is over quota (402)
  }

  if (!ybSuccess) {
    console.error('API_AVATAR_MEMBER_UPDATE_ERROR: Both Yugabyte and Supabase updates failed');
  }

  invalidateUserSession(userId);

  return json({ ...image, avatar_crop: crop });
};
