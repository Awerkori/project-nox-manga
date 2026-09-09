import { json } from '@sveltejs/kit';
import { editor } from '$lib/server/db';
import { storeImage, RateLimitError } from '$lib/server/media';
export const POST = async ({ request, locals }) => {
  editor(locals);
  try {
    return json(await storeImage(request, locals.user!.id));
  } catch (failure) {
    if (failure instanceof RateLimitError) {
      const retryAfter = failure.retryAfter;
      return new Response(
        JSON.stringify({ error: 'Rate limit temporário. O envio será retomado automaticamente.', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          }
        }
      );
    }
    throw failure;
  }
};
