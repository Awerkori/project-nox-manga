/**
 * Resilient upload queue with AIMD adaptive pacing, bounded concurrency, and retry-after cooldown recovery.
 *
 * Design principles:
 * - Cooldown from 429 Retry-After is strictly observed.
 * - After cooldown, pacing resumes at a CONSERVATIVELY slower rate, then ramps up gradually (AIMD).
 * - Repeated 429s escalate cooldown duration proportionally and deepen the rate reduction.
 * - Concurrency drops to 1 during recovery to avoid simultaneous re-triggers.
 * - After a sustained healthy window (4 successful uploads), concurrency and pacing restore to baseline.
 */

export interface ProgressStats {
  completed: number;
  total: number;
  speedMBs: number;
  inCooldown: boolean;
  cooldownSecondsRemaining?: number;
  /** True when operating at reduced speed after a rate limit recovery */
  inRecovery?: boolean;
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

// ── Adaptive pacing state (module-level, shared across calls within the same session) ──

let rateLimitCooldownUntil = 0;
let lastRateLimitTime = 0;

/** How many consecutive 429s have occurred without a full recovery in between */
let consecutive429Count = 0;

/** Current effective pacing interval (increases after 429, gradually decreases on success) */
let currentPaceMs = 0;

/** How many successful uploads since the last 429 */
let successesSinceLastThrottle = 0;

/** Effective concurrency override (0 = use options.concurrency) */
let concurrencyOverride = 0;

const RECOVERY_WINDOW = 4; // uploads of sustained success before restoring full concurrency
const MAX_PACE_MULTIPLIER = 8; // max pacing slowdown factor

/** Full reset of all module-level adaptive state. For testing only. */
export function _resetAdaptiveStateForTesting(): void {
  rateLimitCooldownUntil = 0;
  lastRateLimitTime = 0;
  consecutive429Count = 0;
  currentPaceMs = 0;
  successesSinceLastThrottle = 0;
  concurrencyOverride = 0;
}

function recordRateLimit(retryAfterSec: number, basePaceMs: number): void {
  const now = Date.now();

  // If previous 429 was recent (< 30s), escalate; otherwise start new streak
  if (now - lastRateLimitTime < 30_000) {
    consecutive429Count++;
  } else {
    consecutive429Count = 1;
  }
  lastRateLimitTime = now;

  // Escalate cooldown duration proportionally to retryAfterSec
  const escalationMultiplier = Math.pow(1.5, Math.min(consecutive429Count - 1, 3));
  const effectiveCooldownMs = Math.max(Math.round(retryAfterSec * 1000 * escalationMultiplier), 20);
  rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, now + effectiveCooldownMs);

  // Multiplicative increase in pacing: double base pace on first 429, escalate if repeated
  const effectiveBase = basePaceMs || 250;
  const paceMultiplier = Math.min(MAX_PACE_MULTIPLIER, Math.pow(2, consecutive429Count));
  currentPaceMs = Math.min(2500, effectiveBase * paceMultiplier);

  // Drop concurrency to 1 during recovery to prevent parallel re-triggers
  concurrencyOverride = 1;
  successesSinceLastThrottle = 0;
}

function recordSuccess(basePaceMs: number): void {
  successesSinceLastThrottle++;
  const effectiveBase = basePaceMs || 250;

  // Additive decrease: gradually ease pacing back toward basePaceMs
  if (currentPaceMs > effectiveBase) {
    currentPaceMs = Math.max(effectiveBase, Math.round(currentPaceMs * 0.8));
  } else {
    currentPaceMs = 0;
  }

  // Restore concurrency and clear streak after sustained healthy recovery window
  if (successesSinceLastThrottle >= RECOVERY_WINDOW) {
    concurrencyOverride = 0;
    currentPaceMs = 0;
    consecutive429Count = 0;
  }
}

function getEffectivePace(basePaceMs: number): number {
  return currentPaceMs > 0 ? currentPaceMs : basePaceMs;
}

function getEffectiveConcurrency(requestedConcurrency: number): number {
  return concurrencyOverride > 0 ? Math.min(concurrencyOverride, requestedConcurrency) : requestedConcurrency;
}

export function isInRecovery(): boolean {
  return currentPaceMs > 0 || concurrencyOverride > 0;
}

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
    const sleepChunk = Math.min(1000, Math.max(50, rateLimitCooldownUntil - Date.now()));
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
      cooldownSecondsRemaining: cooldownSec > 0 ? cooldownSec : undefined,
      inRecovery: isInRecovery()
    });
  };

  if (concurrency <= 1) {
    while (pending.length && !paused()) {
      await waitForCooldown(onRetry, pending[0]);

      // Apply adaptive pacing between sequential requests
      const pace = getEffectivePace(basePaceMs);
      if (completedCount > 0 && pace > 0) {
        await sleep(pace);
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
          recordSuccess(basePaceMs);
          emitProgress();
          break;
        } catch (err) {
          attempt++;
          if (attempt > maxRetries) {
            throw err;
          }

          if (err instanceof UploadRateLimitError) {
            recordRateLimit(err.retryAfter, basePaceMs);
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
  let inFlight = 0;

  async function worker() {
    while (nextQueueIdx < initialFiles.length && !paused() && !abortError) {
      await waitForCooldown(onRetry, initialFiles[nextQueueIdx]);
      if (paused() || abortError) return;

      // Dynamic concurrency gate: if under rate-limit recovery, drop active concurrent workers to 1
      while (inFlight >= getEffectiveConcurrency(concurrency) && !paused() && !abortError) {
        await sleep(20);
      }
      if (paused() || abortError || nextQueueIdx >= initialFiles.length) return;

      inFlight++;
      const myIdx = nextQueueIdx++;
      const file = initialFiles[myIdx];
      let attempt = 0;

      try {
        while (true) {
          try {
            const pace = getEffectivePace(basePaceMs);
            if (pace > 0 && myIdx > 0) {
              await sleep(pace);
            }
            if (paused() || abortError) return;

            const result = await send(file);
            totalBytesUploaded += file.size;
            completedCount++;
            completedResults.set(myIdx, { result, file });
            recordSuccess(basePaceMs);

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
              recordRateLimit(err.retryAfter, basePaceMs);
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
      } finally {
        inFlight--;
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
