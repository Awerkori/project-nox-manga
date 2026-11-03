import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidateYugabyteLkgPrefix, withYugabyteLkg } from '../src/lib/server/yugabyte';

describe('public Yugabyte request deduplication', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('shares a slow in-flight query after four seconds and releases it on completion', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    let now = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let resolve!: (value: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const first = withYugabyteLkg('slow-public-flight-test', fetcher, 'fallback', 1_000);
    await Promise.resolve();
    now += 5_000;
    const second = withYugabyteLkg('slow-public-flight-test', fetcher, 'fallback', 1_000);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve('ok');
    await expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
  });

  it('recovers from a stuck query without letting its late result replace fresher data', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    let now = 200_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let resolveOld!: (value: string) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((done) => { resolveOld = done; }))
      .mockResolvedValueOnce('fresh');
    const first = withYugabyteLkg('stuck-public-flight-test', fetcher, 'fallback', 60_000);
    await Promise.resolve();
    now += 15_001;
    const second = withYugabyteLkg('stuck-public-flight-test', fetcher, 'fallback', 60_000);
    await expect(second).resolves.toBe('fresh');
    resolveOld('old');
    await expect(first).resolves.toBe('old');
    await expect(withYugabyteLkg('stuck-public-flight-test', fetcher, 'fallback', 60_000)).resolves.toBe('fresh');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cleans up after a synchronous fetch failure so the next call can recover', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn().mockImplementationOnce(() => { throw new Error('offline'); }).mockResolvedValueOnce('recovered');
    await expect(withYugabyteLkg('failed-public-flight-test', fetcher, 'fallback', 1_000)).resolves.toBe('fallback');
    await expect(withYugabyteLkg('failed-public-flight-test', fetcher, 'fallback', 1_000)).resolves.toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledOnce();
  });

  it('does not repopulate invalidated data from a read started before a write', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    let resolveOld!: (value: string) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((done) => { resolveOld = done; }))
      .mockResolvedValueOnce('updated');
    const first = withYugabyteLkg('invalidate-flight-test', fetcher, 'fallback', 60_000);
    await Promise.resolve();
    invalidateYugabyteLkgPrefix('invalidate-flight-');
    await expect(withYugabyteLkg('invalidate-flight-test', fetcher, 'fallback', 60_000)).resolves.toBe('updated');
    resolveOld('old');
    await expect(first).resolves.toBe('old');
    await expect(withYugabyteLkg('invalidate-flight-test', fetcher, 'fallback', 60_000)).resolves.toBe('updated');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
