import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function foldAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scoreCandidate(username: string, displayName: string, q: string): number {
  const u = foldAccents(username);
  const d = foldAccents(displayName);
  const query = foldAccents(q);

  if (!query) return 50;
  if (u === query) return 100;
  if (d === query) return 95;
  if (u.startsWith(query)) return 90;
  if (d.startsWith(query)) return 85;
  if (u.includes(query)) return 70;
  if (d.includes(query)) return 60;
  return 10;
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const rawQuery = (url.searchParams.get('q') || '').trim();
  const cleanQ = rawQuery.replace(/^@/, '').trim().replace(/[%_]/g, '');
  const scanId = url.searchParams.get('scan_id');

  // 1. Scan Context (se fornecido scan_id - exige autenticação)
  if (scanId) {
    if (!locals.user) {
      throw error(401, 'Não autenticado');
    }

    const candidates: Array<{
      type: 'user' | 'position' | 'all';
      id: string;
      username?: string;
      display_name?: string;
      avatar_id?: string | null;
      avatar_crop?: unknown;
      label: string;
      sub: string;
      score?: number;
    }> = [];

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
          sub: `Notifica todos os ${p.name}s da Scan`,
          score: foldAccents(p.name).startsWith(foldAccents(cleanQ)) ? 92 : 72
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
          sub: 'Notifica todos os membros da Scan',
          score: 80
        });
      }
    }

    // Membros da Scan
    const membersQuery = locals.db
      .from('scan_members')
      .select('user_id, role, members!scan_members_user_id_fkey(id, username, display_name, avatar_id, avatar_crop)')
      .eq('scan_id', scanId);

    const { data: scanMems } = await membersQuery.limit(30);
    if (scanMems) {
      for (const sm of scanMems) {
        const m = (sm as any).members;
        if (!m || !m.username) continue;
        const score = scoreCandidate(m.username, m.display_name || '', cleanQ);
        if (!cleanQ || score >= 60) {
          candidates.push({
            type: 'user',
            id: m.id,
            username: m.username,
            display_name: m.display_name,
            avatar_id: m.avatar_id,
            avatar_crop: m.avatar_crop,
            label: '@' + m.username,
            sub: m.display_name || sm.role || 'Membro',
            score
          });
        }
      }
    }

    candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

    return json({
      candidates: candidates.slice(0, 10)
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10'
      }
    });
  }

  // 2. Public Platform Context (Comentários de Obras, Capítulos, Comunidade)
  let query = locals.db
    .from('members')
    .select('id, username, display_name, avatar_id, avatar_crop, xp');

  if (cleanQ) {
    query = query.or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`);
  }

  query = query.order('xp', { ascending: false }).limit(25);

  const { data: members, error: dbError } = await query;
  if (dbError) {
    throw error(500, 'Erro ao buscar membros: ' + dbError.message);
  }

  const rawList = (members || []).map((m: any) => ({
    type: 'user' as const,
    id: m.id,
    username: m.username,
    display_name: m.display_name,
    avatar_id: m.avatar_id,
    avatar_crop: m.avatar_crop,
    label: '@' + m.username,
    sub: m.display_name || 'Leitor',
    xp: m.xp || 0,
    score: scoreCandidate(m.username, m.display_name || '', cleanQ)
  }));

  // Priorizar prefixos exatos, depois substring, depois XP
  rawList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.xp - a.xp;
  });

  const candidates = rawList.slice(0, 10).map(({ xp, score, ...rest }) => rest);

  return json({
    candidates
  }, {
    headers: {
      'Cache-Control': 'public, max-age=15'
    }
  });
};
