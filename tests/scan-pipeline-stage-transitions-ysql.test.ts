import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '30000000-0000-4000-8000-000000000001',
  owner: '30000000-0000-4000-8000-000000000002',
  member: '30000000-0000-4000-8000-000000000003',
  outsider: '30000000-0000-4000-8000-000000000004',
  otherMember: '30000000-0000-4000-8000-000000000010',
  workflow: '30000000-0000-4000-8000-000000000005',
  targetWorkflow: '30000000-0000-4000-8000-000000000006',
  chapter: '30000000-0000-4000-8000-000000000007',
  sourceStage: '30000000-0000-4000-8000-000000000008',
  targetStage: '30000000-0000-4000-8000-000000000009'
};

function migration() {
  return readFileSync(resolve('yugabyte/migrations/20261002220000_scan_pipeline_stage_transitions_ysql.sql'), 'utf8');
}

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE public.members (id uuid PRIMARY KEY, username text, display_name text);
    CREATE TABLE public.scan_members (scan_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, PRIMARY KEY(scan_id, user_id));
    CREATE TABLE public.scan_workflow_stages (id uuid PRIMARY KEY, scan_id uuid NOT NULL, slug text NOT NULL, name text NOT NULL);
    CREATE TABLE public.scan_chapter_stages (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, production_chapter_id uuid, chapter_id uuid, stage_id uuid NOT NULL,
      status text NOT NULL, assigned_to uuid, previous_assigned_to uuid, claimed_at timestamptz,
      completed_at timestamptz, completed_by uuid, rejection_reason text, return_to_stage_id uuid,
      availability_version integer DEFAULT 1, availability_reason text, notified_available boolean DEFAULT false,
      is_override boolean DEFAULT false, override_action text, override_reason text, override_by uuid,
      skip_reason text, skipped_by uuid, last_activity_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.scan_chapter_timeline (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, production_chapter_id uuid,
      stage_id uuid, stage_slug text, event_type text, user_id uuid, user_name text,
      details jsonb DEFAULT '{}'::jsonb
    );
    CREATE OR REPLACE FUNCTION public.reconcile_scan_chapter_dependencies_ysql(uuid) RETURNS void
    LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;
  `);
}

describe('scan pipeline YSQL stage transitions', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await createSchema(db);
    await db.exec(migration());
    await db.query(`INSERT INTO public.members (id, username) VALUES ($1, 'owner'), ($2, 'member'), ($3, 'outsider'), ($4, 'other-member')`, [ids.owner, ids.member, ids.outsider, ids.otherMember]);
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER'), ($1, $4, 'MEMBER')`, [ids.scan, ids.owner, ids.member, ids.otherMember]);
    await db.query(`INSERT INTO public.scan_workflow_stages VALUES ($1, $2, 'traducao', 'Tradução'), ($3, $2, 'clean_redraw', 'Clean')`, [ids.workflow, ids.scan, ids.targetWorkflow]);
    await db.query(`INSERT INTO public.scan_chapter_stages (id, scan_id, production_chapter_id, stage_id, status, assigned_to)
      VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5), ($6, $2, $3, $7, 'DONE', $5)`,
      [ids.sourceStage, ids.scan, ids.chapter, ids.workflow, ids.member, ids.targetStage, ids.targetWorkflow]);
  });

  it('releases exactly once and rejects an unrelated member', async () => {
    await expect(db.query(`SELECT public.release_scan_chapter_stage_ysql($1, $2, false, 'fila')`, [ids.sourceStage, ids.otherMember]))
      .rejects.toThrow(/STAGE_RELEASE_FORBIDDEN/);
    const released = await db.query<{ result: { status: string; availability_version: number } }>(
      `SELECT public.release_scan_chapter_stage_ysql($1, $2, false, 'fila') AS result`, [ids.sourceStage, ids.member]
    );
    expect(released.rows[0].result).toMatchObject({ status: 'AVAILABLE', availability_version: 2 });
    const retried = await db.query<{ result: { idempotent: boolean; availability_version: number } }>(
      `SELECT public.release_scan_chapter_stage_ysql($1, $2, false, 'retry') AS result`, [ids.sourceStage, ids.member]
    );
    expect(retried.rows[0].result).toMatchObject({ idempotent: true, availability_version: 2 });
    expect((await db.query(`SELECT * FROM public.scan_chapter_timeline WHERE event_type = 'RELEASED'`)).rows).toHaveLength(1);
  });

  it('moves the target to rework atomically and releases its former assignee', async () => {
    const moved = await db.query<{ result: { status: string; target_stage_id: string } }>(
      `SELECT public.return_scan_chapter_stage_ysql($1, $2, false, 'clean', 'Balão precisa ser corrigido') AS result`,
      [ids.sourceStage, ids.member]
    );
    expect(moved.rows[0].result).toMatchObject({ status: 'REWORK', target_stage_id: ids.targetStage });
    expect((await db.query(`SELECT status, assigned_to, return_to_stage_id FROM public.scan_chapter_stages WHERE id = $1`, [ids.targetStage])).rows[0])
      .toMatchObject({ status: 'REWORK', assigned_to: null, return_to_stage_id: ids.sourceStage });
  });

  it('limits overrides to leadership and never transfers a task to a non-member', async () => {
    await expect(db.query(
      `SELECT public.admin_override_scan_stage_ysql($1, $2, false, 'REOPEN', 'QA seguro', NULL)`,
      [ids.sourceStage, ids.member]
    )).rejects.toThrow(/STAGE_OVERRIDE_FORBIDDEN/);
    await expect(db.query(
      `SELECT public.admin_override_scan_stage_ysql($1, $2, false, 'TRANSFER', 'QA seguro', $3)`,
      [ids.sourceStage, ids.owner, ids.outsider]
    )).rejects.toThrow(/OVERRIDE_TRANSFER_TARGET_NOT_MEMBER/);
    const transferred = await db.query<{ result: { action: string } }>(
      `SELECT public.admin_override_scan_stage_ysql($1, $2, false, 'TRANSFER', 'Redistribuição segura', $3) AS result`,
      [ids.sourceStage, ids.owner, ids.member]
    );
    expect(transferred.rows[0].result.action).toBe('TRANSFER');
    expect((await db.query(`SELECT status, assigned_to, is_override FROM public.scan_chapter_stages WHERE id = $1`, [ids.sourceStage])).rows[0])
      .toMatchObject({ status: 'IN_PROGRESS', assigned_to: ids.member, is_override: true });
  });

  it('routes the workspace transitions through YSQL rather than legacy RPCs', () => {
    const workspace = readFileSync(resolve('src/routes/scan/+page.server.ts'), 'utf8');
    expect(workspace).toContain('release_scan_chapter_stage_ysql');
    expect(workspace).toContain('return_scan_chapter_stage_ysql');
    expect(workspace).toContain('admin_override_scan_stage_ysql');
    expect(workspace).not.toContain("locals.db.rpc('release_scan_chapter_stage'");
    expect(workspace).not.toContain("locals.db.rpc('return_scan_chapter_stage'");
    expect(workspace).not.toContain("locals.db.rpc('admin_override_scan_stage'");
  });
});
