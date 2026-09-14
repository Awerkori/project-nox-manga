import { describe, expect, it, vi } from 'vitest';
import { resolveSessionData } from '../src/lib/server/session-cache';

describe('verified session cache', () => {
  it('rejects forged claims before reading roles or profiles', async () => {
    const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('invalid token') }) }, from: vi.fn() };
    await expect(resolveSessionData(db as any, { sub: 'forged-owner', exp: 9999999999 }, 'forged-token')).rejects.toThrow('SESSION_NOT_VERIFIED');
    expect(db.from).not.toHaveBeenCalled();
  });

  it('rejects a verified token whose subject differs from the decoded claims', async () => {
    const db = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'reader' } }, error: null }) }, from: vi.fn() };
    await expect(resolveSessionData(db as any, { sub: 'owner', exp: 9999999999 }, 'reader-token')).rejects.toThrow('SESSION_NOT_VERIFIED');
    expect(db.from).not.toHaveBeenCalled();
  });
});
