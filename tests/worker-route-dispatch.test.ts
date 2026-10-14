import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Worker application-route dispatch', () => {
  it('keeps dynamic public and API routes out of the static asset binding', () => {
    const wrapper = readFileSync('src/worker-wrapper.js', 'utf8');

    expect(wrapper).toContain('APPLICATION_ROUTE_GUARD');
    expect(wrapper).toContain("pathname.startsWith('/api/')");
    expect(wrapper).toContain('!isApplicationRoute(pathname, filename) && (is_static_asset');
  });

  it('keeps the generated-worker patch durable across builds', () => {
    const patcher = readFileSync('scripts/patch-worker-runtime.mjs', 'utf8');

    expect(patcher).toContain('APPLICATION_ROUTE_GUARD');
    expect(patcher).toContain('Worker asset route condition changed');
    expect(patcher).toContain('!isApplicationRoute(pathname, filename)');
  });
});
