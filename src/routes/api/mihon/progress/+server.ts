import { and, eq } from "drizzle-orm";
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyMihonAuth } from '$lib/server/mihon';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';

const progressSchema = z.object({chapterId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  completed: z.boolean().default(false)});

export const POST = async ({ request }) => {
  const auth = await verifyMihonAuth(request);
  if (!auth.authenticated || !auth.user) {
    return json(
      { error: 'Autenticao necessria para sincronizar progresso.' },
      { status: 401 }
    );
  }

  let body;
  try {
    const raw = await request.json();
    body = progressSchema.parse(raw);
  } catch (err) {
    return json({ error: 'Dados de progresso invlidos.' }, { status: 400 });
  }

    const userId = auth.user.id;

  // 1. Verify chapter exists
  const { data: chapter, error: chErr } = await safeQuerySingle(db.select({ id: schema.chapters.id, workId: schema.chapters.workId, number: schema.chapters.number }).from(schema.chapters).where(eq(schema.chapters.id, body.chapterId)));

  if (chErr || !chapter) {
    return json({ error: 'Captulo no encontrado' }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 2. Upsert reading_sessions for anti-cheat tracking
  await safeQuery(
    db.insert(schema.readingSessions)
      .values({
        userId: userId,
        chapterId: body.chapterId,
        nextPage: body.page + 1,
        acceptedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.readingSessions.userId, schema.readingSessions.chapterId],
        set: {
          nextPage: body.page + 1,
          acceptedAt: now
        }
      })
  );

  // 3. Upsert reading entry
  const { data: existingRead } = await safeQuerySingle(
    db.select({ page: schema.reading.page, maxPage: schema.reading.maxPage, completedAt: schema.reading.completedAt })
      .from(schema.reading)
      .where(and(eq(schema.reading.userId, userId), eq(schema.reading.chapterId, body.chapterId)))
  );

  const completedAt =
    existingRead?.completedAt || (body.completed ? now : null);

  await safeQuery(
    db.insert(schema.reading)
      .values({
        userId: userId,
        chapterId: body.chapterId,
        page: body.page,
        maxPage: Math.max(existingRead?.maxPage || 1, body.page),
        completedAt: completedAt,
        updatedAt: now, startedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.reading.userId, schema.reading.chapterId],
        set: {
          page: body.page,
          maxPage: Math.max(existingRead?.maxPage || 1, body.page),
          completedAt: completedAt,
          updatedAt: now, startedAt: now
        }
      })
  );

  // 4. If completed, claim XP
  let xpResult = null;
  if (body.completed) {
    const { data: claimData, error: claimErr } = { data: null, error: null }; // TODO: IMPLEMENT XP RPC
    if (!claimErr) {
      xpResult = claimData;
    }
  }

  // 5. Get current member XP
  const { data: memberData } = await safeQuerySingle(
    db.select({ xp: schema.members.xp }).from(schema.members).where(eq(schema.members.id, userId))
  );

  return json({ok: true,
    chapterId: body.chapterId,
    page: body.page,
    completed: body.completed,
    xp: memberData?.xp ?? auth.user.xp,
    xp_claim: xpResult});
};
