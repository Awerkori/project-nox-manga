import { json } from '@sveltejs/kit';
import { fetchRecentReleasesFromYugabyte } from '$lib/server/yugabyte';

export const GET = async ({ url, platform, setHeaders }: any) => {
  const cursorTime = url.searchParams.get('cursorTime') || null;
  const cursorId = url.searchParams.get('cursorId') || null;
  const rawKind = url.searchParams.get('kind');
  const kind = rawKind && rawKind.toUpperCase() !== 'ALL' ? rawKind.toUpperCase() : null;
  const limit = Math.min(48, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10)));

  const chaptersData = await fetchRecentReleasesFromYugabyte(
    limit,
    4,
    cursorTime,
    cursorId,
    platform?.env,
    kind
  );

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
    if (group.chapters.length < 4) {
      group.chapters.push({
        id: (row as any).chapter_id,
        number: (row as any).chapter_number,
        title: (row as any).chapter_title,
        publishedAt: (row as any).chapter_published_at || ''
      });
    }
  }

  const releases = Array.from(releasesMap.values());

  if (setHeaders) {
    setHeaders({
      'cache-control': 'public, max-age=15, stale-while-revalidate=60'
    });
  }

  return json({
    releases,
    hasMore: releases.length === limit,
    nextCursorTime: releases.length > 0 ? releases[releases.length - 1].latestPublishedAt : null,
    nextCursorId: releases.length > 0 ? releases[releases.length - 1].workId : null
  });
};
