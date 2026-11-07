import { json } from '@sveltejs/kit';
import { verifyMihonAuth, matchesETag } from '$lib/server/mihon';
import { executeYugabyteSql } from '$lib/server/yugabyte';

type MihonPagesPayload = {
  chapter: any;
  pages: any[];
  etag: string;
};

const MIHON_PAGES_CACHE_TTL_MS = 300_000;
const MAX_MIHON_PAGES_CACHE = 200;
const mihonPagesCache = new Map<string, { timestamp: number; data: MihonPagesPayload }>();
const mihonPagesInFlight = new Map<string, Promise<MihonPagesPayload | null>>();

async function fetchChapterPagesData(id: string, platformEnv?: any): Promise<MihonPagesPayload | null> {
  const chRes = await executeYugabyteSql(
    `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
            c.chapter_kind, c.edition, c.language, c.title, c.published_at, c.created_at, c.work_id,
            w.title AS work_title, w.slug AS work_slug, w.content_rating, w.published AS work_published, w.updated_at AS work_updated_at,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'position', p.position,
                'media_id', p.media_id,
                'width', p.width,
                'height', p.height
              ) ORDER BY p.position ASC)
               FROM public.pages p
               WHERE p.chapter_id = c.id
              ),
              '[]'::json
            ) AS pages
     FROM public.chapters c
     JOIN public.works w ON w.id = c.work_id
     WHERE c.id = $1
     LIMIT 1;`,
    [id],
    platformEnv
  );

  const chapter = chRes.rows[0];
  if (!chapter || !chapter.published_at || !chapter.work_published) {
    return null;
  }

  const pages = Array.isArray(chapter.pages) ? chapter.pages : [];
  let pagesHash = 0;
  for (const p of pages) {
    const pageSig = `${p.position}:${p.media_id}:${p.width || 0}:${p.height || 0};`;
    for (let i = 0; i < pageSig.length; i++) {
      pagesHash = ((pagesHash << 5) - pagesHash + pageSig.charCodeAt(i)) | 0;
    }
  }
  let metaHash = 0;
  const metaSig = `${chapter.id}:${chapter.number}:${chapter.display_number}:${chapter.title || ''}:${chapter.chapter_kind || ''}:${chapter.edition || ''}:${chapter.language || ''}:${chapter.content_rating || ''}:${chapter.work_updated_at || ''}`;
  for (let i = 0; i < metaSig.length; i++) {
    metaHash = ((metaHash << 5) - metaHash + metaSig.charCodeAt(i)) | 0;
  }
  const chapterTime = new Date(chapter.published_at || chapter.created_at || 0).getTime();
  const etag = `"${chapter.id}-${pages.length}-${(pagesHash >>> 0).toString(36)}-${(metaHash >>> 0).toString(36)}-${chapterTime}"`;

  return { chapter, pages, etag };
}

export const GET = async ({ params, request, url, platform }: any) => {
  const { id } = params;

  // Fast path: check in-memory cache
  let payload: MihonPagesPayload | null = null;
  const cached = mihonPagesCache.get(id);
  if (cached && Date.now() - cached.timestamp < MIHON_PAGES_CACHE_TTL_MS) {
    payload = cached.data;
  } else {
    let pending = mihonPagesInFlight.get(id);
    if (!pending) {
      pending = fetchChapterPagesData(id, platform?.env).finally(() => {
        mihonPagesInFlight.delete(id);
      });
      mihonPagesInFlight.set(id, pending);
    }
    payload = await pending;
    if (payload) {
      if (mihonPagesCache.size >= MAX_MIHON_PAGES_CACHE) {
        const oldestKey = mihonPagesCache.keys().next().value;
        if (oldestKey) mihonPagesCache.delete(oldestKey);
      }
      mihonPagesCache.set(id, { timestamp: Date.now(), data: payload });
    }
  }

  if (!payload) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const { chapter, pages, etag } = payload;
  const ifNoneMatch = request.headers.get('if-none-match');

  // Zero-SQL fast path for public non-adult 304 revalidation
  if (chapter.content_rating !== 'ADULT_18' && matchesETag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600',
        'ETag': etag
      }
    });
  }

  const auth = await verifyMihonAuth(request, platform?.env);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  if (chapter.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      {
        status: 403,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Vary': 'Authorization, Cookie'
        }
      }
    );
  }

  const cacheControl =
    chapter.content_rating === 'ADULT_18'
      ? 'private, no-cache, no-store, must-revalidate'
      : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600';

  if (matchesETag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        'Cache-Control': cacheControl,
        'ETag': etag,
        'Vary': chapter.content_rating === 'ADULT_18' ? 'Authorization, Cookie' : 'Accept-Encoding'
      }
    });
  }

  const origin = (platform?.env?.MEDIA_CDN_URL || '').replace(/\/+$/, '') || url.origin;
  return json({
    chapter_id: chapter.id,
    chapter_number: chapter.number,
    chapter_display_number: chapter.display_number || String(chapter.number ?? 'Especial'),
    canonical_chapter_key: chapter.canonical_chapter_key,
    chapter_order_key: chapter.chapter_order_key,
    chapter_kind: chapter.chapter_kind,
    edition: chapter.edition,
    language: chapter.language,
    chapter_title: chapter.title,
    work_title: chapter.work_title,
    work_slug: chapter.work_slug,
    total_pages: pages.length,
    pages: pages.map((p: any) => ({
      position: p.position,
      url: `${origin}/media/${p.media_id}`,
      width: p.width,
      height: p.height
    }))
  }, {
    headers: {
      'Cache-Control': cacheControl,
      'ETag': etag
    }
  });
};
