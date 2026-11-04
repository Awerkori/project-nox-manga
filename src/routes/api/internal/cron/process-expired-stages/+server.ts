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

async function handleDevolution(request: Request, locals: App.Locals, platform?: App.Platform) {
  verifyAuthorization(request, locals, platform);

  const isPreview = (
    platform?.env?.PREVIEW_ISOLATED === 'true' ||
    platform?.env?.NOX_ENVIRONMENT === 'preview' ||
    env.PREVIEW_ISOLATED === 'true' ||
    env.NOX_ENVIRONMENT === 'preview'
  );

  try {
    const queryRes = await executeYugabyteSql<{ process_expired_scan_stages_ysql: any }>(
      'SELECT public.process_expired_scan_stages_ysql(NULL, $1)',
      [isPreview],
      platform?.env
    );
    const devolution = queryRes.rows?.[0]?.process_expired_scan_stages_ysql || { success: true, devolved_count: 0 };
    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      environment: isPreview ? 'preview_isolated' : 'production',
      onlyTestChapters: isPreview,
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
}

export const GET: RequestHandler = async ({ request, locals, platform }) => {
  return handleDevolution(request, locals, platform);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  return handleDevolution(request, locals, platform);
};
