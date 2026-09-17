import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema, safeQuery } from '$lib/server/db';
import { ilike, or, desc, eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user || locals.role !== 'ADMIN') {
    throw error(403, 'Acesso restrito a administradores.');
  }

  const rawQuery = (url.searchParams.get('q') || '').trim();
  const cleanQ = rawQuery.replace(/^@/, '').trim().replace(/[%_]/g, '');
  if (cleanQ.length < 2) {
    return json({ users: [] });
  }

  const { data: members, error: dbError } = await safeQuery(
    db.select({
      id: schema.members.id,
      username: schema.members.username,
      displayName: schema.members.displayName,
      avatarId: schema.members.avatarId,
      createdAt: schema.members.createdAt,
      xp: schema.members.xp,
      role: schema.accessRoles.role,
      suspended: schema.accessRoles.suspended
    })
    .from(schema.members)
    .leftJoin(schema.accessRoles, eq(schema.members.id, schema.accessRoles.userId))
    .where(or(ilike(schema.members.username, `%${cleanQ}%`), ilike(schema.members.displayName, `%${cleanQ}%`)))
    .orderBy(desc(schema.members.createdAt))
    .limit(15)
  );

  if (dbError) {
    throw error(500, 'Erro ao buscar membros: ' + (dbError as any).message);
  }

  const users = (members || []).map((m: any) => {const role = m.role || 'USER';
    return {
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      avatarId: m.avatarId,
      xp: m.xp || 0,
      role,
      isStaff: role === 'ADMIN' || role === 'STAFF_SITE' || role === 'EDITOR',
      suspended: Boolean(m.suspended)};
  });

  return json({ users });
};
