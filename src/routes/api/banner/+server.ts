import { json, error } from '@sveltejs/kit';
import { member, privileged } from '$lib/server/db';
import { storeImage, RateLimitError } from '$lib/server/media';
import { invalidateUserSession } from '$lib/server/session-cache';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: { request: Request; locals: App.Locals; platform?: any }) => {
  const userId = member(locals);
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) error(400, 'Selecione uma imagem.');

  const cropX = parseFloat(formData.get('crop_x') as string) || 50;
  const cropY = parseFloat(formData.get('crop_y') as string) || 50;
  const cropZoom = parseFloat(formData.get('crop_zoom') as string) || 1;
  const crop = {
    x: Math.max(0, Math.min(100, cropX)),
    y: Math.max(0, Math.min(100, cropY)),
    zoom: Math.max(1, Math.min(3, cropZoom))
  };

  let image;
  try {
    image = await storeImage(formData, userId, 'banner');
  } catch (err) {
    if (err instanceof RateLimitError) {
      return json(
        { message: 'Muitas requisições. Aguarde alguns instantes.', retryAfter: err.retryAfter },
        { status: 429, headers: { 'retry-after': String(err.retryAfter) } }
      );
    }
    console.error('API_BANNER_STORE_ERROR:', err);
    throw err;
  }

  let ybSuccess = false;
  try {
    const ybRes = await executeYugabyteSql(
      `UPDATE public.members SET banner_id = $1, banner_crop = $2 WHERE id = $3`,
      [image.id, JSON.stringify(crop), userId],
      platform?.env
    );
    if (ybRes && ybRes.rowCount > 0) {
      ybSuccess = true;
    }
  } catch (ybProblem) {
    console.warn('api_banner_yugabyte_update_warning', ybProblem);
  }

  // Best-effort sync to legacy Supabase
  try {
    await privileged()
      .from('members')
      .update({ banner_id: image.id, banner_crop: crop })
      .eq('id', userId);
  } catch (supaProblem) {
    // Non-fatal if Supabase is over quota (402)
  }

  if (!ybSuccess) {
    console.error('API_BANNER_MEMBER_UPDATE_ERROR: Both Yugabyte and Supabase updates failed');
  }

  invalidateUserSession(userId);

  return json({ ...image, banner_crop: crop });
};
