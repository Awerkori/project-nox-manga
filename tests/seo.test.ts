import { describe, expect, it } from 'vitest';
import { structuredDataScript, workStructuredData } from '../src/lib/seo';
import type { Work } from '../src/lib/types';

const work: Work = {
  id: 'test',
  slug: 'historia',
  title: 'Uma história',
  aliases: ['Outro nome'],
  synopsis: 'Uma sinopse.',
  description: '',
  author: 'Autora',
  artist: 'Artista',
  kind: 'MANGA',
  status: 'ONGOING',
  year: 2026,
  age_rating: 0,
  published: true,
  featured: false,
  cover_id: null,
  updated_at: '2026-09-05T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z'
};

describe('public work structured data', () => {
  it('includes real editorial metadata and breadcrumbs, without inventing reviews or ownership', () => {
    const result = workStructuredData(
      work,
      [
        { name: 'Aventura', kind: 'GENRE' },
        { name: 'Sistema', kind: 'TAG' }
      ],
      'https://nox.example'
    );
    expect(result['@graph'][0]).toMatchObject({
      '@type': 'ComicSeries',
      name: work.title,
      genre: ['Aventura'],
      keywords: ['Aventura', 'Sistema'],
      author: { name: 'Autora' }
    });
    for (const key of ['aggregateRating', 'copyrightHolder', 'publisher', 'image'])
      expect(result['@graph'][0]).not.toHaveProperty(key);
    expect(result['@graph'][1]).toMatchObject({ '@type': 'BreadcrumbList' });
  });

  it('cannot break out of its script, while preserving malicious-looking editorial text', () => {
    const value = { title: '</script><img src=x onerror=alert(1)>', synopsis: '&\u2028\u2029' };
    const html = structuredDataScript(value);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain('<img');
    expect(JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')))).toEqual(value);
  });

  it('omits unavailable people and includes a cover only when one exists', () => {
    const entry = workStructuredData(
      { ...work, author: '', artist: '', cover_id: 'cover' },
      [],
      'https://nox.example'
    )['@graph'][0];
    expect(entry).not.toHaveProperty('author');
    expect(entry).not.toHaveProperty('illustrator');
    expect(entry).toHaveProperty('image', 'https://nox.example/media/cover');
  });
});
