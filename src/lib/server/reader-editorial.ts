import { executeYugabyteSql } from './yugabyte';

// Editorial reads never fall back to the legacy Supabase catalogue.
export async function readerChapter(id: string, preview: boolean, platformEnv: any) {
  const result = await executeYugabyteSql(`
    SELECT c.id,c.number,c.display_number,c.canonical_chapter_key,c.chapter_order_key,
      c.chapter_kind,c.edition,c.language,c.title,c.work_id,c.published_at,
      json_build_object('id',w.id,'title',w.title,'slug',w.slug,'kind',w.kind,
        'published',w.published,'content_rating',w.content_rating) AS works
    FROM chapters c JOIN works w ON w.id=c.work_id
    WHERE c.id=$1 AND ($2::boolean OR c.published_at IS NOT NULL)
    LIMIT 1`, [id, preview], platformEnv);
  return { data: result.rows[0] || null };
}

export async function readerContent(chapterId: string, workId: string, platformEnv: any) {
  const result = await executeYugabyteSql(`
    SELECT
      COALESCE((SELECT json_agg(p ORDER BY p.position) FROM
        (SELECT position,media_id,width,height FROM pages WHERE chapter_id=$1) p),'[]'::json) AS pages,
      COALESCE((SELECT json_agg(c ORDER BY c.chapter_order_key, c.canonical_chapter_key, c.id) FROM
        (SELECT id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language
         FROM chapters WHERE work_id=$2 AND published_at IS NOT NULL) c),'[]'::json) AS siblings`,
    [chapterId, workId], platformEnv);
  return { data: result.rows[0] || { pages: [], siblings: [] } };
}

export async function readerPreviewTarget(workId: string, displayNumber: string | number, platformEnv: any) {
  // A production-stage number is only a display label. Never resolve it via
  // numeric equality: YSQL considers 12.1 and 12.10 equal. A target id is
  // preferred; this fallback is intentionally an exact textual match.
  const result = await executeYugabyteSql(
    'SELECT id FROM chapters WHERE work_id=$1 AND display_number=$2::text ORDER BY chapter_order_key, canonical_chapter_key, id LIMIT 1',
    [workId, String(displayNumber).trim()],
    platformEnv,
  );
  return result.rows[0] ? readerChapter(result.rows[0].id, true, platformEnv) : { data: null };
}

export async function readerPreviewWork(workId: string, platformEnv: any) {
  const result = await executeYugabyteSql('SELECT id,title,slug,kind,published,content_rating FROM works WHERE id=$1 LIMIT 1', [workId], platformEnv);
  return { data: result.rows[0] || null };
}
