import { expect, it, vi } from 'vitest';
import { flushUploads } from '../src/lib/upload-queue';

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
