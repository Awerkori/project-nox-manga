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

  // 2. Allow internal requests authenticated by Bearer token (NOX_STORAGE_BRIDGE_TOKEN or INTERNAL_CRON_SECRET)
  const expectedToken = platform?.env?.NOX_STORAGE_BRIDGE_TOKEN || env.NOX_STORAGE_BRIDGE_TOKEN || platform?.env?.INTERNAL_CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (expectedToken && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (safeTokenCompare(token, expectedToken)) {
      return;
    }
  }

  // 3. For manual triggers: ONLY global ADMIN allowed (least privilege — common staff cannot mutate global queues)
  if (locals.user && locals.role === 'ADMIN') {
    return;
  }

  // Reject unauthorized third-party or common staff requests
  error(401, 'Unauthorized');
}

function resolveIsolationMode(platform?: App.Platform): boolean {
  // Fail-safe default: Any environment that is not explicitly confirmed as production runs in isolated test mode
  const noxEnv = platform?.env?.NOX_ENVIRONMENT || env.NOX_ENVIRONMENT;
  const previewIsolated = platform?.env?.PREVIEW_ISOLATED || env.PREVIEW_ISOLATED;

  if (noxEnv === 'production' && previewIsolated !== 'true') {
    return false; // Real production execution
  }
  return true; // Preview, test, or unverified environment defaults to isolated mode
}

export const GET: RequestHandler = async ({ request, locals, platform }) => {
  verifyAuthorization(request, locals, platform);
  const onlyTestChapters = resolveIsolationMode(platform);

  // GET is strictly read-only audit / health inspection
  return json({
    ok: true,
    method: 'GET',
    readOnly: true,
    timestamp: new Date().toISOString(),
    environment: onlyTestChapters ? 'preview_isolated' : 'production',
    onlyTestChapters,
    message: 'Cron endpoint healthy. Mutative devolution requires POST.'
  });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  verifyAuthorization(request, locals, platform);
  const onlyTestChapters = resolveIsolationMode(platform);

  try {
    const queryRes = await executeYugabyteSql<{ process_expired_scan_stages_ysql: any }>(
      'SELECT public.process_expired_scan_stages_ysql(NULL, $1)',
      [onlyTestChapters],
      platform?.env
    );
    const devolution = queryRes.rows?.[0]?.process_expired_scan_stages_ysql || { success: true, devolved_count: 0 };
    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      environment: onlyTestChapters ? 'preview_isolated' : 'production',
      onlyTestChapters,
      devolution
    });
  } catch (err: any) {
    console.error('[CRON_PROCESS_EXPIRED_STAGES_ERR]', err);
    return json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: String(err?.message || err)
    }, { status: 500 });
  }
};
