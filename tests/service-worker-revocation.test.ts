import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Service Worker Media Revocation & Cache Lifetime Protection', () => {
  const swSource = readFileSync('src/service-worker.ts', 'utf8');

  it('includes message event listener for active client-side media expurgo', () => {
    expect(swSource).toContain("self.addEventListener('message'");
    expect(swSource).toContain("event.data.type === 'PURGE_MEDIA'");
    expect(swSource).toContain("event.data.type === 'PURGE_MEDIA_URL'");
    expect(swSource).toContain("event.data.type === 'CLEAR_MEDIA_CACHE'");
    expect(swSource).toContain('caches.open(CACHE_MEDIA)');
    expect(swSource).toContain('caches.delete(CACHE_MEDIA)');
  });

  it('enforces maximum 7-day client retention TTL and expires legacy unversioned entries', () => {
    expect(swSource).toContain('MAX_MEDIA_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000');
    expect(swSource).toContain("cached.headers.get('X-Nox-Cached-At') || cached.headers.get('date')");
    expect(swSource).toContain('cachedAt <= 0 || (Date.now() - cachedAt > MAX_MEDIA_CACHE_AGE_MS)');
    expect(swSource).toContain('await mediaCache.delete(event.request)');
  });

  it('verifies ReaderPage dispatches active SW purge on broken media', () => {
    const readerPageSource = readFileSync('src/lib/components/ReaderPage.svelte', 'utf8');
    expect(readerPageSource).toContain("import { purgeMediaFromClientCache } from '$lib/client/sw-purge'");
    expect(readerPageSource).toContain('purgeMediaFromClientCache(page.media_id)');
  });

  it('verifies client sw-purge module dispatches PURGE_MEDIA messages to active controller', () => {
    const swPurgeSource = readFileSync('src/lib/client/sw-purge.ts', 'utf8');
    expect(swPurgeSource).toContain("type: 'PURGE_MEDIA'");
    expect(swPurgeSource).toContain("type: 'CLEAR_MEDIA_CACHE'");
    expect(swPurgeSource).toContain('navigator.serviceWorker.controller.postMessage');
  });

  it('actively evicts local media cache if server returns 401, 403, or 404', () => {
    expect(swSource).toContain('response.status === 401 || response.status === 403 || response.status === 404');
    expect(swSource).toContain('await mediaCache.delete(event.request)');
  });

  it('tags stored media responses with X-Nox-Cached-At timestamp', () => {
    expect(swSource).toContain("headers.set('X-Nox-Cached-At', String(Date.now()))");
    expect(swSource).toContain('await mediaCache.put(event.request, stampedResponse)');
  });

  it('functionally simulates TTL expiration and status-based cache eviction including legacy unversioned entries', async () => {
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
    const store = new Map<string, { status: number; headers: Map<string, string> }>();

    function checkCache(url: string, now: number) {
      const entry = store.get(url);
      if (!entry) return null;
      const headerDate = entry.headers.get('X-Nox-Cached-At') || entry.headers.get('date');
      const cachedAt = headerDate ? (Number(headerDate) || Date.parse(headerDate) || 0) : 0;
      if (cachedAt <= 0 || now - cachedAt > MAX_AGE) {
        store.delete(url);
        return null;
      }
      return entry;
    }

    function handleServerResponse(url: string, status: number, now: number) {
      if (status === 401 || status === 403 || status === 404) {
        store.delete(url);
        return;
      }
      if (status === 200) {
        const headers = new Map<string, string>();
        headers.set('X-Nox-Cached-At', String(now));
        store.set(url, { status: 200, headers });
      }
    }

    const t0 = 1000000000000;
    const mediaUrl = 'https://projectnox.org/media/uuid-1';

    // 1. Unversioned legacy entry with no timestamp: must be treated as expired and evicted
    store.set('https://projectnox.org/media/legacy-uuid', { status: 200, headers: new Map() });
    expect(checkCache('https://projectnox.org/media/legacy-uuid', t0)).toBeNull();
    expect(store.has('https://projectnox.org/media/legacy-uuid')).toBe(false);

    // 2. Store initially at t0
    handleServerResponse(mediaUrl, 200, t0);
    expect(store.has(mediaUrl)).toBe(true);

    // 3. Reading at t0 + 1 day: valid
    expect(checkCache(mediaUrl, t0 + 24 * 3600 * 1000)).not.toBeNull();

    // 4. Reading at t0 + 8 days: expired and evicted
    expect(checkCache(mediaUrl, t0 + 8 * 24 * 3600 * 1000)).toBeNull();
    expect(store.has(mediaUrl)).toBe(false);

    // 5. Re-cache at t0 + 8 days
    handleServerResponse(mediaUrl, 200, t0 + 8 * 24 * 3600 * 1000);
    expect(store.has(mediaUrl)).toBe(true);

    // 6. Server revokes media (returns 403 Forbidden)
    handleServerResponse(mediaUrl, 403, t0 + 9 * 24 * 3600 * 1000);
    expect(store.has(mediaUrl)).toBe(false);
  });
});
