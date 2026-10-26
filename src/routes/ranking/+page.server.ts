import { safeDbQuery } from '$lib/server/resilience';
import { getCachedRanking, setCachedRanking } from '$lib/server/ranking-cache';

export const load = async ({ locals, setHeaders }) => {
  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=5, stale-while-revalidate=15'
    });
  } else {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });
  }

  const cached = getCachedRanking();
  if (cached) {
    return {
      members: cached,
      loadError: false,
      isStale: false
    };
  }

  const res = await safeDbQuery(
    locals.db
      .from('members')
      .select('id,username,display_name,xp,avatar_id,avatar_crop,created_at,equipped_title_id,equipped_badge_id')
      .eq('is_test', false)
      .gt('xp', 0)
      .order('xp', { ascending: false })
      .limit(50),
    1200,
    'ranking_members'
  );

  if (res.data && res.data.length > 0) {
    setCachedRanking(res.data);
    return {
      members: res.data,
      loadError: false,
      isStale: false
    };
  }

  return {
    members: [],
    loadError: false,
    isStale: false
  };
};
