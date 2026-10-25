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

let tableEnsured = false;
async function ensureWorkRatingsTable(platformEnv?: any) {
  if (tableEnsured) return;
  try {
    await executeYugabyteSql(
      `CREATE TABLE IF NOT EXISTS public.work_ratings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
        visitor_id text NOT NULL,
        user_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
        rating smallint NOT NULL CHECK (rating >= 0 AND rating <= 5),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (work_id, visitor_id)
      );
      CREATE INDEX IF NOT EXISTS idx_work_ratings_work_id ON public.work_ratings(work_id);`,
      [],
      platformEnv
    );
    tableEnsured = true;
  } catch (err: any) {
    // If table already exists or transient permission warning, continue
    console.warn('[RATINGS_TABLE_ENSURE]', err?.message || err);
  }
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

  await ensureWorkRatingsTable(platformEnv);

  return withYugabyteLkg(
    `rating_${workId}`,
    async () => {
      // 1. Aggregate stats
      const aggRes = await executeYugabyteSql<{
        avg_rating: string | null;
        total_count: string;
      }>(
        `SELECT
          ROUND(AVG(rating)::numeric, 1) as avg_rating,
          COUNT(*)::int as total_count
        FROM public.work_ratings
        WHERE work_id = $1;`,
        [workId],
        platformEnv
      );

      const rawAvg = aggRes.rows[0]?.avg_rating;
      const count = parseInt(aggRes.rows[0]?.total_count || '0', 10);
      const average = rawAvg !== null && rawAvg !== undefined ? parseFloat(rawAvg) : null;

      // 2. User specific rating
      let userRating: number | null = null;
      if (visitorId || userId) {
        const userRes = await executeYugabyteSql<{ rating: number }>(
          `SELECT rating FROM public.work_ratings
           WHERE work_id = $1 AND (visitor_id = $2 OR (user_id = $3 AND $3 IS NOT NULL))
           ORDER BY user_id NULLS LAST
           LIMIT 1;`,
          [workId, visitorId || '', userId || null],
          platformEnv
        );
        if (userRes.rows.length > 0 && userRes.rows[0].rating !== null && userRes.rows[0].rating !== undefined) {
          userRating = userRes.rows[0].rating;
        }
      }

      // 3. Distribution
      const distRes = await executeYugabyteSql<{ rating: number; cnt: string }>(
        `SELECT rating, COUNT(*)::int as cnt
         FROM public.work_ratings
         WHERE work_id = $1
         GROUP BY rating;`,
        [workId],
        platformEnv
      );

      const distribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const row of distRes.rows) {
        distribution[row.rating] = parseInt(row.cnt, 10);
      }

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
      distribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
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
  if (rating < 0 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('A avaliação deve ser um número inteiro de 0 a 5 estrelas.');
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
