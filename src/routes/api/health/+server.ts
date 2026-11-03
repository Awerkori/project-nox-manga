import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withTimeout } from '$lib/server/resilience';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const startTime = Date.now();

export const GET: RequestHandler = async ({ locals, url, platform }: any) => {
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

  // Bounded DB probe with 1000ms strict timeout against authoritative YugabyteDB
  try {
    const probeRes = await withTimeout(
      executeYugabyteSql('SELECT id FROM works LIMIT 1;', [], platform?.env),
      1000,
      null,
      'health_db_probe'
    );

    if (!probeRes || !probeRes.rows) {
      throw new Error('YugabyteDB probe timeout or unavailable');
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
