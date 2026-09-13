import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processPendingEmailOutbox, reconcileUncertainEmailOutbox } from '$lib/server/notifications';

export const GET: RequestHandler = async ({ request, url }) => {
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;

  const [outboxResult, reconResult] = await Promise.all([
    processPendingEmailOutbox(limit, id),
    reconcileUncertainEmailOutbox(10).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 }))
  ]);

  return json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...outboxResult,
    reconciliation: reconResult
  });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const id = url.searchParams.get('id') || undefined;
  
  const [outboxResult, reconResult] = await Promise.all([
    processPendingEmailOutbox(limit, id),
    reconcileUncertainEmailOutbox(10).catch(() => ({ reconciled: 0, retried: 0, waiting: 0 }))
  ]);

  return json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...outboxResult,
    reconciliation: reconResult
  });
};
