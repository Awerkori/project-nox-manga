import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('pg', () => ({
  Client: class {
    connect = vi.fn().mockResolvedValue(undefined);
    query = (...args: any[]) => query(...args);
    end = vi.fn().mockResolvedValue(undefined);
  }
}));

import { searchWorksFromYugabyte } from '../src/lib/server/yugabyte';
import { GET as getWorks } from '../src/routes/api/v1/[...path]/+server';

describe('Yugabyte alias search', () => {
  beforeEach(() => query.mockReset());

  it('searches the authoritative alias index with parameterized filters and stable pagination', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'work-1', title: 'Solo Leveling', aliases: ['나 혼자만 레벨업'], total_count: 1 }],
      rowCount: 1
    });

    const result = await searchWorksFromYugabyte('나 혼자만 레벨업', {
      limit: 20, offset: 20, sort: 'titulo', kind: 'MANHWA', tag: 'action'
    }, { HYPERDRIVE: { connectionString: 'postgres://test' } });

    expect(result.works).toEqual([{ id: 'work-1', title: 'Solo Leveling', aliases: ['나 혼자만 레벨업'] }]);
    expect(result.total).toBe(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('search_text ILIKE $1');
    expect(sql).toContain('wt.work_id=works.id');
    expect(sql).toContain('ORDER BY title ASC, id ASC');
    expect(params).toEqual(['%나 혼자만 레벨업%', 'MANHWA', 'action', 20, 20]);
  });

  it('does not turn wildcard input into an unbounded match', async () => {
    const result = await searchWorksFromYugabyte(' %_\\ ', { limit: 20, offset: 0 }, {});
    expect(result).toEqual({ works: [], total: 0 });
    expect(query).not.toHaveBeenCalled();
  });

  it('falls back to persisted title and aliases when the derived search index is stale', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({
      rows: [{ id: 'work-2', slug: 'cheer-love', title: 'Cheer Love!', aliases: ['Viva o Amor!'], total_count: 1 }],
      rowCount: 1
    });

    const result = await searchWorksFromYugabyte('Viva o Amor!', {
      limit: 20, offset: 0
    }, { HYPERDRIVE: { connectionString: 'postgres://test' } });

    expect(result).toEqual({
      works: [{ id: 'work-2', slug: 'cheer-love', title: 'Cheer Love!', aliases: ['Viva o Amor!'] }],
      total: 1
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('search_text ILIKE $1');
    expect(query.mock.calls[1][0]).toContain('title ILIKE $1 OR EXISTS');
    expect(query.mock.calls[1][0]).toContain('unnest(COALESCE(works.aliases');
  });

  it('serves public API alias searches from the authoritative catalog', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'work-1', slug: 'solo-leveling', title: 'Solo Leveling', aliases: ['나 혼자만 레벨업'], total_count: 1 }],
      rowCount: 1
    });
    const supabaseQuery = {
      select: vi.fn(function (this: any) { return this; }),
      eq: vi.fn(function (this: any) { return this; }),
      ilike: vi.fn(function (this: any) { return this; }),
      order: vi.fn(function (this: any) { return this; }),
      range: vi.fn(function (this: any) { return this; })
    };
    const db = { from: vi.fn(() => supabaseQuery) };
    const response = await getWorks({
      locals: { db },
      params: { path: 'works' },
      url: new URL('https://nox.test/api/v1/works?q=%EB%82%98%20%ED%98%BC%EC%9E%90%EB%A7%8C%20%EB%A0%88%EB%B2%A8%EC%97%85'),
      platform: { env: { HYPERDRIVE: { connectionString: 'postgres://test' } } }
    } as any);

    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({ title: 'Solo Leveling', aliases: ['나 혼자만 레벨업'] });
    expect(db.from).toHaveBeenCalledOnce();
    expect(supabaseQuery.range).not.toHaveBeenCalled();
  });
});
