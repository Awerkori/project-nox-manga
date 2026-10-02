import { json, error } from '@sveltejs/kit';
import { member, privileged } from '$lib/server/db';
import { storeImage, RateLimitError } from '$lib/server/media';
import { normalizeAvatarCrop } from '$lib/avatar';

export const POST = async ({ request, locals }) => {
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

  const { error: problem } = await privileged()
    .from('members')
    .update({ avatar_id: image.id, avatar_crop: crop })
    .eq('id', userId);

  if (problem) {
    console.error('API_AVATAR_MEMBER_UPDATE_ERROR:', problem);
    error(500, 'Não foi possível atualizar seu avatar.');
  }

  return json({ ...image, avatar_crop: crop });
};
