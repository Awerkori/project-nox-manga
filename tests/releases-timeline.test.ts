import { expect, it, vi } from 'vitest';

const { query, end } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('pg', () => ({
  Client: class {
    connect = vi.fn().mockResolvedValue(undefined);
    query = query;
    end = end;
  }
}));

import { fetchRecentReleaseTimelineFromYugabyte } from '../src/lib/server/yugabyte';

it('uses an indexed chapter publication timeline with a stable chapter cursor', async () => {
  await fetchRecentReleaseTimelineFromYugabyte(
    24,
    '2026-09-28T00:00:00Z',
    '11111111-1111-4111-8111-111111111111',
    { HYPERDRIVE: { connectionString: 'test' } },
    'manga'
  );

  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('FROM chapters c');
  expect(sql).toContain('INNER JOIN works w ON w.id = c.work_id');
  expect(sql).toContain('(c.published_at, c.id) < ($2::timestamptz, $3::uuid)');
  expect(sql).toContain('ORDER BY c.published_at DESC, c.id DESC');
  expect(sql).not.toContain('CROSS JOIN LATERAL');
  expect(sql).not.toContain('GROUP BY');
  expect(sql).not.toContain('ROW_NUMBER');
  expect(params).toEqual([24, '2026-09-28T00:00:00Z', '11111111-1111-4111-8111-111111111111', 'MANGA']);
  expect(end).toHaveBeenCalledOnce();
});
