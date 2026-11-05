import { json } from '@sveltejs/kit';
import { fetchTagsFromYugabyte } from '$lib/server/yugabyte';

/**
 * The catalogue's filter list is deliberately loaded outside the SSR document.
 * It is public and changes slowly, so Cloudflare can serve a shared response
 * while the catalogue itself becomes usable without serializing hundreds of
 * option nodes into every page response.
 */
export const GET = async ({ platform, setHeaders }: any) => {
  const tags = await fetchTagsFromYugabyte(platform?.env);
  setHeaders({
    'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600'
  });
  return json({ tags });
};
