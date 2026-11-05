import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { processPendingEmailOutbox, reconcileUncertainEmailOutbox } from '$lib/server/notifications';
import { dispatchStaleTaskReminders } from '$lib/server/pipeline-reminders';

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
  // 1. Allow native Cloudflare Worker scheduled invocation
  if (platform?.scheduledInvocation === true) {
    return;
  }

  // 2. Allow authenticated staff / admin users
  if (locals.user && ['ADMIN', 'STAFF_SITE', 'EDITOR'].includes(locals.role || '')) {
    return;
  }

  // 3. Allow internal requests authenticated by Bearer NOX_STORAGE_BRIDGE_TOKEN
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

async function handleProcessing(request: Request, url: URL, locals: App.Locals, platform?: App.Platform) {
  verifyAuthorization(request, locals, platform);

  const isPreview = (
    platform?.env?.PREVIEW_ISOLATED === 'true' ||
    platform?.env?.NOX_ENVIRONMENT === 'preview' ||
    env.PREVIEW_ISOLATED === 'true' ||
    env.NOX_ENVIRONMENT === 'preview'
  );

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;

  // In PREVIEW mode, do NOT send real emails to avoid alerting real members during testing
  const outboxPromise = isPreview
    ? Promise.resolve({ processed: 0, sent: 0, failed: 0, details: ['preview_isolated_mode_skipped_real_email'] })
    : processPendingEmailOutbox(limit, id, platform?.env).catch(() => ({ processed: 0, sent: 0, failed: 0, details: [] }));

  const reconPromise = isPreview
    ? Promise.resolve({ reconciled: 0, retried: 0, waiting: 0 })
    : reconcileUncertainEmailOutbox(10, platform?.env).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 }));

  const remindersPromise = isPreview
    ? Promise.resolve({ scanned: 0, reminded: 0, unassignedDueToRemoval: 0, dedupedOrSkipped: 0, details: [] })
    : dispatchStaleTaskReminders({ platform }).catch(() => ({ scanned: 0, reminded: 0, unassignedDueToRemoval: 0, dedupedOrSkipped: 0, details: [] }));

  const [outboxResult, reconResult, staleReminders] = await Promise.all([
    outboxPromise,
    reconPromise,
    remindersPromise
  ]);

  return json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: isPreview ? 'preview_isolated' : 'production',
    onlyTestChapters: isPreview,
    ...outboxResult,
    reconciliation: reconResult,
    staleReminders
  });
}

export const GET: RequestHandler = async ({ request, url, locals, platform }) => {
  return handleProcessing(request, url, locals, platform);
};

export const POST: RequestHandler = async ({ request, url, locals, platform }) => {
  return handleProcessing(request, url, locals, platform);
};
