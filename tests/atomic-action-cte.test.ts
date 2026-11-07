import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('Atomic Reading Progress + XP CTE Verification', () => {
  it('executes progress upsert and XP award atomically in a single statement', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE public.members (id uuid PRIMARY KEY, username text, xp integer NOT NULL DEFAULT 0);
      CREATE TABLE public.chapters (id uuid PRIMARY KEY, work_id uuid NOT NULL);
      CREATE TABLE public.reading (
        user_id uuid NOT NULL,
        chapter_id uuid NOT NULL,
        page integer NOT NULL DEFAULT 1,
        max_page integer NOT NULL DEFAULT 1,
        started_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        PRIMARY KEY (user_id, chapter_id)
      );
      CREATE TABLE public.xp_awards (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        chapter_id uuid NOT NULL,
        work_id uuid NOT NULL,
        amount integer NOT NULL DEFAULT 150,
        source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mihon')),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT unique_user_chapter_xp UNIQUE(user_id, chapter_id)
      );
    `);

    const u1 = '11111111-1111-4000-8000-111111111111';
    const c1 = '22222222-2222-4000-8000-222222222222';
    const w1 = '33333333-3333-4000-8000-333333333333';

    await db.exec(`
      INSERT INTO public.members (id, username, xp) VALUES ('${u1}', 'tester', 50);
      INSERT INTO public.chapters (id, work_id) VALUES ('${c1}', '${w1}');
    `);

    const sql = `
      WITH upsert_reading AS (
        INSERT INTO public.reading (user_id, chapter_id, page, max_page, started_at, updated_at, completed_at)
        VALUES ($1, $2, $3, $3, NOW(), NOW(), CASE WHEN $4::boolean THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, chapter_id) DO UPDATE SET
          page = GREATEST(reading.page, EXCLUDED.page),
          max_page = GREATEST(reading.max_page, EXCLUDED.max_page),
          updated_at = NOW(),
          completed_at = COALESCE(reading.completed_at, EXCLUDED.completed_at)
        RETURNING user_id, chapter_id, page, max_page, completed_at
      ),
      new_award AS (
        INSERT INTO public.xp_awards (id, user_id, chapter_id, work_id, amount, source, created_at)
        SELECT gen_random_uuid(), ur.user_id, ur.chapter_id, COALESCE(NULLIF($5, '')::uuid, (SELECT work_id FROM public.chapters WHERE id = ur.chapter_id LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid), 150, 'web', NOW()
        FROM upsert_reading ur
        WHERE ur.completed_at IS NOT NULL
        ON CONFLICT (user_id, chapter_id) DO NOTHING
        RETURNING user_id, amount
      ),
      update_member AS (
        UPDATE public.members m
        SET xp = COALESCE(m.xp, 0) + na.amount
        FROM new_award na
        WHERE m.id = na.user_id
        RETURNING m.id, m.xp
      )
      SELECT 
        ur.page,
        ur.max_page,
        ur.completed_at,
        COALESCE(um.xp, (SELECT xp FROM public.members WHERE id = ur.user_id LIMIT 1), 0) AS total_xp,
        (EXISTS (SELECT 1 FROM new_award)) AS newly_awarded
      FROM upsert_reading ur
      LEFT JOIN update_member um ON um.id = ur.user_id;
    `;

    // 1. Reading page 10 (not completed)
    const res1 = await db.query<any>(sql, [u1, c1, 10, false, w1]);
    expect(res1.rows[0].page).toBe(10);
    expect(res1.rows[0].max_page).toBe(10);
    expect(res1.rows[0].completed_at).toBeNull();
    expect(res1.rows[0].total_xp).toBe(50);
    expect(res1.rows[0].newly_awarded).toBe(false);

    // 2. Reading page 30 (completed first time)
    const res2 = await db.query<any>(sql, [u1, c1, 30, true, w1]);
    expect(res2.rows[0].page).toBe(30);
    expect(res2.rows[0].max_page).toBe(30);
    expect(res2.rows[0].completed_at).not.toBeNull();
    expect(res2.rows[0].total_xp).toBe(200); // 50 + 150
    expect(res2.rows[0].newly_awarded).toBe(true);

    // Verify member table has 200 xp
    const mCheck = await db.query<any>(`SELECT xp FROM public.members WHERE id = '${u1}'`);
    expect(mCheck.rows[0].xp).toBe(200);

    // Verify xp_awards has 1 row
    const aCheck = await db.query<any>(`SELECT * FROM public.xp_awards WHERE user_id = '${u1}' AND chapter_id = '${c1}'`);
    expect(aCheck.rows.length).toBe(1);
    expect(aCheck.rows[0].amount).toBe(150);
    expect(aCheck.rows[0].source).toBe('web');

    // 3. Rereading page 30 (already completed, should NOT award XP again)
    const res3 = await db.query<any>(sql, [u1, c1, 30, true, w1]);
    expect(res3.rows[0].page).toBe(30);
    expect(res3.rows[0].max_page).toBe(30);
    expect(res3.rows[0].completed_at).not.toBeNull();
    expect(res3.rows[0].total_xp).toBe(200); // remains 200
    expect(res3.rows[0].newly_awarded).toBe(false); // NOT newly awarded!

    // Verify member table STILL has 200 xp
    const mCheck2 = await db.query<any>(`SELECT xp FROM public.members WHERE id = '${u1}'`);
    expect(mCheck2.rows[0].xp).toBe(200);
  });
});
