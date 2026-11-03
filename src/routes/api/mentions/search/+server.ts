import { json, error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
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

export const GET: RequestHandler = async ({ url, locals, platform }: any) => {
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
    const posRes = await executeYugabyteSql<{ id: string; name: string }>(`
      SELECT id, name
      FROM scan_positions
      WHERE scan_id = $1 AND name ILIKE $2
      LIMIT 4;
    `, [scanId, `%${cleanQ}%`], platform?.env).catch(() => ({ rows: [] }));

    for (const p of posRes.rows || []) {
      candidates.push({
        type: 'position',
        id: p.id,
        label: '@' + p.name,
        sub: `Notifica todos os ${p.name}s da Scan`,
        score: foldAccents(p.name).startsWith(foldAccents(cleanQ)) ? 92 : 72
      });
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
    const memRes = await executeYugabyteSql<{
      user_id: string; role: string; id: string; username: string; display_name: string;
      avatar_id: string | null; avatar_crop: unknown;
    }>(`
      SELECT sm.user_id, sm.role, m.id, m.username, m.display_name, m.avatar_id, m.avatar_crop
      FROM scan_members sm
      JOIN members m ON m.id = sm.user_id
      WHERE sm.scan_id = $1
      LIMIT 30;
    `, [scanId], platform?.env).catch(() => ({ rows: [] }));

    for (const sm of memRes.rows || []) {
      if (!sm || !sm.username) continue;
      const score = scoreCandidate(sm.username, sm.display_name || '', cleanQ);
      if (!cleanQ || score >= 60) {
        candidates.push({
          type: 'user',
          id: sm.id,
          username: sm.username,
          display_name: sm.display_name,
          avatar_id: sm.avatar_id,
          avatar_crop: sm.avatar_crop,
          label: '@' + sm.username,
          sub: sm.display_name || sm.role || 'Membro',
          score
        });
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
  const searchPattern = cleanQ ? `%${cleanQ}%` : '';
  const pubRes = await executeYugabyteSql<{
    id: string; username: string; display_name: string; avatar_id: string | null;
    avatar_crop: unknown; xp: number;
  }>(`
    SELECT id, username, display_name, avatar_id, avatar_crop, xp
    FROM members
    WHERE ($1 = '' OR username ILIKE $2 OR display_name ILIKE $2)
    ORDER BY xp DESC
    LIMIT 25;
  `, [cleanQ, searchPattern], platform?.env).catch((err: any) => {
    throw error(500, 'Erro ao buscar membros: ' + (err?.message || 'Falha no banco de dados'));
  });

  const members = pubRes.rows || [];

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
