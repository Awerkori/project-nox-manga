import { executeYugabyteSql } from '$lib/server/yugabyte';
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
const RANKING_PUBLIC_CACHE_TTL_MS = 60_000;
let cachedPublicRankingBase: {
  at: number;
  season: any;
  totalMembers: number;
  page1Rows: any[];
  top3: any[];
} | null = null;

export const load = async ({ locals, url, setHeaders, platform }: any) => {
  if (!locals.user) {
    setHeaders({
      'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
    });
  } else {
    setHeaders({
      'cache-control': 'private, no-cache, no-store, must-revalidate'
    });
  }

  const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const searchQuery = (url.searchParams.get('q') || '').trim();
  const isTestEnv =
    typeof process !== 'undefined' && (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test');
  const canUsePublicCache = !isTestEnv && cachedPublicRankingBase && Date.now() - cachedPublicRankingBase.at < RANKING_PUBLIC_CACHE_TTL_MS;

  let currentSeason: any;
  let totalMembers: number;

  if (canUsePublicCache) {
    currentSeason = cachedPublicRankingBase!.season;
    totalMembers = cachedPublicRankingBase!.totalMembers;
  } else {
    // 1 & 2. Fetch active season and total non-test members in parallel
    const [seasonRes, countRes] = await Promise.all([
      executeYugabyteSql(`
        SELECT id, name, number, starts_at, ends_at, is_active, rules_text
        FROM seasons
        WHERE is_active = true
        ORDER BY number DESC
        LIMIT 1;
      `, [], platform?.env).catch(() => ({ rows: [] })),
      executeYugabyteSql<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM members
        WHERE is_test = false;
      `, [], platform?.env).catch(() => ({ rows: [{ count: 0 }] }))
    ]);

    currentSeason = seasonRes.rows[0] || DEFAULT_SEASON;
    totalMembers = Number(countRes.rows[0]?.count || 0);
  }

  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // 3. Fetch leaderboard members for current page with deterministic ordering
  let rawMembers: any[];
  if (canUsePublicCache && currentPage === 1) {
    rawMembers = cachedPublicRankingBase!.page1Rows;
  } else {
    const pageRes = await executeYugabyteSql(`
      SELECT id, username, display_name, xp, lifetime_xp, season_xp, avatar_id, avatar_crop,
             avatar_frame_id, name_color, created_at, equipped_badge_id
      FROM members
      WHERE is_test = false
      ORDER BY season_xp DESC, created_at ASC, id ASC
      LIMIT $1 OFFSET $2;
    `, [PAGE_SIZE, offset], platform?.env).catch(() => ({ rows: [] }));
    rawMembers = pageRes.rows || [];
  }

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
  let top3: any[];
  if (currentPage === 1 && members.length > 0) {
    top3 = members.slice(0, 3);
    if (!isTestEnv) {
      cachedPublicRankingBase = {
        at: Date.now(),
        season: currentSeason,
        totalMembers,
        page1Rows: rawMembers,
        top3
      };
    }
  } else if (canUsePublicCache && cachedPublicRankingBase!.top3.length > 0) {
    top3 = cachedPublicRankingBase!.top3;
  } else {
    const top3Res = await executeYugabyteSql(`
      SELECT id, username, display_name, xp, lifetime_xp, season_xp, avatar_id, avatar_crop,
             avatar_frame_id, name_color, created_at, equipped_badge_id
      FROM members
      WHERE is_test = false
      ORDER BY season_xp DESC, created_at ASC, id ASC
      LIMIT 3;
    `, [], platform?.env).catch(() => ({ rows: [] }));

    top3 = (top3Res.rows || []).map((m: any, idx: number) => {
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
    const userRes = await executeYugabyteSql(`
      WITH ranked AS (
        SELECT id, username, display_name, xp, lifetime_xp, season_xp, avatar_id, avatar_crop,
               avatar_frame_id, name_color, created_at, equipped_badge_id, equipped_title_id,
               ROW_NUMBER() OVER (ORDER BY season_xp DESC, created_at ASC, id ASC) AS rank
        FROM members
        WHERE is_test = false
      )
      SELECT * FROM ranked WHERE id = $1 LIMIT 1;
    `, [locals.user.id], platform?.env).catch(() => ({ rows: [] }));

    const myMember = userRes.rows[0];
    if (myMember) {
      currentUser = myMember;
      const seasonalXp = Math.max(0, myMember.season_xp ?? 0);
      currentUserProgress = getLevelProgress(seasonalXp);
      currentUserRank = Number(myMember.rank);
      currentUserPage = Math.ceil(currentUserRank / PAGE_SIZE) || 1;
    }
  }

  // 6. Handle Search Query if provided in URL
  let searchResults: any[] = [];
  if (searchQuery && searchQuery.length >= 2) {
    const cleanQ = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
    const searchRes = await executeYugabyteSql(`
      WITH ranked AS (
        SELECT id, username, display_name, xp, season_xp, lifetime_xp, avatar_id, avatar_crop,
               avatar_frame_id, name_color, created_at, equipped_badge_id,
               ROW_NUMBER() OVER (ORDER BY season_xp DESC, created_at ASC, id ASC) AS rank
        FROM members
        WHERE is_test = false
      )
      SELECT * FROM ranked
      WHERE username ILIKE $1 OR display_name ILIKE $1
      ORDER BY rank ASC
      LIMIT 10;
    `, [`%${cleanQ}%`], platform?.env).catch(() => ({ rows: [] }));

    searchResults = (searchRes.rows || []).map((m: any) => {
      const seasonXp = m.season_xp ?? 0;
      const rankPosition = Number(m.rank);
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
    });
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
