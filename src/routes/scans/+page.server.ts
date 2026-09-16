import { safeQuery } from '$lib/server/db';
import { db, schema } from '$lib/server/db';
import { eq, desc, asc, sql } from 'drizzle-orm';

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

  const scansResult = await safeQuery(
    db.select({
      id: schema.scans.id,
      name: schema.scans.name,
      slug: schema.scans.slug,
      description: schema.scans.description,
      displayPreposition: schema.scans.displayPreposition,
      logoId: schema.scans.logoId,
      bannerId: schema.scans.bannerId,
      website: schema.scans.website,
      discord: schema.scans.discord,
      fluxer: schema.scans.fluxer,
      isOfficial: schema.scans.isOfficial,
      status: schema.scans.status,
      createdAt: schema.scans.createdAt,
      worksCount: sql<number>`(SELECT count(*) FROM ${schema.workScans} WHERE ${schema.workScans.scanId} = ${schema.scans.id})::int`,
      chaptersCount: sql<number>`(SELECT count(*) FROM ${schema.chapterScans} WHERE ${schema.chapterScans.scanId} = ${schema.scans.id})::int`
    })
    .from(schema.scans)
    .where(eq(schema.scans.status, 'ACTIVE'))
    .orderBy(desc(schema.scans.isOfficial), asc(schema.scans.name))
  );

  const openingsResult = await safeQuery(
    db.select({
      id: schema.scanRecruitmentOpenings.id,
      title: schema.scanRecruitmentOpenings.title,
      status: schema.scanRecruitmentOpenings.status,
      scanId: schema.scanRecruitmentOpenings.scanId,
      position: {
        id: schema.scanPositions.id,
        name: schema.scanPositions.name
      }
    })
    .from(schema.scanRecruitmentOpenings)
    .leftJoin(schema.scanPositions, eq(schema.scanRecruitmentOpenings.positionId, schema.scanPositions.id))
    .where(eq(schema.scanRecruitmentOpenings.status, 'OPEN'))
  );

  const openingsByScanId = new Map<string, any[]>();
  if (openingsResult.data) {
    for (const o of openingsResult.data) {
      if (!openingsByScanId.has(o.scanId)) openingsByScanId.set(o.scanId, []);
      openingsByScanId.get(o.scanId)!.push(o);
    }
  }

  const scans = scansResult.data;

  if (scans && scans.length > 0) {
    const formattedScans = scans.map((s: any) => {
      const openVacancies = openingsByScanId.get(s.id) || [];
      return {
        ...s,
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
    loadError: scansResult.isDegraded,
    isStale: false
  };
};
