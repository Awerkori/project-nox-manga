import { json, error } from '@sveltejs/kit';
import { member, privileged } from '$lib/server/db';
import { storeImage } from '$lib/server/media';

export const POST = async ({ request, locals }) => {
  const userId = member(locals);
  const image = await storeImage(request, userId, 'banner');
  const { error: problem } = await privileged()
    .from('members')
    .update({ banner_id: image.id })
    .eq('id', userId);

  if (problem) {
    error(500, 'Não foi possível atualizar seu banner.');
  }

  return json(image);
};
