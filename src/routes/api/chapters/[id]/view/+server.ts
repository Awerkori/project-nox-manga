import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { executeYugabyteSql, withYugabyteReadSession } from '$lib/server/yugabyte';

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const VIEW_DEDUPE_TTL_MS = 30 * 60 * 1000;
const VIEW_DEDUPE_MAX = 2000;
const recentViewDedupe = new Map<string, number>();

let yugabyteTableEnsured = false;
async function ensureYugabyteViewsTable(platformEnv?: any) {
  if (yugabyteTableEnsured) return;
  try {
    await executeYugabyteSql(
      `CREATE TABLE IF NOT EXISTS public.chapter_views (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id uuid NOT NULL,
        work_id uuid NOT NULL,
        user_id uuid,
        anonymous_hash text,
        origin text NOT NULL DEFAULT 'WEB',
        viewed_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chapter_views_chap_user ON public.chapter_views(chapter_id, user_id, viewed_at);
      CREATE INDEX IF NOT EXISTS idx_chapter_views_chap_anon ON public.chapter_views(chapter_id, anonymous_hash, viewed_at);`,
      [],
      platformEnv
    );
    yugabyteTableEnsured = true;
  } catch (err: any) {
    console.warn('[YUGABYTE_VIEWS_TABLE_ENSURE]', err?.message || err);
  }
}

export const POST = async ({ params, locals, request, getClientAddress, platform }: any) => {
  const chapterId = params.id;
  if (!chapterId) {
    return json({ counted: false, error: 'Capítulo não informado' }, { status: 400 });
  }

  const userId = locals.user?.id || null;
  let anonHash: string | null = null;

  if (!userId) {
    try {
      const cookieHeader = request.headers.get('cookie') || '';
      const vidMatch = cookieHeader.match(/(?:^|;\s*)nox-vid=([^;]+)/);
      const visitorId = vidMatch ? vidMatch[1] : '';
      const ip = getClientAddress() || '';
      const ua = request.headers.get('user-agent') || '';
      anonHash = await hashString(`${visitorId || ip}-${ua}`);
    } catch {
      anonHash = 'anonymous-visitor';
    }
  }

  const dedupeKey = `${chapterId}:${userId || anonHash || 'anon'}`;
  const isTestEnv = typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test');
  if (!isTestEnv) {
    const prevAt = recentViewDedupe.get(dedupeKey);
    if (prevAt && Date.now() - prevAt < VIEW_DEDUPE_TTL_MS) {
      return json({
        counted: false,
        reason: 'deduplicated'
      });
    }
  }

  let yugabyteCounted = false;
  let workViewsTotal = 0;
  let chapterViewsTotal = 0;

  // 1. Authoritative recording in YugabyteDB in a SINGLE atomic CTE statement (1 round-trip instead of 5)
  try {
    const runSingleRoundTrip = async (sessionEnv: any) =>
      executeYugabyteSql<{
        chapter_id: string | null;
        recent: boolean | null;
        chapter_views_total: number | null;
        work_views_total: number | null;
      }>(
        `WITH chap AS (
           SELECT id, work_id, views_total
           FROM public.chapters
           WHERE id = $1
           LIMIT 1
         ),
         dedupe AS (
           SELECT EXISTS(
             SELECT 1 FROM public.chapter_views
             WHERE chapter_id = $1
               AND (
                 ($2::uuid IS NOT NULL AND user_id = $2::uuid)
                 OR ($2::uuid IS NULL AND anonymous_hash = $3::text)
               )
               AND viewed_at > now() - interval '30 minutes'
           ) AS recent
         ),
         ins AS (
           INSERT INTO public.chapter_views (chapter_id, work_id, user_id, anonymous_hash, origin, viewed_at)
           SELECT chap.id, chap.work_id, $2::uuid, $3::text, 'WEB', now()
           FROM chap, dedupe
           WHERE NOT dedupe.recent
           RETURNING chapter_id, work_id
         ),
         up_chap AS (
           UPDATE public.chapters c
           SET views_total = c.views_total + 1
           FROM ins
           WHERE c.id = ins.chapter_id
           RETURNING c.views_total
         ),
         up_work AS (
           UPDATE public.works w
           SET views_total = w.views_total + 1
           FROM ins
           WHERE w.id = ins.work_id
           RETURNING w.views_total
         )
         SELECT
           (SELECT id FROM chap) AS chapter_id,
           (SELECT recent FROM dedupe) AS recent,
           (SELECT views_total FROM up_chap) AS chapter_views_total,
           (SELECT views_total FROM up_work) AS work_views_total;`,
        [chapterId, userId || null, anonHash],
        sessionEnv
      );

    const res = await withYugabyteReadSession(
      platform?.env,
      async (sessionEnv) => {
        try {
          return await runSingleRoundTrip(sessionEnv);
        } catch (err: any) {
          if (err?.code === '42P01') {
            await ensureYugabyteViewsTable(sessionEnv);
            return await runSingleRoundTrip(sessionEnv);
          }
          throw err;
        }
      },
      1
    );

    const row = res.rows[0];
    if (row?.chapter_id) {
      if (!isTestEnv) {
        if (recentViewDedupe.size >= VIEW_DEDUPE_MAX) {
          const oldest = recentViewDedupe.keys().next().value;
          if (oldest) recentViewDedupe.delete(oldest);
        }
        recentViewDedupe.set(dedupeKey, Date.now());
      }
      if (!row.recent && row.chapter_views_total !== null) {
        chapterViewsTotal = Number(row.chapter_views_total || 0);
        workViewsTotal = Number(row.work_views_total || 0);
        yugabyteCounted = true;
      }
    }
  } catch (err: any) {
    console.warn('[VIEW_YUGABYTE_RECORD_ERROR]', err?.message || err);
  }

  // 2. Synchronize with Supabase in background only when counted
  if (yugabyteCounted) {
    const syncPromise = (async () => {
      try {
        const db = privileged();
        await db.rpc('record_chapter_view', {
          p_chapter_id: chapterId,
          p_user_id: userId ?? undefined,
          p_anon_hash: anonHash ?? undefined,
          p_origin: 'WEB'
        });
      } catch {
        // Non-blocking
      }
    })();
    if (platform?.context?.waitUntil) {
      platform.context.waitUntil(syncPromise);
    }
  }

  if (yugabyteCounted) {
    return json({
      counted: true,
      work_views: workViewsTotal,
      chapter_views: chapterViewsTotal
    });
  }

  return json({
    counted: false,
    reason: 'deduplicated'
  });
};
