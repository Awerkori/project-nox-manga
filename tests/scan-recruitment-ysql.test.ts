import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '20000000-0000-4000-8000-000000000001',
  owner: '20000000-0000-4000-8000-000000000002',
  applicant: '20000000-0000-4000-8000-000000000003',
  outsider: '20000000-0000-4000-8000-000000000004',
  position: '20000000-0000-4000-8000-000000000005',
  opening: '20000000-0000-4000-8000-000000000006',
  question: '20000000-0000-4000-8000-000000000007',
  workflowStage: '20000000-0000-4000-8000-000000000008',
  chapterStage: '20000000-0000-4000-8000-000000000009',
  chapter: '20000000-0000-4000-8000-000000000010',
  secondPosition: '20000000-0000-4000-8000-000000000011'
};

function migration() {
  return readFileSync(resolve('yugabyte/migrations/20261002210000_scan_recruitment_ysql.sql'), 'utf8');
}

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE public.scans (id uuid PRIMARY KEY, name text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE');
    CREATE TABLE public.members (id uuid PRIMARY KEY, username text, display_name text);
    CREATE TABLE public.scan_members (
      scan_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL,
      PRIMARY KEY (scan_id, user_id)
    );
    CREATE TABLE public.scan_positions (id uuid PRIMARY KEY, scan_id uuid NOT NULL, name text NOT NULL);
    CREATE TABLE public.scan_recruitment_openings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, position_id uuid NOT NULL,
      title text NOT NULL, description text NOT NULL DEFAULT '', requirements text NOT NULL DEFAULT '',
      language text NOT NULL DEFAULT 'pt-BR', experience_level text NOT NULL DEFAULT 'QUALQUER',
      availability text NOT NULL DEFAULT '', slots integer, notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'OPEN',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, opening_id uuid NOT NULL,
      position_id uuid NOT NULL, user_id uuid NOT NULL, experience text NOT NULL DEFAULT '',
      availability text NOT NULL DEFAULT '', presentation text NOT NULL DEFAULT '', portfolio_url text,
      contact_info text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'PENDING', internal_notes text,
      reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_recruitment_questions (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, opening_id uuid NOT NULL, question text NOT NULL,
      question_type text NOT NULL DEFAULT 'TEXT_SHORT', options jsonb NOT NULL DEFAULT '[]'::jsonb,
      required boolean NOT NULL DEFAULT true, display_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_application_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL, question_id uuid NOT NULL,
      answer text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(application_id, question_id)
    );
    CREATE TABLE public.scan_member_positions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, user_id uuid NOT NULL,
      position_id uuid NOT NULL, is_primary boolean NOT NULL DEFAULT false, UNIQUE(scan_id, user_id, position_id)
    );
    CREATE TABLE public.scan_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, user_id uuid,
      action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, user_id uuid NOT NULL,
      parent_id uuid, body text NOT NULL, removed boolean NOT NULL DEFAULT false, pinned boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_comment_likes (
      user_id uuid NOT NULL, comment_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, comment_id)
    );
    CREATE TABLE public.scan_comment_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), comment_id uuid NOT NULL, user_id uuid NOT NULL,
      reason text NOT NULL, status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.scan_workflow_stages (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, slug text NOT NULL, name text NOT NULL,
      allowed_position_ids uuid[]
    );
    CREATE TABLE public.scan_chapter_stages (
      id uuid PRIMARY KEY, scan_id uuid NOT NULL, production_chapter_id uuid, chapter_id uuid, stage_id uuid NOT NULL,
      status text NOT NULL, assigned_to uuid, claimed_at timestamptz, last_activity_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.scan_chapter_timeline (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, production_chapter_id uuid,
      stage_id uuid, stage_slug text, event_type text, user_id uuid, user_name text, details jsonb NOT NULL DEFAULT '{}'::jsonb
    );
  `);
}

describe('scan recruitment YSQL migration', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await createSchema(db);
    await db.exec(migration());
    await db.query(`INSERT INTO public.scans (id, name, status) VALUES ($1, 'QA Scan', 'ACTIVE')`, [ids.scan]);
    await db.query(`INSERT INTO public.members (id, username) VALUES ($1, 'owner'), ($2, 'applicant'), ($3, 'outsider')`, [ids.owner, ids.applicant, ids.outsider]);
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'OWNER')`, [ids.scan, ids.owner]);
    await db.query(`INSERT INTO public.scan_positions VALUES ($1, $2, 'Tradutor')`, [ids.position, ids.scan]);
    await db.query(`INSERT INTO public.scan_positions VALUES ($1, $2, 'Revisor')`, [ids.secondPosition, ids.scan]);
    await db.query(
      `INSERT INTO public.scan_recruitment_openings (id, scan_id, position_id, title, status)
       VALUES ($1, $2, $3, 'Tradutor PT-BR', 'OPEN')`,
      [ids.opening, ids.scan, ids.position]
    );
    await db.query(
      `INSERT INTO public.scan_recruitment_questions (id, scan_id, opening_id, question, required)
       VALUES ($1, $2, $3, 'Mostre uma experiência relacionada', true)`,
      [ids.question, ids.scan, ids.opening]
    );
  });

  it('writes an application and its answers atomically, and rejects a duplicate active application', async () => {
    const applied = await db.query<{ result: { application_id: string; leader_ids: string[] } }>(
      `SELECT public.apply_for_scan_opening_ysql($1, $2, $3, $4, $5, $6, $7, $8::jsonb) AS result`,
      [ids.opening, ids.applicant, '1 ano', '10h', 'Olá', 'https://example.test/portfolio', 'Discord', JSON.stringify([{ question_id: ids.question, answer: 'Traduzi capítulos.' }])]
    );
    const applicationId = applied.rows[0].result.application_id;
    expect(applied.rows[0].result.leader_ids).toEqual([ids.owner]);
    expect((await db.query('SELECT * FROM public.scan_application_answers WHERE application_id = $1', [applicationId])).rows).toHaveLength(1);
    await expect(db.query(
      `SELECT public.apply_for_scan_opening_ysql($1, $2, '', '', '', NULL, '', '[]'::jsonb)`,
      [ids.opening, ids.applicant]
    )).rejects.toThrow(/APPLICATION_ALREADY_ACTIVE/);
  });

  it('requires every required question before it writes an application', async () => {
    await expect(db.query(
      `SELECT public.apply_for_scan_opening_ysql($1, $2, '', '', '', NULL, '', '[]'::jsonb)`,
      [ids.opening, ids.applicant]
    )).rejects.toThrow(/APPLICATION_REQUIRED_ANSWER_MISSING/);
    expect((await db.query('SELECT * FROM public.scan_applications')).rows).toHaveLength(0);
  });

  it('enforces management RBAC and safely adds an approved applicant exactly once', async () => {
    await expect(db.query(
      `SELECT public.manage_scan_opening_ysql($1, $2, false, NULL, $3, 'Nova vaga', '', '', 'pt-BR', 'QUALQUER', '', NULL, '', 'OPEN')`,
      [ids.scan, ids.outsider, ids.position]
    )).rejects.toThrow(/RECRUITMENT_MANAGEMENT_FORBIDDEN/);

    const applied = await db.query<{ result: { application_id: string } }>(
      `SELECT public.apply_for_scan_opening_ysql($1, $2, '', '', '', NULL, '', $3::jsonb) AS result`,
      [ids.opening, ids.applicant, JSON.stringify([{ question_id: ids.question, answer: 'Resposta' }])]
    );
    const applicationId = applied.rows[0].result.application_id;
    await expect(db.query(
      `SELECT public.review_scan_application_ysql($1, $2, false, 'APPROVE', NULL, true, 'MEMBER')`,
      [applicationId, ids.outsider]
    )).rejects.toThrow(/APPLICATION_REVIEW_FORBIDDEN/);

    const reviewed = await db.query<{ result: { status: string; added_to_team: boolean } }>(
      `SELECT public.review_scan_application_ysql($1, $2, false, 'APPROVE', 'Bem-vindo', true, 'MEMBER') AS result`,
      [applicationId, ids.owner]
    );
    expect(reviewed.rows[0].result).toMatchObject({ status: 'APPROVED', added_to_team: true });
    expect((await db.query(`SELECT role FROM public.scan_members WHERE scan_id = $1 AND user_id = $2`, [ids.scan, ids.applicant])).rows).toEqual([{ role: 'MEMBER' }]);
    await expect(db.query(
      `SELECT public.review_scan_application_ysql($1, $2, false, 'REJECT', NULL, false, 'MEMBER')`,
      [applicationId, ids.owner]
    )).rejects.toThrow(/APPLICATION_ALREADY_FINALIZED/);
  });

  it('keeps public comment replies, likes and moderation on YSQL with backend RBAC', async () => {
    const parent = await db.query<{ result: { comment_id: string } }>(
      `SELECT public.post_scan_comment_ysql($1, $2, 'Comentário raiz', NULL) AS result`,
      [ids.scan, ids.applicant]
    );
    const parentId = parent.rows[0].result.comment_id;
    const reply = await db.query<{ result: { parent_author_id: string } }>(
      `SELECT public.post_scan_comment_ysql($1, $2, 'Resposta', $3) AS result`,
      [ids.scan, ids.outsider, parentId]
    );
    expect(reply.rows[0].result.parent_author_id).toBe(ids.applicant);

    const liked = await db.query<{ result: { liked: boolean; likes_count: number } }>(
      `SELECT public.toggle_scan_comment_like_ysql($1, $2) AS result`,
      [parentId, ids.owner]
    );
    expect(liked.rows[0].result).toEqual({ success: true, liked: true, likes_count: 1 });
    await expect(db.query(
      `SELECT public.moderate_scan_comment_ysql($1, $2, false, 'REMOVE')`,
      [parentId, ids.outsider]
    )).rejects.toThrow(/COMMENT_MODERATION_FORBIDDEN/);
    await db.query(
      `SELECT public.moderate_scan_comment_ysql($1, $2, false, 'REMOVE')`,
      [parentId, ids.owner]
    );
    expect((await db.query(`SELECT removed FROM public.scan_comments WHERE id = $1`, [parentId])).rows).toEqual([{ removed: true }]);
  });

  it('makes the stage claim atomic and prevents a second member from taking it', async () => {
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'MEMBER')`, [ids.scan, ids.applicant]);
    await db.query(
      `INSERT INTO public.scan_workflow_stages (id, scan_id, slug, name, allowed_position_ids)
       VALUES ($1, $2, 'traducao', 'Tradução', ARRAY[$3::uuid])`,
      [ids.workflowStage, ids.scan, ids.position]
    );
    await db.query(
      `INSERT INTO public.scan_chapter_stages (id, scan_id, production_chapter_id, stage_id, status)
       VALUES ($1, $2, $3, $4, 'AVAILABLE')`,
      [ids.chapterStage, ids.scan, ids.chapter, ids.workflowStage]
    );
    await db.query(
      `INSERT INTO public.scan_member_positions (scan_id, user_id, position_id, is_primary)
       VALUES ($1, $2, $3, true)`,
      [ids.scan, ids.applicant, ids.position]
    );
    const first = await db.query<{ result: { status: string } }>(
      `SELECT public.claim_scan_chapter_stage_ysql($1, $2, false) AS result`,
      [ids.chapterStage, ids.applicant]
    );
    expect(first.rows[0].result.status).toBe('IN_PROGRESS');
    await expect(db.query(
      `SELECT public.claim_scan_chapter_stage_ysql($1, $2, false)`,
      [ids.chapterStage, ids.owner]
    )).rejects.toThrow(/STAGE_ALREADY_CLAIMED/);
    expect((await db.query(`SELECT assigned_to, status FROM public.scan_chapter_stages WHERE id = $1`, [ids.chapterStage])).rows)
      .toEqual([{ assigned_to: ids.applicant, status: 'IN_PROGRESS' }]);
  });

  it('serializes member-position changes and keeps exactly one primary position', async () => {
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'MEMBER')`, [ids.scan, ids.applicant]);
    await expect(db.query(
      `SELECT public.manage_scan_member_position_ysql('ASSIGN', $1, $2, false, $3, $4, true)`,
      [ids.scan, ids.outsider, ids.applicant, ids.position]
    )).rejects.toThrow(/MEMBER_POSITION_FORBIDDEN/);

    await db.query(
      `SELECT public.manage_scan_member_position_ysql('ASSIGN', $1, $2, false, $3, $4, true)`,
      [ids.scan, ids.owner, ids.applicant, ids.position]
    );
    await db.query(
      `SELECT public.manage_scan_member_position_ysql('ASSIGN', $1, $2, false, $3, $4, true)`,
      [ids.scan, ids.owner, ids.applicant, ids.secondPosition]
    );
    expect((await db.query<{ position_id: string; is_primary: boolean }>(
      `SELECT position_id, is_primary FROM public.scan_member_positions WHERE scan_id = $1 AND user_id = $2 ORDER BY position_id`,
      [ids.scan, ids.applicant]
    )).rows).toEqual([
      { position_id: ids.position, is_primary: false },
      { position_id: ids.secondPosition, is_primary: true }
    ]);

    await db.query(
      `SELECT public.manage_scan_member_position_ysql('REMOVE', $1, $2, false, $3, $4, false)`,
      [ids.scan, ids.owner, ids.applicant, ids.secondPosition]
    );
    expect((await db.query<{ position_id: string; is_primary: boolean }>(
      `SELECT position_id, is_primary FROM public.scan_member_positions WHERE scan_id = $1 AND user_id = $2`,
      [ids.scan, ids.applicant]
    )).rows).toEqual([{ position_id: ids.position, is_primary: true }]);
  });
});
