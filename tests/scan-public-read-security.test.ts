import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('public Scan read boundary', () => {
  it('selects an explicit public column allow-list for the Scan profile', () => {
    const source = readFileSync(resolve('src/routes/scans/[slug]/+page.server.ts'), 'utf8');
    expect(source).toContain('SELECT id, name, slug, description, display_preposition');
    expect(source).toContain('logo_id, banner_id, website, discord, fluxer');
    expect(source).not.toContain('SELECT * FROM public.scans');
  });
});
