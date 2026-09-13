import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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
    display_name?: string;
    avatar_id?: string | null;
    label: string;
    sub: string;
  }> = [];

  // 1. Scan Context (se fornecido scan_id)
  if (scanId) {
    // Buscar cargos compatíveis
    const { data: positions } = await locals.db
      .from('scan_positions')
      .select('id, name')
      .eq('scan_id', scanId)
      .ilike('name', `%${cleanQ}%`)
      .limit(4);

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
    let membersQuery = locals.db
      .from('scan_members')
      .select('user_id, role, members!scan_members_user_id_fkey(id, username, display_name, avatar_id)')
      .eq('scan_id', scanId);

    const { data: scanMems } = await membersQuery.limit(20);
    if (scanMems) {
      for (const sm of scanMems) {
        const m = (sm as any).members;
        if (!m || !m.username) continue;
        const u = m.username.toLowerCase();
        const d = (m.display_name || '').toLowerCase();
        const q = cleanQ.toLowerCase();
        if (!q || u.includes(q) || d.includes(q)) {
          candidates.push({
            type: 'user',
            id: m.id,
            username: m.username,
            display_name: m.display_name,
            avatar_id: m.avatar_id,
            label: '@' + m.username,
            sub: m.display_name || sm.role || 'Membro'
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
  let query = locals.db
    .from('members')
    .select('id, username, display_name, avatar_id')
    .order('xp', { ascending: false })
    .limit(8);

  if (cleanQ) {
    query = query.or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`);
  }

  const { data: members, error: dbError } = await query;
  if (dbError) {
    throw error(500, 'Erro ao buscar membros: ' + dbError.message);
  }

  for (const m of (members || [])) {
    candidates.push({
      type: 'user',
      id: m.id,
      username: m.username,
      display_name: m.display_name,
      avatar_id: m.avatar_id,
      label: '@' + m.username,
      sub: m.display_name || 'Leitor'
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
