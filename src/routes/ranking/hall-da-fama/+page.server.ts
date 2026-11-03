import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ platform, setHeaders }: any) => {
  setHeaders({
    'cache-control': 'public, max-age=60, stale-while-revalidate=300'
  });

  const [activeSeasonRes, concludedSeasonsRes, allWinnersRes] = await Promise.all([
    executeYugabyteSql(`
      SELECT id, name, number, starts_at, ends_at, is_active, rules_text
      FROM seasons
      WHERE is_active = true
      ORDER BY number DESC
      LIMIT 1;
    `, [], platform?.env).catch(() => ({ rows: [] })),
    executeYugabyteSql(`
      SELECT id, name, number, starts_at, ends_at, is_active
      FROM seasons
      WHERE is_active = false
      ORDER BY number DESC;
    `, [], platform?.env).catch(() => ({ rows: [] })),
    executeYugabyteSql(`
      SELECT *
      FROM season_winners
      ORDER BY place ASC;
    `, [], platform?.env).catch(() => ({ rows: [] }))
  ]);

  const activeSeason = activeSeasonRes.rows[0] || null;
  const concludedSeasons = concludedSeasonsRes.rows || [];
  const allWinners = allWinnersRes.rows || [];

  // Group winners by season_id
  const winnersBySeason: Record<string, any[]> = {};
  for (const w of allWinners) {
    if (!winnersBySeason[w.season_id]) {
      winnersBySeason[w.season_id] = [];
    }
    winnersBySeason[w.season_id].push(w);
  }

  return {
    activeSeason: activeSeason || {
      id: 'season_1',
      name: 'Temporada 1 — Despertar Cósmico',
      number: 1,
      starts_at: '2026-10-01T00:00:00.000Z',
      ends_at: '2026-12-31T23:59:59.000Z',
      is_active: true
    },
    concludedSeasons,
    winnersBySeason
  };
};
