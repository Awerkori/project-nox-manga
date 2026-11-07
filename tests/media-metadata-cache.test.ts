import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedMediaMetadata,
  setCachedMediaMetadata,
  invalidateMediaMetadataCache,
  fetchMediaMetadataFromYugabyte
} from '../src/lib/server/yugabyte';

describe('Media Metadata In-Memory LRU Cache', () => {
  const testMediaId = '11111111-2222-4333-8444-555555555555';

  beforeEach(() => {
    invalidateMediaMetadataCache(testMediaId);
  });

  it('stores and retrieves cached media metadata', () => {
    const fakeRow = {
      id: testMediaId,
      provider: 'TELEGRAM',
      provider_key: 'tg_file_123',
      mime: 'image/webp',
      width: 1200,
      height: 1800,
      access_class: 'PUBLIC',
      status: 'AVAILABLE'
    };

    setCachedMediaMetadata(testMediaId, fakeRow);

    const cached = getCachedMediaMetadata(testMediaId);
    expect(cached).toEqual(fakeRow);
  });

  it('invalidates cache entry properly', () => {
    setCachedMediaMetadata(testMediaId, { id: testMediaId });
    expect(getCachedMediaMetadata(testMediaId)).not.toBeNull();

    invalidateMediaMetadataCache(testMediaId);
    expect(getCachedMediaMetadata(testMediaId)).toBeNull();
  });

  it('returns cached entry from fetchMediaMetadataFromYugabyte without calling SQL', async () => {
    const fakeRow = {
      id: testMediaId,
      provider: 'TELEGRAM',
      provider_key: 'tg_file_cached',
      mime: 'image/jpeg'
    };

    setCachedMediaMetadata(testMediaId, fakeRow);

    // fetchMediaMetadataFromYugabyte must return the cached entry immediately
    const res = await fetchMediaMetadataFromYugabyte(testMediaId, {});
    expect(res).toEqual(fakeRow);
  });

  it('invalidates media metadata cache when revokeMedia and unrevokeMedia are invoked', async () => {
    const { revokeMedia, unrevokeMedia } = await import('../src/lib/server/media-revocation');
    const fakeRow = {
      id: testMediaId,
      access_class: 'PUBLIC',
      status: 'ACTIVE'
    };

    setCachedMediaMetadata(testMediaId, fakeRow);
    expect(getCachedMediaMetadata(testMediaId)).toEqual(fakeRow);

    const mockKv = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };

    // Calling revokeMedia must automatically purge mediaMetadataCache
    await revokeMedia(testMediaId, { kv: mockKv });
    expect(getCachedMediaMetadata(testMediaId)).toBeNull();

    // Re-set and test unrevokeMedia
    setCachedMediaMetadata(testMediaId, fakeRow);
    expect(getCachedMediaMetadata(testMediaId)).toEqual(fakeRow);

    await unrevokeMedia(testMediaId, { kv: mockKv });
    expect(getCachedMediaMetadata(testMediaId)).toBeNull();
  });
});
