import { safeDbQuery } from '$lib/server/resilience';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { safeQuery } from '$lib/server/db/safe';

type RankingCache = {
  timestamp: number;
  members: any[];
};

let cachedRanking: RankingCache | null = null;
const RANKING_CACHE_TTL_MS = 300_000;

export const load = async ({ locals, setHeaders }) => {
  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    });
  }

  if (cachedRanking && Date.now() - cachedRanking.timestamp < RANKING_CACHE_TTL_MS) {
    return {
      members: cachedRanking.members,
      loadError: false,
      isStale: false
    };
  }

  const res = await safeDbQuery(
    safeQuery(
      db.select({
        id: schema.members.id,
        username: schema.members.username,
        display_name: schema.members.displayName,
        xp: schema.members.xp,
        avatar_id: schema.members.avatarId,
        created_at: schema.members.createdAt,
        equipped_title_id: schema.members.equippedTitleId,
        equipped_badge_id: schema.members.equippedBadgeId
      })
      .from(schema.members)
      .where(and(eq(schema.members.isTest, 0), gt(schema.members.xp, 0)))
      .orderBy(desc(schema.members.xp))
      .limit(50)
    ),
    1200,
    'ranking_members'
  );

  if (res.data && res.data.length > 0) {
    cachedRanking = {
      timestamp: Date.now(),
      members: res.data
    };
    return {
      members: res.data,
      loadError: false,
      isStale: false
    };
  }

  if (cachedRanking) {
    return {
      members: cachedRanking.members,
      loadError: false,
      isStale: true
    };
  }

  return {
    members: [],
    loadError: false,
    isStale: false
  };
};
