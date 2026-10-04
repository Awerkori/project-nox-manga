import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { processPendingEmailOutbox, reconcileUncertainEmailOutbox } from '$lib/server/notifications';

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

function verifyAuthorization(request: Request, locals: App.Locals, platformEnv?: any): void {
  // Allow authenticated staff / admin users
  if (locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return;
  }

  // Allow internal requests authenticated by Bearer NOX_STORAGE_BRIDGE_TOKEN
  const expectedToken = platformEnv?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN;
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
  verifyAuthorization(request, locals, platform?.env);

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;

  const [legacyOutbox, scanOutbox, legacyRecon, scanRecon] = await Promise.all([
    processPendingEmailOutbox(limit, id),
    processPendingEmailOutbox(limit, id, platform?.env),
    reconcileUncertainEmailOutbox(10).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 }))
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
    reconciliation: reconResult
  });
};

export const POST: RequestHandler = async ({ request, url, locals, platform }) => {
  verifyAuthorization(request, locals, platform?.env);

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;
  
  const [legacyOutbox, scanOutbox, legacyRecon, scanRecon] = await Promise.all([
    processPendingEmailOutbox(limit, id),
    processPendingEmailOutbox(limit, id, platform?.env),
    reconcileUncertainEmailOutbox(10).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 })),
    reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 }))
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
    reconciliation: reconResult
  });
};
