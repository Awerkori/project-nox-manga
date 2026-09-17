import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: {
    TURSO_DB_URL: 'http://127.0.0.1:8080',
    TURSO_DB_TOKEN: 'test'
  }
}));

const { queries, mockData } = vi.hoisted(() => ({
  queries: [] as string[],
  mockData: {
    telemetry: null as any
  }
}));

vi.mock('$lib/server/db', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    safeQuery: vi.fn(async (promise: any) => {
      if (promise && promise.toSQL) {
        queries.push(promise.toSQL().sql);
      }
      return { data: [], error: null };
    }),
    safeQuerySingle: vi.fn(async (promise: any) => {
      if (promise && promise.toSQL) {
        const sql = promise.toSQL().sql;
        queries.push(sql);
        if (sql.includes('importer_telemetry')) {
          return { data: mockData.telemetry, error: null };
        }
      }
      return { data: null, error: null };
    })
  };
});

describe('health requires evidence', () => {
  beforeEach(() => {
    queries.length = 0;
    mockData.telemetry = null;
  });

  it('does not report healthy components or zero errors when telemetry is missing', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/health/+page.server');
    mockData.telemetry = null;
    
    const data = await load({ locals: { user: { id: 'admin' }, role: 'ADMIN' } } as any);
    
    const telemetryQuery = queries.find(q => q.includes('importer_telemetry'));
    expect(telemetryQuery).toBeDefined();
    expect(telemetryQuery).toContain('select');
    expect(telemetryQuery).toContain('from "importer_telemetry"');

    expect(data.overall.status).toBe('BOM');
    expect(data.components.web.status).toBe('BOM');
    expect(data.components.database.status).toBe('SEM_DADOS');
    expect(data.components.importer.status).toBe('SEM_DADOS');
  });

  it('marks an expired heartbeat as critical instead of RUNNING', async () => {
    vi.resetModules();
    const { load } = await import('../src/routes/admin/health/+page.server');
    
    mockData.telemetry = {
      createdAt: new Date(Date.now() - 600000).toISOString(),
      rssMb: 200,
      concurrency: 4,
      activeJobs: 3
    };

    const data = await load({ locals: { user: { id: 'admin' }, role: 'ADMIN' } } as any);
    
    const telemetryQuery = queries.find(q => q.includes('importer_telemetry'));
    expect(telemetryQuery).toBeDefined();
    expect(data.components.importer.status).toBe('CRITICO');
    expect(data.overall.status).toBe('BOM');
  });
});
