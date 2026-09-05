import { error } from '@sveltejs/kit';
export const load = async ({ locals, params }) => {
  const { data: work } = await locals.db.from('works').select('id,title').eq('id', params.id).maybeSingle();
  if (!work) error(404);
  const chapter =
    params.chapter === 'novo'
      ? null
      : (
          await locals.db
            .from('chapters')
            .select('id,number,title,published_at')
            .eq('id', params.chapter)
            .eq('work_id', work.id)
            .maybeSingle()
        ).data;
  if (params.chapter !== 'novo' && !chapter) error(404);
  const pages = chapter
    ? (
        await locals.db
          .from('pages')
          .select('media_id,position,width,height')
          .eq('chapter_id', chapter.id)
          .order('position')
      ).data || []
    : [];
  return { work, chapter, pages };
};
