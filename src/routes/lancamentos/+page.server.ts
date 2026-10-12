import { fetchRecentReleaseTimelineFromYugabyte } from "$lib/server/yugabyte";

export const load = async ({ url, platform, setHeaders }: any) => {
  if (setHeaders) {
    setHeaders({
      "cache-control": "public, max-age=15, stale-while-revalidate=60"
    });
  }

  const rawKind = url.searchParams.get("kind");
  const kind = rawKind && rawKind.toUpperCase() !== "ALL" ? rawKind.toUpperCase() : null;

  const rows = await fetchRecentReleaseTimelineFromYugabyte(24, null, null, platform?.env, kind);

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
    group.chapters.push({
      id: (r as any).chapter_id,
      number: (r as any).chapter_number,
      display_number: (r as any).chapter_display_number,
      canonical_chapter_key: (r as any).canonical_chapter_key,
      chapter_order_key: (r as any).chapter_order_key,
      chapter_kind: (r as any).chapter_kind,
      edition: (r as any).chapter_edition,
      language: (r as any).chapter_language,
      title: (r as any).chapter_title,
      publishedAt: (r as any).chapter_published_at || ""
    });
  }

  const releases = Array.from(releasesMap.values());
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

  return {
    releases,
    hasMore: rows.length === 24,
    nextCursorTime: lastRow ? lastRow.chapter_published_at : null,
    nextCursorId: lastRow ? lastRow.chapter_id : null,
    selectedKind: kind || "ALL",
    loadError: false
  };
};
