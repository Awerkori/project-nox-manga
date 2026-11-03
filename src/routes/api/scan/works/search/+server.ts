import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, platform }) => {
  // 1. Mandatory authentication
  if (!locals.user) {
    return json({ error: 'Não autenticado' }, { status: 401 });
  }

  const scanId = url.searchParams.get('scan_id');
  const rawQ = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));

  if (!scanId) {
    return json({ error: 'scan_id é obrigatório' }, { status: 400 });
  }

  // 2. Strict RBAC: scan OWNER, scan ADMIN, or global site ADMIN can search works to request
  const isAuthorizedGlobal = locals.role === 'ADMIN';
  if (!isAuthorizedGlobal) {
    const permRes = await executeYugabyteSql<{ role: string }>(
      `SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2`,
      [scanId, locals.user.id],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const userScanRole = permRes.rows[0]?.role;
    if (!userScanRole || !['OWNER', 'ADMIN'].includes(userScanRole)) {
      return json(
        { error: 'Apenas a liderança da scan (Dono ou Administradores) possui permissão para pesquisar e solicitar obras do catálogo.' },
        { status: 403 }
      );
    }
  }

  // If query is empty or less than 1 char, return empty results
  if (!rawQ || rawQ.length < 1) {
    return json({ results: [], total: 0 });
  }

  const cleanQ = rawQ.slice(0, 100).replace(/[%_\\]/g, '').trim();
  if (!cleanQ) {
    return json({ results: [], total: 0 });
  }

  try {
    const likePattern = `%${cleanQ}%`;
    const prefixPattern = `${cleanQ}%`;

    // Query published works matching title, aliases, or unaccented text.
    // Order of relevance:
    // 0 = Title starts with query
    // 1 = Title contains query
    // 2 = Alternative title (alias) starts with query
    // 3 = Alternative title or search_text contains query
    const query = `
      SELECT 
        w.id,
        w.title,
        w.slug,
        w.cover_id,
        COALESCE(w.aliases, ARRAY[]::text[]) AS aliases,
        w.kind,
        w.status,
        w.author,
        w.artist,
        (SELECT count(*)::int FROM public.chapters WHERE work_id = w.id) AS chapters_count,
        EXISTS(
          SELECT 1 FROM public.work_scans ws 
          WHERE ws.work_id = w.id AND ws.scan_id = $2
        ) AS is_linked,
        EXISTS(
          SELECT 1 FROM public.scan_project_requests spr 
          WHERE spr.work_id = w.id AND spr.scan_id = $2 AND spr.status = 'PENDING'
        ) AS is_pending
      FROM public.works w
      WHERE w.published = true
        AND (
          w.title ILIKE $1
          OR EXISTS (
            SELECT 1 FROM unnest(COALESCE(w.aliases, ARRAY[]::text[])) AS a(t)
            WHERE a.t ILIKE $1
          )
          OR translate(lower(COALESCE(w.search_text, w.title)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') 
             LIKE translate(lower($1), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
        )
      ORDER BY 
        CASE 
          WHEN w.title ILIKE $3 THEN 0
          WHEN w.title ILIKE $1 THEN 1
          WHEN EXISTS (
            SELECT 1 FROM unnest(COALESCE(w.aliases, ARRAY[]::text[])) AS a(t)
            WHERE a.t ILIKE $3
          ) THEN 2
          ELSE 3
        END,
        w.views_total DESC,
        w.title ASC
      LIMIT $4;
    `;

    const res = await executeYugabyteSql<any>(
      query,
      [likePattern, scanId, prefixPattern, limit],
      platform?.env
    );

    const cleanLower = cleanQ.toLowerCase();
    const results = (res.rows || []).map((row) => {
      let link_status: 'AVAILABLE' | 'LINKED' | 'PENDING' = 'AVAILABLE';
      let link_label = 'Disponível para vincular';

      if (row.is_linked) {
        link_status = 'LINKED';
        link_label = 'Já vinculada à sua scan';
      } else if (row.is_pending) {
        link_status = 'PENDING';
        link_label = 'Solicitação já pendente';
      }

      // Check if matched by alternative title
      let matched_alias: string | null = null;
      const titleLower = (row.title || '').toLowerCase();
      if (!titleLower.includes(cleanLower) && Array.isArray(row.aliases)) {
        const foundAlias = row.aliases.find((a: string) =>
          typeof a === 'string' && a.toLowerCase().includes(cleanLower)
        );
        if (foundAlias) {
          matched_alias = foundAlias.trim();
        }
      }

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        cover_id: row.cover_id,
        aliases: row.aliases || [],
        matched_alias,
        kind: row.kind,
        status: row.status,
        author: row.author,
        artist: row.artist,
        chapters_count: row.chapters_count || 0,
        link_status,
        link_label
      };
    });

    return json(
      { results, total: results.length },
      {
        headers: {
          'cache-control': 'private, no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (err: any) {
    console.error('Error searching catalog works for scan:', err);
    return json({ error: 'Falha ao buscar obras do catálogo' }, { status: 500 });
  }
};
