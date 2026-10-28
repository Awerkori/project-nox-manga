import { processPendingEmailOutbox, reconcileUncertainEmailOutbox } from './notifications';
import { dispatchStaleTaskReminders } from './pipeline-reminders';

/** One bounded scheduled invocation must never claim more than this many emails. */
export const SCHEDULED_EMAIL_OUTBOX_LIMIT = 25;
export const SCHEDULED_EMAIL_RECONCILIATION_LIMIT = 10;

const EMPTY_RECONCILIATION = { reconciled: 0, retried: 0, waiting: 0 };

type EmailOutboxRunOptions = {
  limit?: number;
  id?: string;
  reconciliationLimit?: number;
};

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type SafeLogger = {
  error(...args: unknown[]): void;
};

function clampPositiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value as number) : fallback;
  return Math.min(maximum, Math.max(1, parsed));
}

/**
 * Shared outbox round used by the authenticated HTTP endpoint and by the
 * Worker cron. The business rules remain in notifications.ts; this module
 * owns only the bounded orchestration of those two existing operations.
 */
export async function runEmailOutboxProcessing({
  limit = SCHEDULED_EMAIL_OUTBOX_LIMIT,
  id,
  reconciliationLimit = SCHEDULED_EMAIL_RECONCILIATION_LIMIT
}: EmailOutboxRunOptions = {}) {
  const boundedLimit = clampPositiveInteger(limit, SCHEDULED_EMAIL_OUTBOX_LIMIT, 50);
  const boundedReconciliationLimit = clampPositiveInteger(
    reconciliationLimit,
    SCHEDULED_EMAIL_RECONCILIATION_LIMIT,
    SCHEDULED_EMAIL_RECONCILIATION_LIMIT
  );

  const [outboxResult, reconciliation] = await Promise.all([
    processPendingEmailOutbox(boundedLimit, id),
    reconcileUncertainEmailOutbox(boundedReconciliationLimit).catch((error) => {
      console.error('[EMAIL_OUTBOX_RECONCILE_ERROR]', error);
      return EMPTY_RECONCILIATION;
    }),
    dispatchStaleTaskReminders().catch((error) => {
      console.error('[STALE_REMINDER_CRON_ERROR]', error);
      return { scanned: 0, reminded: 0, unassignedDueToRemoval: 0, dedupedOrSkipped: 0, details: [] };
    })
  ]);

  return { ...outboxResult, reconciliation };
}

/** The cron has a deliberately fixed, bounded batch size. */
export function runScheduledEmailOutboxProcessing() {
  return runEmailOutboxProcessing({
    limit: SCHEDULED_EMAIL_OUTBOX_LIMIT,
    reconciliationLimit: SCHEDULED_EMAIL_RECONCILIATION_LIMIT
  });
}

/**
 * Registers a contained background task for a scheduled event. A rejection
 * is observed here so a failed email round cannot become an unhandled Worker
 * exception or affect a subsequent fetch event in the same isolate.
 */
export function scheduleEmailOutboxProcessing(
  ctx: WaitUntilContext,
  run: () => Promise<unknown> = runScheduledEmailOutboxProcessing,
  logger: SafeLogger = console
): Promise<void> {
  const task = Promise.resolve()
    .then(run)
    .then(() => undefined)
    .catch((error) => {
      try {
        logger.error('[CRON_EMAIL_PROCESSOR_ERROR]', error);
      } catch {
        // Logging must not turn a contained cron failure into a rejection.
      }
    });

  ctx.waitUntil(task);
  return task;
}
