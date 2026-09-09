/**
 * Resilient upload queue with adaptive pacing, bounded concurrency, and retry-after cooldown recovery.
 *
 * Design principles:
 * - Cooldown from 429 Retry-After is strictly observed, but pacing returns to normal (250ms) immediately after expiry.
 * - Concurrency defaults to 1 (backward-compatible, deterministic FIFO) and supports bounded concurrency (e.g. 2) with in-order completion buffering.
 * - Real-time progress metrics: speed tracking (MB/s), cooldown countdowns, and completion percentages.
 */

export interface ProgressStats {
  completed: number;
  total: number;
  speedMBs: number;
  inCooldown: boolean;
  cooldownSecondsRemaining?: number;
}

export interface FlushOptions {
  /** Maximum retry attempts per page before giving up (default: 0). */
  maxRetries?: number;
  /** Bounded concurrency limit (default: 1). */
  concurrency?: number;
  /** Base pace between uploads in ms (default: 250). */
  basePaceMs?: number;
  /** Called when a retry is about to happen, with the wait time in seconds. */
  onRetry?: (file: File, attempt: number, waitSeconds: number) => void;
  /** Real-time progress update callback */
  onProgress?: (stats: ProgressStats) => void;
}

export class UploadRateLimitError extends Error {
  constructor(
    readonly retryAfter: number,
    message = 'Rate limit temporário'
  ) {
    super(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let rateLimitCooldownUntil = 0;

/** Check if currently under rate limit cooldown and sleep until expired */
async function waitForCooldown(
  onRetry?: (file: File, attempt: number, waitSeconds: number) => void,
  currentFile?: File
): Promise<void> {
  while (Date.now() < rateLimitCooldownUntil) {
    const remainingSec = Math.ceil((rateLimitCooldownUntil - Date.now()) / 1000);
    if (remainingSec > 0 && currentFile && onRetry) {
      onRetry(currentFile, 1, remainingSec);
    }
    const sleepChunk = Math.min(1000, Math.max(100, rateLimitCooldownUntil - Date.now()));
    await sleep(sleepChunk);
  }
}

/** Remove only acknowledged uploads, so retries never resend completed pages. */
export async function flushUploads<T>(
  pending: File[],
  send: (file: File) => Promise<T>,
  accepted: (result: T, file: File) => void,
  paused: () => boolean = () => false,
  options: FlushOptions = {}
) {
  const { maxRetries = 0, onRetry, onProgress, concurrency = 1, basePaceMs = 250 } = options;

  let totalBytesUploaded = 0;
  const startTime = Date.now();
  const totalFiles = pending.length;
  let completedCount = 0;

  const emitProgress = (inCooldown = false, cooldownSec = 0) => {
    if (!onProgress) return;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const speedMBs =
      elapsedSec > 0 ? Number(((totalBytesUploaded / (1024 * 1024)) / elapsedSec).toFixed(2)) : 0;
    onProgress({
      completed: completedCount,
      total: totalFiles,
      speedMBs,
      inCooldown,
      cooldownSecondsRemaining: cooldownSec > 0 ? cooldownSec : undefined
    });
  };

  if (concurrency <= 1) {
    while (pending.length && !paused()) {
      await waitForCooldown(onRetry, pending[0]);

      // Apply standard base pacing between sequential requests (e.g. 250ms)
      if (completedCount > 0 && basePaceMs > 0) {
        await sleep(basePaceMs);
      }

      if (paused()) return;
      const file = pending[0];
      let attempt = 0;

      while (true) {
        try {
          const result = await send(file);
          totalBytesUploaded += file.size;
          completedCount++;
          pending.shift();
          accepted(result, file);
          emitProgress();
          break;
        } catch (err) {
          attempt++;
          if (attempt > maxRetries) {
            throw err;
          }

          if (err instanceof UploadRateLimitError) {
            rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, Date.now() + err.retryAfter * 1000);
            onRetry?.(file, attempt, err.retryAfter);
            emitProgress(true, err.retryAfter);
            await waitForCooldown(onRetry, file);
          } else {
            const backoffMs = Math.min(30_000, 1000 * Math.pow(2, attempt - 1));
            onRetry?.(file, attempt, Math.ceil(backoffMs / 1000));
            await sleep(backoffMs);
          }

          if (paused()) return;
        }
      }
    }
    return;
  }

  // Concurrency > 1: Bounded pipeline with FIFO completion preservation
  let nextQueueIdx = 0;
  let nextDeliverIdx = 0;
  const initialFiles = [...pending];
  const completedResults = new Map<number, { result: T; file: File }>();
  let abortError: any = null;

  async function worker() {
    while (nextQueueIdx < initialFiles.length && !paused() && !abortError) {
      await waitForCooldown(onRetry, initialFiles[nextQueueIdx]);
      if (paused() || abortError) return;

      const myIdx = nextQueueIdx++;
      const file = initialFiles[myIdx];
      let attempt = 0;

      while (true) {
        try {
          if (basePaceMs > 0 && myIdx > 0) {
            await sleep(basePaceMs);
          }
          if (paused() || abortError) return;

          const result = await send(file);
          totalBytesUploaded += file.size;
          completedCount++;
          completedResults.set(myIdx, { result, file });

          // Flush in-order delivered items
          while (completedResults.has(nextDeliverIdx)) {
            const item = completedResults.get(nextDeliverIdx)!;
            completedResults.delete(nextDeliverIdx);
            nextDeliverIdx++;
            const frontIndex = pending.indexOf(item.file);
            if (frontIndex !== -1) {
              pending.splice(frontIndex, 1);
            }
            accepted(item.result, item.file);
            emitProgress();
          }

          break;
        } catch (err) {
          attempt++;
          if (attempt > maxRetries) {
            abortError = err;
            throw err;
          }

          if (err instanceof UploadRateLimitError) {
            rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, Date.now() + err.retryAfter * 1000);
            onRetry?.(file, attempt, err.retryAfter);
            emitProgress(true, err.retryAfter);
            await waitForCooldown(onRetry, file);
          } else {
            const backoffMs = Math.min(30_000, 1000 * Math.pow(2, attempt - 1));
            onRetry?.(file, attempt, Math.ceil(backoffMs / 1000));
            await sleep(backoffMs);
          }

          if (paused() || abortError) return;
        }
      }
    }
  }

  const workerPromises = Array.from(
    { length: Math.min(concurrency, pending.length) },
    () => worker()
  );
  await Promise.all(workerPromises);

  if (abortError) {
    throw abortError;
  }
}
