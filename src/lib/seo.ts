import type { Work } from './types';

// JSON inside a script element must never contain an HTML closing tag, including
// when an editor supplies a title such as </script>. Keep the data lossless.
export function structuredDataScript(value: unknown): string {
  const json = JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<script type="application/ld+json">${json}</script>`;
}

export function workStructuredData(work: Work, tags: { name: string; kind: string }[], origin: string) {
  const canonical = `${origin}/obra/${encodeURIComponent(work.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ComicSeries',
        '@id': `${canonical}#series`,
        url: canonical,
        name: work.title,
        alternateName: work.aliases,
        description: work.synopsis,
        inLanguage: 'pt-BR',
        dateModified: work.updated_at,
        ...(work.author ? { author: { '@type': 'Person', name: work.author } } : {}),
        ...(work.artist ? { illustrator: { '@type': 'Person', name: work.artist } } : {}),
        ...(work.cover_id
          ? {
              image:
                work.content_rating === 'ADULT_18'
                  ? `${origin}/brand/nox-symbol-256.webp`
                  : `${origin}/media/${work.cover_id}`
            }
          : {}),
        genre: tags.filter((tag) => tag.kind === 'GENRE').map((tag) => tag.name),
        keywords: tags.map((tag) => tag.name),
        isAccessibleForFree: true
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Catálogo', item: `${origin}/catalogo` },
          { '@type': 'ListItem', position: 2, name: work.title, item: canonical }
        ]
      }
    ]
  };
}
