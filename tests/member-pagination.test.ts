import { describe, expect, it, vi } from 'vitest';
import { MEMBER_PAGE_SIZE, pageNumber, pageLink } from '../src/lib/pagination';
vi.mock('$lib/server/db', () => ({
  WORK_FIELDS: '*',
  check: (r: any) => {
    if (r.error) throw new Error('Database unavailable');
  }
}));
import { load } from '../src/routes/[area=member]/+page.server';

function fixture(area: string, search = '', total = 125, failure?: string) {
  const executed: { table: string; calls: [string, any[]][] }[] = [];
  const db = {
    from(table: string) {
      const calls: [string, any[]][] = [];
      const query: any = {};
      for (const method of ['select', 'eq', 'is', 'not', 'order', 'range'])
        query[method] = (...args: any[]) => {
          calls.push([method, args]);
          return query;
        };
      query.then = (resolve: any) => {
        executed.push({ table, calls });
        const head = calls.find(([method]) => method === 'select')?.[1][1]?.head;
        return Promise.resolve({
          data: head ? null : [],
          count: total,
          error: failure ? { code: failure } : null
        }).then(resolve);
      };
      return query;
    }
  };
  const event = {
    locals: { user: { id: 'current-user' }, db },
    params: { area },
    url: new URL(`https://nox.invalid/${area}${search}`)
  } as any;
  return { event, executed };
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
      const { event, executed } = fixture(area, '?pagina=6');
      const data = await load(event);
      expect(data.page).toBe(6);
      expect(data.total).toBe(125);
      expect(data.pageSize).toBe(MEMBER_PAGE_SIZE);
      expect(executed).toHaveLength(1);
      expect(executed[0].calls).toContainEqual(['range', [100, 119]]);
      expect(executed[0].calls).toContainEqual(['eq', ['user_id', 'current-user']]);
      expect(executed[0].calls.filter(([method]) => method === 'order')).toHaveLength(2);
    }
  );
  it('combines the unread filter with owner isolation', async () => {
    const { event, executed } = fixture('notificacoes', '?filtro=nao-lidas');
    expect((await load(event)).filter).toBe('nao-lidas');
    expect(executed[0].calls).toContainEqual(['is', ['read_at', null]]);
  });
  it('ignores unsupported library statuses', async () => {
    const { event, executed } = fixture('biblioteca', '?status=ADMIN');
    expect((await load(event)).tab).toBe('');
    expect(executed[0].calls.some(([method, args]) => method === 'eq' && args[0] === 'status')).toBe(false);
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
    expect(executed).toHaveLength(3);
    for (const query of executed) {
      expect(query.calls.find(([method]) => method === 'select')?.[1][1]).toEqual({
        count: 'exact',
        head: true
      });
      expect(query.calls).toContainEqual(['eq', ['user_id', 'current-user']]);
    }
  });
  it('does not disguise database failures as empty collections', async () => {
    const { event } = fixture('historico', '', 0, 'unavailable');
    await expect(load(event)).rejects.toThrow('Database unavailable');
  });
});
