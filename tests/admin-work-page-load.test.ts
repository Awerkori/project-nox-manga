import { describe, expect, it, vi } from 'vitest';

const workId = '11111111-1111-4111-8111-111111111111';

let currentWork: any = { id: workId, title: 'Obra QA', metadata_provenance: {} };

vi.mock('$lib/server/yugabyte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/server/yugabyte')>();
  return {
    ...actual,
    executeYugabyteSql: vi.fn(async (sql: string) => {
      if (sql.includes('FROM public.works WHERE id = $1')) {
        return { rows: currentWork ? [currentWork] : [] };
      }
      return { rows: [] };
    })
  };
});

function event(id = workId) {
  return {
    locals: { user: { id: 'admin' }, role: 'ADMIN' },
    params: { id },
    request: new Request('https://admin.example/admin/obras/' + id, { headers: { 'cf-ray': 'qa-correlation' } })
  };
}

describe('/admin/obras/[id] load', () => {
  it('keeps the work page behind the editorial admin boundary', async () => {
    const { load: adminLayoutLoad } = await import('../src/routes/admin/+layout.server');
    await expect(adminLayoutLoad({ locals: { user: null, role: null } } as any)).rejects.toMatchObject({ status: 303 });
    await expect(adminLayoutLoad(event() as any)).resolves.toMatchObject({ pendingReportsCount: 0 });
  });

  it('loads an existing work and its administrative data', async () => {
    currentWork = { id: workId, title: 'Obra QA', metadata_provenance: {} };
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    const loaded = await load(event() as any);
    expect(loaded.work).toMatchObject({ id: workId, title: 'Obra QA' });
    expect(loaded.tags).toEqual([]);
    expect(loaded.chapters).toEqual([]);
    expect(loaded.allScans).toEqual([]);
    expect(loaded.provenance).toBeTruthy();
  });

  it('returns 404 only when a valid work id has no row', async () => {
    currentWork = null;
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    await expect(load(event() as any)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the work page usable when metadata_provenance is empty', async () => {
    currentWork = { id: workId, title: 'Obra QA', metadata_provenance: null };
    const { load } = await import('../src/routes/admin/obras/[id]/+page.server');
    const loaded = await load(event() as any);
    expect(loaded.work).toMatchObject({ id: workId });
    expect(loaded.metadataProvenanceAvailable).toBe(true);
  });
});
