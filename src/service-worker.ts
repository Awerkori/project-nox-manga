/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE_NAME = `nox-offline-v${version}`;

// Only precache core application bundle and essential brand assets
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

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
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
          if (key !== CACHE_NAME) {
            await caches.delete(key);
          }
        }
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept API endpoints, auth endpoints, or external domains
  if (!url.protocol.startsWith('http')) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/scan/api')
  ) {
    return;
  }

  // Precached static bundle files
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Navigation requests: Network-First with cached offline shell fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && url.pathname === '/downloads') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedDownloads = await cache.match('/downloads');
          if (cachedDownloads) {
            return cachedDownloads;
          }
          const cachedMatch = await cache.match(event.request);
          if (cachedMatch) {
            return cachedMatch;
          }
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

  // Static assets or other GET requests: Network first, cache fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error('Offline network error');
    })
  );
});
