import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('$env/dynamic/private', () => ({
  env: {
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
  }
}));

vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
  }
}));

vi.mock('pg', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      query = vi.fn().mockResolvedValue({
        rows: [{ id: 'test-id', slug: 'one-piece-ptbr', number: 1190, provider: 'telegram' }],
        rowCount: 1
      });
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

import {
  fetchWorkFromYugabyte,
  fetchWorkChaptersFromYugabyte,
  fetchMediaMetadataFromYugabyte,
  withYugabyteLkg,
  setLkg,
  getLkg
} from '../src/lib/server/yugabyte';
import * as yugabyteModule from '../src/lib/server/yugabyte';
import { privileged } from '../src/lib/server/db';
import { load as loadHome } from '../src/routes/+page.server';
import { GET as getReleases } from '../src/routes/api/releases/+server';

describe('Yugabyte Authoritative Runtime & Architecture Smoke Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('strictly verifies NO hardcoded gateway secrets exist in yugabyte.ts', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/lib/server/yugabyte.ts', 'utf-8');
    expect(content).not.toContain('DEFAULT_GATEWAY_TOKEN');
    expect(content).not.toMatch(/DEFAULT_GATEWAY_TOKEN\s*=\s*['"][0-9a-fA-F]{32,}['"]/);
  });

  it('verifies privileged() returns pure Supabase client without Yugabyte Proxy', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    const client = privileged();
    expect(client).toBeDefined();
    // Pure Supabase client has .from, .auth, .storage
    expect(typeof client.from).toBe('function');
    expect(client.auth).toBeDefined();
    expect(client.storage).toBeDefined();
  });

  it('guarantees LKG cache works and provides graceful degradation on DB errors', async () => {
    const testKey = 'test_smoke_op';
    const mockData = [{ id: 'work-1', title: 'Solo Leveling' }];

    // Prime LKG
    setLkg(testKey, mockData);
    const cached = getLkg<typeof mockData>(testKey);
    expect(cached).not.toBeNull();
    expect(cached?.data).toEqual(mockData);
    expect(cached?.ageSec).toBeGreaterThanOrEqual(0);

    // Call with error - should gracefully return LKG data without throwing 500
    const result = await withYugabyteLkg(
      testKey,
      async () => {
        throw new Error('Yugabyte connection timeout');
      },
      []
    );
    expect(result).toEqual(mockData);
  });

  it('runs Home page loader successfully using Yugabyte helpers and Supabase locals.db', async () => {
    const mockWorks = [
      {
        id: 'w-1',
        slug: 'one-piece-ptbr',
        title: 'One Piece',
        published: true,
        cover_id: 'c-1',
        updated_at: '2026-09-26T01:00:00Z',
        views_total: 50000
      }
    ];

    const mockReleases = [
      {
        work_id: 'w-1',
        work_slug: 'one-piece-ptbr',
        work_title: 'One Piece',
        work_cover_id: 'c-1',
        work_kind: 'MANGA',
        work_content_rating: 'GENERAL',
        latest_published_at: '2026-09-26T01:02:00Z',
        chapter_id: 'ch-1190',
        chapter_number: 1190,
        chapter_title: 'Capítulo 1190',
        chapter_published_at: '2026-09-26T01:02:00Z'
      }
    ];

    vi.spyOn(yugabyteModule, 'fetchHomeWorksFromYugabyte').mockResolvedValue(mockWorks as any);
    vi.spyOn(yugabyteModule, 'fetchMostReadFromYugabyte').mockResolvedValue(mockWorks as any);
    vi.spyOn(yugabyteModule, 'fetchRecentReleasesFromYugabyte').mockResolvedValue(mockReleases as any);

    // Mock locals.db as standard Supabase
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] })
      })
    };

    const result = await loadHome({
      locals: { db: mockDb, user: null },
      setHeaders: vi.fn(),
      url: new URL('https://manga.project-nox.test/?fresh=1'),
      platform: { env: {} }
    } as any);

    expect(result).toBeDefined();
    expect(result.works).toEqual(mockWorks);
    expect(result.recentReleases.length).toBe(1);
    expect(result.recentReleases[0].workTitle).toBe('One Piece');
    expect(result.recentReleases[0].chapters[0].number).toBe(1190);
    expect(result.loadError).toBe(false);
  });

  it('runs /api/releases endpoint successfully using Yugabyte helper', async () => {
    const mockReleases = [
      {
        work_id: 'w-1',
        work_slug: 'one-piece-ptbr',
        work_title: 'One Piece',
        work_cover_id: 'c-1',
        work_kind: 'MANGA',
        work_content_rating: 'GENERAL',
        latest_published_at: '2026-09-26T01:02:00Z',
        chapter_id: 'ch-1190',
        chapter_number: 1190,
        chapter_title: 'Capítulo 1190',
        chapter_published_at: '2026-09-26T01:02:00Z'
      }
    ];

    vi.spyOn(yugabyteModule, 'fetchRecentReleasesFromYugabyte').mockResolvedValue(mockReleases as any);

    const response = await getReleases({
      url: new URL('https://manga.project-nox.test/api/releases?limit=1'),
      platform: { env: {} }
    } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.releases.length).toBe(1);
    expect(json.releases[0].workTitle).toBe('One Piece');
    expect(json.releases[0].chapters[0].number).toBe(1190);
  });

  it('verifies fetchWorkFromYugabyte, fetchWorkChaptersFromYugabyte, and fetchMediaMetadataFromYugabyte execute safely', async () => {
    const mockEnv = {
      HYPERDRIVE: { connectionString: 'postgresql://mock:5433/mock' }
    };

    const work = await fetchWorkFromYugabyte('one-piece-ptbr', mockEnv);
    expect(work).toBeDefined();

    const chapters = await fetchWorkChaptersFromYugabyte('test-id', false, mockEnv);
    expect(Array.isArray(chapters)).toBe(true);

    const media = await fetchMediaMetadataFromYugabyte('test-id', mockEnv);
    expect(media).toBeDefined();
  });
});
