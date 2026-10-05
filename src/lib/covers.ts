/**
 * Project Nox — Canonical Cover Resolver
 * Resolves covers strictly from database media IDs.
 * No hardcoded fixtures, mocks, or synthetic maps.
 */
export function resolveCoverUrl(
  coverId?: string | null,
  _slug?: string | null,
  _workId?: string | null,
  options?: { size?: 'thumb' | 'hero' | 'full' } | 'thumb' | 'hero' | 'full'
): string {
  if (coverId && typeof coverId === 'string' && coverId.trim()) {
    const trimmed = coverId.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('http')) return trimmed;
    const size = typeof options === 'string' ? options : options?.size;
    const query = size === 'thumb' || size === 'hero' ? `?size=${size}&v=3` : '';
    return `/media/${trimmed}${query}`;
  }
  return '/brand/nox-symbol.webp';
}

/** Return the canonical original media URL for a failed derived variant. */
export function resolveOriginalCoverUrl(src: string): string {
  try {
    const url = new URL(src, 'https://project-nox.invalid');
    url.searchParams.delete('size');
    url.searchParams.delete('v');
    return url.origin === 'https://project-nox.invalid'
      ? `${url.pathname}${url.search}`
      : url.toString();
  } catch {
    return src.replace(/[?&]size=(?:thumb|hero)/, '').replace(/[?&]v=\d+/, '');
  }
}
