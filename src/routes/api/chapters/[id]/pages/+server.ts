import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

export const GET = async ({ params, locals, cookies }) => {
  const { id } = params;
  const db = locals.db || privileged();

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  let query = db
    .from('chapters')
    .select('id, number, display_number, canonical_chapter_key, chapter_order_key, chapter_kind, edition, language, title, published_at, work_id, works(id, title, slug, content_rating, published)')
    .eq('id', id);

  if (!isStaff) {
    query = query.not('published_at', 'is', null);
  }

  const { data: chapter, error: chErr } = await query.maybeSingle();

  if (chErr || !chapter) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const work = Array.isArray(chapter.works) ? chapter.works[0] : chapter.works;
  if (!work || (!isStaff && !work.published)) {
    return json({ error: 'Obra não publicada' }, { status: 404 });
  }

  if (work.content_rating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
    let ageStatus = rawAgeCookie;
    if (locals.user) {
      const p = await db.from('members').select('age_status').eq('id', locals.user.id).maybeSingle();
      if (p.data?.age_status) ageStatus = p.data.age_status;
    }
    if (ageStatus === 'MINOR') {
      return json({ error: 'Conteúdo restrito (+18).' }, { status: 403 });
    }
  }

  const { data: pages, error: pErr } = await db
    .from('pages')
    .select('position, media_id, width, height')
    .eq('chapter_id', chapter.id)
    .order('position', { ascending: true });

  if (pErr) {
    return json({ error: 'Erro ao carregar páginas' }, { status: 500 });
  }

  return json({
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
    pages: pages || []
  });
};
