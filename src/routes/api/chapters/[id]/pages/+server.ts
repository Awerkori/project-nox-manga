import { json } from '@sveltejs/kit';
import { readerChapter, readerContent } from '$lib/server/reader-editorial';

// The public Reader already uses direct YSQL for canonical chapter identity.
// Keep this API on the same authoritative path: PostgREST can otherwise hold
// a stale schema cache immediately after additive chapter-identity migrations.
export const GET = async ({ params, locals, cookies, platform }) => {
  const { id } = params;
  const platformEnv = (platform as any)?.env;

  const isStaff = ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '');
  const { data: chapter } = await readerChapter(id, isStaff, platformEnv);

  if (!chapter) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const work = chapter.works;
  if (!work || (!isStaff && !work.published)) {
    return json({ error: 'Obra não publicada' }, { status: 404 });
  }

  if (work.content_rating === 'ADULT_18') {
    const rawAgeCookie = cookies.get('nox-age-status');
    let ageStatus = rawAgeCookie;
    if (locals.user) {
      const p = await locals.db.from('members').select('age_status').eq('id', locals.user.id).maybeSingle();
      if (p.data?.age_status) ageStatus = p.data.age_status;
    }
    if (ageStatus === 'MINOR') {
      return json({ error: 'Conteúdo restrito (+18).' }, { status: 403 });
    }
  }

  const { data: content } = await readerContent(chapter.id, chapter.work_id, platformEnv);

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
    pages: content?.pages || []
  });
};
