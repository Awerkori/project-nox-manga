import { safeDbQuery } from '$lib/server/resilience';
import { getCachedRanking, setCachedRanking } from '$lib/server/ranking-cache';
import { getLevelProgress } from '$lib/levels';

const DEFAULT_SEASON = {
  id: 'season_1',
  name: 'Temporada 1 — Despertar Cósmico',
  number: 1,
  starts_at: '2026-10-01T00:00:00.000Z',
  ends_at: '2026-12-31T23:59:59.000Z',
  is_active: true,
  rules_text: 'Pontos de Temporada são zerados a cada ciclo trimestral (90 dias). Seu Nível Permanente e cosméticos comprados na Loja são eternos e nunca são perdidos.'
};

export const load = async ({ locals, setHeaders }: any) => {
  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=5, stale-while-revalidate=15'
    });
  } else {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });
  }

  // 1. Fetch active season and past winners
  const [seasonRes, pastWinnersRes] = await Promise.all([
    locals.db
      .from('seasons')
      .select('id,name,number,starts_at,ends_at,is_active,rules_text')
      .eq('is_active', true)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    locals.db
      .from('season_winners')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)
  ]);

  const currentSeason = seasonRes?.data || DEFAULT_SEASON;
  const pastWinners = pastWinnersRes?.data || [];

  // 2. Fetch leaderboard members (cached)
  let members = getCachedRanking();

  if (!members) {
    const res = await safeDbQuery(
      locals.db
        .from('members')
        .select(
          'id,username,display_name,xp,lifetime_xp,season_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,created_at,equipped_title_id,equipped_badge_id'
        )
        .eq('is_test', false)
        .gt('season_xp', 0)
        .order('season_xp', { ascending: false })
        .limit(50),
      1500,
      'ranking_members'
    );

    members = res.data && res.data.length > 0 ? res.data : [];
    if (members.length > 0) {
      setCachedRanking(members);
    }
  }

  // 3. User personalized ranking & progress
  let currentUser = null;
  let currentUserRank: number | null = null;
  let currentUserProgress = null;

  if (locals.user?.id) {
    const { data: myMember } = await locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,lifetime_xp,season_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,equipped_title_id,equipped_badge_id'
      )
      .eq('id', locals.user.id)
      .maybeSingle();

    if (myMember) {
      currentUser = myMember;
      const lifetimeXp = Math.max(0, myMember.lifetime_xp ?? myMember.xp ?? 0);
      currentUserProgress = getLevelProgress(lifetimeXp);

      const foundIdx = members.findIndex((m: any) => m.id === myMember.id);
      if (foundIdx !== -1) {
        currentUserRank = foundIdx + 1;
      } else {
        const { count } = await locals.db
          .from('members')
          .select('id', { count: 'exact', head: true })
          .gt('season_xp', myMember.season_xp ?? 0)
          .eq('is_test', false);
        currentUserRank = (count ?? 0) + 1;
      }
    }
  }

  return {
    season: currentSeason,
    pastWinners,
    members: members || [],
    currentUser,
    currentUserRank,
    currentUserProgress,
    loadError: false,
    isStale: false
  };
};
