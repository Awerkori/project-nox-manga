import { error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
export const load = async ({ locals, params }) => {
  const [work, tags, selected, chapters, allScans, workScans] = await Promise.all([
    params.id === 'nova'
      ? Promise.resolve({ data: null })
      : locals.db.from('works').select(WORK_FIELDS).eq('id', params.id).maybeSingle(),
    locals.db.from('tags').select('*').order('name'),
    params.id === 'nova'
      ? Promise.resolve({ data: [] })
      : locals.db.from('work_tags').select('tag_id').eq('work_id', params.id),
    params.id === 'nova'
      ? Promise.resolve({ data: [] })
      : locals.db
          .from('chapters')
          .select('id,number,title,published_at')
          .eq('work_id', params.id)
          .order('number', { ascending: false }),
    locals.db.from('scans').select('id,name,slug,is_official,status').order('is_official', { ascending: false }).order('name'),
    params.id === 'nova'
      ? Promise.resolve({ data: [] })
      : locals.db
          .from('work_scans')
          .select('scan_id,is_primary,scans(id,name,slug,is_official)')
          .eq('work_id', params.id)
  ]);
  if (params.id !== 'nova' && !work.data) error(404, 'Obra não encontrada');
  return {
    work: work.data,
    tags: tags.data || [],
    selected: selected.data?.map((t) => t.tag_id) || [],
    chapters: chapters.data || [],
    allScans: allScans.data || [],
    workScans: workScans.data || []
  };
};
