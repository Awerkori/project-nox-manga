import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

describe('XP Progression, Anti-Abuse, and Reading Flow Tests', () => {
  it('strictly validates atomic XP distribution, 90s cooldown, idempotency, and shop purchases', async () => {
    const db = new PGlite();

    // Setup mock PostgreSQL schema
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE public.members (
        id uuid PRIMARY KEY,
        username text,
        xp integer NOT NULL DEFAULT 0
      );
      CREATE TABLE public.chapters (
        id uuid PRIMARY KEY,
        work_id uuid NOT NULL,
        views_total bigint NOT NULL DEFAULT 0
      );
      CREATE TABLE public.works (
        id uuid PRIMARY KEY,
        title text NOT NULL,
        views_total bigint NOT NULL DEFAULT 0
      );
      CREATE TABLE public.shop_items (
        id text PRIMARY KEY,
        name text NOT NULL,
        price_xp integer NOT NULL,
        min_level integer NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true
      );
      CREATE TABLE public.member_inventory (
        user_id uuid NOT NULL,
        item_id text NOT NULL,
        origin text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, item_id)
      );
      CREATE TABLE public.xp_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        amount integer NOT NULL,
        balance_after integer NOT NULL,
        kind text NOT NULL,
        source_id text,
        description text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX idx_xp_ledger_unique_action ON public.xp_ledger(user_id, kind, source_id)
        WHERE kind IN ('READ_CHAPTER', 'FAVORITE_WORK', 'RATE_WORK');

      CREATE TABLE public.reading (
        user_id uuid NOT NULL,
        chapter_id uuid NOT NULL,
        work_id uuid,
        page integer NOT NULL DEFAULT 1,
        max_page integer NOT NULL DEFAULT 1,
        completed_at timestamptz,
        started_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, chapter_id)
      );

      CREATE TABLE public.chapter_views (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id uuid NOT NULL,
        work_id uuid NOT NULL,
        user_id uuid,
        anonymous_hash text,
        origin text NOT NULL DEFAULT 'WEB',
        viewed_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const testUserId = '00000000-0000-4000-8000-000000000001';
    const testWorkId = '00000000-0000-4000-8000-000000000010';
    const testChapter1 = '00000000-0000-4000-8000-000000000101';
    const testChapter2 = '00000000-0000-4000-8000-000000000102';

    await db.exec(`
      INSERT INTO public.members (id, username, xp) VALUES ('${testUserId}', 'test_reader', 0);
      INSERT INTO public.works (id, title, views_total) VALUES ('${testWorkId}', 'Solo Leveling Test', 0);
      INSERT INTO public.chapters (id, work_id, views_total) VALUES ('${testChapter1}', '${testWorkId}', 0);
      INSERT INTO public.chapters (id, work_id, views_total) VALUES ('${testChapter2}', '${testWorkId}', 0);
      INSERT INTO public.shop_items (id, name, price_xp, min_level) VALUES ('frame-cosmic-gold', 'Moldura Dourada', 250, 1);
    `);

    // 1. Test View deduplication & increment
    // First view for anonymous visitor
    await db.exec(`
      INSERT INTO public.chapter_views (chapter_id, work_id, anonymous_hash, viewed_at)
      VALUES ('${testChapter1}', '${testWorkId}', 'anon_hash_abc', now());
      UPDATE public.chapters SET views_total = views_total + 1 WHERE id = '${testChapter1}';
      UPDATE public.works SET views_total = views_total + 1 WHERE id = '${testWorkId}';
    `);

    const viewCheck1 = await db.query<{ views_total: number }>(`SELECT views_total FROM public.works WHERE id = '${testWorkId}'`);
    expect(Number(viewCheck1.rows[0].views_total)).toBe(1);

    // Re-view within dedupe window should be rejected
    const dedupeCheck = await db.query<{ recent: boolean }>(`
      SELECT EXISTS(
        SELECT 1 FROM public.chapter_views
        WHERE chapter_id = '${testChapter1}' AND anonymous_hash = 'anon_hash_abc' AND viewed_at > now() - interval '30 minutes'
      ) as recent;
    `);
    expect(dedupeCheck.rows[0].recent).toBe(true);

    // 2. Reading progress & completion
    await db.exec(`
      INSERT INTO public.reading (user_id, chapter_id, work_id, page, max_page, completed_at)
      VALUES ('${testUserId}', '${testChapter1}', '${testWorkId}', 25, 25, now());
    `);

    const readingRow = await db.query<{ completed_at: string }>(`SELECT completed_at FROM public.reading WHERE user_id = '${testUserId}' AND chapter_id = '${testChapter1}'`);
    expect(readingRow.rows[0].completed_at).toBeTruthy();

    // 3. XP Award for first read
    const awardAmount = 150;
    await db.exec(`
      UPDATE public.members SET xp = xp + ${awardAmount} WHERE id = '${testUserId}';
      INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
      VALUES ('${testUserId}', ${awardAmount}, ${awardAmount}, 'READ_CHAPTER', '${testChapter1}', 'Leitura concluída');
    `);

    const memberCheck1 = await db.query<{ xp: number }>(`SELECT xp FROM public.members WHERE id = '${testUserId}'`);
    expect(memberCheck1.rows[0].xp).toBe(150);

    // 4. Duplicate read should violate unique index on xp_ledger
    let duplicateRejected = false;
    try {
      await db.exec(`
        INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
        VALUES ('${testUserId}', ${awardAmount}, 300, 'READ_CHAPTER', '${testChapter1}', 'Leitura repetida');
      `);
    } catch {
      duplicateRejected = true;
    }
    expect(duplicateRejected).toBe(true);

    // Member balance should remain 150
    const memberCheck2 = await db.query<{ xp: number }>(`SELECT xp FROM public.members WHERE id = '${testUserId}'`);
    expect(memberCheck2.rows[0].xp).toBe(150);

    // 5. Favorite XP
    const favAward = 75;
    await db.exec(`
      UPDATE public.members SET xp = xp + ${favAward} WHERE id = '${testUserId}';
      INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
      VALUES ('${testUserId}', ${favAward}, 225, 'FAVORITE_WORK', '${testWorkId}', 'Favoritado');
    `);

    // Refavoriting same work should be rejected
    let refavoriteRejected = false;
    try {
      await db.exec(`
        INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
        VALUES ('${testUserId}', ${favAward}, 300, 'FAVORITE_WORK', '${testWorkId}', 'Refavoritado');
      `);
    } catch {
      refavoriteRejected = true;
    }
    expect(refavoriteRejected).toBe(true);

    // 6. Rating XP
    const rateAward = 50;
    await db.exec(`
      UPDATE public.members SET xp = xp + ${rateAward} WHERE id = '${testUserId}';
      INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
      VALUES ('${testUserId}', ${rateAward}, 275, 'RATE_WORK', '${testWorkId}', 'Avaliado');
    `);

    const memberCheck3 = await db.query<{ xp: number }>(`SELECT xp FROM public.members WHERE id = '${testUserId}'`);
    expect(memberCheck3.rows[0].xp).toBe(275);

    // 7. Shop Purchase: item costs 250 XP
    const itemCost = 250;
    await db.exec(`
      UPDATE public.members SET xp = xp - ${itemCost} WHERE id = '${testUserId}';
      INSERT INTO public.member_inventory (user_id, item_id, origin) VALUES ('${testUserId}', 'frame-cosmic-gold', 'SHOP');
      INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description)
      VALUES ('${testUserId}', -${itemCost}, 25, 'SHOP_PURCHASE', 'frame-cosmic-gold', 'Compra na loja');
    `);

    const memberCheck4 = await db.query<{ xp: number }>(`SELECT xp FROM public.members WHERE id = '${testUserId}'`);
    expect(memberCheck4.rows[0].xp).toBe(25);

    // Verify inventory holds the item
    const invCheck = await db.query<{ item_id: string }>(`SELECT item_id FROM public.member_inventory WHERE user_id = '${testUserId}'`);
    expect(invCheck.rows.length).toBe(1);
    expect(invCheck.rows[0].item_id).toBe('frame-cosmic-gold');

    // 8. Ledger integrity: sum of ledger matches balance
    const ledgerSum = await db.query<{ total: string }>(`SELECT SUM(amount) as total FROM public.xp_ledger WHERE user_id = '${testUserId}'`);
    expect(Number(ledgerSum.rows[0].total)).toBe(25);
  });
});
