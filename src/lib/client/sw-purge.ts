/**
 * Client-side Service Worker media cache purge helper.
 * Dispatches active eviction messages to the active Service Worker controller
 * when media is reported revoked, deleted, or fails with 401/403/404.
 */
export function purgeMediaFromClientCache(mediaId: string): void {
  if (!mediaId) return;
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'PURGE_MEDIA',
        mediaId: String(mediaId)
      });
    } catch {
      // Non-fatal client postMessage error
    }
  }
}

export function clearClientMediaCache(): void {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_MEDIA_CACHE'
      });
    } catch {}
  }
}
