import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user || locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito a administradores.');
  }

  const rawQuery = (url.searchParams.get('q') || '').trim();
  const cleanQ = rawQuery.replace(/^@/, '').trim().replace(/[%_]/g, '');
  if (cleanQ.length < 2) {
    return json({ users: [] });
  }

  const { data: members, error: dbError } = await locals.db
    .from('members')
    .select('id, username, display_name, avatar_id, created_at, xp, access_roles(role, suspended)')
    .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
    .order('created_at', { ascending: false })
    .limit(15);

  if (dbError) {
    throw error(500, 'Erro ao buscar membros: ' + dbError.message);
  }

  const users = (members || []).map((m: any) => {
    const role = m.access_roles?.role || 'USER';
    return {
      id: m.id,
      username: m.username,
      display_name: m.display_name,
      avatar_id: m.avatar_id,
      xp: m.xp || 0,
      role,
      isStaff: role === 'ADMIN' || role === 'STAFF_SITE' || role === 'EDITOR',
      suspended: Boolean(m.access_roles?.suspended)
    };
  });

  return json({ users });
};
