import { safeDbQuery } from '$lib/server/resilience';

export const load = async ({ locals, setHeaders }: any) => {
  setHeaders({
    'cache-control': 'public, max-age=60, stale-while-revalidate=300'
  });

  // 1. Fetch active season
  const { data: activeSeason } = await locals.db
    .from('seasons')
    .select('id, name, number, starts_at, ends_at, is_active, rules_text')
    .eq('is_active', true)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Fetch concluded/archived seasons
  const { data: concludedSeasons } = await locals.db
    .from('seasons')
    .select('id, name, number, starts_at, ends_at, is_active')
    .eq('is_active', false)
    .order('number', { ascending: false });

  // 3. Fetch all season winners
  const { data: allWinners } = await locals.db
    .from('season_winners')
    .select('*')
    .order('place', { ascending: true });

  // Group winners by season_id
  const winnersBySeason: Record<string, any[]> = {};
  if (allWinners) {
    for (const w of allWinners) {
      if (!winnersBySeason[w.season_id]) {
        winnersBySeason[w.season_id] = [];
      }
      winnersBySeason[w.season_id].push(w);
    }
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
    concludedSeasons: concludedSeasons || [],
    winnersBySeason
  };
};
