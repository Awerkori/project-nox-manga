import { error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import {
  buildChapterProvenance,
  buildWorkProvenance,
  type ChapterMappingRecord,
  type SourceRecord,
  type WorkMappingRecord
} from '$lib/server/admin-work-provenance';

export const load = async ({ locals, params }) => {
  const [work, tags, selected, chapters, allScans, workScans, workMappings, sources] = await Promise.all([
    params.id === 'nova'
      ? Promise.resolve({ data: null })
      : locals.db.from('works').select(`${WORK_FIELDS},metadata_provenance`).eq('id', params.id).maybeSingle(),
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
          .eq('work_id', params.id),
    params.id === 'nova'
      ? Promise.resolve({ data: [] })
      : locals.db
          .from('importer_work_mappings')
          .select('id,source,source_work_id,source_slug,source_title,sync_status,last_synced_at,is_primary,metadata,updated_at')
          .eq('work_id', params.id),
    params.id === 'nova'
      ? Promise.resolve({ data: [] })
      : locals.db
          .from('importer_sources')
          .select('id,name,base_url,enabled,status')
  ]);
  if (params.id !== 'nova' && !work.data) error(404, 'Obra não encontrada');

  const chapterIds = (chapters.data || []).map((chapter) => chapter.id);
  const chapterMappings =
    params.id === 'nova' || chapterIds.length === 0
      ? { data: [] }
      : await locals.db
          .from('importer_chapter_mappings')
          .select('id,chapter_id,work_id,work_mapping_id,source,source_chapter_id,status,is_page_provider,created_at,updated_at')
          .eq('work_id', params.id);

  const sourceRecords = (sources.data || []) as SourceRecord[];
  const provenance = work.data
    ? buildWorkProvenance(
        (work.data as any).metadata_provenance,
        (workMappings.data || []) as WorkMappingRecord[],
        sourceRecords
      )
    : null;

  return {
    work: work.data,
    tags: tags.data || [],
    selected: selected.data?.map((t) => t.tag_id) || [],
    chapters: chapters.data || [],
    allScans: allScans.data || [],
    workScans: workScans.data || [],
    provenance,
    chapterProvenance: buildChapterProvenance(
      chapterIds,
      (chapterMappings.data || []) as ChapterMappingRecord[],
      sourceRecords
    )
  };
};
