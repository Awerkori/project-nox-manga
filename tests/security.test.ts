import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: {
    TURSO_DB_URL: 'libsql://dummy.turso.io',
    TURSO_DB_TOKEN: 'dummy-token'
  }
}));

vi.mock('@sveltejs/kit', async () => ({
  error: vi.fn((status, message) => { throw new Error(`HTTP ${status}: ${message}`); }),
  redirect: vi.fn((status, location) => { throw new Error(`REDIRECT ${status}: ${location}`); }),
  fail: vi.fn((status, data) => ({ status, data }))
}));

let executedQueries: string[] = [];

vi.mock('../src/lib/server/db/safe', () => {
  return {
    safeQuery: vi.fn(async (query) => {
      if (query && typeof query.toSQL === 'function') {
        executedQueries.push(query.toSQL().sql);
      }
      return Promise.resolve({ data: [], error: null });
    }),
    safeQuerySingle: vi.fn(async (query) => {
      if (query && typeof query.toSQL === 'function') {
        executedQueries.push(query.toSQL().sql);
      }
      return Promise.resolve({ data: null, error: null });
    })
  };
});

import { db } from '../src/lib/server/db';
vi.spyOn(db, 'execute').mockImplementation(async (query: any) => {
  if (query && query.queryChunks) {
    executedQueries.push(JSON.stringify(query.queryChunks));
  }
  return [];
});

import { load as adminLoad } from '../src/routes/admin/+page.server';
import { load as editLoad } from '../src/routes/admin/obras/[id]/+page.server';
import { actions as scanActions } from '../src/routes/scan/+page.server';

describe('RBAC Security - Negative Tests', () => {
  beforeEach(() => {
    executedQueries = [];
    vi.clearAllMocks();
  });

  it('membro comum acessa Admin -> BLOQUEADO', async () => {
    const event = { locals: { user: { id: 'user1' }, role: 'MEMBER' } } as any;
    await expect(adminLoad(event)).rejects.toThrow(/HTTP 403/);
  });

  it('sem sessão -> BLOQUEADO', async () => {
    const event = { locals: { user: null }, params: { id: 'some-id' } } as any;
    await expect(adminLoad(event)).rejects.toThrow(/HTTP 403/);
    await expect(editLoad(event)).rejects.toThrow(/HTTP 403|HTTP 404/);
  });

  it('sessão inválida/expirada -> BLOQUEADO', async () => {
    const event = { locals: { user: null }, params: { id: 'some-id' } } as any;
    await expect(adminLoad(event)).rejects.toThrow(/HTTP 403/);
  });

  it('usuário A edita B -> BLOQUEADO', async () => {
    const event = { locals: { user: { id: 'userA' }, role: 'MEMBER' }, params: { id: 'obra-b' } } as any;
    await expect(editLoad(event)).rejects.toThrow(/HTTP 403|HTTP 404/);
    
    expect(executedQueries.length).toBeGreaterThan(0);
    const sqlStr = executedQueries.join(' ');
    expect(sqlStr).toContain('select');
    expect(sqlStr).toContain('works');
  });
  
  it('editor executa ação exclusiva de Admin -> BLOQUEADO', async () => {
    const event = { 
      locals: { user: { id: 'user1' }, role: 'EDITOR' },
      request: { formData: async () => new URLSearchParams('scanId=123') }
    } as any;
    if (scanActions.adminOverrideScanStage) {
      await expect(scanActions.adminOverrideScanStage(event)).rejects.toThrow(/403/);
    }
  });

  it('scan_id forjado -> bloqueado', async () => {
    const event = { 
      locals: { user: { id: 'user1' }, role: 'MEMBER' },
      request: { formData: async () => new URLSearchParams('scan_id=forged-id') }
    } as any;
    if (scanActions.leaveScan) {
      await expect(scanActions.leaveScan(event)).rejects.toThrow(/REDIRECT 303/);
      
      expect(executedQueries.length).toBeGreaterThan(0);
      const sqlStr = executedQueries.join(' ');
      expect(sqlStr).toContain('leave_scan');
    }
  });
});
