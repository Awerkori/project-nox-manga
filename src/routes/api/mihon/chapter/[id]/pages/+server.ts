import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { privileged } from '$lib/server/db';

export const GET = async ({ params, request, url }) => {
  const { id } = params;
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const db = privileged();
  const { data: chapter, error: chErr } = await db
    .from('chapters')
    .select('id, number, title, published_at, work_id, works(id, title, slug, content_rating, published)')
    .eq('id', id)
    .maybeSingle();

  if (chErr || !chapter || !chapter.published_at) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const work = Array.isArray(chapter.works) ? chapter.works[0] : chapter.works;
  if (!work || !work.published) {
    return json({ error: 'Obra não publicada' }, { status: 404 });
  }

  if (work.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      { status: 403 }
    );
  }

  const { data: pages, error: pErr } = await db
    .from('pages')
    .select('position, media_id, width, height')
    .eq('chapter_id', chapter.id)
    .order('position', { ascending: true });

  if (pErr) {
    return json({ error: 'Erro ao carregar páginas' }, { status: 500 });
  }

  const origin = url.origin;
  return json({
    chapter_id: chapter.id,
    chapter_number: chapter.number,
    chapter_title: chapter.title,
    work_title: work.title,
    work_slug: work.slug,
    total_pages: pages?.length ?? 0,
    pages: (pages || []).map((p) => ({
      position: p.position,
      url: `${origin}/media/${p.media_id}`,
      width: p.width,
      height: p.height
    }))
  });
};
