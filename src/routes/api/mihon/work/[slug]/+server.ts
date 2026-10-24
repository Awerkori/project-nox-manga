import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { fetchWorkFromYugabyte, fetchWorkChaptersFromYugabyte, fetchWorkTagsFromYugabyte } from '$lib/server/yugabyte';

export const GET = async ({ params, request, url, platform }: any) => {
  const { slug } = params;
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const work = await fetchWorkFromYugabyte(slug, platform?.env);

  if (!work || !work.published) {
    return json({ error: 'Obra não encontrada' }, { status: 404 });
  }

  if (work.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      { status: 403 }
    );
  }

  const [chapters, tags] = await Promise.all([
    fetchWorkChaptersFromYugabyte(work.id, false, platform?.env),
    fetchWorkTagsFromYugabyte(work.id, platform?.env)
  ]);

  const origin = url.origin;
  const genres = (tags || []).map((t) => t.name).filter(Boolean);

  // Mihon expects chapters ascending by reading order
  const sortedChapters = [...(chapters || [])].sort((a, b) => {
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
    cover_url: work.cover_id ? `${origin}/media/${work.cover_id}` : null,
    updated_at: work.updated_at,
    genres,
    chapters: sortedChapters.map((ch) => ({
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
  });
};
