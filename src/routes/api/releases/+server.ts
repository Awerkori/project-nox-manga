import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { withTimeout } from '$lib/server/resilience';

export const GET = async ({ url, locals, platform }: any) => {
  const db = locals.db || privileged(platform?.env);
  
  const cursorTime = url.searchParams.get('cursorTime') || null;
  const cursorId = url.searchParams.get('cursorId') || null;
  const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '16', 10)));

  const { data: chaptersData, error: chaptersError } = await withTimeout(
    db.rpc('get_recent_releases', {
      p_limit: limit,
      p_chapters_per_work: 3,
      p_cursor_time: cursorTime,
      p_cursor_id: cursorId
    }),
    4500,
    { data: null, error: null } as any,
    'api_recent_releases'
  );

  if (chaptersError || !chaptersData) {
    return json({ releases: [], error: chaptersError?.message || 'Timeout' }, { status: 500 });
  }

  const releasesMap = new Map();
  for (const row of chaptersData) {
    const workId = (row as any).work_id as string;
    if (!workId) continue;
    if (!releasesMap.has(workId)) {
      releasesMap.set(workId, {
        workId,
        workSlug: (row as any).work_slug || '',
        workTitle: (row as any).work_title || '',
        coverId: (row as any).work_cover_id || null,
        kind: (row as any).work_kind || 'UNKNOWN',
        contentRating: (row as any).work_content_rating || null,
        latestPublishedAt: (row as any).latest_published_at || '',
        chapters: []
      });
    }
    const group = releasesMap.get(workId);
    if (group.chapters.length < 3) {
      group.chapters.push({
        id: (row as any).chapter_id,
        number: (row as any).chapter_number,
        title: (row as any).chapter_title,
        publishedAt: (row as any).chapter_published_at || ''
      });
    }
  }

  const releases = Array.from(releasesMap.values());

  return json({
    releases,
    hasMore: releases.length === limit,
    nextCursorTime: releases.length > 0 ? releases[releases.length - 1].latestPublishedAt : null,
    nextCursorId: releases.length > 0 ? releases[releases.length - 1].workId : null
  });
};
