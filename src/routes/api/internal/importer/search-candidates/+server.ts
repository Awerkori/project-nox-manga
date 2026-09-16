import { json, type RequestHandler } from '@sveltejs/kit';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, or, and, like } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
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

    const { data: rawMappings } = await safeQuery(
      db.select({
        workId: schema.importerWorkMappings.workId,
        source: schema.importerWorkMappings.source,
        sourceWorkId: schema.importerWorkMappings.sourceWorkId,
        sourceSlug: schema.importerWorkMappings.sourceSlug,
        sourceTitle: schema.importerWorkMappings.sourceTitle,
        metadata: schema.importerWorkMappings.metadata,
        workIdRef: schema.works.id,
        workTitle: schema.works.title,
        workSlug: schema.works.slug,
        workCoverId: schema.works.coverId
      })
      .from(schema.importerWorkMappings)
      .leftJoin(schema.works, eq(schema.importerWorkMappings.workId, schema.works.id))
      .where(and(
        eq(schema.importerWorkMappings.source, provider),
        or(
          eq(schema.importerWorkMappings.sourceSlug, slug),
          eq(schema.importerWorkMappings.sourceWorkId, slug)
        )
      ))
      .limit(5)
    );

    const mappings = (rawMappings || []).map(row => ({
      workId: row.workId,
      source: row.source,
      sourceWorkId: row.sourceWorkId,
      sourceSlug: row.sourceSlug,
      sourceTitle: row.sourceTitle,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      works: row.workIdRef ? {
        id: row.workIdRef,
        title: row.workTitle,
        slug: row.workSlug,
        coverId: row.workCoverId
      } : null
    }));

    if (mappings && mappings.length > 0) {
      const candidates = mappings.map((m: any) => ({
        workId: m.workId,
        title: m.works?.title || m.sourceTitle || cleanSlugTitle(slug),
        slug: m.works?.slug || slug,
        coverId: m.works?.coverId || null,
        provider: m.source || provider,
        sourceWorkId: m.sourceWorkId || slug,
        sourceUrl: cleanUrl,
        existsInNox: Boolean(m.workId),
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

  // A. Search in existing works
  const { data: rawWorks } = await safeQuery(
    db.select({
      id: schema.works.id,
      title: schema.works.title,
      slug: schema.works.slug,
      coverId: schema.works.coverId,
      kind: schema.works.kind,
      mappingSource: schema.importerWorkMappings.source,
      mappingSourceWorkId: schema.importerWorkMappings.sourceWorkId,
      mappingSourceSlug: schema.importerWorkMappings.sourceSlug,
      mappingMetadata: schema.importerWorkMappings.metadata
    })
    .from(schema.works)
    .leftJoin(schema.importerWorkMappings, eq(schema.works.id, schema.importerWorkMappings.workId))
    .where(or(
      like(schema.works.title, `%${q}%`),
      like(schema.works.slug, `%${q}%`)
    ))
    .limit(20) // a bit more because of joins
  );

  const worksMap = new Map();
  for (const row of rawWorks || []) {
    if (!worksMap.has(row.id)) {
      worksMap.set(row.id, {
        id: row.id,
        title: row.title,
        slug: row.slug,
        coverId: row.coverId,
        kind: row.kind,
        importer_work_mappings: []
      });
    }
    if (row.mappingSource) {
      worksMap.get(row.id).importer_work_mappings.push({
        source: row.mappingSource,
        sourceWorkId: row.mappingSourceWorkId,
        sourceSlug: row.mappingSourceSlug,
        metadata: row.mappingMetadata ? (typeof row.mappingMetadata === 'string' ? JSON.parse(row.mappingMetadata) : row.mappingMetadata) : null
      });
    }
  }

  const works = Array.from(worksMap.values()).slice(0, 10);

  if (works) {
    for (const w of works) {
      const primaryMapping = w.importer_work_mappings?.[0];
      const key = `nox:${w.id}`;
      seenKeys.add(key);

      results.push({
        workId: w.id,
        title: w.title,
        slug: w.slug,
        coverId: w.coverId,
        provider: primaryMapping?.source || 'nexus',
        sourceWorkId: primaryMapping?.sourceWorkId || w.slug,
        sourceUrl: null,
        existsInNox: true,
        chapterCount: primaryMapping?.metadata?.totalChapters || null
      });
    }
  }

  // B. Search in existing importer_work_mappings
  const { data: rawMappingsTitle } = await safeQuery(
    db.select({
      workId: schema.importerWorkMappings.workId,
      source: schema.importerWorkMappings.source,
      sourceWorkId: schema.importerWorkMappings.sourceWorkId,
      sourceSlug: schema.importerWorkMappings.sourceSlug,
      sourceTitle: schema.importerWorkMappings.sourceTitle,
      metadata: schema.importerWorkMappings.metadata,
      workIdRef: schema.works.id,
      workTitle: schema.works.title,
      workSlug: schema.works.slug,
      workCoverId: schema.works.coverId
    })
    .from(schema.importerWorkMappings)
    .leftJoin(schema.works, eq(schema.importerWorkMappings.workId, schema.works.id))
    .where(or(
      like(schema.importerWorkMappings.sourceTitle, `%${q}%`),
      like(schema.importerWorkMappings.sourceSlug, `%${q}%`)
    ))
    .limit(10)
  );

  const mappingsTitle = (rawMappingsTitle || []).map(row => ({
    workId: row.workId,
    source: row.source,
    sourceWorkId: row.sourceWorkId,
    sourceSlug: row.sourceSlug,
    sourceTitle: row.sourceTitle,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    works: row.workIdRef ? {
      id: row.workIdRef,
      title: row.workTitle,
      slug: row.workSlug,
      coverId: row.workCoverId
    } : null
  }));

  if (mappingsTitle) {
    for (const m of mappingsTitle) {
      const key = m.workId ? `nox:${m.workId}` : `src:${m.source}:${m.sourceWorkId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          workId: m.workId,
          title: m.works?.title || m.sourceTitle || cleanSlugTitle(m.sourceSlug),
          slug: m.works?.slug || m.sourceSlug,
          coverId: m.works?.coverId || null,
          provider: m.source,
          sourceWorkId: m.sourceWorkId || m.sourceSlug,
          sourceUrl: null,
          existsInNox: Boolean(m.workId),
          chapterCount: m.metadata?.totalChapters || null
        });
      }
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
