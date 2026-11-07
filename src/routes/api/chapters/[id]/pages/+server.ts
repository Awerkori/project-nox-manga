import { json } from '@sveltejs/kit';
import { readerChapter, readerContent } from '$lib/server/reader-editorial';
import { withYugabyteReadSession, executeYugabyteSql, batchWarmMediaMetadata } from '$lib/server/yugabyte';

// The public Reader already uses direct YSQL for canonical chapter identity.
// Keep this API on the same authoritative path: PostgREST can otherwise hold
// a stale schema cache immediately after additive chapter-identity migrations.
export const GET = async ({ params, locals, cookies, platform, request }: any) => {
  const { id } = params;
  const rawPlatformEnv = (platform as any)?.env;

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  return withYugabyteReadSession(rawPlatformEnv, async (platformEnv) => {
    const { data: chapter } = await readerChapter(id, isStaff, platformEnv);

    if (!chapter) {
      return json({ error: 'Capítulo não encontrado' }, { status: 404 });
    }

    const work = chapter.works;
    if (!work || (!isStaff && !work.published)) {
      return json({ error: 'Obra não publicada' }, { status: 404 });
    }

    const isAdult = work.content_rating === 'ADULT_18';
    if (isAdult) {
      const rawAgeCookie = cookies.get('nox-age-status');
      let ageStatus = locals.sessionCache?.profile?.age_status || rawAgeCookie;
      if (!ageStatus && locals.user) {
        try {
          const mem = await executeYugabyteSql(`SELECT age_status FROM members WHERE id = $1 LIMIT 1;`, [locals.user.id], platformEnv);
          if (mem.rows[0]?.age_status) ageStatus = mem.rows[0].age_status;
        } catch {}
      }
      if (ageStatus === 'MINOR') {
        return json({ error: 'Conteúdo restrito (+18).' }, { status: 403 });
      }
    }

    const { data: content } = await readerContent(chapter.id, chapter.work_id, platformEnv);
    const mediaBaseUrl = (rawPlatformEnv?.MEDIA_CDN_URL || '').replace(/\/+$/, '');
    const rawPages = content?.pages || [];

    const mediaIds = rawPages.map((p: any) => p.media_id).filter((mid: any): mid is string => Boolean(mid && /^[0-9a-f-]{36}$/i.test(mid)));
    if (mediaIds.length > 0) {
      const warmPromise = batchWarmMediaMetadata(mediaIds, platformEnv);
      if (platform?.context?.waitUntil) {
        platform.context.waitUntil(warmPromise);
      }
    }

    const pages = rawPages.map((p: any) => ({
      ...p,
      url: `${mediaBaseUrl}/media/${p.media_id}`
    }));

    const chapterPublishedTime = new Date(chapter.published_at || 0).getTime();
    const etag = `"${chapter.id}-${pages.length}-${chapterPublishedTime}"`;
    const cacheControl =
      !isStaff && !isAdult && chapter.published_at
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
        : 'private, no-cache, no-store, must-revalidate';

    if (request?.headers?.get?.('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': cacheControl,
          'ETag': etag
        }
      });
    }

    return json(
      {
        chapter_id: chapter.id,
        // Retain numeric `chapter_number` for old consumers and expose the
        // authoritative text separately. New clients must display this field.
        chapter_number: chapter.number,
        chapter_display_number: chapter.display_number || String(chapter.number ?? 'Especial'),
        canonical_chapter_key: chapter.canonical_chapter_key,
        chapter_order_key: chapter.chapter_order_key,
        chapter_kind: chapter.chapter_kind,
        edition: chapter.edition,
        language: chapter.language,
        chapter_title: chapter.title,
        work_id: work.id,
        work_title: work.title,
        work_slug: work.slug,
        pages
      },
      {
        headers: {
          'cache-control': cacheControl,
          'ETag': etag
        }
      }
    );
  }, 1);
};

