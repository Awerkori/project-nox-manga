import { describe, expect, it, vi } from 'vitest';
describe('health requires evidence', () => {
  it('does not report healthy components or zero errors when telemetry is missing', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/health/+page.server');
    const q: any = { select: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: null }) };
    const data = await load({ locals: { user: { id: 'admin' }, role: 'ADMIN', db: { rpc: async () => ({ data: null, error: {} }), from: () => q } } } as any);
    expect(data.overall.status).toBe('ATENCAO');
    expect(data.components.web.status).toBe('SEM_DADOS');
    expect(data.components.database.status).toBe('SEM_DADOS');
    expect(data.components.importer.status).toBe('SEM_DADOS');
    expect(data.components.web.details).toEqual({});
  });
  it('marks an expired heartbeat as critical instead of RUNNING', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/health/+page.server');
    const q: any = { select: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: { created_at: new Date(Date.now() - 600000).toISOString(), rss_mb: 200, concurrency: 4, active_jobs: 3 } }) };
    const data = await load({ locals: { user: { id: 'admin' }, role: 'ADMIN', db: { rpc: async () => ({ data: null }), from: () => q } } } as any);
    expect(data.components.importer.status).toBe('CRITICO');
    expect(data.overall.status).toBe('CRITICO');
  });
});
