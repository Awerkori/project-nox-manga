import { json } from '@sveltejs/kit';
import { verifyMihonAuth } from '$lib/server/mihon';
import { privileged } from '$lib/server/db';

export const GET = async ({ params, request, url }) => {
  const { slug } = params;
  const auth = await verifyMihonAuth(request);
  const allowAdult = auth.authenticated && auth.ageStatus === 'ADULT';

  const db = privileged();
  const { data: work, error: workErr } = await db
    .from('works')
    .select('id, title, slug, cover_id, kind, status, content_rating, synopsis, author, artist, updated_at, published')
    .eq('slug', slug)
    .maybeSingle();

  if (workErr || !work || !work.published) {
    return json({ error: 'Obra não encontrada' }, { status: 404 });
  }

  if (work.content_rating === 'ADULT_18' && !allowAdult) {
    return json(
      { error: 'Conteúdo Adulto (+18). Requer autenticação com token de usuário maior de idade.' },
      { status: 403 }
    );
  }

  const [chaptersRes, tagsRes] = await Promise.all([
    db
      .from('chapters')
      .select('id, number, display_number, canonical_chapter_key, chapter_order_key, chapter_kind, edition, language, title, published_at')
      .eq('work_id', work.id)
      .not('published_at', 'is', null)
      .order('chapter_order_key', { ascending: true, nullsFirst: false })
      .order('canonical_chapter_key', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    db
      .from('work_tags')
      .select('tags(name, slug, kind)')
      .eq('work_id', work.id)
  ]);

  const origin = url.origin;
  const genres = (tagsRes.data || [])
    .map((wt) => (Array.isArray(wt.tags) ? wt.tags[0]?.name : (wt.tags as { name?: string } | null)?.name))
    .filter(Boolean);

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
    chapters: (chaptersRes.data || []).map((ch) => ({
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
