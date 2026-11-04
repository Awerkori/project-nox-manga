import { describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/server/yugabyte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/server/yugabyte')>()),
  executeYugabyteSql: sql
}));

import { getWorkRating, setWorkRating } from '../src/lib/server/ratings';

describe('rating fallback privacy', () => {
  it('never serves another visitor’s rating when the database fails', async () => {
    sql.mockReset();
    sql.mockResolvedValueOnce({ rows: [{ avg_rating: '5', total_count: 1, user_rating: 5, cnt_5: 1 }] });
    const first = await getWorkRating('privacy-work', 'visitor-a');
    expect(first.userRating).toBe(5);
    sql.mockRejectedValueOnce(new Error('database unavailable'));
    const second = await getWorkRating('privacy-work', 'visitor-b');
    expect(second.userRating).toBeNull();
    expect(second.count).toBe(0);
  });

  it('does not restore a stale fallback after a rating write', async () => {
    sql.mockReset();
    sql.mockResolvedValueOnce({ rows: [{ avg_rating: '5', total_count: 1, user_rating: 5, cnt_5: 1 }] });
    await getWorkRating('write-work', 'visitor-a');
    sql.mockResolvedValueOnce({ rows: [] });
    sql.mockRejectedValueOnce(new Error('database unavailable'));
    const afterWrite = await setWorkRating('write-work', 'visitor-a', 2);
    expect(afterWrite.userRating).toBeNull();
  });

  it('can reuse only the same visitor’s recent fallback', async () => {
    vi.useFakeTimers();
    try {
      sql.mockReset();
      sql.mockResolvedValueOnce({ rows: [{ avg_rating: '4', total_count: 1, user_rating: 4, cnt_4: 1 }] });
      await getWorkRating('same-visitor-work', 'visitor-a');
      vi.advanceTimersByTime(16_000);
      sql.mockRejectedValueOnce(new Error('database unavailable'));
      expect((await getWorkRating('same-visitor-work', 'visitor-a')).userRating).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
