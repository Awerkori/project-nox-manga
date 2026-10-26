type RankingCache = {
  timestamp: number;
  members: any[];
};

let cachedRanking: RankingCache | null = null;
export const RANKING_CACHE_TTL_MS = 2_000;

export function getCachedRanking(): any[] | null {
  if (cachedRanking && Date.now() - cachedRanking.timestamp < RANKING_CACHE_TTL_MS) {
    return cachedRanking.members;
  }
  return null;
}

export function setCachedRanking(members: any[]) {
  cachedRanking = {
    timestamp: Date.now(),
    members
  };
}

export function invalidateRankingCache() {
  cachedRanking = null;
}
