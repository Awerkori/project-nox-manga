import { json } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ url, locals, platform }: any) => {
  if (!locals.user || !['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return json({ error: 'Não autorizado' }, { status: 403 });
  }

  const q = url.searchParams.get('q')?.trim() || '';
  if (!q || q.length < 2) {
    return json({ candidates: [], isUrl: false });
  }

  // 1. Detect if query is a URL
  const urlMatch = detectProviderFromUrl(q);
  if (urlMatch) {
    const { provider, slug, cleanUrl } = urlMatch;

    // Check if we already have this work mapped in our database
    const mapRes = await executeYugabyteSql(`
      SELECT m.work_id, m.source, m.source_work_id, m.source_slug, m.source_title, m.metadata,
             w.id AS w_id, w.title AS w_title, w.slug AS w_slug, w.cover_id AS w_cover_id
      FROM importer_work_mappings m
      LEFT JOIN works w ON w.id = m.work_id
      WHERE m.source = $1 AND (m.source_slug = $2 OR m.source_work_id = $2)
      LIMIT 5;
    `, [provider, slug], platform?.env).catch(() => ({ rows: [] }));

    const mappings = mapRes.rows || [];
    if (mappings.length > 0) {
      const candidates = mappings.map((m: any) => ({
        workId: m.work_id,
        title: m.w_title || m.source_title || cleanSlugTitle(slug),
        slug: m.w_slug || slug,
        coverId: m.w_cover_id || null,
        provider: m.source || provider,
        sourceWorkId: m.source_work_id || slug,
        sourceUrl: cleanUrl,
        existsInNox: Boolean(m.work_id),
        chapterCount: m.metadata?.totalChapters || null
      }));

      return json({ isUrl: true, candidates });
    }

    // New work not yet in Nox database
    const fallbackTitle = cleanSlugTitle(slug);
    return json({
      isUrl: true,
      candidates: [
        {
          workId: null,
          title: fallbackTitle,
          slug,
          coverId: null,
          provider,
          sourceWorkId: slug,
          sourceUrl: cleanUrl,
          existsInNox: false,
          chapterCount: null
        }
      ]
    });
  }

  // 2. Query by Title / Name
  const results: any[] = [];
  const seenKeys = new Set<string>();
  const searchPattern = `%${q}%`;

  // A. Search in existing works
  const worksRes = await executeYugabyteSql(`
    SELECT w.id, w.title, w.slug, w.cover_id, w.kind,
           (SELECT json_agg(json_build_object('source', m.source, 'source_work_id', m.source_work_id, 'source_slug', m.source_slug, 'metadata', m.metadata))
            FROM importer_work_mappings m WHERE m.work_id = w.id) AS importer_work_mappings
    FROM works w
    WHERE w.title ILIKE $1 OR w.slug ILIKE $1
    LIMIT 10;
  `, [searchPattern], platform?.env).catch(() => ({ rows: [] }));

  for (const w of (worksRes.rows || []) as any[]) {
    const primaryMapping = w.importer_work_mappings?.[0];
    const key = `nox:${w.id}`;
    seenKeys.add(key);

    results.push({
      workId: w.id,
      title: w.title,
      slug: w.slug,
      coverId: w.cover_id,
      provider: primaryMapping?.source || 'nexus',
      sourceWorkId: primaryMapping?.source_work_id || w.slug,
      sourceUrl: null,
      existsInNox: true,
      chapterCount: primaryMapping?.metadata?.totalChapters || null
    });
  }

  // B. Search in existing importer_work_mappings
  const mappingsRes = await executeYugabyteSql(`
    SELECT m.work_id, m.source, m.source_work_id, m.source_slug, m.source_title, m.metadata,
           w.id AS w_id, w.title AS w_title, w.slug AS w_slug, w.cover_id AS w_cover_id
    FROM importer_work_mappings m
    LEFT JOIN works w ON w.id = m.work_id
    WHERE m.source_title ILIKE $1 OR m.source_slug ILIKE $1
    LIMIT 10;
  `, [searchPattern], platform?.env).catch(() => ({ rows: [] }));

  for (const m of (mappingsRes.rows || []) as any[]) {
    const key = m.work_id ? `nox:${m.work_id}` : `src:${m.source}:${m.source_work_id}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push({
        workId: m.work_id,
        title: m.w_title || m.source_title || cleanSlugTitle(m.source_slug),
        slug: m.w_slug || m.source_slug,
        coverId: m.w_cover_id || null,
        provider: m.source,
        sourceWorkId: m.source_work_id || m.source_slug,
        sourceUrl: null,
        existsInNox: Boolean(m.work_id),
        chapterCount: m.metadata?.totalChapters || null
      });
    }
  }

  // C. If staff searched for something not in the catalog, also suggest importing as a new work across sources
  if (results.length < 3) {
    const searchSlug = slugify(q);
    const supportedProviders = ['nexus', 'kuro', 'mangaflix', 'manhastro', 'mangotoons'];
    for (const prov of supportedProviders) {
      const key = `new:${prov}:${searchSlug}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          workId: null,
          title: q,
          slug: searchSlug,
          coverId: null,
          provider: prov,
          sourceWorkId: searchSlug,
          sourceUrl: null,
          existsInNox: false,
          chapterCount: null,
          isExternalCandidate: true
        });
      }
    }
  }

  return json({ isUrl: false, candidates: results.slice(0, 10) });
};

function detectProviderFromUrl(rawUrl: string): { provider: string; slug: string; cleanUrl: string } | null {
  try {
    const formatted = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    const u = new URL(formatted);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    let provider = '';
    if (host.includes('kuro')) provider = 'kuro';
    else if (host.includes('nexus')) provider = 'nexus';
    else if (host.includes('mangaflix')) provider = 'mangaflix';
    else if (host.includes('manhastro')) provider = 'manhastro';
    else if (host.includes('mangotoons')) provider = 'mangotoons';

    if (!provider) return null;

    const segments = path.split('/').filter(Boolean);
    const slug = segments[segments.length - 1] || '';
    if (!slug) return null;

    return { provider, slug, cleanUrl: u.toString() };
  } catch {
    return null;
  }
}

function cleanSlugTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
