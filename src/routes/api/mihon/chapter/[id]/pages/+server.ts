import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ params, request, url, platform }) => {
  const { id } = params;
  const auth = await verifyMihonAuth(request, platform?.env);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const chRes = await executeYugabyteSql(
    `SELECT c.id, c.number, c.display_number, c.canonical_chapter_key, c.chapter_order_key,
            c.chapter_kind, c.edition, c.language, c.title, c.published_at, c.work_id,
            w.id AS work_id, w.title AS work_title, w.slug AS work_slug, w.content_rating, w.published AS work_published
     FROM public.chapters c
     JOIN public.works w ON w.id = c.work_id
     WHERE c.id = $1
     LIMIT 1;`,
    [id],
    platform?.env
  );

  const chapter = chRes.rows[0];
  if (!chapter || !chapter.published_at) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  if (!chapter.work_published) {
    return json({ error: 'Obra não publicada' }, { status: 404 });
  }

  if (chapter.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      { status: 403 }
    );
  }

  const pRes = await executeYugabyteSql(
    `SELECT position, media_id, width, height
     FROM public.pages
     WHERE chapter_id = $1
     ORDER BY position ASC;`,
    [chapter.id],
    platform?.env
  );
  const pages = pRes.rows;

  const origin = url.origin;
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
    total_pages: pages?.length ?? 0,
    pages: (pages || []).map((p: any) => ({
      position: p.position,
      url: `${origin}/media/${p.media_id}`,
      width: p.width,
      height: p.height
    }))
  }, {
    headers: {
      'Cache-Control':
        chapter.content_rating === 'ADULT_18'
          ? 'private, no-cache, no-store, must-revalidate'
          : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
};
