import { json, error } from '@sveltejs/kit';
import { member } from '$lib/server/db';
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

  try {
    await executeYugabyteSql(
      `UPDATE public.members SET avatar_id = $1, avatar_crop = $2 WHERE id = $3`,
      [image.id, JSON.stringify(crop), userId],
      platform?.env
    );
    await executeYugabyteSql(
      `UPDATE public."user" SET image = $1, "updatedAt" = NOW() WHERE id = $2`,
      [`/media/${image.id}`, userId],
      platform?.env
    ).catch(() => {});
  } catch (ybProblem) {
    console.error('API_AVATAR_YUGABYTE_UPDATE_ERROR:', ybProblem);
    error(500, 'Falha ao salvar avatar no banco de dados.');
  }

  invalidateUserSession(userId);

  return json({ ...image, avatar_crop: crop });
};
