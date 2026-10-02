import { error } from '@sveltejs/kit';
import { WORK_FIELDS } from '$lib/server/db';
import { logAdminLoadError, throwOnAdminLoadError } from '$lib/server/admin-load-errors';
import {
  buildChapterProvenance,
  buildWorkProvenance,
  type ChapterMappingRecord,
  type SourceRecord,
  type WorkMappingRecord
} from '$lib/server/admin-work-provenance';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingMetadataProvenance(error: { code?: string | null; message?: string | null } | null | undefined) {
  return Boolean(
    error &&
      /metadata_provenance/i.test(error.message || '') &&
      (error.code === 'PGRST204' || /column|schema cache/i.test(error.message || ''))
  );
}

export const load = async ({ locals, params, request }) => {
  if (params.id !== 'nova' && !UUID.test(params.id)) error(404, 'Obra não encontrada');

  const queryContext = {
    route: '/admin/obras/[id]',
    requestId: request.headers.get('cf-ray') || request.headers.get('x-request-id')
  };
  const queries = await Promise.all([
    params.id === 'nova'
      ? Promise.resolve({ data: null, error: null })
      : locals.db.from('works').select(`${WORK_FIELDS},metadata_provenance`).eq('id', params.id).maybeSingle(),
    locals.db.from('tags').select('*').order('name'),
    params.id === 'nova'
      ? Promise.resolve({ data: [], error: null })
      : locals.db.from('work_tags').select('tag_id').eq('work_id', params.id),
    params.id === 'nova'
      ? Promise.resolve({ data: [], error: null })
      : locals.db
          .from('chapters')
          .select('id,number,title,published_at')
          .eq('work_id', params.id)
          .order('number', { ascending: false }),
    locals.db.from('scans').select('id,name,slug,is_official,status').order('is_official', { ascending: false }).order('name'),
    params.id === 'nova'
      ? Promise.resolve({ data: [], error: null })
      : locals.db
          .from('work_scans')
          .select('scan_id,is_primary,scans(id,name,slug,is_official)')
          .eq('work_id', params.id),
    params.id === 'nova'
      ? Promise.resolve({ data: [], error: null })
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
  let work = queries[0];
  const [, tags, selected, chapters, allScans, workScans, workMappings, sources] = queries;

  let metadataProvenanceAvailable = true;
  if (params.id !== 'nova' && isMissingMetadataProvenance(work.error)) {
    logAdminLoadError('admin_load_query_degraded', work.error!, { ...queryContext, operation: 'work_metadata_provenance' });
    work = await locals.db.from('works').select(WORK_FIELDS).eq('id', params.id).maybeSingle();
    metadataProvenanceAvailable = false;
  }

  throwOnAdminLoadError(work, { ...queryContext, operation: 'work' });
  throwOnAdminLoadError(tags, { ...queryContext, operation: 'tags' });
  throwOnAdminLoadError(selected, { ...queryContext, operation: 'work_tags' });
  throwOnAdminLoadError(chapters, { ...queryContext, operation: 'chapters' });
  throwOnAdminLoadError(allScans, { ...queryContext, operation: 'scans' });
  throwOnAdminLoadError(workScans, { ...queryContext, operation: 'work_scans' });
  throwOnAdminLoadError(workMappings, { ...queryContext, operation: 'importer_work_mappings' });
  throwOnAdminLoadError(sources, { ...queryContext, operation: 'importer_sources' });

  if (params.id !== 'nova' && !work.data) error(404, 'Obra não encontrada');

  const chapterIds = (chapters.data || []).map((chapter) => chapter.id);
  const chapterMappings =
    params.id === 'nova' || chapterIds.length === 0
      ? { data: [] }
      : await locals.db
          .from('importer_chapter_mappings')
          .select('id,chapter_id,work_id,work_mapping_id,source,source_chapter_id,status,is_page_provider,created_at,updated_at')
          .eq('work_id', params.id);

  throwOnAdminLoadError(chapterMappings, { ...queryContext, operation: 'importer_chapter_mappings' });

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
    metadataProvenanceAvailable,
    chapterProvenance: buildChapterProvenance(
      chapterIds,
      (chapterMappings.data || []) as ChapterMappingRecord[],
      sourceRecords
    )
  };
};
