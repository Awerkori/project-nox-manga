import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
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
  // 1. Allow native Cloudflare Worker scheduled invocation
  if (platform?.scheduledInvocation === true) {
    return;
  }

  // 2. Allow internal requests authenticated by Bearer token
  const expectedToken = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN || platform?.env?.INTERNAL_CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (expectedToken && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (safeTokenCompare(token, expectedToken)) {
      return;
    }
  }

  // 3. For manual triggers: ONLY global ADMIN allowed
  if (locals.user && locals.role === 'ADMIN') {
    return;
  }

  error(401, 'Unauthorized');
}

function resolveIsolationMode(platform?: App.Platform): boolean {
  const noxEnv = platform?.env?.NOX_ENVIRONMENT || env.NOX_ENVIRONMENT;
  const previewIsolated = platform?.env?.PREVIEW_ISOLATED || env.PREVIEW_ISOLATED;

  if (noxEnv === 'production' && previewIsolated !== 'true') {
    return false;
  }
  return true; // Preview, test, or unverified environment defaults to isolated mode
}

export const GET: RequestHandler = async ({ request, locals, platform }) => {
  verifyAuthorization(request, locals, platform);
  const onlyTestChapters = resolveIsolationMode(platform);

  return json({
    ok: true,
    method: 'GET',
    readOnly: true,
    timestamp: new Date().toISOString(),
    environment: onlyTestChapters ? 'preview_isolated' : 'production',
    onlyTestChapters,
    message: 'Deadline warnings endpoint healthy. Dispatch requires POST.'
  });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  verifyAuthorization(request, locals, platform);
  const onlyTestChapters = resolveIsolationMode(platform);

  try {
    const queryRes = await executeYugabyteSql<{ check_and_send_deadline_warnings_ysql: number }>(
      'SELECT public.check_and_send_deadline_warnings_ysql(NULL, $1)',
      [onlyTestChapters],
      platform?.env
    );
    const warningsSent = queryRes.rows?.[0]?.check_and_send_deadline_warnings_ysql || 0;
    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      environment: onlyTestChapters ? 'preview_isolated' : 'production',
      onlyTestChapters,
      warningsSent
    });
  } catch (err: any) {
    console.error('[CRON_DEADLINE_WARNINGS_ERR]', err);
    return json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: String(err?.message || err)
    }, { status: 500 });
  }
};
