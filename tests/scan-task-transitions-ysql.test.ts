import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '40000000-0000-4000-8000-000000000001',
  owner: '40000000-0000-4000-8000-000000000002',
  member: '40000000-0000-4000-8000-000000000003',
  outsider: '40000000-0000-4000-8000-000000000004',
  position: '40000000-0000-4000-8000-000000000005',
  currentStage: '40000000-0000-4000-8000-000000000006',
  nextStage: '40000000-0000-4000-8000-000000000007',
  work: '40000000-0000-4000-8000-000000000008',
  publicChapter: '40000000-0000-4000-8000-000000000009',
  productionChapter: '40000000-0000-4000-8000-000000000010',
  task: '40000000-0000-4000-8000-000000000011'
};

function migration() {
  return readFileSync(resolve('yugabyte/migrations/20261002230000_scan_task_transitions_ysql.sql'), 'utf8');
}

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE public.scan_members (scan_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, PRIMARY KEY(scan_id, user_id));
    CREATE TABLE public.scan_member_positions (scan_id uuid NOT NULL, user_id uuid NOT NULL, position_id uuid NOT NULL);
    CREATE TABLE public.scan_workflow_stages (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, name text NOT NULL, slug text NOT NULL,
      display_order integer NOT NULL, is_active boolean NOT NULL DEFAULT true, allowed_position_ids uuid[]
    );
    CREATE TABLE public.scan_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, work_id uuid, chapter_id uuid, stage_id uuid,
      title text NOT NULL, description text, assigned_to uuid, created_by uuid NOT NULL,
      priority text NOT NULL DEFAULT 'NORMAL', status text NOT NULL DEFAULT 'TODO',
      completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, user_id uuid,
      action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, user_id uuid NOT NULL,
      type text NOT NULL, title text NOT NULL, body text NOT NULL, deep_link text, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_production_chapters (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, target_chapter_id uuid, current_stage_slug text, updated_at timestamptz
    );
  `);
}

describe('scan task YSQL transitions', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await createSchema(db);
    await db.exec(migration());
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')`, [ids.scan, ids.owner, ids.member]);
    await db.query(`INSERT INTO public.scan_member_positions VALUES ($1, $2, $3)`, [ids.scan, ids.member, ids.position]);
    await db.query(`INSERT INTO public.scan_workflow_stages VALUES
      ($1, $2, 'Tradução', 'traducao', 1, true, ARRAY[$3::uuid]),
      ($4, $2, 'Revisão', 'revisao', 2, true, ARRAY[$3::uuid])`,
      [ids.currentStage, ids.scan, ids.position, ids.nextStage]);
    await db.query(`INSERT INTO public.scan_production_chapters VALUES ($1, $2, $3, 'traducao', now())`, [ids.productionChapter, ids.scan, ids.publicChapter]);
    await db.query(`INSERT INTO public.scan_tasks
      (id, scan_id, work_id, chapter_id, stage_id, title, created_by, priority, status)
      VALUES ($1, $2, $3, $4, $5, 'Traduzir capítulo', $6, 'HIGH', 'TODO')`,
      [ids.task, ids.scan, ids.work, ids.publicChapter, ids.currentStage, ids.owner]);
  });

  it('atomically claims once and does not double-log a retry', async () => {
    await expect(db.query(`SELECT public.claim_scan_task_ysql($1, $2, false)`, [ids.task, ids.outsider]))
      .rejects.toThrow(/SCAN_MEMBERSHIP_REQUIRED/);
    const first = await db.query<{ result: { assigned_to: string } }>(
      `SELECT public.claim_scan_task_ysql($1, $2, false) AS result`, [ids.task, ids.member]
    );
    expect(first.rows[0].result.assigned_to).toBe(ids.member);
    await expect(db.query(`SELECT public.claim_scan_task_ysql($1, $2, false)`, [ids.task, ids.owner]))
      .rejects.toThrow(/TASK_ALREADY_CLAIMED/);
    const retry = await db.query<{ result: { idempotent: boolean } }>(
      `SELECT public.claim_scan_task_ysql($1, $2, false) AS result`, [ids.task, ids.member]
    );
    expect(retry.rows[0].result.idempotent).toBe(true);
    expect((await db.query(`SELECT * FROM public.scan_activity WHERE action = 'TASK_CLAIMED'`)).rows).toHaveLength(1);
  });

  it('allows only the assignee or leadership to release an active task', async () => {
    await db.query(`SELECT public.claim_scan_task_ysql($1, $2, false)`, [ids.task, ids.member]);
    await expect(db.query(`SELECT public.release_scan_task_ysql($1, $2, false, 'sem acesso')`, [ids.task, ids.outsider]))
      .rejects.toThrow(/SCAN_MEMBERSHIP_REQUIRED/);
    await db.query(`SELECT public.release_scan_task_ysql($1, $2, false, 'voltar à fila')`, [ids.task, ids.owner]);
    expect((await db.query(`SELECT status, assigned_to FROM public.scan_tasks WHERE id = $1`, [ids.task])).rows)
      .toEqual([{ status: 'TODO', assigned_to: null }]);
  });

  it('finishes once, creates one downstream task and advances the linked production chapter', async () => {
    await db.query(`SELECT public.claim_scan_task_ysql($1, $2, false)`, [ids.task, ids.member]);
    const completed = await db.query<{ result: { next_task_id: string; next_stage_slug: string } }>(
      `SELECT public.complete_scan_task_ysql($1, $2, false, 'entrega pronta', NULL) AS result`, [ids.task, ids.member]
    );
    expect(completed.rows[0].result.next_stage_slug).toBe('revisao');
    expect((await db.query(`SELECT current_stage_slug FROM public.scan_production_chapters WHERE id = $1`, [ids.productionChapter])).rows)
      .toEqual([{ current_stage_slug: 'revisao' }]);
    expect((await db.query(`SELECT stage_id, status FROM public.scan_tasks WHERE scan_id = $1 ORDER BY created_at`, [ids.scan])).rows)
      .toEqual([{ stage_id: ids.currentStage, status: 'DONE' }, { stage_id: ids.nextStage, status: 'TODO' }]);
    const retry = await db.query<{ result: { idempotent: boolean } }>(
      `SELECT public.complete_scan_task_ysql($1, $2, false, NULL, NULL) AS result`, [ids.task, ids.member]
    );
    expect(retry.rows[0].result.idempotent).toBe(true);
    expect((await db.query(`SELECT * FROM public.scan_tasks WHERE stage_id = $1`, [ids.nextStage])).rows).toHaveLength(1);
  });

  it('routes legacy task actions through YSQL transactions', () => {
    const workspace = readFileSync(resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(workspace).toContain('claim_scan_task_ysql');
    expect(workspace).toContain('release_scan_task_ysql');
    expect(workspace).toContain('complete_scan_task_ysql');
    expect(workspace).not.toContain("locals.db.rpc('claim_scan_task'");
    expect(workspace).not.toContain("locals.db.rpc('release_scan_task'");
    expect(workspace).not.toContain("locals.db.rpc('complete_scan_stage'");
  });
});
