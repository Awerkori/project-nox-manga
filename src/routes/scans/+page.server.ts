import { safeDbQuery } from '$lib/server/resilience';

type ScansCache = {
  timestamp: number;
  scans: any[];
};

let cachedScans: ScansCache | null = null;
const SCANS_CACHE_TTL_MS = 300_000;

export const load = async ({ locals }) => {
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
    const formattedScans = scans.map((s: any) => {
      const openVacancies = (s.scan_recruitment_openings || []).filter((o: any) => o.status === 'OPEN');
      return {
        ...s,
        worksCount: s.work_scans?.[0]?.count ?? 0,
        chaptersCount: s.chapter_scans?.[0]?.count ?? 0,
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
