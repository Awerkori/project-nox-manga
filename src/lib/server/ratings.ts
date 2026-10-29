import { executeYugabyteSql, withYugabyteLkg } from './yugabyte';

export interface RatingSummary {
  average: number | null;
  count: number;
  userRating: number | null;
  distribution: Record<number, number>;
}

// In-memory cache for fast lookup during high concurrency
const ratingCache = new Map<string, { summary: RatingSummary; timestamp: number }>();
const CACHE_TTL_MS = 15_000;

let tableEnsured = true;
async function ensureWorkRatingsTable(_platformEnv?: any) {
  // Table and index are authoritative and verified to exist. No-op on hot SSR path.
}

export async function getWorkRating(
  workId: string,
  visitorId?: string,
  userId?: string,
  platformEnv?: any
): Promise<RatingSummary> {
  const cacheKey = `${workId}:${visitorId || 'anon'}:${userId || 'anon'}`;
  const cached = ratingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.summary;
  }

  return withYugabyteLkg(
    `rating_${workId}`,
    async () => {
      const sql = `
        SELECT
          ROUND(AVG(rating) FILTER (WHERE rating >= 1 AND rating <= 5)::numeric, 1) as avg_rating,
          COUNT(*) FILTER (WHERE rating >= 1 AND rating <= 5)::int as total_count,
          MAX(rating) FILTER (WHERE visitor_id = $2 OR (user_id = $3 AND $3 IS NOT NULL)) as user_rating,
          COUNT(*) FILTER (WHERE rating = 1)::int as cnt_1,
          COUNT(*) FILTER (WHERE rating = 2)::int as cnt_2,
          COUNT(*) FILTER (WHERE rating = 3)::int as cnt_3,
          COUNT(*) FILTER (WHERE rating = 4)::int as cnt_4,
          COUNT(*) FILTER (WHERE rating = 5)::int as cnt_5
        FROM public.work_ratings
        WHERE work_id = $1;
      `;
      const res = await executeYugabyteSql<{
        avg_rating: string | null;
        total_count: number;
        user_rating: number | null;
        cnt_1: number;
        cnt_2: number;
        cnt_3: number;
        cnt_4: number;
        cnt_5: number;
      }>(sql, [workId, visitorId || '', userId || null], platformEnv);

      const row = res.rows[0];
      const rawAvg = row?.avg_rating;
      const count = row?.total_count ? Number(row.total_count) : 0;
      const average = rawAvg !== null && rawAvg !== undefined ? parseFloat(rawAvg) : null;
      const userRating = row?.user_rating !== null && row?.user_rating !== undefined ? Number(row.user_rating) : null;
      const distribution: Record<number, number> = {
        1: row?.cnt_1 ? Number(row.cnt_1) : 0,
        2: row?.cnt_2 ? Number(row.cnt_2) : 0,
        3: row?.cnt_3 ? Number(row.cnt_3) : 0,
        4: row?.cnt_4 ? Number(row.cnt_4) : 0,
        5: row?.cnt_5 ? Number(row.cnt_5) : 0
      };

      const summary: RatingSummary = {
        average,
        count,
        userRating,
        distribution
      };

      ratingCache.set(cacheKey, { summary, timestamp: Date.now() });
      return summary;
    },
    {
      average: null,
      count: 0,
      userRating: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    }
  );
}

export async function setWorkRating(
  workId: string,
  visitorId: string,
  rating: number,
  userId?: string,
  platformEnv?: any
): Promise<RatingSummary> {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('A avaliação deve ser um número inteiro de 1 a 5 estrelas.');
  }

  await ensureWorkRatingsTable(platformEnv);

  await executeYugabyteSql(
    `INSERT INTO public.work_ratings (work_id, visitor_id, user_id, rating, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (work_id, visitor_id)
     DO UPDATE SET rating = EXCLUDED.rating,
                   user_id = COALESCE(EXCLUDED.user_id, public.work_ratings.user_id),
                   updated_at = now();`,
    [workId, visitorId, userId || null, rating],
    platformEnv
  );

  // Invalidate cache for this work
  for (const k of ratingCache.keys()) {
    if (k.startsWith(`${workId}:`)) ratingCache.delete(k);
  }

  return getWorkRating(workId, visitorId, userId, platformEnv);
}

export async function removeWorkRating(
  workId: string,
  visitorId: string,
  userId?: string,
  platformEnv?: any
): Promise<RatingSummary> {
  await ensureWorkRatingsTable(platformEnv);

  await executeYugabyteSql(
    `DELETE FROM public.work_ratings
     WHERE work_id = $1 AND (visitor_id = $2 OR (user_id = $3 AND $3 IS NOT NULL));`,
    [workId, visitorId, userId || null],
    platformEnv
  );

  // Invalidate cache
  for (const k of ratingCache.keys()) {
    if (k.startsWith(`${workId}:`)) ratingCache.delete(k);
  }

  return getWorkRating(workId, visitorId, userId, platformEnv);
}
