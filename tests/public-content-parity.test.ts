import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@libsql/client/web', () => ({ createClient: vi.fn() }));
vi.mock('../src/lib/server/db/safe', () => ({
  safeQuery: vi.fn(),
  safeQuerySingle: vi.fn()
}));
vi.mock('../src/lib/server/resilience', () => ({
  withTimeout: (promise: Promise<any>) => promise
}));

import { safeQuery, safeQuerySingle } from '../src/lib/server/db/safe';
import { load as workLoad } from '../src/routes/obra/[slug]/+page.server';

function makeEvent(role: string | null, preview = false) {
  return {
    locals: { user: role ? { id: 'user' } : null, role },
    params: { slug: 'story' },
    url: new URL('https://nox.invalid/obra/story' + (preview ? '?preview=1' : '')),
    cookies: { get: () => undefined }
  } as any;
}

describe('public chapter visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (safeQuerySingle as Mock).mockImplementation(async (query) => {
      if (!query || !query.toSQL) return { data: null };
      const sql = query.toSQL().sql.toLowerCase();
      if (sql.includes('from "works"')) {
        return { data: { id: 'work', title: 'Story', slug: 'story', published: true } };
      }
      return { data: null };
    });

    (safeQuery as Mock).mockImplementation(async (query) => {
      return { data: [] };
    });
  });

  it('gives staff and anonymous readers the same published chapters', async () => {
    await workLoad(makeEvent(null));
    
    let anonChaptersCall = (safeQuery as Mock).mock.calls.find(c => {
      const q = c[0];
      return q && q.toSQL && q.toSQL().sql.toLowerCase().includes('from "chapters"');
    });
    
    (safeQuery as Mock).mockClear();
    
    await workLoad(makeEvent('ADMIN'));
    let staffChaptersCall = (safeQuery as Mock).mock.calls.find(c => {
      const q = c[0];
      return q && q.toSQL && q.toSQL().sql.toLowerCase().includes('from "chapters"');
    });

    const anonSql = anonChaptersCall[0].toSQL().sql;
    const staffSql = staffChaptersCall[0].toSQL().sql;

    expect(anonSql).toContain('"chapters"."publishedAt" is not null');
    expect(staffSql).toContain('"chapters"."publishedAt" is not null');
    expect(anonSql).toEqual(staffSql);
  });

  it('requires both explicit preview and staff authority to include drafts', async () => {
    await workLoad(makeEvent(null, true));
    let anonPreviewCall = (safeQuery as Mock).mock.calls.find(c => {
      const q = c[0];
      return q && q.toSQL && q.toSQL().sql.toLowerCase().includes('from "chapters"');
    });
    
    (safeQuery as Mock).mockClear();

    await workLoad(makeEvent('ADMIN', true));
    let staffPreviewCall = (safeQuery as Mock).mock.calls.find(c => {
      const q = c[0];
      return q && q.toSQL && q.toSQL().sql.toLowerCase().includes('from "chapters"');
    });

    const anonPreviewSql = anonPreviewCall[0].toSQL().sql;
    const staffPreviewSql = staffPreviewCall[0].toSQL().sql;

    expect(anonPreviewSql).toContain('"chapters"."publishedAt" is not null');
    expect(staffPreviewSql).not.toContain('"chapters"."publishedAt" is not null');
  });
});
