import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Chapter Reactions In-Memory Aggregate Caching', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('serves aggregate emoji counts from memory on subsequent calls', async () => {
    const mockSql = vi.fn().mockImplementation((query: string) => {
      if (query.includes('GROUP BY emoji')) {
        return Promise.resolve({
          rows: [
            { emoji: 'heart', cnt: 42 },
            { emoji: 'fire', cnt: 15 }
          ]
        });
      }
      if (query.includes('visitor_id')) {
        return Promise.resolve({
          rows: [{ emoji: 'heart' }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    vi.doMock('$lib/server/yugabyte', () => ({
      executeYugabyteSql: mockSql
    }));

    const { GET } = await import('../src/routes/api/chapter-reactions/+server');

    const fakeEvent = {
      url: new URL('http://localhost/api/chapter-reactions?chapterId=chap-react-1'),
      locals: { user: { id: 'user-1' } },
      cookies: { get: () => undefined, set: () => {} },
      platform: { env: {} }
    };

    // First call: both counts and user queries are executed
    const res1 = await GET(fakeEvent as any);
    const data1 = await res1.json();
    expect(data1.counts).toEqual({ heart: 42, fire: 15 });
    expect(data1.userReactions).toEqual(['heart']);

    // Check count of GROUP BY queries
    const groupByCalls1 = mockSql.mock.calls.filter((c: any) => c[0].includes('GROUP BY emoji')).length;
    expect(groupByCalls1).toBe(1);

    // Second call: counts must come from memory; GROUP BY query is NOT executed again
    const res2 = await GET(fakeEvent as any);
    const data2 = await res2.json();
    expect(data2.counts).toEqual({ heart: 42, fire: 15 });

    const groupByCalls2 = mockSql.mock.calls.filter((c: any) => c[0].includes('GROUP BY emoji')).length;
    expect(groupByCalls2).toBe(1); // Still 1! Cached in memory
  });
});
