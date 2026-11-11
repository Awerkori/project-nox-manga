import { readFileSync } from 'node:fs';
import net from 'node:net';
import { Miniflare } from 'miniflare';
import ts from 'typescript';
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

it('constructs Telegram upload requests in the actual Cloudflare runtime', async (ctx) => {
  if (!(await canBindLocalSocket())) {
    ctx.skip();
    return;
  }

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
          return Response.json({ok:true,result:{message_id:1,chat:{id:'-100123'},document:{file_id:'runtime_file'}}});
        };
        const file = await telegramStorage('noncredential', 'local', transport)
          .upload(new Uint8Array([1,2,3]), 'image/png', 'runtime');
        return Response.json({file});
      } catch { return new Response('Runtime validation failed', {status:500}); }
    } };`;
  let runtime: Miniflare;
  try {
    runtime = new Miniflare({
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
  } catch (err: any) {
    if (err?.code === 'EPERM' || err?.message?.includes('EPERM') || err?.message?.includes('listen')) {
      ctx.skip();
      return;
    }
    throw err;
  }
  try {
    let response;
    try {
      response = await runtime.dispatchFetch('http://localhost');
    } catch (err: any) {
      if (err?.code === 'EPERM' || err?.message?.includes('EPERM') || err?.message?.includes('listen')) {
        ctx.skip();
        return;
      }
      throw err;
    }
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      file: { fileId: 'runtime_file', messageId: '1', chatId: '-100123', uniqueFileId: null }
    });
  } finally {
    try {
      await runtime?.dispose();
    } catch {
      // Best-effort runtime cleanup
    }
  }
});
