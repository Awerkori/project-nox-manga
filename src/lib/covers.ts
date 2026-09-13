/**
 * Project Nox — Canonical Cover Resolver
 * Resolves covers strictly from database media IDs.
 * No hardcoded fixtures, mocks, or synthetic maps.
 */
export function resolveCoverUrl(coverId?: string | null, _slug?: string | null, _workId?: string | null): string {
  if (coverId && typeof coverId === 'string' && coverId.trim()) {
    const trimmed = coverId.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('http')) return trimmed;
    return `/media/${trimmed}`;
  }
  return '/brand/nox-symbol.webp';
}

