import { safeDbQuery } from '$lib/server/resilience';
import { getLevelProgress, resolveRankingDisplay, NOX_SEASON_ACHIEVEMENT_TITLES } from '$lib/levels';

const DEFAULT_SEASON = {
  id: 'season_1',
  name: 'Temporada 1 — Despertar Cósmico',
  number: 1,
  starts_at: '2026-10-01T00:00:00.000Z',
  ends_at: '2026-12-31T23:59:59.000Z',
  is_active: true,
  rules_text:
    'Pontos de Temporada, Nível e saldo de XP são zerados a cada ciclo trimestral (90 dias). Cosméticos comprados na Loja Cósmica e títulos exclusivos do Hall da Fama são permanentes.'
};

const PAGE_SIZE = 20;

export const load = async ({ locals, url, setHeaders }: any) => {
  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=5, stale-while-revalidate=15'
    });
  } else {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });
  }

  const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const searchQuery = (url.searchParams.get('q') || '').trim();

  // 1. Fetch active season
  const { data: activeSeason } = await locals.db
    .from('seasons')
    .select('id,name,number,starts_at,ends_at,is_active,rules_text')
    .eq('is_active', true)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentSeason = activeSeason || DEFAULT_SEASON;

  // 2. Count total non-test members for real backend pagination
  const { count: totalMembersCount } = await locals.db
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('is_test', false);

  const totalMembers = totalMembersCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // 3. Fetch leaderboard members for current page with deterministic ordering
  const { data: pageRows } = await safeDbQuery(
    locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,lifetime_xp,season_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,created_at,equipped_badge_id'
      )
      .eq('is_test', false)
      .order('season_xp', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
    1500,
    'ranking_page_members'
  );

  const rawMembers = pageRows || [];

  // Decorate members with deterministic global rank and seasonal achievement title
  const members = rawMembers.map((m: any, idx: number) => {
    const rank = offset + idx + 1;
    const seasonXp = m.season_xp ?? 0;
    const rankInfo = resolveRankingDisplay(seasonXp, m.equipped_badge_id);
    return {
      ...m,
      rank,
      level: rankInfo.level,
      achievementTitle: rankInfo.achievementTitle,
      title: rankInfo.title,
      badge: rankInfo.badge
    };
  });

  // 4. Fetch Top 3 for the Olympic Podium
  let top3 = [];
  if (currentPage === 1 && members.length > 0) {
    top3 = members.slice(0, 3);
  } else {
    const { data: top3Rows } = await locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,lifetime_xp,season_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,created_at,equipped_badge_id'
      )
      .eq('is_test', false)
      .order('season_xp', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(3);

    top3 = (top3Rows || []).map((m: any, idx: number) => {
      const rank = idx + 1;
      const seasonXp = m.season_xp ?? 0;
      const rankInfo = resolveRankingDisplay(seasonXp, m.equipped_badge_id);
      return {
        ...m,
        rank,
        level: rankInfo.level,
        achievementTitle: rankInfo.achievementTitle,
        title: rankInfo.title,
        badge: rankInfo.badge
      };
    });
  }

  // 5. User personalized ranking & progress
  let currentUser = null;
  let currentUserRank: number | null = null;
  let currentUserPage: number = 1;
  let currentUserProgress = null;

  if (locals.user?.id) {
    const { data: myMember } = await locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,lifetime_xp,season_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,created_at,equipped_badge_id,equipped_title_id'
      )
      .eq('id', locals.user.id)
      .maybeSingle();

    if (myMember) {
      currentUser = myMember;
      const seasonalXp = Math.max(0, myMember.season_xp ?? 0);
      currentUserProgress = getLevelProgress(seasonalXp);

      // Exact deterministic rank calculation
      const { count: aheadCount } = await locals.db
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('is_test', false)
        .or(
          `season_xp.gt.${seasonalXp},and(season_xp.eq.${seasonalXp},created_at.lt.${myMember.created_at}),and(season_xp.eq.${seasonalXp},created_at.eq.${myMember.created_at},id.lt.${myMember.id})`
        );

      currentUserRank = (aheadCount ?? 0) + 1;
      currentUserPage = Math.ceil(currentUserRank / PAGE_SIZE) || 1;
    }
  }

  // 6. Handle Search Query if provided in URL
  let searchResults: any[] = [];
  if (searchQuery && searchQuery.length >= 2) {
    const cleanQ = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
    const { data: matched } = await locals.db
      .from('members')
      .select(
        'id,username,display_name,xp,season_xp,lifetime_xp,avatar_id,avatar_crop,avatar_frame_id,name_color,created_at,equipped_badge_id'
      )
      .eq('is_test', false)
      .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
      .order('season_xp', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(10);

    if (matched && matched.length > 0) {
      searchResults = await Promise.all(
        matched.map(async (m: any) => {
          const seasonXp = m.season_xp ?? 0;
          const { count } = await locals.db
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('is_test', false)
            .or(
              `season_xp.gt.${seasonXp},and(season_xp.eq.${seasonXp},created_at.lt.${m.created_at}),and(season_xp.eq.${seasonXp},created_at.eq.${m.created_at},id.lt.${m.id})`
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
    }
  }

  return {
    season: currentSeason,
    members,
    top3,
    pagination: {
      page: currentPage,
      pageSize: PAGE_SIZE,
      totalMembers,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    },
    currentUser,
    currentUserRank,
    currentUserPage,
    currentUserProgress,
    achievementTitles: NOX_SEASON_ACHIEVEMENT_TITLES,
    searchQuery,
    searchResults,
    loadError: false
  };
};
