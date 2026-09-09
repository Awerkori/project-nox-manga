import { describe, it, expect } from 'vitest';

function detectProviderFromUrl(rawUrl: string): { provider: string; slug: string; cleanUrl: string } | null {
  try {
    const formatted = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    const u = new URL(formatted);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    let provider = '';
    if (host.includes('kuro')) provider = 'kuro';
    else if (host.includes('nexus')) provider = 'nexus';
    else if (host.includes('mangaflix')) provider = 'mangaflix';
    else if (host.includes('manhastro')) provider = 'manhastro';
    else if (host.includes('mangotoons')) provider = 'mangotoons';

    if (!provider) return null;

    const segments = path.split('/').filter(Boolean);
    const slug = segments[segments.length - 1] || '';
    if (!slug) return null;

    return { provider, slug, cleanUrl: u.toString() };
  } catch {
    return null;
  }
}

function cleanSlugTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

describe('Importer Candidate URL & Provider Detection', () => {
  it('detects Kuro provider from URL and extracts slug', () => {
    const res = detectProviderFromUrl('https://kuromangas.com/manga/solo-leveling-ragnarok');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('kuro');
    expect(res?.slug).toBe('solo-leveling-ragnarok');
    expect(cleanSlugTitle(res!.slug)).toBe('Solo Leveling Ragnarok');
  });

  it('detects Nexus provider from URL and extracts slug', () => {
    const res = detectProviderFromUrl('https://nexusmangas.com/obra/vinganca-do-cao-de-caca/');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('nexus');
    expect(res?.slug).toBe('vinganca-do-cao-de-caca');
    expect(cleanSlugTitle(res!.slug)).toBe('Vinganca Do Cao De Caca');
  });

  it('detects MangaFlix and MangoToons providers', () => {
    const r1 = detectProviderFromUrl('https://mangaflix.org/series/tower-of-god');
    expect(r1?.provider).toBe('mangaflix');
    expect(r1?.slug).toBe('tower-of-god');

    const r2 = detectProviderFromUrl('https://api.mangotoons.com/manga/omniscient-reader');
    expect(r2?.provider).toBe('mangotoons');
    expect(r2?.slug).toBe('omniscient-reader');
  });

  it('returns null for unsupported domains or invalid URLs', () => {
    expect(detectProviderFromUrl('https://google.com/search?q=manga')).toBeNull();
    expect(detectProviderFromUrl('not a url')).toBeNull();
  });
});
