import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadYsqlImporterHeartbeat: vi.fn(),
  executeYugabyteSql: vi.fn(),
  withYugabyteReadSession: vi.fn(async (_env: any, fn: any) => fn(_env))
}));

vi.mock('$lib/server/importer-snapshot', () => ({
  loadYsqlImporterHeartbeat: mocks.loadYsqlImporterHeartbeat
}));

vi.mock('$lib/server/yugabyte', () => ({
  executeYugabyteSql: mocks.executeYugabyteSql,
  withYugabyteReadSession: mocks.withYugabyteReadSession
}));

describe('health requires evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not report healthy components or zero errors when telemetry is missing', async () => {
    vi.resetModules();
    mocks.loadYsqlImporterHeartbeat.mockResolvedValueOnce(null);
    mocks.executeYugabyteSql.mockResolvedValue({ rows: [] });

    const { load } = await import('../src/routes/admin/health/+page.server');
    const data = await load({
      locals: { user: { id: 'admin' }, role: 'ADMIN' },
      platform: { env: {} }
    } as any);

    expect(data.overall.status).toBe('ATENCAO');
    expect(data.components.web.status).toBe('SEM_DADOS');
    expect(data.components.database.status).toBe('SEM_DADOS');
    expect(data.components.importer.status).toBe('SEM_DADOS');
    expect(data.components.web.details).toEqual({});
    expect(data.components.mobile.status).toBe('SEM_DADOS');
    expect(data.components.sources.status).toBe('SEM_DADOS');
    expect(data.components.readiness.status).toBe('SEM_DADOS');
  });

  it('marks an expired heartbeat as critical instead of RUNNING', async () => {
    vi.resetModules();
    mocks.loadYsqlImporterHeartbeat.mockResolvedValueOnce({
      telemetry: {
        created_at: new Date(Date.now() - 600000).toISOString(),
        rss_mb: 200,
        concurrency: 4,
        active_jobs: 3
      }
    });
    mocks.executeYugabyteSql.mockResolvedValue({ rows: [] });

    const { load } = await import('../src/routes/admin/health/+page.server');
    const data = await load({
      locals: { user: { id: 'admin' }, role: 'ADMIN' },
      platform: { env: {} }
    } as any);

    expect(data.components.importer.status).toBe('CRITICO');
    expect(data.overall.status).toBe('CRITICO');
  });
});
