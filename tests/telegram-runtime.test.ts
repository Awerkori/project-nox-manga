import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('constructs Telegram upload requests in the actual Cloudflare runtime', async () => {
  const provider = ts.transpileModule(readFileSync('src/lib/server/telegram.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const script = `
    import { telegramStorage } from './provider.js';
    export default { async fetch() {
      try {
        const transport = async (_url, options) => {
          // Real workerd validation, without external network access or credentials.
          const request = new Request('https://example.invalid', options);
          if (request.redirect !== 'manual') throw new Error('Unexpected redirect mode');
          return Response.json({ok:true,result:{document:{file_id:'runtime_file'}}});
        };
        const file = await telegramStorage('noncredential', 'local', transport)
          .upload(new Uint8Array([1,2,3]), 'image/png', 'runtime');
        return Response.json({file});
      } catch { return new Response('Runtime validation failed', {status:500}); }
    } };`;
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: 'storage-runtime-test',
          type: 'worker',
          compatibilityDate: '2026-09-01',
          manifest: {
            mainModule: 'worker.js',
            modules: {
              'worker.js': { type: 'esm', contents: script },
              'provider.js': { type: 'esm', contents: provider }
            }
          }
        }
      }
    ]
  });
  try {
    const response = await runtime.dispatchFetch('http://localhost');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ file: 'runtime_file' });
  } finally {
    await runtime.dispose();
  }
});
