import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveSessionData } from '../src/lib/server/session-cache';
import { safeQuery, safeQuerySingle } from '../src/lib/server/db/safe';

vi.mock('../src/lib/server/db/safe', () => ({
  safeQuery: vi.fn(),
  safeQuerySingle: vi.fn()
}));

const mockSession = {
  id: 'session-id',
  user: { id: 'reader-id', name: 'Reader', email: 'reader@example.com' },
  session: { expiresAt: new Date(Date.now() + 100000) }
};

describe('verified session cache', () => {
  beforeEach(() => {
    (safeQuery as any).mockClear();
    (safeQuerySingle as any).mockClear();
  });

  it('queries Drizzle for roles and profiles using the trusted session object', async () => {
    (safeQuerySingle as any).mockResolvedValue({ data: null, error: null });
    (safeQuery as any).mockResolvedValue({ data: [], error: null });
    
    await resolveSessionData(mockSession);
    
    expect(safeQuerySingle).toHaveBeenCalledTimes(2); // profile and role
    
    const profileCall = (safeQuerySingle as any).mock.calls[0][0];
    const { sql, params } = profileCall.toSQL();
    expect(sql).toContain('"members"');
    expect(params).toContain('reader-id');
  });

  it('provides safe fallback data if database fails', async () => {
    (safeQuerySingle as any).mockRejectedValue(new Error('DB Offline'));
    
    const data = await resolveSessionData(mockSession);
    
    expect(data.role).toBeNull();
    expect(data.profile.role).toBe('LEITOR');
  });
});
