import { json, type RequestHandler } from '@sveltejs/kit';
import { loadSnapshot } from '$lib/server/importer-snapshot';

export const GET: RequestHandler = async (event) => {
  const { locals, url } = event;
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return json({ error: 'Não autorizado' }, { status: 403 });
  }

  try {
    const forceRefresh = url.searchParams.get('refresh') === '1';
    const data = await loadSnapshot(event, { forceRefresh });
    return json({ success: true, data });
  } catch (err: any) {
    return json({ success: false, error: err.message }, { status: 503 });
  }
};
