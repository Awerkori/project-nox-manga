import { describe, expect, it, vi } from 'vitest';
import { MEMBER_PAGE_SIZE, pageNumber, pageLink } from '../src/lib/pagination';

let sqlCalls: { sql: string; params: any[] }[] = [];
let mockTotal = 125;

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: vi.fn(async (sql: string, params: any[]) => {
    sqlCalls.push({ sql, params });
    if (sql.includes('count(*) OVER() AS full_count')) {
      const rows = [];
      const limit = params[params.length - 2] || MEMBER_PAGE_SIZE;
      for (let i = 0; i < Math.min(limit, mockTotal); i++) {
        rows.push({
          id: `item-${i}`,
          work_id: `work-${i}`,
          chapter_id: `chap-${i}`,
          status: 'READING',
          full_count: String(mockTotal)
        });
      }
      return { rows };
    }
    if (sql.includes('library_total')) {
      return {
        rows: [{
          completed: String(mockTotal),
          library_total: String(mockTotal),
          completed_works: String(mockTotal)
        }]
      };
    }
    return { rows: [] };
  })
}));

vi.mock('$lib/server/reading-history', () => ({
  enrichReadingRowsWithCatalog: vi.fn(async (rows: any[]) => rows)
}));

import { load } from '../src/routes/[area=member]/+page.server';

function makeEvent(area: string, search = '', total = 125) {
  mockTotal = total;
  sqlCalls = [];
  return {
    locals: { user: { id: 'current-user' } },
    params: { area },
    url: new URL(`https://nox.invalid/${area}${search}`)
  } as any;
}

describe('member pagination', () => {
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
      const event = makeEvent(area, '?pagina=6', 125);
      const data = await load(event);
      expect(data.page).toBe(6);
      expect(data.total).toBe(125);
      expect(data.pageSize).toBe(MEMBER_PAGE_SIZE);
      expect(sqlCalls.length).toBeGreaterThanOrEqual(1);
      const mainQuery = sqlCalls.find((c) => c.sql.includes('full_count'));
      expect(mainQuery).toBeTruthy();
      expect(mainQuery?.params).toContain(MEMBER_PAGE_SIZE);
      expect(mainQuery?.params).toContain(100); // offset = (6 - 1) * 20 = 100
      expect(mainQuery?.params).toContain('current-user');
    }
  );

  it('combines the unread filter with owner isolation', async () => {
    const event = makeEvent('notificacoes', '?filtro=nao-lidas');
    const data = await load(event);
    expect(data.filter).toBe('nao-lidas');
    const mainQuery = sqlCalls.find((c) => c.sql.includes('full_count'));
    expect(mainQuery?.params).toContain('unread');
    expect(mainQuery?.params).toContain('current-user');
  });

  it('ignores unsupported library statuses', async () => {
    const event = makeEvent('biblioteca', '?status=ADMIN');
    const data = await load(event);
    expect(data.tab).toBe('');
    const mainQuery = sqlCalls.find((c) => c.sql.includes('full_count'));
    expect(mainQuery?.params[1]).toBe('');
  });

  it('redirects a past-the-end page while keeping the valid filter', async () => {
    const event = makeEvent('biblioteca', '?pagina=100&status=READING', 41);
    await expect(load(event)).rejects.toMatchObject({
      status: 303,
      location: '/biblioteca?status=READING&pagina=3'
    });
  });

  it('uses exact head counts for the profile without fetching the whole library', async () => {
    const event = makeEvent('perfil', '', 125);
    const data = await load(event);
    expect(data.libraryTotal).toBe(125);
    expect(data.completedWorks).toBe(125);
    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0].sql).toContain('library_total');
    expect(sqlCalls[0].params).toEqual(['current-user']);
  });
});
