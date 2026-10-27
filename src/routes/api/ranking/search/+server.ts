import { json } from '@sveltejs/kit';
import { getLevelProgress, resolveRankingDisplay } from '$lib/levels';

export const GET = async ({ url, locals }: any) => {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query || query.length < 2) {
    return json({ results: [] });
  }

  const cleanQuery = query.startsWith('@') ? query.slice(1) : query;

  try {
    // Search matching non-test members
    const { data: matchedMembers, error } = await locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,season_xp,lifetime_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,equipped_badge_id,created_at'
      )
      .eq('is_test', false)
      .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .order('season_xp', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(10);

    if (error || !matchedMembers || matchedMembers.length === 0) {
      return json({ results: [] });
    }

    // For each member, compute exact ranking position using deterministic tie-breaker
    const results = await Promise.all(
      matchedMembers.map(async (m: any) => {
        const seasonXp = m.season_xp ?? 0;
        const createdAt = m.created_at;
        const memberId = m.id;

        const { count } = await locals.db
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('is_test', false)
          .or(
            `season_xp.gt.${seasonXp},and(season_xp.eq.${seasonXp},created_at.lt.${createdAt}),and(season_xp.eq.${seasonXp},created_at.eq.${createdAt},id.lt.${memberId})`
          );

        const rankPosition = (count ?? 0) + 1;
        const rankInfo = resolveRankingDisplay(seasonXp, m.equipped_badge_id);
        const progress = getLevelProgress(seasonXp);

        return {
          id: m.id,
          username: m.username,
          display_name: m.display_name,
          avatar_id: m.avatar_id,
          avatar_crop: m.avatar_crop,
          avatar_frame_id: m.avatar_frame_id,
          name_color: m.name_color,
          season_xp: seasonXp,
          rank: rankPosition,
          level: rankInfo.level,
          title: rankInfo.title,
          badge: rankInfo.badge,
          progressPercent: progress.progressPercent
        };
      })
    );

    return json({ results });
  } catch (err: any) {
    console.error('[RANKING_SEARCH] Error searching users:', err);
    return json({ results: [], error: 'Falha na busca' }, { status: 500 });
  }
};
