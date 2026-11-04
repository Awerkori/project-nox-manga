import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { processPendingEmailOutbox, reconcileUncertainEmailOutbox } from '$lib/server/notifications';
import { dispatchStaleTaskReminders } from '$lib/server/pipeline-reminders';
import { executeYugabyteSql } from '$lib/server/yugabyte';

function safeTokenCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function verifyAuthorization(request: Request, locals: App.Locals, platform?: any): void {
  // Allow Cloudflare Worker scheduled invocation
  if (platform?.scheduledInvocation === true) {
    return;
  }

  // Allow internal requests marked by worker-wrapper
  if (request.headers.get('x-internal-cron') === 'true') {
    return;
  }

  // Allow authenticated staff / admin users
  if (locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return;
  }

  // Allow internal requests authenticated by Bearer NOX_STORAGE_BRIDGE_TOKEN
  const expectedToken = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN;
  const authHeader = request.headers.get('authorization') || '';
  if (expectedToken && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (safeTokenCompare(token, expectedToken)) {
      return;
    }
  }

  // Reject unauthorized third-party requests
  error(401, 'Unauthorized');
}

export const GET: RequestHandler = async ({ request, url, locals, platform }) => {
  verifyAuthorization(request, locals, platform);

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;

  const [legacyOutbox, scanOutbox, legacyRecon, scanRecon, staleReminders, expiredStagesResult] = await Promise.all([
    processPendingEmailOutbox(limit, id, platform?.env).catch(() => ({ processed: 0, sent: 0, failed: 0, details: [] })),
    processPendingEmailOutbox(limit, id, platform?.env).catch(() => ({ processed: 0, sent: 0, failed: 0, details: [] })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    dispatchStaleTaskReminders({ platform }).catch(() => ({ scanned: 0, reminded: 0, unassignedDueToRemoval: 0, dedupedOrSkipped: 0, details: [] })),
    executeYugabyteSql<{ process_expired_scan_stages_ysql: any }>(
      'SELECT public.process_expired_scan_stages_ysql(NULL)',
      [],
      platform?.env
    ).then(r => r.rows?.[0]?.process_expired_scan_stages_ysql || { success: true, devolved_count: 0 })
     .catch(err => {
        console.error('[CRON_EXPIRED_STAGES_ERR]', err);
        return { success: false, error: String(err?.message || err) };
     })
  ]);
  const outboxResult = {
    processed: legacyOutbox.processed + scanOutbox.processed,
    sent: legacyOutbox.sent + scanOutbox.sent,
    failed: legacyOutbox.failed + scanOutbox.failed,
    details: [...legacyOutbox.details, ...scanOutbox.details]
  };
  const reconResult = {
    reconciled: legacyRecon.reconciled + scanRecon.reconciled,
    retried: legacyRecon.retried + scanRecon.retried,
    waiting: legacyRecon.waiting + scanRecon.waiting
  };

  return json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...outboxResult,
    reconciliation: reconResult,
    staleReminders,
    expiredStages: expiredStagesResult
  });
};

export const POST: RequestHandler = async ({ request, url, locals, platform }) => {
  verifyAuthorization(request, locals, platform);

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;
  
  const [legacyOutbox, scanOutbox, legacyRecon, scanRecon, staleReminders, expiredStagesResult] = await Promise.all([
    processPendingEmailOutbox(limit, id, platform?.env).catch(() => ({ processed: 0, sent: 0, failed: 0, details: [] })),
    processPendingEmailOutbox(limit, id, platform?.env).catch(() => ({ processed: 0, sent: 0, failed: 0, details: [] })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    dispatchStaleTaskReminders({ platform }).catch(() => ({ scanned: 0, reminded: 0, unassignedDueToRemoval: 0, dedupedOrSkipped: 0, details: [] })),
    executeYugabyteSql<{ process_expired_scan_stages_ysql: any }>(
      'SELECT public.process_expired_scan_stages_ysql(NULL)',
      [],
      platform?.env
    ).then(r => r.rows?.[0]?.process_expired_scan_stages_ysql || { success: true, devolved_count: 0 })
     .catch(err => {
        console.error('[CRON_EXPIRED_STAGES_ERR]', err);
        return { success: false, error: String(err?.message || err) };
     })
  ]);
  const outboxResult = {
    processed: legacyOutbox.processed + scanOutbox.processed,
    sent: legacyOutbox.sent + scanOutbox.sent,
    failed: legacyOutbox.failed + scanOutbox.failed,
    details: [...legacyOutbox.details, ...scanOutbox.details]
  };
  const reconResult = {
    reconciled: legacyRecon.reconciled + scanRecon.reconciled,
    retried: legacyRecon.retried + scanRecon.retried,
    waiting: legacyRecon.waiting + scanRecon.waiting
  };

  return json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...outboxResult,
    reconciliation: reconResult,
    staleReminders,
    expiredStages: expiredStagesResult
  });
};
