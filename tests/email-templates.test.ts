import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('authentication email templates', () => {
  for (const [name, type] of [
    ['confirmation', 'signup'],
    ['recovery', 'recovery']
  ]) {
    it(`${name} uses the site's token-hash callback without scripts or third-party links`, () => {
      const html = readFileSync(`supabase/templates/${name}.html`, 'utf8');
      expect(html).toContain('lang="pt-BR"');
      expect(html).toContain('PROJECT NOX');
      expect(html).toContain(
        `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}"`
      );
      expect(html).not.toMatch(/<script\b|\son\w+\s*=|javascript:/i);
      expect(html).not.toContain('{{ .ConfirmationURL }}');
      expect(html.match(/href=/g)).toHaveLength(1);
    });
  }
});
