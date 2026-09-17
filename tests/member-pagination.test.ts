import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MEMBER_PAGE_SIZE, pageNumber, pageLink } from '../src/lib/pagination';
vi.mock('$env/dynamic/private', () => ({ env: { TURSO_DB_URL: 'http://localhost' } }));
vi.mock('$lib/server/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/db')>();
  return { ...actual as object, 
    WORK_FIELDS: '*',
    safeQuery: vi.fn(),
    check: (r: any) => {
      if (r.error) throw new Error('Database unavailable');
    }
  };
});
import { load } from '../src/routes/[area=member]/+page.server';

import { safeQuery } from '../src/lib/server/db';
function fixture(area: string, search = '', total = 125, failure?: string) {
  const db = {} as any; // Dummy db object for locals, no longer used
  const event = {
    locals: { user: { id: 'current-user' }, db },
    params: { area },
    url: new URL(`https://nox.invalid/${area}${search}`)
  } as any;
  
  // Mock safeQuery implementation
  (safeQuery as any).mockImplementation((query: any) => {
    if (failure) return { error: { message: failure } };
    
    const { sql, params } = query.toSQL();
    // console.log("SQL:", sql);
    if (sql.toLowerCase().includes('count(')) {
        return { data: [{ count: total }], error: null };
    }
    
    // Simulate empty data if total is 0 or offset is beyond total
    // Simulate empty data if total is 0 or offset is beyond total
    let limit = params[params.length - 2];
    let offset = params[params.length - 1];
    if (offset >= total) return { data: [], error: null };
    
    return { data: [{ id: 'mock' }], error: null };
  });

  const executed = () => (safeQuery as any).mock.calls.map((c: any) => c[0].toSQL());
  
  return { event, executed };
}

describe('member pagination', () => {
  beforeEach(() => { (safeQuery as any).mockClear(); });
  it.each([
    [null, 1],
    ['NaN', 1],
    ['Infinity', 1],
    ['-1', 1],
    ['2.9', 2],
    ['1000000', 10000]
  ])('bounds page %s', (value, expected) => {
    expect(pageNumber(value as string | null)).toBe(expected);
  });
  it('preserves filters and resets the page without duplicating query parameters', () => {
    expect(pageLink('/biblioteca', 2, { status: 'READING', filtro: '' })).toBe(
      '/biblioteca?status=READING&pagina=2'
    );
    expect(pageLink('/notificacoes', 1, { filtro: 'nao-lidas' })).toBe('/notificacoes?filtro=nao-lidas');
  });
  it.each(['biblioteca', 'favoritos', 'historico', 'notificacoes'])(
    'pages %s without the old 100-row truncation',
    async (area) => {
      const { event, executed } = fixture(area, '?pagina=6');
      const data = await load(event);
      expect(data.page).toBe(6);
      expect(data.total).toBe(125);
      expect(data.pageSize).toBe(MEMBER_PAGE_SIZE);
      expect(executed().filter(q => !q.sql.toLowerCase().includes('count('))).toHaveLength(1);
      const q = executed().find(q => !q.sql.toLowerCase().includes('count(')); expect(q.sql).toContain('limit ? offset ?'); expect(q.params.slice(-2)).toEqual([20, 100]);
      expect(q.params).toContain('current-user');
      expect(q.sql).toContain('order by');
    }
  );
  it('combines the unread filter with owner isolation', async () => {
    const { event, executed } = fixture('notificacoes', '?filtro=nao-lidas');
    expect((await load(event)).filter).toBe('nao-lidas');
    const q = executed().find(q => !q.sql.toLowerCase().includes('count(')); expect(q.sql).toContain('"readAt" is null');
  });
  it('ignores unsupported library statuses', async () => {
    const { event, executed } = fixture('biblioteca', '?status=ADMIN');
    expect((await load(event)).tab).toBe('');
    const q = executed().find(q => !q.sql.toLowerCase().includes('count(')); expect(q.sql).not.toContain('"status" =');
  });
  it('redirects a past-the-end page while keeping the valid filter', async () => {
    const { event } = fixture('biblioteca', '?pagina=100&status=READING', 41);
    await expect(load(event)).rejects.toMatchObject({
      status: 303,
      location: '/biblioteca?status=READING&pagina=3'
    });
  });
  it('recovers from a PostgREST out-of-range response', async () => {
    const { event } = fixture('notificacoes', '?pagina=8&filtro=nao-lidas', 0, 'PGRST103');
    await expect(load(event)).rejects.toMatchObject({
      status: 303,
      location: '/notificacoes?filtro=nao-lidas'
    });
  });
  it('uses exact head counts for the profile without fetching the whole library', async () => {
    const { event, executed } = fixture('perfil', '', 125);
    const data = await load(event);
    expect(data.libraryTotal).toBe(125);
    expect(data.completedWorks).toBe(125);
    expect(executed().length).toBeGreaterThanOrEqual(3);
    for (const query of executed()) {
      expect(query.sql.toLowerCase()).toContain('count(');
      expect(query.params).toContain('current-user');
    }
  });
  it('gracefully handles database failures and logs error', async () => {
    const { event } = fixture('historico', '', 0, 'unavailable');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = await load(event);
    expect(spy).toHaveBeenCalledWith({ message: 'unavailable' });
    expect(data.history).toEqual([]);
    spy.mockRestore();
  });
});
