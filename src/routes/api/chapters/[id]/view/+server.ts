import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { executeYugabyteSql } from '$lib/server/yugabyte';

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

  let yugabyteCounted = false;
  let workViewsTotal = 0;
  let chapterViewsTotal = 0;

  // 1. Authoritative recording in YugabyteDB (Directly feeds "Mais Lidos", Works, and Chapters)
  try {
    await ensureYugabyteViewsTable(platform?.env);

    // Resolve chapter & work from Yugabyte
    const chapRes = await executeYugabyteSql<{ id: string; work_id: string; views_total: number }>(
      `SELECT id, work_id, views_total FROM public.chapters WHERE id = $1 LIMIT 1;`,
      [chapterId],
      platform?.env
    );

    if (chapRes.rows.length > 0) {
      const chap = chapRes.rows[0];
      const workId = chap.work_id;

      // Anti-inflation: 30-minute deduplication window
      const dedupeSql = userId
        ? `SELECT EXISTS(
             SELECT 1 FROM public.chapter_views
             WHERE chapter_id = $1 AND user_id = $2 AND viewed_at > now() - interval '30 minutes'
           ) AS recent;`
        : `SELECT EXISTS(
             SELECT 1 FROM public.chapter_views
             WHERE chapter_id = $1 AND anonymous_hash = $2 AND viewed_at > now() - interval '30 minutes'
           ) AS recent;`;

      const dedupeRes = await executeYugabyteSql<{ recent: boolean }>(
        dedupeSql,
        [chapterId, userId || anonHash],
        platform?.env
      );

      const isRecent = dedupeRes.rows[0]?.recent;

      if (!isRecent) {
        // Insert view record
        await executeYugabyteSql(
          `INSERT INTO public.chapter_views (chapter_id, work_id, user_id, anonymous_hash, origin, viewed_at)
           VALUES ($1, $2, $3, $4, 'WEB', now());`,
          [chapterId, workId, userId || null, anonHash],
          platform?.env
        );

        // Atomically increment chapter views
        const upChap = await executeYugabyteSql<{ views_total: number }>(
          `UPDATE public.chapters
           SET views_total = views_total + 1
           WHERE id = $1
           RETURNING views_total;`,
          [chapterId],
          platform?.env
        );
        chapterViewsTotal = upChap.rows[0]?.views_total || 0;

        // Atomically increment work views (feeds "Mais Lidos")
        const upWork = await executeYugabyteSql<{ views_total: number }>(
          `UPDATE public.works
           SET views_total = views_total + 1
           WHERE id = $1
           RETURNING views_total;`,
          [workId],
          platform?.env
        );
        workViewsTotal = upWork.rows[0]?.views_total || 0;

        yugabyteCounted = true;
      }
    }
  } catch (err: any) {
    console.warn('[VIEW_YUGABYTE_RECORD_ERROR]', err?.message || err);
  }

  // 2. Synchronize with Supabase in background
  try {
    const db = privileged();
    await db.rpc('record_chapter_view', {
      p_chapter_id: chapterId,
      p_user_id: userId ?? undefined,
      p_anon_hash: anonHash ?? undefined,
      p_origin: 'WEB'
    });
  } catch (sbErr: any) {
    // Non-blocking
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
