import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  resolveSessionData: vi.fn(),
  safeQuerySingle: vi.fn(),
  media: { 
    id: '11111111-1111-4111-8111-111111111111', 
    provider: 'telegram', 
    storageReady: true, 
    status: 'ACTIVE', 
    accessClass: 'PUBLIC', 
    botReference: 'MANGA_STORAGE_01', 
    mime: 'image/jpeg', 
    sha256: 'test', 
    providerKey: 'file' 
  }
}));

vi.mock('@libsql/client/web', () => ({
  createClient: () => ({
    execute: vi.fn(), batch: vi.fn(), transaction: vi.fn(), executeMultiple: vi.fn(), sync: vi.fn(), close: vi.fn(), closed: false, protocol: 'http'
  })
}));

vi.mock('$lib/server/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/db')>();
  return {
    ...actual,
    safeQuerySingle: mocks.safeQuerySingle
  };
});

vi.mock('$lib/server/storage-router', () => ({ resolveBotDownloadClient: () => ({ download: mocks.download }), normalizeBotReference: (x: string) => x, deduceMangaShardFromFileId: () => null }));
vi.mock('$lib/server/session-cache', () => ({ extractFullAuthCookie: vi.fn(), decodeSessionJwt: vi.fn(), resolveSessionData: mocks.resolveSessionData }));
import { GET } from '../src/routes/media/[id]/+server';

describe('public media delivery', () => {
  it('returns the upstream stream without waiting for the full image or querying Auth', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
    mocks.download.mockResolvedValue(stream);
    
    mocks.safeQuerySingle.mockImplementation(async (query) => {
      return { data: mocks.media, error: null };
    });

    const response = await GET({ locals: {}, params: { id: mocks.media.id }, request: new Request('https://nox.invalid/media/' + mocks.media.id), cookies: { getAll: vi.fn() } });
    
    expect(response.status).toBe(200);
    
    expect(mocks.safeQuerySingle).toHaveBeenCalledTimes(1);
    const queryArg = mocks.safeQuerySingle.mock.calls[0][0];
    expect(queryArg.toSQL().sql).toContain('select');
    expect(queryArg.toSQL().sql).toContain('from "media"');
    
    expect(mocks.resolveSessionData).not.toHaveBeenCalled();
    const reader = response.body!.getReader();
    controller.enqueue(new Uint8Array([255, 216, 255]));
    expect((await reader.read()).value).toEqual(new Uint8Array([255, 216, 255]));
    controller.close();
    expect((await reader.read()).done).toBe(true);
  });
});
