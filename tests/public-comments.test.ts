import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockSafeQuery, mockSafeQuerySingle } = vi.hoisted(() => {
  return {
    mockSafeQuery: vi.fn(),
    mockSafeQuerySingle: vi.fn(),
  };
});

vi.mock('../src/lib/server/db', async () => {
  const schema = await import('../src/lib/server/db/schema');
  const { drizzle } = await import('drizzle-orm/libsql');
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url: 'file::memory:' });
  const mockDb = drizzle(client, { schema });

  return { 
    schema,
    WORK_FIELDS: '*', 
    check: () => {},
    safeQuery: mockSafeQuery,
    safeQuerySingle: mockSafeQuerySingle,
    db: mockDb
  };
});

vi.mock('../src/lib/server/resilience', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    safeDbQuery: async (q: any) => await q,
    withTimeout: async (p: any, ms: any, fallback: any) => {
      try { return await p; } catch (e) { return fallback; }
    }
  };
});

import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';
import { load as readerLoad } from '../src/routes/ler/[id]/+page.server';

function event() {
  return {
    locals: { user: null, role: 'ADMIN', sessionCache: { profile: { ageStatus: 'ADULT_18' } } },
    params: { slug: 'story', id: 'chapter' },
    url: new URL('https://nox.invalid/obra/story'),
    cookies: { get: () => null },
    setHeaders: () => {}
  } as any;
}

describe('moderated comments on public pages', () => {
  let commentQueries: any[] = [];

  beforeEach(() => {
    commentQueries = [];
    
    mockSafeQuerySingle.mockImplementation(async (q: any) => {
      if (!q || !q.toSQL) return { data: null, error: null };
      const { sql } = q.toSQL();
      if (sql.includes('"chapters"."id" = ?') || sql.includes('"chapters"."id"=')) {
        return { 
          data: { 
            id: 'chapter', workId: 'work', number: 64, publishedAt: new Date(), 
            works: { id: 'work', slug: 'story', title: 'Story', published: true, contentRating: 'TEEN' } 
          }, 
          error: null 
        };
      }
      if (sql.includes('"works"."slug" = ?') || sql.includes('"works"."id" = ?') || sql.includes('"works"."slug"=')) {
        return { 
          data: { id: 'work', slug: 'story', title: 'Story', synopsis: '', aliases: [], published: true, contentRating: 'TEEN' }, 
          error: null 
        };
      }
      return { data: null, error: null };
    });

    mockSafeQuery.mockImplementation(async (q: any) => {
      if (!q || !q.toSQL) return { data: [], error: null };
      const { sql, params } = q.toSQL();
      if (sql.includes('"comments"')) {
        commentQueries.push({ sql, params });
      }
      if (sql.includes('"pages"')) {
        return { data: [{ position: 1, mediaId: 'media', width: 800, height: 1200 }], error: null };
      }
      return { data: [], error: null };
    });
  });

  it('hides removed work comments even from the owner outside moderation', async () => {
    await workLoad(event());
    const query = commentQueries.find(q => q.sql.includes('"chapterId" is null'));
    expect(query).toBeDefined();
    
    expect(query.sql).toContain('"comments"."removed" = ?');
    const paramIndex = query.sql.substring(0, query.sql.indexOf('"comments"."removed" = ?')).split('?').length - 1;
    expect(query.params[paramIndex]).toBe(0); // 0 means false in Drizzle SQLite
  });

  it('hides removed chapter comments even from the owner outside moderation', async () => {
    await readerLoad(event());
    const query = commentQueries.find(q => q.sql.includes('"chapterId" = ?'));
    expect(query).toBeDefined();
    
    expect(query.sql).toContain('"comments"."removed" = ?');
    const paramIndex = query.sql.substring(0, query.sql.indexOf('"comments"."removed" = ?')).split('?').length - 1;
    expect(query.params[paramIndex]).toBe(0); // 0 means false in Drizzle SQLite
  });
});
