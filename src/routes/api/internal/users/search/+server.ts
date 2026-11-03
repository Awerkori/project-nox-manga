import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ url, locals, platform }: any) => {
  if (!locals.user || locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito a administradores.');
  }

  const rawQuery = (url.searchParams.get('q') || '').trim();
  const cleanQ = rawQuery.replace(/^@/, '').trim().replace(/[%_]/g, '');
  if (cleanQ.length < 2) {
    return json({ users: [] });
  }

  const searchPattern = `%${cleanQ}%`;
  const res = await executeYugabyteSql(`
    SELECT m.id, m.username, m.display_name, m.avatar_id, m.created_at, m.xp,
           ar.role, ar.suspended
    FROM members m
    LEFT JOIN access_roles ar ON ar.user_id = m.id
    WHERE m.username ILIKE $1 OR m.display_name ILIKE $1
    ORDER BY m.created_at DESC
    LIMIT 15;
  `, [searchPattern], platform?.env).catch((err: any) => {
    throw error(500, 'Erro ao buscar membros: ' + (err?.message || 'Falha no banco de dados'));
  });

  const users = (res.rows || []).map((m: any) => {
    const role = m.role || 'USER';
    return {
      id: m.id,
      username: m.username,
      display_name: m.display_name,
      avatar_id: m.avatar_id,
      xp: m.xp || 0,
      role,
      isStaff: role === 'ADMIN' || role === 'STAFF_SITE' || role === 'EDITOR',
      suspended: Boolean(m.suspended)
    };
  });

  return json({ users });
};
