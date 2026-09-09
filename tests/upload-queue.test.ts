import { expect, it, vi } from 'vitest';
import { flushUploads, UploadRateLimitError } from '../src/lib/upload-queue';

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
  expect(duration).toBeLessThan(1500);
});
