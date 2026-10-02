import { error } from '@sveltejs/kit';
import {
  buildChapterProvenance,
  type ChapterMappingRecord,
  type SourceRecord
} from '$lib/server/admin-work-provenance';

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
  const [pagesRes, allScansRes, workScansRes, chapterScansRes, chapterMappingsRes, sourcesRes] = await Promise.all([
    chapter
      ? locals.db
          .from('pages')
          .select('media_id,position,width,height')
          .eq('chapter_id', chapter.id)
          .order('position')
      : Promise.resolve({ data: [] }),
    locals.db
      .from('scans')
      .select('id,name,slug,is_official,status')
      .order('is_official', { ascending: false })
      .order('name'),
    locals.db
      .from('work_scans')
      .select('scan_id,is_primary,scans(id,name,slug,is_official)')
      .eq('work_id', work.id),
    chapter
      ? locals.db
          .from('chapter_scans')
          .select('scan_id,scans(id,name,slug,is_official)')
          .eq('chapter_id', chapter.id)
      : Promise.resolve({ data: [] }),
    chapter
      ? locals.db
          .from('importer_chapter_mappings')
          .select('id,chapter_id,work_id,work_mapping_id,source,source_chapter_id,status,is_page_provider,created_at,updated_at')
          .eq('chapter_id', chapter.id)
          .eq('work_id', work.id)
      : Promise.resolve({ data: [] }),
    chapter
      ? locals.db.from('importer_sources').select('id,name,base_url,enabled,status')
      : Promise.resolve({ data: [] })
  ]);

  const pages = pagesRes.data || [];
  const allScans = allScansRes.data || [];
  const workScans = workScansRes.data || [];
  // For new chapters, default to work's scans; for existing chapters, use their assigned scans
  const chapterScans = chapter
    ? chapterScansRes.data || []
    : workScans.map((ws) => ({ scan_id: ws.scan_id, scans: ws.scans }));

  const chapterProvenance = chapter
    ? buildChapterProvenance(
        [chapter.id],
        (chapterMappingsRes.data || []) as ChapterMappingRecord[],
        (sourcesRes.data || []) as SourceRecord[]
      )[chapter.id] || null
    : null;

  return { work, chapter, pages, allScans, workScans, chapterScans, chapterProvenance };
};
