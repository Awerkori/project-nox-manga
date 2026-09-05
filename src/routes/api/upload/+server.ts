import { json } from '@sveltejs/kit';
import { editor } from '$lib/server/db';
import { storeImage } from '$lib/server/media';
export const POST = async ({ request, locals }) => {
  editor(locals);
  return json(await storeImage(request, locals.user!.id));
};
