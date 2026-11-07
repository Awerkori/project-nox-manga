import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

const HALL_CACHE_TTL_MS = 300_000; // 5 minutes
let cachedHall: { timestamp: number; data: any } | null = null;
let hallFlight: Promise<any> | null = null;

export const load = async ({ platform, setHeaders }: any) => {
  if (setHeaders) {
    setHeaders({
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    });
  }

  const isTestEnv =
    typeof process !== 'undefined' && (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test');

  const now = Date.now();
  if (!isTestEnv && cachedHall && now - cachedHall.timestamp < HALL_CACHE_TTL_MS) {
    return cachedHall.data;
  }

  if (!isTestEnv && hallFlight) {
    return hallFlight;
  }

  const run = (async () => {
    try {
      return await withYugabyteReadSession(platform?.env, async (sessionEnv) => {
        const [allSeasonsRes, allWinnersRes] = await Promise.all([
          executeYugabyteSql(`
            SELECT id, name, number, starts_at, ends_at, is_active, rules_text
            FROM seasons
            ORDER BY number DESC;
          `, [], sessionEnv).catch(() => ({ rows: [] })),
          executeYugabyteSql(`
            SELECT *
            FROM season_winners
            ORDER BY place ASC;
          `, [], sessionEnv).catch(() => ({ rows: [] }))
        ]);

        const allSeasons = allSeasonsRes.rows || [];
        const activeSeason = allSeasons.find((s: any) => s.is_active) || null;
        const concludedSeasons = allSeasons.filter((s: any) => !s.is_active);
        const allWinners = allWinnersRes.rows || [];

      // Group winners by season_id
      const winnersBySeason: Record<string, any[]> = {};
      for (const w of allWinners) {
        if (!winnersBySeason[w.season_id]) {
          winnersBySeason[w.season_id] = [];
        }
        winnersBySeason[w.season_id].push(w);
      }

      const result = {
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

      if (!isTestEnv) {
        cachedHall = { timestamp: Date.now(), data: result };
      }
        return result;
      });
    } finally {
      hallFlight = null;
    }
  })();

  if (!isTestEnv) {
    hallFlight = run;
  }
  return run;
};
