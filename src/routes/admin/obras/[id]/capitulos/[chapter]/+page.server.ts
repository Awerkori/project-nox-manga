import { error } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  buildChapterProvenance,
  type ChapterMappingRecord,
  type SourceRecord
} from '$lib/server/admin-work-provenance';

export const load = async ({ params, platform }: any) => {
  const platformEnv = platform?.env;

  const workRes = await executeYugabyteSql(
    `SELECT id, title FROM public.works WHERE id = $1 LIMIT 1;`,
    [params.id],
    platformEnv
  );
  const work = workRes.rows[0];
  if (!work) error(404);

  let chapter = null;
  if (params.chapter !== 'novo') {
    const chapRes = await executeYugabyteSql(
      `SELECT id, number, display_number, canonical_chapter_key, chapter_order_key, chapter_kind, edition, language, title, published_at
       FROM public.chapters
       WHERE id = $1 AND work_id = $2
       LIMIT 1;`,
      [params.chapter, work.id],
      platformEnv
    );
    chapter = chapRes.rows[0] || null;
    if (!chapter) error(404);
  }

  const [pagesRes, allScansRes, workScansRes, chapterScansRes, chapterMappingsRes, sourcesRes] = await Promise.all([
    chapter
      ? executeYugabyteSql(
          `SELECT media_id, position, width, height FROM public.pages WHERE chapter_id = $1 ORDER BY position;`,
          [chapter.id],
          platformEnv
        )
      : Promise.resolve({ rows: [] }),
    executeYugabyteSql(
      `SELECT id, name, slug, is_official, status FROM public.scans ORDER BY is_official DESC, name ASC;`,
      [],
      platformEnv
    ),
    executeYugabyteSql(
      `SELECT ws.scan_id, ws.is_primary,
              json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official) AS scans
       FROM public.work_scans ws
       JOIN public.scans s ON s.id = ws.scan_id
       WHERE ws.work_id = $1;`,
      [work.id],
      platformEnv
    ),
    chapter
      ? executeYugabyteSql(
          `SELECT cs.scan_id,
                  json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'is_official', s.is_official) AS scans
           FROM public.chapter_scans cs
           JOIN public.scans s ON s.id = cs.scan_id
           WHERE cs.chapter_id = $1;`,
          [chapter.id],
          platformEnv
        )
      : Promise.resolve({ rows: [] }),
    chapter
      ? executeYugabyteSql(
          `SELECT id, chapter_id, work_id, work_mapping_id, source, source_chapter_id, status, is_page_provider, created_at, updated_at
           FROM public.importer_chapter_mappings
           WHERE chapter_id = $1 AND work_id = $2;`,
          [chapter.id, work.id],
          platformEnv
        )
      : Promise.resolve({ rows: [] }),
    chapter
      ? executeYugabyteSql(
          `SELECT id, name, base_url, enabled, status FROM public.importer_sources;`,
          [],
          platformEnv
        )
      : Promise.resolve({ rows: [] })
  ]);

  const pages = pagesRes.rows || [];
  const allScans = allScansRes.rows || [];
  const workScans = workScansRes.rows || [];
  const chapterScans = chapter
    ? chapterScansRes.rows || []
    : workScans.map((ws: any) => ({ scan_id: ws.scan_id, scans: ws.scans }));

  const chapterProvenance = chapter
    ? buildChapterProvenance(
        [chapter.id],
        (chapterMappingsRes.rows || []) as ChapterMappingRecord[],
        (sourcesRes.rows || []) as SourceRecord[]
      )[chapter.id] || null
    : null;

  return { work, chapter, pages, allScans, workScans, chapterScans, chapterProvenance };
};
