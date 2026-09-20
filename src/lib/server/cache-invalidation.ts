export interface InvalidationPayload {
  workId?: string;
  workSlug?: string;
  chapterId?: string;
  type?: 'CHAPTER_PUBLISHED' | 'ALL';
}

export function performCacheInvalidation(payload?: InvalidationPayload) {
  // 1. Invalidate Home public cache
  if (typeof (globalThis as any).__nox_invalidate_home === 'function') {
    (globalThis as any).__nox_invalidate_home();
  }

  // 2. Invalidate /lancamentos cache
  if (typeof (globalThis as any).__nox_invalidate_releases === 'function') {
    (globalThis as any).__nox_invalidate_releases();
  }

  // 3. Invalidate affected work cache
  if (typeof (globalThis as any).__nox_invalidate_obra === 'function') {
    (globalThis as any).__nox_invalidate_obra(payload?.workId, payload?.workSlug);
  }

  return {
    success: true,
    invalidated: [
      'home',
      'lancamentos',
      ...(payload?.workId ? [`obra:${payload.workId}`] : [])
    ]
  };
}
