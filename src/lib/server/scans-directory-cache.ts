type ScansDirectoryCache = {
  timestamp: number;
  scans: any[];
};

let cache: ScansDirectoryCache | null = null;
let directoryFlight: Promise<any[]> | null = null;

export const SCANS_DIRECTORY_CACHE_TTL_MS = 300_000;
export const SCAN_PROFILE_CACHE_TTL_MS = 120_000;

const scanProfileCache = new Map<string, { timestamp: number; data: any }>();
const scanProfileFlights = new Map<string, Promise<any>>();

export function getScansDirectoryCache(): ScansDirectoryCache | null {
  return cache;
}

export function setScansDirectoryCache(scans: any[]): void {
  cache = { timestamp: Date.now(), scans };
}

export async function getOrFetchScansDirectory(fetcher: () => Promise<any[]>): Promise<any[]> {
  if (cache && Date.now() - cache.timestamp < SCANS_DIRECTORY_CACHE_TTL_MS) {
    return cache.scans;
  }
  if (directoryFlight) {
    return directoryFlight;
  }
  const run = fetcher().finally(() => {
    if (directoryFlight === run) directoryFlight = null;
  });
  directoryFlight = run;
  return run;
}

export async function getOrFetchScanProfile<T>(slug: string, fetcher: () => Promise<T>): Promise<T> {
  const key = slug.toLowerCase();
  const cached = scanProfileCache.get(key);
  if (cached && Date.now() - cached.timestamp < SCAN_PROFILE_CACHE_TTL_MS) {
    return cached.data as T;
  }
  const existingFlight = scanProfileFlights.get(key);
  if (existingFlight) {
    return existingFlight as Promise<T>;
  }
  const run = fetcher()
    .then((res) => {
      if (res) {
        if (scanProfileCache.size >= 100) {
          const oldest = scanProfileCache.keys().next().value;
          if (oldest) scanProfileCache.delete(oldest);
        }
        scanProfileCache.set(key, { timestamp: Date.now(), data: res });
      }
      return res;
    })
    .finally(() => {
      if (scanProfileFlights.get(key) === run) {
        scanProfileFlights.delete(key);
      }
    });
  scanProfileFlights.set(key, run);
  return run;
}

/** Called after a canonical scan branding/profile or comment update. */
export function invalidateScansDirectoryCache(slug?: string): void {
  cache = null;
  if (slug) {
    scanProfileCache.delete(slug.toLowerCase());
  } else {
    scanProfileCache.clear();
  }
}
