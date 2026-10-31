/**
 * Centralized short-TTL single-flight caches and explicit invalidators for
 * administrative panels. Avoids exporting custom symbols from +layout.server.ts
 * or +page.server.ts (which SvelteKit rejects at build time).
 */

type CacheEntry<T> = { at: number; value: T };

const adminLayoutCache = new Map<string, CacheEntry<any>>();
const adminLayoutFlights = new Map<string, Promise<any>>();

const adminTicketsCache = new Map<string, CacheEntry<any>>();
const adminTicketsFlights = new Map<string, Promise<any>>();

const adminScansCache = new Map<string, CacheEntry<any>>();
const adminScansFlights = new Map<string, Promise<any>>();

const adminStaffCache = new Map<string, CacheEntry<any>>();
const adminStaffFlights = new Map<string, Promise<any>>();

const adminAuxPanelCache = new Map<string, CacheEntry<any>>();
const adminAuxPanelFlights = new Map<string, Promise<any>>();

function isTestRuntime(): boolean {
  return typeof process !== 'undefined' && (process.env?.VITEST === 'true' || process.env?.NODE_ENV === 'test');
}

export async function withSingleFlightCache<T>(
  store: Map<string, CacheEntry<T>>,
  flights: Map<string, Promise<T>>,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  maxEntries = 40
): Promise<T> {
  if (isTestRuntime()) {
    return loader();
  }
  const now = Date.now();
  const cached = store.get(key);
  if (cached && now - cached.at < ttlMs) {
    return cached.value;
  }
  const existing = flights.get(key);
  if (existing) {
    return existing;
  }
  const flight = loader()
    .then((value) => {
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest) store.delete(oldest);
      }
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      if (flights.get(key) === flight) {
        flights.delete(key);
      }
    });
  flights.set(key, flight);
  return flight;
}

export {
  adminLayoutCache,
  adminLayoutFlights,
  adminTicketsCache,
  adminTicketsFlights,
  adminScansCache,
  adminScansFlights,
  adminStaffCache,
  adminStaffFlights,
  adminAuxPanelCache,
  adminAuxPanelFlights
};

export function invalidateAdminLayoutCounts(): void {
  adminLayoutCache.clear();
}

export function invalidateAdminTicketsCache(): void {
  adminTicketsCache.clear();
  adminLayoutCache.clear();
}

export function invalidateAdminScansCache(): void {
  adminScansCache.clear();
  adminLayoutCache.clear();
}

export function invalidateAdminStaffCache(): void {
  adminStaffCache.clear();
  adminAuxPanelCache.clear();
}

export function invalidateAdminCatalogCaches(): void {
  adminAuxPanelCache.clear();
  adminLayoutCache.clear();
}
