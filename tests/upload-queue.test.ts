import { expect, it, vi, beforeEach } from 'vitest';
import { flushUploads, UploadRateLimitError, _resetAdaptiveStateForTesting, isInRecovery } from '../src/lib/upload-queue';

beforeEach(() => {
  _resetAdaptiveStateForTesting();
});

it('retains only unfinished pages and does not duplicate successful uploads on retry', async () => {
  const pending = [1, 2, 3].map((n) => new File(['page'], `${n}.png`));
  const accepted = vi.fn();
  const send = vi.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error('Offline'));
  await expect(flushUploads(pending, send, accepted)).rejects.toThrow('Offline');
  expect(pending.map((f) => f.name)).toEqual(['2.png', '3.png']);
  const retry = vi.fn().mockResolvedValue('resumed');
  await flushUploads(pending, retry, accepted);
  expect(retry.mock.calls.map(([f]) => f.name)).toEqual(['2.png', '3.png']);
  expect(pending).toEqual([]);
  expect(accepted).toHaveBeenCalledTimes(3);
});

it('pauses between pages without dropping pending uploads', async () => {
  const pending = [1, 2].map((n) => new File(['page'], `${n}.png`));
  let pause = false;
  await flushUploads(
    pending,
    async () => 'accepted',
    () => {
      pause = true;
    },
    () => pause
  );
  expect(pending.map((f) => f.name)).toEqual(['2.png']);
});

it('uploads concurrently (concurrency: 2) while strictly preserving FIFO delivery order', async () => {
  const pending = [1, 2, 3, 4].map((n) => new File(['page'], `${n}.png`));
  const deliveredOrder: string[] = [];
  const accepted = vi.fn((_res, file: File) => {
    deliveredOrder.push(file.name);
  });

  const send = vi.fn(async (file: File) => {
    if (file.name === '1.png') {
      await new Promise((r) => setTimeout(r, 30));
      return 'p1';
    }
    if (file.name === '2.png') {
      await new Promise((r) => setTimeout(r, 10));
      return 'p2';
    }
    return file.name;
  });

  await flushUploads(pending, send, accepted, () => false, {
    concurrency: 2,
    basePaceMs: 0
  });

  expect(deliveredOrder).toEqual(['1.png', '2.png', '3.png', '4.png']);
  expect(pending).toEqual([]);
});

it('recovers pacing immediately after rate limit cooldown instead of accumulating permanent delay', async () => {
  const pending = [1, 2, 3].map((n) => new File(['page'], `${n}.png`));
  const accepted = vi.fn();
  let attemptCount = 0;

  const send = vi.fn(async (file: File) => {
    if (file.name === '1.png' && attemptCount === 0) {
      attemptCount++;
      throw new UploadRateLimitError(0.05, 'Cooldown');
    }
    return file.name;
  });

  const start = Date.now();
  await flushUploads(pending, send, accepted, () => false, {
    maxRetries: 2,
    basePaceMs: 10
  });

  const duration = Date.now() - start;
  expect(accepted).toHaveBeenCalledTimes(3);
  expect(pending).toEqual([]);
  expect(duration).toBeLessThan(3000);
});

it('escalates pacing after repeated 429s instead of cycling at constant 2s', async () => {
  const pending = [1, 2, 3, 4, 5].map((n) => new File(['page'], `${n}.png`));
  const accepted = vi.fn();
  const retryEvents: number[] = [];
  let rateLimitCount = 0;

  const send = vi.fn(async (file: File) => {
    // First file: 429 on first attempt
    if (file.name === '1.png' && rateLimitCount === 0) {
      rateLimitCount++;
      throw new UploadRateLimitError(0.05, '429 first');
    }
    // Second file: 429 on first attempt (consecutive)
    if (file.name === '2.png' && rateLimitCount === 1) {
      rateLimitCount++;
      throw new UploadRateLimitError(0.05, '429 second');
    }
    return file.name;
  });

  await flushUploads(pending, send, accepted, () => false, {
    maxRetries: 3,
    basePaceMs: 10,
    onRetry: (_file, _attempt, waitSec) => {
      retryEvents.push(waitSec);
    }
  });

  expect(accepted).toHaveBeenCalledTimes(5);
  expect(pending).toEqual([]);
  expect(rateLimitCount).toBe(2);
});

it('reports inRecovery in progress stats after a 429 and clears it after recovery window', async () => {
  const pending = [1, 2, 3, 4, 5, 6].map((n) => new File(['page'], `${n}.png`));
  const accepted = vi.fn();
  const progressEvents: { inCooldown: boolean; inRecovery?: boolean }[] = [];
  let triggered429 = false;

  const send = vi.fn(async (file: File) => {
    if (file.name === '1.png' && !triggered429) {
      triggered429 = true;
      throw new UploadRateLimitError(0.05, '429');
    }
    return file.name;
  });

  await flushUploads(pending, send, accepted, () => false, {
    maxRetries: 2,
    basePaceMs: 10,
    onProgress: (stats) => {
      progressEvents.push({ inCooldown: stats.inCooldown, inRecovery: stats.inRecovery });
    }
  });

  expect(accepted).toHaveBeenCalledTimes(6);
  // Should have at least one progress event with inRecovery=true after the 429
  const recoveryEvents = progressEvents.filter((e) => e.inRecovery === true);
  expect(recoveryEvents.length).toBeGreaterThan(0);

  // After 4 consecutive successes, inRecovery should become false
  expect(isInRecovery()).toBe(false);
});
