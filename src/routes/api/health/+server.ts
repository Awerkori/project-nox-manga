import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withTimeout } from '$lib/server/resilience';

const startTime = Date.now();

export const GET: RequestHandler = async ({ locals, url }) => {
  const checkDb = url.searchParams.has('db');

  const baseResponse: Record<string, any> = {
    status: 'ok',
    worker: true,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  };

  if (!checkDb) {
    return json(baseResponse, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Project-Nox-Edge': 'healthy'
      }
    });
  }

  // Bounded DB probe with 1000ms strict timeout
  try {
    const probeRes = await withTimeout(
      locals.db.from('works').select('id').limit(1),
      1000,
      { data: null, error: { message: 'Database probe timeout (1000ms)' } } as any,
      'health_db_probe'
    );

    if (probeRes?.error) {
      return json(
        {
          ...baseResponse,
          status: 'degraded',
          db: {
            status: 'unreachable_or_degraded',
            error: probeRes.error.message
          }
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Project-Nox-Edge': 'healthy',
            'X-Project-Nox-DB': 'degraded'
          }
        }
      );
    }

    return json(
      {
        ...baseResponse,
        db: {
          status: 'ok'
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Project-Nox-Edge': 'healthy',
          'X-Project-Nox-DB': 'ok'
        }
      }
    );
  } catch (err: any) {
    return json(
      {
        ...baseResponse,
        status: 'degraded',
        db: {
          status: 'error',
          error: err?.message || String(err)
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Project-Nox-Edge': 'healthy',
          'X-Project-Nox-DB': 'error'
        }
      }
    );
  }
};
