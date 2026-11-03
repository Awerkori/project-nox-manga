import { error } from '@sveltejs/kit';
import { editor } from '$lib/server/db';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  buildChapterProvenance,
  buildWorkProvenance,
  type ChapterMappingRecord,
  type SourceRecord,
  type WorkMappingRecord
} from '$lib/server/admin-work-provenance';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load = async ({ locals, params, platform }: any) => {
  editor(locals);
  if (params.id !== 'nova' && !UUID.test(params.id)) error(404, 'Obra não encontrada');

  const isNova = params.id === 'nova';

  const [
    workRes,
    tagsRes,
    selectedRes,
    chaptersRes,
    allScansRes,
    workScansRes,
    workMappingsRes,
    sourcesRes,
    chapterMappingsRes
  ] = await Promise.all([
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,published,featured,cover_id,updated_at,created_at,content_rating,views_total,metadata_provenance
           FROM public.works WHERE id = $1 LIMIT 1;`,
          [params.id],
          platform?.env
        ).catch(() => ({ rows: [] })),
    executeYugabyteSql(`SELECT * FROM public.tags ORDER BY name;`, [], platform?.env).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(`SELECT tag_id FROM public.work_tags WHERE work_id = $1;`, [params.id], platform?.env).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title,published_at
           FROM public.chapters
           WHERE work_id = $1
           ORDER BY chapter_order_key DESC NULLS LAST, number DESC NULLS LAST, id DESC;`,
          [params.id],
          platform?.env
        ).catch(() => ({ rows: [] })),
    executeYugabyteSql(`SELECT id,name,slug,is_official,status FROM public.scans ORDER BY is_official DESC, name;`, [], platform?.env).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT ws.scan_id, ws.is_primary, json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official) AS scans
           FROM public.work_scans ws
           JOIN public.scans s ON s.id = ws.scan_id
           WHERE ws.work_id = $1;`,
          [params.id],
          platform?.env
        ).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT id,source,source_work_id,source_slug,source_title,sync_status,last_synced_at,is_primary,metadata,updated_at
           FROM public.importer_work_mappings
           WHERE work_id = $1;`,
          [params.id],
          platform?.env
        ).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT id,name,base_url,enabled,status FROM public.importer_sources;`,
          [],
          platform?.env
        ).catch(() => ({ rows: [] })),
    isNova
      ? Promise.resolve({ rows: [] })
      : executeYugabyteSql(
          `SELECT id,chapter_id,work_id,work_mapping_id,source,source_chapter_id,status,is_page_provider,created_at,updated_at
           FROM public.importer_chapter_mappings
           WHERE work_id = $1;`,
          [params.id],
          platform?.env
        ).catch(() => ({ rows: [] }))
  ]);

  const workData = workRes.rows[0] || null;
  if (!isNova && !workData) error(404, 'Obra não encontrada');

  const tagsData = tagsRes.rows || [];
  const selectedData = selectedRes.rows || [];
  const chaptersData = chaptersRes.rows || [];
  const allScansData = allScansRes.rows || [];
  const workScansData = workScansRes.rows || [];
  const workMappingsData = workMappingsRes.rows || [];
  const sourcesData = (sourcesRes.rows || []) as SourceRecord[];
  const chapterMappingsData = (chapterMappingsRes.rows || []) as ChapterMappingRecord[];

  const chapterIds = chaptersData.map((chapter: any) => chapter.id);

  const provenance = workData
    ? buildWorkProvenance(
        workData.metadata_provenance,
        workMappingsData as WorkMappingRecord[],
        sourcesData
      )
    : null;

  return {
    work: workData,
    tags: tagsData,
    selected: selectedData.map((t: any) => t.tag_id),
    chapters: chaptersData,
    allScans: allScansData,
    workScans: workScansData,
    provenance,
    metadataProvenanceAvailable: true,
    chapterProvenance: buildChapterProvenance(
      chapterIds,
      chapterMappingsData,
      sourcesData
    )
  };
};
