import { safeDbQuery } from '$lib/server/resilience';

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
    locals.db
      .from('members')
      .select('id,username,display_name,xp,avatar_id,created_at,equipped_title_id,equipped_badge_id')
      .eq('is_test', false)
      .gt('xp', 0)
      .order('xp', { ascending: false })
      .limit(50),
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

