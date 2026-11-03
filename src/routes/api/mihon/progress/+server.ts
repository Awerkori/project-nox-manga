import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyMihonAuth } from '$lib/server/mihon';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const progressSchema = z.object({
  chapter_id: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  completed: z.boolean().default(false)
});

export const POST = async ({ request, platform }) => {
  const auth = await verifyMihonAuth(request, platform?.env);
  if (!auth.authenticated || !auth.user) {
    return json(
      { error: 'Autenticação necessária para sincronizar progresso.' },
      { status: 401 }
    );
  }

  let body;
  try {
    const raw = await request.json();
    body = progressSchema.parse(raw);
  } catch (err) {
    return json({ error: 'Dados de progresso inválidos.' }, { status: 400 });
  }

  const userId = auth.user.id;

  // 1. Verify chapter exists
  const chRes = await executeYugabyteSql(
    `SELECT id, work_id, number FROM public.chapters WHERE id = $1 LIMIT 1;`,
    [body.chapter_id],
    platform?.env
  );
  const chapter = chRes.rows[0];

  if (!chapter) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  // 2. Upsert reading_sessions for anti-cheat tracking
  await executeYugabyteSql(
    `INSERT INTO public.reading_sessions (user_id, chapter_id, next_page, accepted_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, chapter_id) DO UPDATE
     SET next_page = EXCLUDED.next_page, accepted_at = now();`,
    [userId, body.chapter_id, body.page + 1],
    platform?.env
  ).catch(() => {});

  // 3. Upsert reading entry
  const readRes = await executeYugabyteSql(
    `SELECT page, max_page, completed_at FROM public.reading WHERE user_id = $1 AND chapter_id = $2 LIMIT 1;`,
    [userId, body.chapter_id],
    platform?.env
  );
  const existingRead = readRes.rows[0];

  const maxPage = Math.max(existingRead?.max_page || 1, body.page);

  await executeYugabyteSql(
    `INSERT INTO public.reading (user_id, chapter_id, page, max_page, completed_at, updated_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END, now())
     ON CONFLICT (user_id, chapter_id) DO UPDATE
     SET page = EXCLUDED.page,
         max_page = GREATEST(reading.max_page, EXCLUDED.max_page),
         completed_at = COALESCE(reading.completed_at, EXCLUDED.completed_at),
         updated_at = now();`,
    [userId, body.chapter_id, body.page, maxPage, body.completed],
    platform?.env
  );

  // 4. If completed, claim XP
  let xpResult: any = null;
  if (body.completed) {
    try {
      const claimRes = await executeYugabyteSql(
        `SELECT public.claim_chapter_xp($1, $2, $3) AS result;`,
        [body.chapter_id, userId, 'mihon'],
        platform?.env
      );
      xpResult = claimRes.rows[0]?.result;
    } catch {}
  }

  // 5. Get current member XP
  const memRes = await executeYugabyteSql(
    `SELECT xp FROM public.members WHERE id = $1 LIMIT 1;`,
    [userId],
    platform?.env
  );

  return json({
    ok: true,
    chapter_id: body.chapter_id,
    page: body.page,
    completed: body.completed,
    xp_gained: xpResult?.xp_gained || 0,
    current_xp: memRes.rows[0]?.xp || 0
  });
};
