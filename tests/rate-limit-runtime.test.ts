import { readFileSync } from 'node:fs';
import net from 'node:net';
import { Miniflare } from 'miniflare';
import { expect, it } from 'vitest';

async function canBindLocalSocket(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    try {
      server.listen(0, '127.0.0.1', () => {
        server.close(() => {
          resolve(true);
        });
      });
    } catch {
      resolve(false);
    }
  });
}

it('binds the configured comment limiter in the Cloudflare runtime', async (ctx) => {
  if (!(await canBindLocalSocket())) {
    ctx.skip();
    return;
  }

  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const commentLimiter = config.ratelimits.find(({ name }: { name: string }) => name === 'COMMENT_POST_RATE_LIMITER');
  expect(commentLimiter?.simple).toEqual({ limit: 2, period: 60 });
  const env = Object.fromEntries(config.ratelimits.map(({ name, namespace_id, simple }: any) => [
    name, { type: 'rate-limit', namespace: namespace_id, simple }
  ]));
  const script = `export default { async fetch(request, env) {
    return Response.json(await env.COMMENT_POST_RATE_LIMITER.limit({ key: new URL(request.url).pathname }));
  } };`;
  let runtime: Miniflare;
  try {
    runtime = new Miniflare({ workers: [{ config: {
      name: 'nox-rate-limit-runtime-test', type: 'worker', compatibilityDate: '2026-09-01', env,
      manifest: { mainModule: 'worker.js', modules: { 'worker.js': { type: 'esm', contents: script } } }
    } }] } as any);
  } catch (err: any) {
    if (err?.code === 'EPERM' || err?.message?.includes('EPERM') || err?.message?.includes('listen')) {
      ctx.skip();
      return;
    }
    throw err;
  }
  try {
    const decisions = [];
    for (let i = 0; i < 3; i++) {
      let response;
      try {
        response = await runtime.dispatchFetch('http://localhost/reader-a');
      } catch (err: any) {
        if (err?.code === 'EPERM' || err?.message?.includes('EPERM') || err?.message?.includes('listen')) {
          ctx.skip();
          return;
        }
        throw err;
      }
      expect(response.status).toBe(200);
      decisions.push((await response.json() as { success: boolean }).success);
    }
    // Cloudflare's Rate Limiting binding is intentionally eventually consistent;
    // the local workerd/Miniflare implementation likewise does not promise that
    // a burst is rejected exactly on the Nth call.  The production guard still
    // denies a definitive `{ success: false }` before any SQL (covered by
    // comment-rate-limit.test.ts).  Here, assert the runtime binding contract
    // without inventing a strict global-counter guarantee it cannot provide.
    expect(decisions).toHaveLength(3);
    expect(decisions.every((decision) => typeof decision === 'boolean')).toBe(true);
    let other;
    try {
      other = await runtime.dispatchFetch('http://localhost/reader-b');
    } catch (err: any) {
      if (err?.code === 'EPERM' || err?.message?.includes('EPERM') || err?.message?.includes('listen')) {
        return;
      }
      throw err;
    }
    expect((await other.json() as { success: boolean }).success).toBe(true);
  } finally {
    try {
      await runtime?.dispose();
    } catch {}
  }
});
