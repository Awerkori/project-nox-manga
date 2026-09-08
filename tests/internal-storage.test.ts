import { describe, it, expect, vi, beforeEach } from 'vitest';

// Valid 1x1 PNG
const VALID_1X1_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64'
  )
);

describe('Internal Storage Bridge Endpoint (/api/internal/storage/upload)', () => {
  const TEST_TOKEN = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects unauthenticated GET requests with 401', async () => {
    vi.doMock('$env/dynamic/private', () => ({
      env: { NOX_STORAGE_BRIDGE_TOKEN: TEST_TOKEN, TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: 'chat' }
    }));

    const { GET } = await import('../src/routes/api/internal/storage/upload/+server');
    const req = new Request('https://127.0.0.1/api/internal/storage/upload');

    await expect(
      GET({
        request: req,
        getClientAddress: () => '127.0.0.1',
        url: new URL('https://127.0.0.1/api/internal/storage/upload'),
        params: {} as any,
        locals: {} as any,
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        isDataRequest: false,
        route: { id: '/api/internal/storage/upload' },
        platform: {} as any,
        isSubRequest: false
      } as any)
    ).rejects.toThrow();
  });

  it('rejects invalid bearer token with 401', async () => {
    vi.doMock('$env/dynamic/private', () => ({
      env: { NOX_STORAGE_BRIDGE_TOKEN: TEST_TOKEN, TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: 'chat' }
    }));

    const { GET } = await import('../src/routes/api/internal/storage/upload/+server');
    const req = new Request('https://127.0.0.1/api/internal/storage/upload', {
      headers: { Authorization: 'Bearer wrong-token' }
    });

    await expect(
      GET({
        request: req,
        getClientAddress: () => '127.0.0.1',
        url: new URL('https://127.0.0.1/api/internal/storage/upload'),
        params: {} as any,
        locals: {} as any,
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        isDataRequest: false,
        route: { id: '/api/internal/storage/upload' },
        platform: {} as any,
        isSubRequest: false
      } as any)
    ).rejects.toThrow();
  });

  it('returns health status 200 on valid token GET', async () => {
    vi.doMock('$env/dynamic/private', () => ({
      env: { NOX_STORAGE_BRIDGE_TOKEN: TEST_TOKEN, TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: 'chat' }
    }));

    const { GET } = await import('../src/routes/api/internal/storage/upload/+server');
    const req = new Request('https://127.0.0.1/api/internal/storage/upload', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });

    const res = await GET({
      request: req,
      getClientAddress: () => '127.0.0.1',
      url: new URL('https://127.0.0.1/api/internal/storage/upload'),
      params: {} as any,
      locals: {} as any,
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      isDataRequest: false,
      route: { id: '/api/internal/storage/upload' },
      platform: {} as any,
      isSubRequest: false
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, provider: 'telegram' });
  });

  it('rejects corrupt image bytes with 400', async () => {
    vi.doMock('$env/dynamic/private', () => ({
      env: { NOX_STORAGE_BRIDGE_TOKEN: TEST_TOKEN, TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: 'chat' }
    }));

    const { POST } = await import('../src/routes/api/internal/storage/upload/+server');
    const req = new Request('https://127.0.0.1/api/internal/storage/upload?id=00000000-0000-0000-0000-000000000001', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      body: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])
    });

    await expect(
      POST({
        request: req,
        getClientAddress: () => '127.0.0.1',
        url: new URL('https://127.0.0.1/api/internal/storage/upload?id=00000000-0000-0000-0000-000000000001'),
        params: {} as any,
        locals: {} as any,
        cookies: {} as any,
        fetch: vi.fn(),
        setHeaders: vi.fn(),
        isDataRequest: false,
        route: { id: '/api/internal/storage/upload' },
        platform: {} as any,
        isSubRequest: false
      } as any)
    ).rejects.toThrow();
  });

  it('uploads valid image and returns providerKey without leaking secrets', async () => {
    vi.doMock('$env/dynamic/private', () => ({
      env: { NOX_STORAGE_BRIDGE_TOKEN: TEST_TOKEN, TELEGRAM_BOT_TOKEN: 'super-secret-token', TELEGRAM_CHAT_ID: '-100123' }
    }));

    const mockUpload = vi.fn().mockResolvedValue('tg-file-id-abc-123');
    vi.doMock('../src/lib/server/telegram', () => ({
      telegramStorage: () => ({ upload: mockUpload }),
      TelegramStorageError: class extends Error {}
    }));

    const { POST } = await import('../src/routes/api/internal/storage/upload/+server');
    const testId = '11111111-1111-1111-1111-111111111111';
    const req = new Request(`https://127.0.0.1/api/internal/storage/upload?id=${testId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      body: VALID_1X1_PNG
    });

    const res = await POST({
      request: req,
      getClientAddress: () => '127.0.0.1',
      url: new URL(`https://127.0.0.1/api/internal/storage/upload?id=${testId}`),
      params: {} as any,
      locals: {} as any,
      cookies: {} as any,
      fetch: vi.fn(),
      setHeaders: vi.fn(),
      isDataRequest: false,
      route: { id: '/api/internal/storage/upload' },
      platform: {} as any,
      isSubRequest: false
    } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      providerKey: 'tg-file-id-abc-123',
      mime: 'image/png',
      width: 1,
      height: 1,
      bytes: VALID_1X1_PNG.byteLength
    });

    expect(JSON.stringify(body)).not.toContain('super-secret-token');
    expect(mockUpload).toHaveBeenCalledWith(expect.any(Uint8Array), 'image/png', testId);
  });
});
