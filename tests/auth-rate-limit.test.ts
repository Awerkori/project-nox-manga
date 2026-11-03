import { describe, expect, it, vi } from 'vitest';
import { checkAuthRateLimit } from '../src/lib/server/auth-rate-limit';

const secret = 'test-only-secret-at-least-thirty-two-characters';
const request = (ip = '203.0.113.8') => new Request('https://projectnox.org/entrar', { headers: { 'cf-connecting-ip': ip } });

describe('optional authentication rate-limit bindings', () => {
  it('allows local development but fails closed when a platform lacks bindings', async () => {
    expect(await checkAuthRateLimit(request(), undefined, 'entrar', 'reader@example.invalid')).toBe('allow');
    expect(await checkAuthRateLimit(request(), {}, 'entrar', 'reader@example.invalid')).toBe('unavailable');
  });

  it('fails closed for partial configuration, missing trusted origin, or service failure', async () => {
    const good = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const failed = { limit: vi.fn().mockRejectedValue(new Error('unavailable')) };
    expect(await checkAuthRateLimit(request(), { AUTH_ORIGIN_RATE_LIMIT: good }, 'entrar', 'a@example.invalid')).toBe('unavailable');
    expect(await checkAuthRateLimit(new Request('https://projectnox.org/entrar'), { AUTH_ORIGIN_RATE_LIMIT: good, AUTH_IDENTITY_RATE_LIMIT: good }, 'entrar', 'a@example.invalid')).toBe('unavailable');
    expect(await checkAuthRateLimit(request(), { AUTH_SECRET: secret, AUTH_ORIGIN_RATE_LIMIT: failed, AUTH_IDENTITY_RATE_LIMIT: good }, 'entrar', 'a@example.invalid')).toBe('unavailable');
  });

  it('fails closed when either binding returns a malformed result', async () => {
    const good = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const invalid = { limit: vi.fn().mockResolvedValue({ success: 'true' }) };
    const env = { AUTH_SECRET: secret, AUTH_ORIGIN_RATE_LIMIT: invalid, AUTH_IDENTITY_RATE_LIMIT: good };
    expect(await checkAuthRateLimit(request(), env, 'entrar', 'a@example.invalid')).toBe('unavailable');
    expect(await checkAuthRateLimit(request(), { ...env, AUTH_ORIGIN_RATE_LIMIT: good, AUTH_IDENTITY_RATE_LIMIT: invalid }, 'entrar', 'a@example.invalid')).toBe('unavailable');
  });

  it('honors origin and identity limits without exposing email or IP in keys', async () => {
    const origin = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const identity = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const env = { AUTH_SECRET: secret, AUTH_ORIGIN_RATE_LIMIT: origin, AUTH_IDENTITY_RATE_LIMIT: identity };
    expect(await checkAuthRateLimit(request(), env, 'entrar', 'Reader@example.invalid')).toBe('limited');
    const a = origin.limit.mock.calls[0][0].key;
    const b = identity.limit.mock.calls[0][0].key;
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(a + b).not.toContain('reader');
    expect(a + b).not.toContain('203.0.113.8');
    identity.limit.mockResolvedValue({ success: true });
    await checkAuthRateLimit(request(), env, 'entrar', 'reader@example.invalid');
    expect(identity.limit.mock.calls[1][0].key).toBe(b);
    await checkAuthRateLimit(request('203.0.113.9'), env, 'entrar', 'reader@example.invalid');
    expect(identity.limit.mock.calls[2][0].key).not.toBe(b);
    origin.limit.mockResolvedValue({ success: false });
    expect(await checkAuthRateLimit(request(), env, 'entrar', 'reader@example.invalid')).toBe('limited');
    expect(identity.limit).toHaveBeenCalledTimes(3);
  });

  it('sends concurrent attempts for the same origin and account to the same counters', async () => {
    const origin = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const identity = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const env = { AUTH_SECRET: secret, AUTH_ORIGIN_RATE_LIMIT: origin, AUTH_IDENTITY_RATE_LIMIT: identity };
    expect(await Promise.all(Array.from({ length: 10 }, () =>
      checkAuthRateLimit(request(), env, 'entrar', 'reader@example.invalid')
    ))).toEqual(Array(10).fill('allow'));
    expect(new Set(origin.limit.mock.calls.map(call => call[0].key)).size).toBe(1);
    expect(new Set(identity.limit.mock.calls.map(call => call[0].key)).size).toBe(1);
    // Atomic enforcement belongs to Cloudflare's binding and is approximate;
    // this unit test does not assert a strict concurrent or global limit.
  });
});
