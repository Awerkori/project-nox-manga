/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE_APP = `nox-app-v${version}`;
const CACHE_MEDIA = 'nox-media-v1';
const CACHE_DATA = `nox-data-v${version}`;
const VALID_CACHES = new Set([CACHE_APP, CACHE_MEDIA, CACHE_DATA]);

// Maximum cached media items (covers + chapter pages) to stay within device storage limits
const MAX_MEDIA_ENTRIES = 300;

// Precache essential application bundle and static brand assets
const PRECACHE_ASSETS = [
  ...build,
  ...files.filter((f) => {
    return (
      f.startsWith('/brand') ||
      f.endsWith('.webmanifest') ||
      f.endsWith('.png') ||
      f.endsWith('.webp') ||
      f.endsWith('.ico')
    );
  })
];

async function trimCache(cacheName: string, maxItems: number): Promise<void> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const excess = keys.slice(0, keys.length - maxItems);
      for (const req of excess) {
        await cache.delete(req);
      }
    }
  } catch {
    // Non-fatal cache eviction failure
  }
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_APP)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        for (const key of keys) {
          // Strictly delete ONLY nox-prefixed caches that are not in the valid cache set
          if (key.startsWith('nox-') && !VALID_CACHES.has(key)) {
            await caches.delete(key);
          }
        }
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  // Non-GET requests are never intercepted (strictly Network Only)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // External protocols or schemes
  if (!url.protocol.startsWith('http')) return;

  // Only intercept same-origin requests or whitelisted external font CDNs
  const isSameOrigin = url.origin === self.location.origin;
  const isWhitelistedCdn = url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com');
  if (!isSameOrigin && !isWhitelistedCdn) return;

  // Private, administrative, authentication, and internal API routes must NEVER be intercepted or cached
  const isPrivateOrApiRoute =
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/me') ||
    url.pathname.startsWith('/perfil') ||
    url.pathname.startsWith('/biblioteca') ||
    url.pathname.startsWith('/favoritos') ||
    url.pathname.startsWith('/historico') ||
    url.pathname.startsWith('/notificacoes') ||
    url.pathname.startsWith('/scan') ||
    url.pathname.startsWith('/settings');

  if (isPrivateOrApiRoute) return;

  // 1. Immutable Assets: Cache-First strategy
  // Application JS/CSS bundles, pre-cached static files, and Google web fonts
  const isImmutableAsset =
    url.pathname.startsWith('/_app/immutable/') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    PRECACHE_ASSETS.includes(url.pathname);

  if (isImmutableAsset) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_APP);
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 2. Public Media Delivery: Cache-First with bounded storage
  // Public reader pages, cover thumbnails, banners, and icons (/media/[id])
  if (url.pathname.startsWith('/media/')) {
    const isPreview = url.searchParams.get('preview') === '1' || url.searchParams.get('preview') === 'true';
    if (isPreview) return; // Unpublished preview media must never be stored in CacheStorage

    event.respondWith(
      (async () => {
        const mediaCache = await caches.open(CACHE_MEDIA);
        const cached = await mediaCache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cc = response.headers.get('cache-control') || '';
            // Only store public, non-private, non-no-store media
            if (!cc.includes('private') && !cc.includes('no-store')) {
              await mediaCache.put(event.request, response.clone());
              trimCache(CACHE_MEDIA, MAX_MEDIA_ENTRIES);
            }
          }
          return response;
        } catch {
          const fallback = await mediaCache.match(event.request);
          if (fallback) return fallback;
          throw new Error('Media network error');
        }
      })()
    );
    return;
  }

  // 3. Navigation Requests: Network with cached offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const cc = response.headers.get('cache-control') || '';
            if (cc.includes('public') || url.pathname === '/downloads') {
              const dataCache = await caches.open(CACHE_DATA);
              await dataCache.put(event.request, response.clone());
            }
          }
          return response;
        })
        .catch(async () => {
          const dataCache = await caches.open(CACHE_DATA);
          const cachedMatch = await dataCache.match(event.request);
          if (cachedMatch) return cachedMatch;

          const appCache = await caches.open(CACHE_APP);
          const cachedDownloads = (await appCache.match('/downloads')) || (await dataCache.match('/downloads'));
          if (cachedDownloads) return cachedDownloads;

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Nox — Offline</title></head><body style="background:#06070c;color:#fff;font-family:sans-serif;text-align:center;padding:50px;"><h2>Você está offline</h2><p>Acesse seus capítulos baixados:</p><a href="/downloads" style="color:#a78bfa;font-weight:bold;">Ir para Downloads</a></body></html>`,
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
              status: 200
            }
          );
        })
    );
    return;
  }

  // 4. Other Public GET requests (e.g. static brand SVGs, badges): Cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cc = response.headers.get('cache-control') || '';
          if (cc.includes('public')) {
            const dataCache = await caches.open(CACHE_DATA);
            dataCache.put(event.request, response.clone());
          }
        }
        return response;
      } catch {
        throw new Error('Offline network error');
      }
    })
  );
});
