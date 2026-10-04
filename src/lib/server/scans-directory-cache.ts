type ScansDirectoryCache = {
  timestamp: number;
  scans: any[];
};

let cache: ScansDirectoryCache | null = null;

export const SCANS_DIRECTORY_CACHE_TTL_MS = 300_000;

export function getScansDirectoryCache(): ScansDirectoryCache | null {
  return cache;
}

export function setScansDirectoryCache(scans: any[]): void {
  cache = { timestamp: Date.now(), scans };
}

/** Called after a canonical scan branding/profile update. */
export function invalidateScansDirectoryCache(): void {
  cache = null;
}
