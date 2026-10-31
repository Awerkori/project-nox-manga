import { executeYugabyteSql } from '$lib/server/yugabyte';
import { withTimeout } from '$lib/server/resilience';

export interface EnrichedChapterWork {
  id: string;
  slug: string;
  title: string;
  cover_id: string | null;
  kind?: string | null;
  status?: string | null;
  published?: boolean;
  content_rating?: string | null;
}

export interface EnrichedReadingChapter {
  id: string;
  number: number | string | null;
  display_number?: string | null;
  canonical_chapter_key?: string | null;
  chapter_order_key?: string | null;
  title: string | null;
  work_id: string;
  published_at: string | null;
  works: EnrichedChapterWork;
}

/**
 * Resolves `chapters` + `works` metadata for Supabase `reading` rows without
 * relying on a PostgREST foreign key between `reading` and `chapters` (which
 * was removed when catalog chapters moved to YugabyteDB and previously caused
 * PGRST200 / HTTP 400 on `/historico`).
 *
 * Executes ZERO queries when `readingRows` is empty, and ONE single indexed
 * `ANY($1::uuid[])` query on YugabyteDB (with Supabase fallback) otherwise.
 */
export async function enrichReadingRowsWithCatalog<T extends Record<string, any>>(
  readingRows: T[] | null | undefined,
  db: any,
  env?: any
): Promise<Array<T & { chapters: EnrichedReadingChapter }>> {
  if (!Array.isArray(readingRows) || readingRows.length === 0) {
    return [];
  }

  const chapterIds = Array.from(
    new Set(
      readingRows
        .map((r) => (typeof r?.chapter_id === 'string' ? r.chapter_id.trim() : ''))
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    )
  );

  if (chapterIds.length === 0) {
    return [];
  }

  const byChapterId = new Map<string, EnrichedReadingChapter>();

  try {
    const ysqlRes = await withTimeout(
      executeYugabyteSql<any>(
        `SELECT
           c.id,
           c.number,
           c.display_number,
           c.canonical_chapter_key,
           c.chapter_order_key,
           c.title,
           c.work_id,
           c.published_at,
           w.slug AS work_slug,
           w.title AS work_title,
           w.cover_id AS work_cover_id,
           w.kind AS work_kind,
           w.status AS work_status,
           w.published AS work_published,
           w.content_rating AS work_content_rating
         FROM public.chapters c
         JOIN public.works w ON w.id = c.work_id
         WHERE c.id = ANY($1::uuid[])
           AND c.published_at IS NOT NULL
           AND w.published = true`,
        [chapterIds],
        env
      ),
      2000,
      null,
      'reading_enrich_yugabyte',
      'YUGABYTE'
    );

    for (const row of ysqlRes?.rows || []) {
      byChapterId.set(row.id, {
        id: row.id,
        number: row.number,
        display_number: row.display_number,
        canonical_chapter_key: row.canonical_chapter_key,
        chapter_order_key: row.chapter_order_key,
        title: row.title,
        work_id: row.work_id,
        published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
        works: {
          id: row.work_id,
          slug: row.work_slug,
          title: row.work_title,
          cover_id: row.work_cover_id || null,
          kind: row.work_kind || null,
          status: row.work_status || null,
          published: Boolean(row.work_published),
          content_rating: row.work_content_rating || null
        }
      });
    }
  } catch {
    // Fallback to Supabase chapters below if Yugabyte is unavailable
  }

  const missingIds = chapterIds.filter((id) => !byChapterId.has(id));
  if (missingIds.length > 0 && db && typeof db.from === 'function') {
    try {
      const supaRes = await withTimeout(
        db
          .from('chapters')
          .select(
            'id,number,display_number,canonical_chapter_key,chapter_order_key,title,work_id,published_at,works!inner(id,slug,title,cover_id,kind,status,published,content_rating)'
          )
          .in('id', missingIds)
          .not('published_at', 'is', null)
          .eq('works.published', true),
        1800,
        { data: [] } as any,
        'reading_enrich_supabase_fallback'
      );
      for (const row of supaRes?.data || []) {
        const w = Array.isArray(row.works) ? row.works[0] : row.works;
        if (!w) continue;
        byChapterId.set(row.id, {
          id: row.id,
          number: row.number,
          display_number: row.display_number,
          canonical_chapter_key: row.canonical_chapter_key,
          chapter_order_key: row.chapter_order_key,
          title: row.title,
          work_id: row.work_id,
          published_at: row.published_at,
          works: {
            id: w.id || row.work_id,
            slug: w.slug,
            title: w.title,
            cover_id: w.cover_id || null,
            kind: w.kind || null,
            status: w.status || null,
            published: Boolean(w.published),
            content_rating: w.content_rating || null
          }
        });
      }
    } catch {
      // Ignore secondary fallback errors
    }
  }

  const enriched: Array<T & { chapters: EnrichedReadingChapter }> = [];
  for (const row of readingRows) {
    const ch = byChapterId.get(row.chapter_id);
    if (ch) {
      enriched.push({
        ...row,
        chapters: ch
      });
    }
  }
  return enriched;
}
