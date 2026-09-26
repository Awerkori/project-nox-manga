import { fetchRecentReleasesFromYugabyte } from "$lib/server/yugabyte";

export const load = async ({ url, platform, setHeaders }: any) => {
  if (setHeaders) {
    setHeaders({
      "cache-control": "public, max-age=15, stale-while-revalidate=60"
    });
  }

  const rawKind = url.searchParams.get("kind");
  const kind = rawKind && rawKind.toUpperCase() !== "ALL" ? rawKind.toUpperCase() : null;

  const rows = await fetchRecentReleasesFromYugabyte(24, 4, null, null, platform?.env, kind);

  const releasesMap = new Map<string, any>();
  for (const r of rows) {
    const workId = (r as any).work_id;
    if (!workId) continue;
    if (!releasesMap.has(workId)) {
      releasesMap.set(workId, {
        workId,
        workSlug: (r as any).work_slug || "",
        workTitle: (r as any).work_title || "",
        coverId: (r as any).work_cover_id || null,
        kind: (r as any).work_kind || "UNKNOWN",
        contentRating: (r as any).work_content_rating || null,
        latestPublishedAt: (r as any).latest_published_at || "",
        chapters: []
      });
    }
    const group = releasesMap.get(workId)!;
    if (group.chapters.length < 4) {
      group.chapters.push({
        id: (r as any).chapter_id,
        number: Number((r as any).chapter_number),
        title: (r as any).chapter_title,
        publishedAt: (r as any).chapter_published_at || ""
      });
    }
  }

  const releases = Array.from(releasesMap.values()).slice(0, 24);
  const lastItem = releases.length > 0 ? releases[releases.length - 1] : null;

  return {
    releases,
    hasMore: releases.length === 24,
    nextCursorTime: lastItem ? lastItem.latestPublishedAt : null,
    nextCursorId: lastItem ? lastItem.workId : null,
    selectedKind: kind || "ALL",
    loadError: false
  };
};
