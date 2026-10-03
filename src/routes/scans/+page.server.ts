import { safeDbQuery } from '$lib/server/resilience';
import { executeYugabyteSql } from '$lib/server/yugabyte';

type ScansCache = {
  timestamp: number;
  scans: any[];
};

let cachedScans: ScansCache | null = null;
const SCANS_CACHE_TTL_MS = 300_000;

export const load = async ({ locals, platform }) => {
  if (cachedScans && Date.now() - cachedScans.timestamp < SCANS_CACHE_TTL_MS) {
    return {
      scans: cachedScans.scans,
      loadError: false,
      isStale: false
    };
  }

  const res = await safeDbQuery(
    locals.db
      .from('scans')
      .select(`
        id,
        name,
        slug,
        description,
        display_preposition,
        logo_id,
        banner_id,
        website,
        discord,
        fluxer,
        is_official,
        status,
        created_at,
        work_scans(count),
        chapter_scans(count),
        scan_members(count),
        scan_recruitment_openings(
          id,
          title,
          status,
          position:scan_positions(id, name)
        )
      `)
      .eq('status', 'ACTIVE')
      .order('is_official', { ascending: false })
      .order('name', { ascending: true }),
    4000,
    'scans_list'
  );

  const scans = res.data;

  if (scans && scans.length > 0) {
    // chapter_scans records only explicit release attribution. A scan can also
    // own published chapters through its work association, so using that count
    // alone made public cards claim "0 capítulos" for a scan whose work had
    // live releases. Yugabyte is authoritative for public work/chapter data.
    const chapterCounts = new Map<string, number>();
    try {
      const ids = scans.map((scan: any) => scan.id).filter(Boolean);
      if (ids.length) {
        const result = await executeYugabyteSql<{ scan_id: string; chapter_count: number | string }>(`
          SELECT work_scan.scan_id::text AS scan_id, COUNT(chapter.id)::int AS chapter_count
          FROM public.work_scans work_scan
          JOIN public.chapters chapter
            ON chapter.work_id = work_scan.work_id
           AND chapter.published_at IS NOT NULL
          WHERE work_scan.scan_id = ANY($1::uuid[])
          GROUP BY work_scan.scan_id
        `, [ids], platform?.env);
        for (const row of result.rows) chapterCounts.set(row.scan_id, Number(row.chapter_count) || 0);
      }
    } catch (error: any) {
      // Keep the existing attribution count available during a transient data
      // plane failure instead of making the public directory unavailable.
      console.warn('public_scan_chapter_counts_ysql_fallback', {
        message: String(error?.message || 'unknown').slice(0, 240)
      });
    }

    const formattedScans = scans.map((s: any) => {
      const openVacancies = (s.scan_recruitment_openings || []).filter((o: any) => o.status === 'OPEN');
      return {
        ...s,
        worksCount: s.work_scans?.[0]?.count ?? 0,
        chaptersCount: chapterCounts.get(s.id) ?? s.chapter_scans?.[0]?.count ?? 0,
        membersCount: s.scan_members?.[0]?.count ?? 0,
        openings: openVacancies,
        isRecruiting: openVacancies.length > 0,
        recruitingPositions: Array.from(
          new Set(openVacancies.map((o: any) => o.position?.name || o.title).filter(Boolean))
        )
      };
    });

    cachedScans = {
      timestamp: Date.now(),
      scans: formattedScans
    };

    return {
      scans: formattedScans,
      loadError: false,
      isStale: false
    };
  }

  if (cachedScans) {
    return {
      scans: cachedScans.scans,
      loadError: false,
      isStale: true
    };
  }

  return {
    scans: [],
    loadError: res.isDegraded,
    isStale: false
  };
};
