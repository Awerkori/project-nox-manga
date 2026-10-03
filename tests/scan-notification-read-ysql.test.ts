import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '60000000-0000-4000-8000-000000000001',
  owner: '60000000-0000-4000-8000-000000000002',
  otherMember: '60000000-0000-4000-8000-000000000003',
  notification: '60000000-0000-4000-8000-000000000004'
};

describe('scan notification YSQL reads', () => {
  it('returns only the authenticated member inbox and preference', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.scan_notifications (
        id uuid PRIMARY KEY, scan_id uuid NOT NULL, user_id uuid NOT NULL,
        type text NOT NULL, title text NOT NULL, body text NOT NULL,
        is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.scan_notification_preferences (
        scan_id uuid NOT NULL, user_id uuid NOT NULL, tasks boolean NOT NULL DEFAULT true,
        UNIQUE (scan_id, user_id)
      );
    `);
    await db.query(
      `INSERT INTO public.scan_notifications (id, scan_id, user_id, type, title, body) VALUES
       ($1, $2, $3, 'TASK_ASSIGNED', 'Sua tarefa', 'Capítulo 85'),
       ('60000000-0000-4000-8000-000000000005', $2, $4, 'MENTION', 'Outra pessoa', 'Privado')`,
      [ids.notification, ids.scan, ids.owner, ids.otherMember]
    );
    await db.query(
      `INSERT INTO public.scan_notification_preferences (scan_id, user_id, tasks) VALUES ($1, $2, false)`,
      [ids.scan, ids.owner]
    );

    const notifications = await db.query<any>(`
      SELECT notification.* FROM public.scan_notifications notification
      WHERE notification.scan_id = $1 AND notification.user_id = $2
      ORDER BY notification.created_at DESC LIMIT 50
    `, [ids.scan, ids.owner]);
    const preferences = await db.query<any>(`
      SELECT preference.* FROM public.scan_notification_preferences preference
      WHERE preference.scan_id = $1 AND preference.user_id = $2 LIMIT 1
    `, [ids.scan, ids.owner]);

    expect(notifications.rows).toHaveLength(1);
    expect(notifications.rows[0]).toMatchObject({ id: ids.notification, user_id: ids.owner });
    expect(preferences.rows).toEqual([expect.objectContaining({ user_id: ids.owner, tasks: false })]);
  });

  it('uses one bounded YSQL snapshot with an explicit legacy fallback', () => {
    const workspace = readFileSync(resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(workspace).toContain("'scan_notification_snapshot_ysql'");
    expect(workspace).toContain("'scan_notification_snapshot_legacy_fallback'");
    expect(workspace).toContain('WHERE notification.scan_id = $1 AND notification.user_id = $2');
    expect(workspace).toContain('WHERE preference.scan_id = $1 AND preference.user_id = $2');
  });
});
