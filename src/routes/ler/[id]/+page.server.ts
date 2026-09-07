import { error } from '@sveltejs/kit';
import { check } from '$lib/server/db';
export const load = async ({ locals, params, url }) => {
  const preview = url.searchParams.get('preview') === '1' && ['ADMIN', 'EDITOR'].includes(locals.role || '');
  let query = locals.db
    .from('chapters')
    .select('id,number,title,work_id,published_at,works(id,title,slug,kind,published)')
    .eq('id', params.id);
  if (!preview) query = query.not('published_at', 'is', null);
  const { data: chapter } = await query.maybeSingle();
  if (!chapter || (!preview && !chapter.works?.published)) error(404, 'Capítulo indisponível');
  const [pages, siblings, progress, comments] = await Promise.all([
    locals.db
      .from('pages')
      .select('position,media_id,width,height')
      .eq('chapter_id', chapter.id)
      .order('position'),
    locals.db
      .from('chapters')
      .select('id,number')
      .eq('work_id', chapter.work_id)
      .not('published_at', 'is', null)
      .order('number'),
    locals.user
      ? locals.db
          .from('reading')
          .select('page,completed_at')
          .eq('user_id', locals.user.id)
          .eq('chapter_id', chapter.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    locals.db
      .from('comments')
      .select(
        'id,user_id,body,created_at,parent_id,members!comments_user_id_fkey(username,display_name,avatar_id),comment_likes(user_id)'
      )
      .eq('chapter_id', chapter.id)
      .eq('removed', false)
      .order('created_at', { ascending: false })
      .limit(100)
  ]);
  check(comments);
  const all = siblings.data || [],
    index = all.findIndex((c) => c.id === chapter.id);
  return {
    chapter,
    pages: pages.data || [],
    previous: all[index - 1] || null,
    next: all[index + 1] || null,
    progress: progress.data,
    comments: comments.data || [],
    preview
  };
};
