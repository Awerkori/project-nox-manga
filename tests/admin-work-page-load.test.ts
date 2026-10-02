import { describe, expect, it, vi } from 'vitest';

const privilegedState = vi.hoisted(() => ({ db: null as any }));

vi.mock('$lib/server/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/server/db')>();
  return { ...original, privileged: () => privilegedState.db };
});

const workId = '11111111-1111-4111-8111-111111111111';

function result(data: unknown, error: unknown = null) {
  return { data, error };
}

function database(overrides: Record<string, ReturnType<typeof result> | ReturnType<typeof result>[]> = {}) {
  const defaults: Record<string, ReturnType<typeof result>> = {
    works: result({ id: workId, title: 'Obra QA', metadata_provenance: {} }),
    tags: result([]),
    work_tags: result([]),
    chapters: result([]),
    scans: result([]),
    work_scans: result([]),
    importer_work_mappings: result([]),
    importer_sources: result([]),
    importer_chapter_mappings: result([])
  };

  return {
    from: vi.fn((table: string) => {
      const requested = overrides[table] || defaults[table];
      const call = Array.isArray(requested) ? requested.shift() || defaults[table] : requested;
      const query: any = {};
      for (const method of ['select', 'eq', 'order', 'in']) query[method] = vi.fn(() => query);
      query.maybeSingle = vi.fn(() => Promise.resolve(call));
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(call).then(resolve, reject);
      return query;
    })
  };
}

function event(
  db: ReturnType<typeof database>,
  id = workId,
  provenanceDb: ReturnType<typeof database> = database({ works: result({ metadata_provenance: {} }) })
) {
  privilegedState.db = provenanceDb;
  return {
    locals: { user: { id: 'admin' }, role: 'ADMIN', db },
    params: { id },
    request: new Request('https://admin.example/admin/obras/' + id, { headers: { 'cf-ray': 'qa-correlation' } })
  };
}

describe('/admin/obras/[id] load', () => {
  it('keeps the work page behind the editorial admin boundary', async () => {
    const { load: adminLayoutLoad } = await import('../src/routes/admin/+layout.server');
    await expect(adminLayoutLoad({ locals: { user: null, role: null, db: database() } } as any)).rejects.toMatchObject({ status: 303 });
    await expect(adminLayoutLoad(event(database()) as any)).resolves.toMatchObject({ pendingReportsCount: 0 });
  });

  it('loads an existing work and its administrative data', async () => {
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    const loaded = await load(event(database()) as any);
    expect(loaded.work).toMatchObject({ id: workId, title: 'Obra QA' });
    expect(loaded.tags).toEqual([]);
    expect(loaded.chapters).toEqual([]);
    expect(loaded.allScans).toEqual([]);
    expect(loaded.provenance).toBeTruthy();
  });

  it('returns 404 only when a valid work id has no row', async () => {
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    await expect(load(event(database({ works: result(null) })) as any)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the work page usable when only the optional provenance column is pending migration', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    const loaded = await load(event(
      database(),
      workId,
      database({ works: result(null, { code: 'PGRST204', message: 'metadata_provenance is missing from schema cache' }) })
    ) as any);
    expect(loaded.work).toMatchObject({ id: workId });
    expect(loaded.metadataProvenanceAvailable).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      'admin_load_query_degraded',
      expect.objectContaining({ route: '/admin/obras/[id]', operation: 'work_metadata_provenance', code: 'PGRST204', requestId: 'qa-correlation' })
    );
    spy.mockRestore();
  });

  it('does not mask an unexpected work query failure as 404', async () => {
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    await expect(load(event(database({ works: result(null, { code: '42501', message: 'permission denied' }) })) as any)).rejects.toMatchObject({ status: 500 });
  });

  it('fails safely when a dependent administrative query fails', async () => {
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    await expect(
      load(event(database({ importer_sources: result(null, { code: '42P01', message: 'relation missing' }) })) as any)
    ).rejects.toMatchObject({ status: 500 });
  });
});
