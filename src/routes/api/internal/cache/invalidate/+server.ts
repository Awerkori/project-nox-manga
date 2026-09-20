import { json, type RequestHandler } from '@sveltejs/kit';
import { authenticateInternalGateway } from '$lib/server/importer-gateway';
import { performCacheInvalidation } from '$lib/server/cache-invalidation';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const isStaff = locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  if (!isStaff) {
    try {
      authenticateInternalGateway(request, url);
    } catch (e: any) {
      return json({ error: e?.message || 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const result = performCacheInvalidation(payload);
    return json(result);
  } catch (err: any) {
    return json({ success: false, error: err?.message }, { status: 500 });
  }
};
