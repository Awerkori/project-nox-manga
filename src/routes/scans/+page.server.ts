import { executeYugabyteSql } from '$lib/server/yugabyte';

type ScansCache = {
  timestamp: number;
  scans: any[];
};

let cachedScans: ScansCache | null = null;
const SCANS_CACHE_TTL_MS = 300_000;

/**
 * Public Scan directory reads only the authoritative YSQL catalog. The old
 * PostgREST join hid chapters whenever optional attribution rows were absent.
 * Scalar aggregates avoid join multiplication while keeping cards inexpensive.
 */
export const load = async ({ platform }: { platform?: any }) => {
  if (cachedScans && Date.now() - cachedScans.timestamp < SCANS_CACHE_TTL_MS) {
    return { scans: cachedScans.scans, loadError: false, isStale: false };
  }

  let rows: any[];
  try {
    const result = await executeYugabyteSql<any>(`
      SELECT
        scan.id, scan.name, scan.slug, scan.description, scan.display_preposition,
        scan.logo_id, scan.banner_id, scan.website, scan.discord, scan.fluxer,
        scan.is_official, scan.status, scan.created_at,
        (SELECT count(*)::int FROM public.work_scans work_scan WHERE work_scan.scan_id = scan.id) AS works_count,
        (SELECT count(DISTINCT chapter.id)::int
           FROM public.work_scans work_scan
           JOIN public.chapters chapter
             ON chapter.work_id = work_scan.work_id AND chapter.published_at IS NOT NULL
          WHERE work_scan.scan_id = scan.id) AS chapters_count,
        (SELECT count(*)::int FROM public.scan_members member WHERE member.scan_id = scan.id) AS members_count,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', opening.id, 'title', opening.title, 'status', opening.status,
            'position', jsonb_build_object('id', position.id, 'name', position.name)
          ) ORDER BY opening.created_at DESC)
          FROM public.scan_recruitment_openings opening
          JOIN public.scan_positions position ON position.id = opening.position_id
          WHERE opening.scan_id = scan.id AND opening.status = 'OPEN'
        ), '[]'::jsonb) AS openings
      FROM public.scans scan
      WHERE scan.status = 'ACTIVE'
      ORDER BY scan.is_official DESC, scan.name ASC
    `, [], platform?.env);
    rows = result.rows;
  } catch (error: any) {
    console.warn('public_scans_directory_ysql_failed', {
      message: String(error?.message || 'unknown').slice(0, 240)
    });
    if (cachedScans) return { scans: cachedScans.scans, loadError: false, isStale: true };
    return { scans: [], loadError: true, isStale: false };
  }

  const scans = rows.map((scan: any) => {
    const openings = Array.isArray(scan.openings) ? scan.openings : [];
    return {
      ...scan,
      worksCount: Number(scan.works_count) || 0,
      chaptersCount: Number(scan.chapters_count) || 0,
      membersCount: Number(scan.members_count) || 0,
      openings,
      isRecruiting: openings.length > 0,
      recruitingPositions: Array.from(new Set(openings.map((opening: any) => opening.position?.name || opening.title).filter(Boolean)))
    };
  });

  cachedScans = { timestamp: Date.now(), scans };
  return { scans, loadError: false, isStale: false };
};
