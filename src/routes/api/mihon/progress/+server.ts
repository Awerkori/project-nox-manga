import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyMihonAuth } from '$lib/server/mihon';
import { privileged } from '$lib/server/db';

const progressSchema = z.object({chapterId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  completed: z.boolean().default(false)});

export const POST = async ({ request }) => {
  const auth = await verifyMihonAuth(request);
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

  const db = privileged();
  const userId = auth.user.id;

  // 1. Verify chapter exists
  const { data: chapter, error: chErr } = await db
    .from('chapters')
    .select('id, work_id, number')
    .eq('id', body.chapterId)
    .maybeSingle();

  if (chErr || !chapter) {
    return json({ error: 'Capítulo não encontrado' }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 2. Upsert reading_sessions for anti-cheat tracking
  await db.from('reading_sessions').upsert(
    {userId: userId,
      chapterId: body.chapterId,
      nextPage: body.page + 1,
      acceptedAt: now},
    {onConflict: 'userId,chapterId'}
  );

  // 3. Upsert reading entry
  const { data: existingRead } = await db
    .from('reading')
    .select('page, max_page, completed_at')
    .eq('user_id', userId)
    .eq('chapter_id', body.chapterId)
    .maybeSingle();

  const completedAt =
    existingRead?.completedAt || (body.completed ? now : null);

  await db.from('reading').upsert(
    {userId: userId,
      chapterId: body.chapterId,
      page: body.page,
      maxPage: Math.max(existingRead?.maxPage || 1, body.page),
      completedAt: completedAt,
      updatedAt: now},
    {onConflict: 'userId,chapterId'}
  );

  // 4. If completed, claim XP
  let xpResult = null;
  if (body.completed) {
    const { data: claimData, error: claimErr } = await db.rpc('claim_chapter_xp', {
      p_chapter_id: body.chapterId,
      p_user_id: userId,
      p_source: 'mihon'
    });
    if (!claimErr) {
      xpResult = claimData;
    }
  }

  // 5. Get current member XP
  const { data: memberData } = await db
    .from('members')
    .select('xp')
    .eq('id', userId)
    .single();

  return json({ok: true,
    chapterId: body.chapterId,
    page: body.page,
    completed: body.completed,
    xp: memberData?.xp ?? auth.user.xp,
    xp_claim: xpResult});
};
