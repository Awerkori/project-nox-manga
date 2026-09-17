import { json, error } from '@sveltejs/kit';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { storeImage, RateLimitError } from '$lib/server/media';

export const POST = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const userId = locals.user.id;
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
        { message: 'Muitas requisies. Aguarde alguns instantes.', retryAfter: err.retryAfter },
        { status: 429, headers: { 'retry-after': String(err.retryAfter) } }
      );
    }
    console.error('API_BANNER_STORE_ERROR:', err);
    throw err;
  }

  const { error: problem } = await safeQuery(
    db.update(schema.members)
      .set({ bannerId: image.id, bannerCrop: crop as any })
      .where(eq(schema.members.id, userId))
  );

  if (problem) {
    console.error('API_BANNER_MEMBER_UPDATE_ERROR:', problem);
    error(500, 'No foi possvel atualizar seu banner.');
  }

  return json({ ...image, bannerCrop: crop });
};
