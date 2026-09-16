import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { safeQuery } from '$lib/server/db/safe';
import { storeImage, RateLimitError } from '$lib/server/media';

export const POST = async ({ request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) error(401, 'Não autorizado');

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

  const { error: problem } = await safeQuery(
    db.update(schema.members)
      .set({avatarId: image.id, avatarCrop: crop})
      .where(eq(schema.members.id, userId))
  );

  if (problem) {
    console.error('API_AVATAR_MEMBER_UPDATE_ERROR:', problem);
    error(500, 'Não foi possível atualizar seu avatar.');
  }

  return json({...image, avatarCrop: crop});
};
