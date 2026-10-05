import { describe, expect, it, vi } from 'vitest';

const { executeYugabyteSql } = vi.hoisted(() => ({
  executeYugabyteSql: vi.fn()
}));

vi.mock('$lib/server/yugabyte', () => ({ executeYugabyteSql }));

import { loadCanonicalPublicationSnapshot } from '../src/lib/server/importer-snapshot';

describe('canonical publication snapshot source', () => {
  it('keeps real publications when the auxiliary pipeline bucket is unavailable', async () => {
    executeYugabyteSql
      .mockResolvedValueOnce({
        rows: [{
          bucket_minute: '2026-10-05T01:59:00.000Z',
          latest_published_at: '2026-10-05T01:59:48.000Z',
          visible_published: 2,
          fresh_visible: 0
        }]
      })
      .mockRejectedValueOnce(new Error('auxiliary bucket table unavailable'));

    const snapshot = await loadCanonicalPublicationSnapshot({}, Date.parse('2026-10-05T02:00:00.000Z'));

    expect(snapshot.source).toBe('YSQL_CANONICAL');
    expect(snapshot.latestPublishedAt).toBe('2026-10-05T01:59:48.000Z');
    expect(snapshot.bucketRows).toEqual([
      expect.objectContaining({
        visible_published: 2,
        completed_jobs: 0
      })
    ]);
  });
});
