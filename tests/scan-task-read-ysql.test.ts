import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '50000000-0000-4000-8000-000000000001',
  task: '50000000-0000-4000-8000-000000000002',
  author: '50000000-0000-4000-8000-000000000003',
  comment: '50000000-0000-4000-8000-000000000004'
};

describe('scan task YSQL reads', () => {
  it('keeps task comments attached to their task on the YSQL snapshot', async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE public.members (id uuid PRIMARY KEY, username text, display_name text, avatar_id uuid);
      CREATE TABLE public.scan_tasks (
        id uuid PRIMARY KEY, scan_id uuid NOT NULL, title text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.scan_task_comments (
        id uuid PRIMARY KEY, task_id uuid NOT NULL, user_id uuid NOT NULL,
        content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.query(
      `INSERT INTO public.members (id, username, display_name) VALUES ($1, 'staff', 'Staff')`,
      [ids.author]
    );
    await db.query(`INSERT INTO public.scan_tasks (id, scan_id, title) VALUES ($1, $2, 'Revisar capítulo')`, [ids.task, ids.scan]);
    await db.query(
      `INSERT INTO public.scan_task_comments (id, task_id, user_id, content) VALUES ($1, $2, $3, 'Manter a nota da página 17')`,
      [ids.comment, ids.task, ids.author]
    );

    const result = await db.query<any>(`
      SELECT task.*,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', comment.id,
            'task_id', comment.task_id,
            'content', comment.content,
            'created_at', comment.created_at,
            'members', CASE WHEN author.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', author.id, 'username', author.username,
              'display_name', author.display_name, 'avatar_id', author.avatar_id
            ) END
          ) ORDER BY comment.created_at ASC)
          FROM public.scan_task_comments comment
          LEFT JOIN public.members author ON author.id = comment.user_id
          WHERE comment.task_id = task.id
        ), '[]'::jsonb) AS scan_task_comments
      FROM public.scan_tasks task
      WHERE task.scan_id = $1
      ORDER BY task.created_at DESC
    `, [ids.scan]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].scan_task_comments).toEqual([
      expect.objectContaining({
        id: ids.comment,
        content: 'Manter a nota da página 17',
        members: expect.objectContaining({ id: ids.author, username: 'staff' })
      })
    ]);
  });

  it('uses the YSQL task snapshot without a legacy task read', () => {
    const workspace = readFileSync(resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(workspace).toContain("'scan_task_snapshot_ysql'");
    expect(workspace).not.toContain("'scan_task_snapshot_legacy_fallback'");
    expect(workspace).toContain('FROM public.scan_tasks task');
    expect(workspace).toContain('FROM public.scan_task_comments comment');
  });
});
