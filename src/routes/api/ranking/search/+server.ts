import { json } from '@sveltejs/kit';
import { getLevelProgress, resolveRankingDisplay } from '$lib/levels';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ url, platform }: any) => {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query || query.length < 2) {
    return json({ results: [] });
  }

  const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
  const pattern = `%${cleanQuery}%`;

  try {
    const res = await executeYugabyteSql<{
      id: string;
      username: string;
      display_name: string;
      xp: number;
      season_xp: number;
      avatar_id: string | null;
      avatar_crop: unknown;
      avatar_frame_id: string | null;
      name_color: string | null;
      equipped_badge_id: string | null;
      rank: number;
    }>(`
      WITH ranked AS (
        SELECT id, username, display_name, xp, season_xp, lifetime_xp, avatar_id, avatar_crop,
               avatar_frame_id, name_color, equipped_badge_id, created_at,
               ROW_NUMBER() OVER (ORDER BY season_xp DESC, created_at ASC, id ASC) AS rank
        FROM members
        WHERE is_test = false
      )
      SELECT * FROM ranked
      WHERE username ILIKE $1 OR display_name ILIKE $1
      ORDER BY rank ASC
      LIMIT 10;
    `, [pattern], platform?.env);

    const matchedMembers = res.rows || [];
    const results = matchedMembers.map((m: any) => {
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

    return json({ results });
  } catch (err: any) {
    console.error('[RANKING_SEARCH] Error searching users:', err);
    return json({ results: [], error: 'Falha na busca' }, { status: 500 });
  }
};
