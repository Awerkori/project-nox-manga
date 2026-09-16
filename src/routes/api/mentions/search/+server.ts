import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, like, and, or, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    throw error(401, 'Não autenticado');
  }

  const rawQuery = (url.searchParams.get('q') || '').trim();
  const cleanQ = rawQuery.replace(/^@/, '').trim().replace(/[%_]/g, '');
  const scanId = url.searchParams.get('scan_id');

  const candidates: Array<{
    type: 'user' | 'position' | 'all';
    id: string;
    username?: string;
    displayName?: string;
    avatarId?: string | null;
    label: string;
    sub: string;
  }> = [];

  // 1. Scan Context (se fornecido scan_id)
  if (scanId) {
    // Buscar cargos compatíveis
    const { data: positions } = await safeQuery(
      db.select({ id: schema.scanPositions.id, name: schema.scanPositions.name })
        .from(schema.scanPositions)
        .where(
          and(
            eq(schema.scanPositions.scanId, scanId),
            like(schema.scanPositions.name, `%${cleanQ}%`)
          )
        )
        .limit(4)
    );

    if (positions) {
      for (const p of positions) {
        candidates.push({
          type: 'position',
          id: p.id,
          label: '@' + p.name,
          sub: `Notifica todos os ${p.name}s da Scan`
        });
      }
    }

    // @todos para liderança
    if (locals.role === 'ADMIN' || locals.role === 'STAFF_SITE') {
      if ('todos'.includes(cleanQ.toLowerCase()) || 'everyone'.includes(cleanQ.toLowerCase()) || !cleanQ) {
        candidates.push({
          type: 'all',
          id: 'all',
          label: '@todos',
          sub: 'Notifica todos os membros da Scan'
        });
      }
    }

    // Membros da Scan
    const { data: scanMems } = await safeQuery(
      db.select({
        userId: schema.scanMembers.userId,
        role: schema.scanMembers.role,
        members: {
          id: schema.members.id,
          username: schema.members.username,
          displayName: schema.members.displayName,
          avatarId: schema.members.avatarId
        }
      })
      .from(schema.scanMembers)
      .innerJoin(schema.members, eq(schema.scanMembers.userId, schema.members.id))
      .where(eq(schema.scanMembers.scanId, scanId))
      .limit(20)
    );

    if (scanMems) {
      for (const sm of scanMems) {
        const m = sm.members;
        if (!m || !m.username) continue;
        const u = m.username.toLowerCase();
        const d = (m.displayName || '').toLowerCase();
        const q = cleanQ.toLowerCase();
        if (!q || u.includes(q) || d.includes(q)) {
          candidates.push({
            type: 'user',
            id: m.id,
            username: m.username,
            displayName: m.displayName,
            avatarId: m.avatarId,
            label: '@' + m.username,
            sub: m.displayName || sm.role || 'Membro'
          });
        }
      }
    }

    return json({
      candidates: candidates.slice(0, 10)
    }, {
      headers: {
        'Cache-Control': 'private, max-age=15'
      }
    });
  }

  // 2. Public Platform Context (Comentários de Obras, Capítulos, etc.)
  let conditions = undefined;
  if (cleanQ) {
    conditions = or(
      like(schema.members.username, `%${cleanQ}%`),
      like(schema.members.displayName, `%${cleanQ}%`)
    ) as any;
  }

  const query = db.select({
    id: schema.members.id,
    username: schema.members.username,
    displayName: schema.members.displayName,
    avatarId: schema.members.avatarId
  })
  .from(schema.members)
  .orderBy(desc(schema.members.xp))
  .limit(8);

  if (conditions) {
    query.where(conditions);
  }

  const { data: members, error: dbError } = await safeQuery(query);
  if (dbError) {
    throw error(500, 'Erro ao buscar membros: ' + dbError.message);
  }

  for (const m of (members || [])) {
    candidates.push({
      type: 'user',
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      avatarId: m.avatarId,
      label: '@' + m.username,
      sub: m.displayName || 'Leitor'
    });
  }

  return json({
    candidates
  }, {
    headers: {
      'Cache-Control': 'private, max-age=15'
    }
  });
};
