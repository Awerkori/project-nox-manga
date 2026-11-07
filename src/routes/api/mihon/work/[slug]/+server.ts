import { json } from '@sveltejs/kit';
import { verifyMihonAuth, matchesETag } from '$lib/server/mihon';
import { fetchFullWorkPageFromYugabyte } from '$lib/server/yugabyte';

type MihonWorkBundle = {
  work: any;
  chapters: any[];
  tags: any[];
  etag: string;
};

const MIHON_WORK_CACHE_TTL_MS = 120_000;
const MAX_MIHON_WORK_CACHE = 150;
const mihonWorkCache = new Map<string, { timestamp: number; data: MihonWorkBundle }>();
const mihonWorkInFlight = new Map<string, Promise<MihonWorkBundle | null>>();

async function fetchMihonWorkData(slug: string, platformEnv?: any): Promise<MihonWorkBundle | null> {
  const bundle = await fetchFullWorkPageFromYugabyte(slug, undefined, undefined, false, platformEnv);
  if (!bundle || !bundle.work || !bundle.work.published) return null;

  const { work, chapters, tags } = bundle;
  const latestChapterTimestamp = (chapters || []).reduce(
    (max: number, c: any) => Math.max(max, new Date(c.updated_at || c.published_at || c.created_at || 0).getTime()),
    0
  );
  const etag = `"${work.id}-${work.updated_at || ''}-${chapters?.length || 0}-${latestChapterTimestamp}"`;
  return { work, chapters: chapters || [], tags: tags || [], etag };
}

export const GET = async ({ params, request, url, platform }: any) => {
  const { slug } = params;
  const auth = await verifyMihonAuth(request, platform?.env);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  let bundle: MihonWorkBundle | null = null;
  const cached = mihonWorkCache.get(slug);
  if (cached && Date.now() - cached.timestamp < MIHON_WORK_CACHE_TTL_MS) {
    bundle = cached.data;
  } else {
    let pending = mihonWorkInFlight.get(slug);
    if (!pending) {
      pending = fetchMihonWorkData(slug, platform?.env).finally(() => {
        mihonWorkInFlight.delete(slug);
      });
      mihonWorkInFlight.set(slug, pending);
    }
    bundle = await pending;
    if (bundle) {
      if (mihonWorkCache.size >= MAX_MIHON_WORK_CACHE) {
        const oldestKey = mihonWorkCache.keys().next().value;
        if (oldestKey) mihonWorkCache.delete(oldestKey);
      }
      mihonWorkCache.set(slug, { timestamp: Date.now(), data: bundle });
    }
  }

  if (!bundle) {
    return json({ error: 'Obra não encontrada' }, { status: 404 });
  }

  const { work, chapters, tags, etag } = bundle;

  if (work.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      { status: 403 }
    );
  }

  const cacheControl =
    work.content_rating === 'ADULT_18'
      ? 'private, no-cache, no-store, must-revalidate'
      : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

  if (matchesETag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        'Cache-Control': cacheControl,
        'ETag': etag
      }
    });
  }

  const mediaBaseUrl = (platform?.env?.MEDIA_CDN_URL || '').replace(/\/+$/, '') || url.origin;
  const genres = (tags || []).map((t: any) => t.name).filter(Boolean);

  // Mihon expects chapters ascending by reading order
  const sortedChapters = [...(chapters || [])].sort((a: any, b: any) => {
    const orderA = a.chapter_order_key || '';
    const orderB = b.chapter_order_key || '';
    if (orderA !== orderB) return orderA.localeCompare(orderB);
    const keyA = a.canonical_chapter_key || '';
    const keyB = b.canonical_chapter_key || '';
    return keyA.localeCompare(keyB);
  });

  return json({
    id: work.id,
    title: work.title,
    slug: work.slug,
    kind: work.kind,
    status: work.status,
    content_rating: work.content_rating || 'GENERAL',
    synopsis: work.synopsis,
    author: work.author,
    artist: work.artist,
    cover_url: work.cover_id ? `${mediaBaseUrl}/media/${work.cover_id}` : null,
    updated_at: work.updated_at,
    genres,
    chapters: sortedChapters.map((ch: any) => ({
      id: ch.id,
      number: ch.number,
      display_number: ch.display_number || String(ch.number ?? 'Especial'),
      canonical_chapter_key: ch.canonical_chapter_key,
      chapter_order_key: ch.chapter_order_key,
      chapter_kind: ch.chapter_kind,
      edition: ch.edition,
      language: ch.language,
      title: ch.title,
      published_at: ch.published_at
    }))
  }, {
    headers: {
      'Cache-Control': cacheControl,
      'ETag': etag
    }
  });
};
