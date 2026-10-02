import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared Worker cache guard', () => {
  it('bypasses shared cache for authenticated and personalized Home requests', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain('PERSONALIZED_HOME_COOKIE');
    expect(wrapper).toContain('nox-age-status|nox-blur-nsfw');
    expect(wrapper).toContain('shouldBypassSharedCache(req)');
    expect(wrapper).toContain('!cacheBypassRequest && !pragma.includes("no-cache")');
  });
});
