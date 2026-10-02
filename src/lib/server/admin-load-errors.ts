import { error } from '@sveltejs/kit';

type DatabaseError = { code?: string | null; message?: string | null };
type DatabaseResult = { error?: DatabaseError | null };

function sanitizeDatabaseMessage(value: string | null | undefined) {
  return (value || 'Unknown database error')
    .replace(/\b(bearer|token|apikey|authorization|password|secret)\s*[:=]?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[redacted-jwt]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .slice(0, 500);
}

export function logAdminLoadError(
  event: string,
  failure: DatabaseError,
  context: { route: string; operation: string; requestId?: string | null }
) {
  console.error(event, {
    route: context.route,
    operation: context.operation,
    code: failure.code || 'UNKNOWN',
    message: sanitizeDatabaseMessage(failure.message),
    requestId: context.requestId || null
  });
}

/** Keeps database failures distinct from a genuinely absent administrative resource. */
export function throwOnAdminLoadError(
  result: unknown,
  context: { route: string; operation: string; requestId?: string | null }
) {
  const failure = (result as DatabaseResult | null | undefined)?.error;
  if (!failure) return;

  logAdminLoadError('admin_load_query_failed', failure, context);
  error(500, 'Não foi possível carregar os dados administrativos. Tente novamente.');
}
