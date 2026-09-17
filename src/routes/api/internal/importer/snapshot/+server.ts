import { json, type RequestHandler } from '@sveltejs/kit';
import { loadSnapshot } from '$lib/server/importer-snapshot';

export const GET: RequestHandler = async (event) => {
  const { locals } = event;
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await loadSnapshot(event);
    return json({ success: true, data });
  } catch (err: any) {
    return json({ success: false, error: (err as any).message }, { status: 503 });
  }
};
