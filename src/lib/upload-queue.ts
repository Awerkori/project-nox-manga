/**
 * Resilient upload queue with adaptive pacing and retry-after support.
 *
 * Design principles:
 * - No hardcoded pacing intervals — adapts dynamically to server feedback
 * - 429 responses with Retry-After are honored exactly, then pace is reduced
 * - Non-429 errors get exponential backoff
 * - Already-acknowledged uploads are never resent (shift on success)
 * - On terminal error, the uncompleted file remains at pending[0] so resume works
 * - The queue can be paused and resumed without losing state
 */

export interface FlushOptions {
  /** Maximum retry attempts per page before giving up (default: 0). */
  maxRetries?: number;
  /** Called when a retry is about to happen, with the wait time in seconds. */
  onRetry?: (file: File, attempt: number, waitSeconds: number) => void;
}

export class UploadRateLimitError extends Error {
  constructor(
    readonly retryAfter: number,
    message = 'Rate limit temporário'
  ) {
    super(message);
  }
}

/** Minimum inter-request pacing in ms. Starts at 0 and increases after rate limits. */
let currentPaceMs = 0;

/** Reduce pacing after a period of successful uploads. */
function onSuccess() {
  if (currentPaceMs > 0) currentPaceMs = Math.max(0, Math.floor(currentPaceMs * 0.7));
}

/** Increase pacing after a rate-limit event. */
function onRateLimit(retryAfterMs: number) {
  currentPaceMs = Math.max(500, Math.ceil(retryAfterMs * 0.25));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Remove only acknowledged uploads, so retries never resend completed pages. */
export async function flushUploads<T>(
  pending: File[],
  send: (file: File) => Promise<T>,
  accepted: (result: T, file: File) => void,
  paused: () => boolean = () => false,
  options: FlushOptions = {}
) {
  const { maxRetries = 0, onRetry } = options;

  while (pending.length && !paused()) {
    const file = pending[0];

    // Apply adaptive pacing between requests
    if (currentPaceMs > 0) await sleep(currentPaceMs);

    let attempt = 0;

    while (true) {
      try {
        const result = await send(file);
        pending.shift();
        accepted(result, file);
        onSuccess();
        break;
      } catch (err) {
        attempt++;

        if (attempt > maxRetries) {
          throw err;
        }

        if (err instanceof UploadRateLimitError) {
          const waitMs = err.retryAfter * 1000;
          onRateLimit(waitMs);
          onRetry?.(file, attempt, err.retryAfter);
          await sleep(waitMs);
        } else {
          const backoffMs = Math.min(30_000, 1000 * Math.pow(2, attempt - 1));
          onRetry?.(file, attempt, Math.ceil(backoffMs / 1000));
          await sleep(backoffMs);
        }

        if (paused()) return;
      }
    }
  }
}
