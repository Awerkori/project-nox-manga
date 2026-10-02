import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '10000000-0000-4000-8000-000000000001',
  work: '10000000-0000-4000-8000-000000000002',
  user: '10000000-0000-4000-8000-000000000003',
  stage: '10000000-0000-4000-8000-000000000004',
  chapter: '10000000-0000-4000-8000-000000000005',
  chapterStage: '10000000-0000-4000-8000-000000000006',
  attemptOne: '10000000-0000-4000-8000-000000000007',
  attemptTwo: '10000000-0000-4000-8000-000000000008',
  attemptThree: '10000000-0000-4000-8000-000000000009',
  delivery: '10000000-0000-4000-8000-000000000010'
};

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.scans (id uuid PRIMARY KEY);
    CREATE TABLE public.works (id uuid PRIMARY KEY);
    CREATE TABLE public.members (id uuid PRIMARY KEY);
    CREATE TABLE public.scan_workflow_stages (
      id uuid PRIMARY KEY, scan_id uuid, slug text, name text,
      requires_output boolean DEFAULT true, dependencies text[]
    );
    CREATE TABLE public.scan_production_chapters (
      id uuid PRIMARY KEY, scan_id uuid, work_id uuid
    );
    CREATE TABLE public.scan_chapter_stages (
      id uuid PRIMARY KEY, scan_id uuid, production_chapter_id uuid, stage_id uuid,
      status text, assigned_to uuid, completed_at timestamptz, completed_by uuid,
      rejection_reason text, return_to_stage_id uuid, notes text,
      last_activity_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.scan_production_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL,
      work_id uuid, production_chapter_id uuid, stage_id uuid, stage_slug text,
      file_name text NOT NULL, byte_size bigint NOT NULL DEFAULT 0, mime_type text,
      file_key text NOT NULL, storage_pool_id uuid, storage_shard_id uuid,
      bot_reference text, telegram_file_id text, sha256 text, provider text NOT NULL DEFAULT 'STORAGE',
      version integer NOT NULL DEFAULT 1, uploaded_by uuid, is_current boolean NOT NULL DEFAULT true,
      note text, input_files jsonb DEFAULT '[]'::jsonb, is_stale boolean DEFAULT false,
      stale_reason text, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.scan_chapter_timeline (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid, production_chapter_id uuid,
      stage_id uuid, stage_slug text, event_type text, user_id uuid, user_name text,
      details jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION public.resolve_scan_chapter_dependencies(uuid)
    RETURNS void LANGUAGE sql AS $$ SELECT; $$;
  `);
}

function migrationPrefix() {
  const migration = readFileSync(resolve('supabase/migrations/20261002090000_scan_pipeline_multifile_deliverables.sql'), 'utf8');
  return migration.slice(0, migration.indexOf('-- The last definition of this function'));
}

function payload(fileKey: string) {
  return JSON.stringify({
    scan_id: ids.scan,
    work_id: ids.work,
    production_chapter_id: ids.chapter,
    stage_id: ids.stage,
    stage_slug: 'traducao',
    delivery_key: ids.delivery,
    file_name: 'Capitulo_84_Parte_1.txt',
    byte_size: 12,
    mime_type: 'text/plain',
    file_key: fileKey,
    provider: 'STORAGE',
    uploaded_by: ids.user,
    is_leadership: false,
    note: ''
  });
}

describe('scan pipeline multi-file migration', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await createSchema(db);
    await db.exec(migrationPrefix());
    await db.query('INSERT INTO public.scans VALUES ($1);', [ids.scan]);
    await db.query('INSERT INTO public.works VALUES ($1);', [ids.work]);
    await db.query('INSERT INTO public.members VALUES ($1);', [ids.user]);
    await db.query(
      "INSERT INTO public.scan_workflow_stages (id, scan_id, slug, name, requires_output) VALUES ($1, $2, 'traducao', 'Tradução', true);",
      [ids.stage, ids.scan]
    );
    await db.query('INSERT INTO public.scan_production_chapters VALUES ($1, $2, $3);', [ids.chapter, ids.scan, ids.work]);
    await db.query(
      "INSERT INTO public.scan_chapter_stages (id, scan_id, production_chapter_id, stage_id, status, assigned_to) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5);",
      [ids.chapterStage, ids.scan, ids.chapter, ids.stage, ids.user]
    );
  });

  it('keeps replacement versioning and currentness atomic per delivery', async () => {
    await db.query(
      `INSERT INTO public.scan_pipeline_upload_attempts (id, scan_id, production_chapter_id, stage_id, user_id, file_name, byte_size)
       VALUES ($1, $2, $3, $4, $5, 'Capitulo_84_Parte_1.txt', 12);`,
      [ids.attemptOne, ids.scan, ids.chapter, ids.stage, ids.user]
    );
    const first = await db.query<{ id: string; version: number }>(
      'SELECT (public.finalize_scan_pipeline_file($1, NULL, $2::jsonb)).*;',
      [ids.attemptOne, payload('artifacts/part-1-v1')]
    );
    expect(first.rows[0].version).toBe(1);

    await db.query(
      `INSERT INTO public.scan_pipeline_upload_attempts (id, scan_id, production_chapter_id, stage_id, user_id, file_name, byte_size)
       VALUES ($1, $2, $3, $4, $5, 'Capitulo_84_Parte_1.txt', 12);`,
      [ids.attemptTwo, ids.scan, ids.chapter, ids.stage, ids.user]
    );
    const second = await db.query<{ id: string; version: number }>(
      'SELECT (public.finalize_scan_pipeline_file($1, $2, $3::jsonb)).*;',
      [ids.attemptTwo, first.rows[0].id, payload('artifacts/part-1-v2')]
    );
    expect(second.rows[0].version).toBe(2);

    const current = await db.query<{ version: number; is_current: boolean }>(
      'SELECT version, is_current FROM public.scan_production_files ORDER BY version;'
    );
    expect(current.rows).toEqual([
      { version: 1, is_current: false },
      { version: 2, is_current: true }
    ]);

    // This models the loser of a simultaneous replacement: it read v1 before
    // the winner committed, but finalization locks and verifies currentness.
    await db.query(
      `INSERT INTO public.scan_pipeline_upload_attempts (id, scan_id, production_chapter_id, stage_id, user_id, file_name, byte_size)
       VALUES ($1, $2, $3, $4, $5, 'Capitulo_84_Parte_1.txt', 12);`,
      [ids.attemptThree, ids.scan, ids.chapter, ids.stage, ids.user]
    );
    await expect(db.query(
      'SELECT (public.finalize_scan_pipeline_file($1, $2, $3::jsonb)).*;',
      [ids.attemptThree, first.rows[0].id, payload('artifacts/part-1-conflict')]
    )).rejects.toThrow(/REPLACEMENT_NOT_CURRENT/);
    const afterConflict = await db.query<{ version: number; is_current: boolean }>(
      'SELECT version, is_current FROM public.scan_production_files ORDER BY version;'
    );
    expect(afterConflict.rows).toEqual([
      { version: 1, is_current: false },
      { version: 2, is_current: true }
    ]);
  });

  it('reopens a completed output after its last current file is withdrawn', async () => {
    await db.query(
      `INSERT INTO public.scan_pipeline_upload_attempts (id, scan_id, production_chapter_id, stage_id, user_id, file_name, byte_size)
       VALUES ($1, $2, $3, $4, $5, 'Capitulo_84_Parte_1.txt', 12);`,
      [ids.attemptOne, ids.scan, ids.chapter, ids.stage, ids.user]
    );
    const inserted = await db.query<{ id: string }>(
      'SELECT (public.finalize_scan_pipeline_file($1, NULL, $2::jsonb)).*;',
      [ids.attemptOne, payload('artifacts/part-1-v1')]
    );
    await db.query("UPDATE public.scan_chapter_stages SET status = 'DONE' WHERE id = $1;", [ids.chapterStage]);
    await db.query('SELECT public.withdraw_scan_pipeline_file($1, $2, $3, false);', [inserted.rows[0].id, ids.user, 'QA']);

    const stage = await db.query<{ status: string }>('SELECT status FROM public.scan_chapter_stages WHERE id = $1;', [ids.chapterStage]);
    const files = await db.query<{ is_current: boolean }>('SELECT is_current FROM public.scan_production_files WHERE id = $1;', [inserted.rows[0].id]);
    expect(stage.rows[0].status).toBe('REWORK');
    expect(files.rows[0].is_current).toBe(false);
  });
});
