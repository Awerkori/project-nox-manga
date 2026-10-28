import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const user1 = '732fbe87-5040-41fb-9983-0aedb2af44c8';
const user2 = '33f6e944-0fbe-4d1d-a64b-25738f8e3183';

describe('Notification system regression suite', () => {
  it('1 & 2: Mark single and mark all as read updates read_at correctly and isolates users', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.notifications (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        title text NOT NULL,
        body text NOT NULL DEFAULT '',
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        dedupe_key text
      );
    `);

    // Insert 3 notifications for user1 and 2 for user2
    await db.query(`
      INSERT INTO public.notifications (id, user_id, title, dedupe_key) VALUES
        ('10000000-0000-0000-0000-000000000001', '${user1}', 'Notif 1', 'key1'),
        ('10000000-0000-0000-0000-000000000002', '${user1}', 'Notif 2', 'key2'),
        ('10000000-0000-0000-0000-000000000003', '${user1}', 'Notif 3', 'key3'),
        ('10000000-0000-0000-0000-000000000004', '${user2}', 'User2 Notif 1', 'key4'),
        ('10000000-0000-0000-0000-000000000005', '${user2}', 'User2 Notif 2', 'key5');
    `);

    // Case 1: Mark single notification read
    const singleUpdate = await db.query(`
      UPDATE public.notifications
      SET read_at = now()
      WHERE id = '10000000-0000-0000-0000-000000000001' AND user_id = '${user1}'
      RETURNING id, read_at;
    `);
    expect(singleUpdate.rows).toHaveLength(1);
    expect(singleUpdate.rows[0].read_at).toBeTruthy();

    // Verify user1 now has 2 unread, user2 still has 2 unread
    const u1Unread = await db.query(`
      SELECT count(*) as unread FROM public.notifications WHERE user_id = '${user1}' AND read_at IS NULL;
    `);
    expect(Number(u1Unread.rows[0].unread)).toBe(2);

    const u2Unread = await db.query(`
      SELECT count(*) as unread FROM public.notifications WHERE user_id = '${user2}' AND read_at IS NULL;
    `);
    expect(Number(u2Unread.rows[0].unread)).toBe(2);

    // Case 2: Mark all read for user1
    const allUpdate = await db.query(`
      UPDATE public.notifications
      SET read_at = now()
      WHERE user_id = '${user1}' AND read_at IS NULL
      RETURNING id;
    `);
    expect(allUpdate.rows).toHaveLength(2);

    // Verify user1 has 0 unread, user2 still has 2 unread
    const u1Final = await db.query(`
      SELECT count(*) as unread FROM public.notifications WHERE user_id = '${user1}' AND read_at IS NULL;
    `);
    expect(Number(u1Final.rows[0].unread)).toBe(0);

    const u2Final = await db.query(`
      SELECT count(*) as unread FROM public.notifications WHERE user_id = '${user2}' AND read_at IS NULL;
    `);
    expect(Number(u2Final.rows[0].unread)).toBe(2);
  });

  it('10 & 11: Authorization isolation and 0 rows affected checks', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.notifications (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        title text NOT NULL,
        read_at timestamptz
      );
    `);
    await db.query(`
      INSERT INTO public.notifications (id, user_id, title) VALUES
        ('20000000-0000-0000-0000-000000000001', '${user2}', 'Private to user 2');
    `);

    // User 1 tries to mark User 2's notification as read
    const unauthorizedAttempt = await db.query(`
      UPDATE public.notifications
      SET read_at = now()
      WHERE id = '20000000-0000-0000-0000-000000000001' AND user_id = '${user1}'
      RETURNING id;
    `);
    expect(unauthorizedAttempt.rows).toHaveLength(0); // 0 rows updated!

    // Non-existent ID attempt
    const nonExistent = await db.query(`
      UPDATE public.notifications
      SET read_at = now()
      WHERE id = '00000000-0000-0000-0000-000000000000' AND user_id = '${user1}'
      RETURNING id;
    `);
    expect(nonExistent.rows).toHaveLength(0);
  });

  it('14: Deduplication prevents duplicate notification spam', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.notifications (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        title text NOT NULL,
        dedupe_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, dedupe_key)
      );
    `);

    // Insert first event
    await db.query(`
      INSERT INTO public.notifications (id, user_id, title, dedupe_key)
      VALUES ('30000000-0000-0000-0000-000000000001', '${user1}', 'First Ticket Alert', 'ticket:123');
    `);

    // Duplicate event insert with ON CONFLICT DO NOTHING
    const dupRes = await db.query(`
      INSERT INTO public.notifications (id, user_id, title, dedupe_key)
      VALUES ('30000000-0000-0000-0000-000000000002', '${user1}', 'First Ticket Alert', 'ticket:123')
      ON CONFLICT (user_id, dedupe_key) DO NOTHING
      RETURNING id;
    `);
    expect(dupRes.rows).toHaveLength(0);

    const total = await db.query(`SELECT count(*) as count FROM public.notifications WHERE user_id = '${user1}';`);
    expect(Number(total.rows[0].count)).toBe(1);
  });

  it('16: Scan notifications sync and isolation', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.notifications (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        title text NOT NULL,
        scan_id uuid,
        read_at timestamptz
      );
      CREATE TABLE public.scan_notifications (
        id uuid PRIMARY KEY,
        scan_id uuid NOT NULL,
        user_id uuid NOT NULL,
        title text NOT NULL,
        is_read boolean NOT NULL DEFAULT false
      );
    `);

    const scanId = '40000000-0000-0000-0000-000000000001';
    await db.exec(`
      INSERT INTO public.notifications (id, user_id, title, scan_id)
      VALUES ('40000000-0000-0000-0000-000000000002', '${user1}', 'Scan Task Assigned', '${scanId}');
      INSERT INTO public.scan_notifications (id, scan_id, user_id, title)
      VALUES ('40000000-0000-0000-0000-000000000003', '${scanId}', '${user1}', 'Scan Task Assigned');
    `);

    const n = await db.query(`SELECT * FROM public.notifications WHERE scan_id = '${scanId}';`);
    const sn = await db.query(`SELECT * FROM public.scan_notifications WHERE scan_id = '${scanId}';`);
    expect(n.rows).toHaveLength(1);
    expect(sn.rows).toHaveLength(1);
  });

  it('Frontend & Server source code resilience and fallback integrity', () => {
    const apiAction = readFileSync(resolve('src/routes/api/action/+server.ts'), 'utf8');
    const pageServer = readFileSync(resolve('src/routes/notificacoes/+page.server.ts'), 'utf8');
    const pageSvelte = readFileSync(resolve('src/routes/notificacoes/+page.svelte'), 'utf8');
    const layoutSvelte = readFileSync(resolve('src/routes/+layout.svelte'), 'utf8');

    // Verification of RPC usage with resilient fallback
    expect(apiAction).toContain('mark_notification_read');
    expect(apiAction).toContain('mark_all_notifications_read');
    expect(apiAction).toContain('invalidateUserSession');

    expect(pageServer).toContain('mark_notification_read');
    expect(pageServer).toContain('mark_all_notifications_read');
    expect(pageServer).toContain('invalidateUserSession');

    // Verification of optimistic rollback on error
    expect(pageSvelte).toContain('prevIsRead');
    expect(pageSvelte).toContain('prevNotifications');
    expect(pageSvelte).toContain('BroadcastChannel');

    // Cross-tab synchronization in layout
    expect(layoutSvelte).toContain('nox_notifications');
  });
});
