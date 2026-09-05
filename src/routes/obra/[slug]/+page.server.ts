import { error } from '@sveltejs/kit';
import { WORK_FIELDS, check } from '$lib/server/db';
export const load = async ({ locals, params, url }) => {
  const result = await locals.db
    .from('works')
    .select(WORK_FIELDS)
    .eq('slug', params.slug)
    .eq('published', true)
    .maybeSingle();
  check(result);
  if (!result.data) error(404, 'Obra não encontrada');
  const work = result.data;
  const [chapters, tags, comments, library, likes, progress, metrics] = await Promise.all([
    locals.db
      .from('chapters')
      .select('id,number,title,published_at')
      .eq('work_id', work.id)
      .not('published_at', 'is', null)
      .order('number', { ascending: false }),
    locals.db.from('work_tags').select('tags(id,name,slug)').eq('work_id', work.id),
    locals.db
      .from('comments')
      .select('id,user_id,body,created_at,parent_id,members(username,display_name),comment_likes(user_id)')
      .eq('work_id', work.id)
      .is('chapter_id', null)
      .order('created_at', { ascending: false })
      .limit(100),
    locals.user
      ? locals.db
          .from('library')
          .select('*')
          .eq('user_id', locals.user.id)
          .eq('work_id', work.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    locals.db.from('likes').select('user_id').eq('work_id', work.id),
    locals.user
      ? locals.db
          .from('reading')
          .select('chapter_id,page,completed_at,chapters!inner(work_id)')
          .eq('chapters.work_id', work.id)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    locals.db.rpc('work_metrics', { p_work: work.id })
  ]);
  return {
    work,
    chapters: chapters.data || [],
    tags: tags.data?.map((t) => t.tags).filter(Boolean) || [],
    comments: comments.data || [],
    library: library.data,
    likes: likes.data || [],
    progress: progress.data || [],
    metrics: metrics.data?.[0] || null,
    canonical: `${url.origin}/obra/${work.slug}`,
    coverUrl: work.cover_id ? `${url.origin}/media/${work.cover_id}` : null
  };
};
