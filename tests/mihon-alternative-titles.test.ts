import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const endpoint = readFileSync('src/routes/api/mihon/catalog/+server.ts', 'utf8');
const catalog = readFileSync('src/routes/catalogo/+page.server.ts', 'utf8');

describe('alternative-title search contracts', () => {
  it('uses the indexed aliases-backed search projection in public catalog search', () => {
    expect(catalog).toContain("ilike('search_text'");
  });

  it('uses the same indexed projection and exposes aliases in the Mihon catalog API', () => {
    expect(endpoint).toContain("ilike('search_text'");
    expect(endpoint).toContain('alternative_titles: w.aliases || []');
  });
});
