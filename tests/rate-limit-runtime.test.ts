import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { expect, it } from 'vitest';

it('binds the configured comment limiter in the Cloudflare runtime', async () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const env = Object.fromEntries(config.ratelimits.map(({ name, namespace_id, simple }: any) => [
    name, { type: 'rate-limit', namespace: namespace_id, simple }
  ]));
  const script = `export default { async fetch(request, env) {
    return Response.json(await env.COMMENT_POST_RATE_LIMITER.limit({ key: new URL(request.url).pathname }));
  } };`;
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'nox-rate-limit-runtime-test', type: 'worker', compatibilityDate: '2026-09-01', env,
    manifest: { mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents: script } } }
  } }] } as any);
  try {
    const decisions = [];
    for (let i = 0; i < 3; i++) {
      const response = await runtime.dispatchFetch('http://localhost/reader-a');
      expect(response.status).toBe(200);
      decisions.push((await response.json() as { success: boolean }).success);
    }
    expect(decisions).toEqual([true, true, false]);
    const other = await runtime.dispatchFetch('http://localhost/reader-b');
    expect((await other.json() as { success: boolean }).success).toBe(true);
  } finally {
    await runtime.dispose();
  }
});
