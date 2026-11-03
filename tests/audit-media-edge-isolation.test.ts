import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  fetchMediaMetadataFromYugabyte: vi.fn(),
  executeYugabyteSql: vi.fn(),
  dbFrom: vi.fn(),
  mediaRecord: null as any
}));

vi.mock('$lib/server/db', () => ({
  privileged: () => ({
    from: mocks.dbFrom,
    storage: {
      from: () => ({
        download: vi.fn().mockResolvedValue({ data: null, error: new Error('Storage error') })
      })
    }
  })
}));

vi.mock('$lib/server/storage-router', () => ({
  resolveBotDownloadClient: () => ({
    download: mocks.download
  }),
  normalizeBotReference: (x: string) => x,
  deduceMangaShardFromFileId: () => null
}));

vi.mock('$lib/server/yugabyte', () => ({
  fetchMediaMetadataFromYugabyte: mocks.fetchMediaMetadataFromYugabyte,
  executeYugabyteSql: mocks.executeYugabyteSql
}));

import { GET as getPublicMediaRoute } from '../src/routes/media/[id]/+server';
import { GET as getPrivateMediaRoute } from '../src/routes/api/media/[id]/+server';
import { signSessionJwt } from '../src/lib/server/yugabyte-auth';

describe('Project Nox Final Security Audit — Priority 2: 1-Year Cache & Private Media Isolation', () => {
  const secret = 'project-nox-production-auth-key-2026-secure-token';
  const staffUserId = '77777777-7777-4777-8777-777777777777';
  const regularUserId = '88888888-8888-4888-8888-888888888888';
  const publicMediaId = '11111111-2222-3333-4444-555555555555';
  const privateStaffMediaId = '99999999-8888-7777-6666-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchMediaMetadataFromYugabyte.mockResolvedValue(null);
    mocks.executeYugabyteSql.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('access_roles')) {
        if (params?.[0] === staffUserId) {
          return { rows: [{ role: 'STAFF_SITE', suspended: false }], rowCount: 1 };
        }
        return { rows: [{ role: 'USER', suspended: false }], rowCount: 1 };
      }
      if (sql.includes('members')) {
        return { rows: [{ id: params?.[0], username: 'testuser' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    mocks.dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.mediaRecord })
        })
      })
    });
    mocks.download.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes
  });

  it('1. serves public media with 1-year shared cache headers and Cloudflare CDN headers', async () => {
    mocks.mediaRecord = {
      id: publicMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'editorial',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'public_sha256',
      provider_key: 'public_key',
      bytes: 50000
    };

    const res = await getPublicMediaRoute({
      locals: {},
      params: { id: publicMediaId },
      request: new Request(`https://projectnox.org/media/${publicMediaId}`),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(200);
    // Cache-Control must be public with 1-year max-age and immutable
    const cc = res.headers.get('Cache-Control') || '';
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=31536000');
    expect(cc).toContain('s-maxage=31536000');
    expect(cc).toContain('immutable');

    // Cloudflare CDN headers must allow 1-year edge cache
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=31536000');
    expect(res.headers.get('CDN-Cache-Control')).toBe('public, max-age=31536000');
  });

  it('2. blocks anonymous visitor from accessing private/staff media on /media/[id] with no-store', async () => {
    mocks.mediaRecord = {
      id: privateStaffMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'private_sha256',
      provider_key: 'private_key',
      bytes: 75000
    };

    const res = await getPublicMediaRoute({
      locals: {},
      params: { id: privateStaffMediaId },
      request: new Request(`https://projectnox.org/media/${privateStaffMediaId}`),
      cookies: { getAll: () => [] }
    });

    // Anonymous request to private media MUST be 404
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Acesso não autorizado');

    // Headers MUST be no-store and prevent Cloudflare edge caching
    const cc = res.headers.get('Cache-Control') || '';
    expect(cc).toContain('no-store');
    expect(cc).toContain('no-cache');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
  });

  it('3. redirects authorized staff member away from /media/[id] to /api/media/[id] with no-store', async () => {
    mocks.mediaRecord = {
      id: privateStaffMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'private_sha256',
      provider_key: 'private_key',
      bytes: 75000
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const staffToken = await signSessionJwt(
      { sub: staffUserId, exp: nowSec + 3600, role: 'authenticated' },
      secret
    );

    const b64Cookie = `base64-${Buffer.from(JSON.stringify({ access_token: staffToken })).toString('base64url')}`;

    const res = await getPublicMediaRoute({
      locals: {
        db: {
          auth: { getUser: vi.fn() }
        }
      },
      params: { id: privateStaffMediaId },
      request: new Request(`https://projectnox.org/media/${privateStaffMediaId}`),
      cookies: {
        getAll: () => [{ name: 'sb-izregkwaqdygwioqzwwo-auth-token', value: b64Cookie }]
      }
    });

    // NEVER returns 200 with media bytes on /media/[id] for private media!
    // Redirects with 307 to /api/media/[id] with private no-store headers.
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe(`/api/media/${privateStaffMediaId}`);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('4. serves private media on dedicated /api/media/[id] with strict no-store to verified staff', async () => {
    mocks.mediaRecord = {
      id: privateStaffMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'private_sha256',
      provider_key: 'private_key',
      bytes: 75000
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const staffToken = await signSessionJwt(
      { sub: staffUserId, exp: nowSec + 3600, role: 'authenticated' },
      secret
    );
    const b64Cookie = `base64-${Buffer.from(JSON.stringify({ access_token: staffToken })).toString('base64url')}`;

    const res = await getPrivateMediaRoute({
      locals: {
        db: { auth: { getUser: vi.fn() } }
      },
      params: { id: privateStaffMediaId },
      request: new Request(`https://projectnox.org/api/media/${privateStaffMediaId}`),
      cookies: {
        getAll: () => [{ name: 'sb-izregkwaqdygwioqzwwo-auth-token', value: b64Cookie }]
      }
    });

    expect(res.status).toBe(200);
    // Strictly private, no-store, no-cache
    const cc = res.headers.get('Cache-Control') || '';
    expect(cc).toContain('private');
    expect(cc).toContain('no-store');
    expect(cc).toContain('no-cache');
    expect(cc).toContain('max-age=0');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Vary')).toContain('Cookie');
    expect(res.headers.get('X-Media-Privacy')).toBe('PRIVATE-AUTHENTICATED');
  });

  it('5. blocks authenticated common user (role: USER) from accessing staff media on /api/media/[id]', async () => {
    mocks.mediaRecord = {
      id: privateStaffMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'private_sha256',
      provider_key: 'private_key',
      bytes: 75000
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const userToken = await signSessionJwt(
      { sub: regularUserId, exp: nowSec + 3600, role: 'authenticated' },
      secret
    );
    const b64Cookie = `base64-${Buffer.from(JSON.stringify({ access_token: userToken })).toString('base64url')}`;

    // Common user tries to access staff media with valid user session
    const res = await getPrivateMediaRoute({
      locals: {
        db: { auth: { getUser: vi.fn() } }
      },
      params: { id: privateStaffMediaId },
      request: new Request(`https://projectnox.org/api/media/${privateStaffMediaId}`),
      cookies: {
        getAll: () => [{ name: 'sb-izregkwaqdygwioqzwwo-auth-token', value: b64Cookie }]
      }
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Acesso não autorizado');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('6. serves public staff chapters (access_class: PUBLIC, purpose: staff_chapter) to anonymous visitors with 1-year cache', async () => {
    const staffChapterMediaId = '0003c487-8286-4c6c-b60c-85c3d1c306de';
    mocks.mediaRecord = {
      id: staffChapterMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'PUBLIC',
      purpose: 'staff_chapter',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'chapter_sha256',
      provider_key: 'chapter_key',
      bytes: 65000
    };

    const res = await getPublicMediaRoute({
      locals: {},
      params: { id: staffChapterMediaId },
      request: new Request(`https://projectnox.org/media/${staffChapterMediaId}`),
      cookies: { getAll: () => [] }
    });

    // Public manga pages MUST be accessible to readers and cached for 1 year
    expect(res.status).toBe(200);
    const cc = res.headers.get('Cache-Control') || '';
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=31536000');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=31536000');
  });

  it('7. supports Authorization Bearer header for staff access to private media', async () => {
    mocks.mediaRecord = {
      id: privateStaffMediaId,
      provider: 'telegram',
      storage_ready: true,
      status: 'ACTIVE',
      access_class: 'STAFF_ONLY',
      purpose: 'staff_manual',
      bot_reference: 'MANGA_STORAGE_01',
      mime: 'image/jpeg',
      sha256: 'private_sha256',
      provider_key: 'private_key',
      bytes: 75000
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const staffToken = await signSessionJwt(
      { sub: staffUserId, exp: nowSec + 3600, role: 'authenticated' },
      secret
    );

    const res = await getPublicMediaRoute({
      locals: { db: { auth: { getUser: vi.fn() } } },
      params: { id: privateStaffMediaId },
      request: new Request(`https://projectnox.org/media/${privateStaffMediaId}`, {
        headers: { authorization: `Bearer ${staffToken}` }
      }),
      cookies: { getAll: () => [] }
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe(`/api/media/${privateStaffMediaId}`);
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });
});
