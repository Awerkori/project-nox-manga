/**
 * Project Nox — Canonical Cover Resolver
 * Resolves covers strictly from database media IDs.
 * No hardcoded fixtures, mocks, or synthetic maps.
 */
export function resolveCoverUrl(
  coverId?: string | null,
  _slug?: string | null,
  _workId?: string | null,
  options?: { size?: 'thumb' | 'full' } | 'thumb' | 'full'
): string {
  if (coverId && typeof coverId === 'string' && coverId.trim()) {
    const trimmed = coverId.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('http')) return trimmed;
    const size = typeof options === 'string' ? options : options?.size;
    const query = size === 'thumb' ? '?size=thumb' : '';
    return `/media/${trimmed}${query}`;
  }
  return '/brand/nox-symbol.webp';
}

