import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ids = {
  scan: '50000000-0000-4000-8000-000000000001',
  owner: '50000000-0000-4000-8000-000000000002',
  member: '50000000-0000-4000-8000-000000000003',
  outsider: '50000000-0000-4000-8000-000000000004',
  chapter: '50000000-0000-4000-8000-000000000005',
  stage: '50000000-0000-4000-8000-000000000006'
};

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE public.scans (id uuid PRIMARY KEY);
    CREATE TABLE public.members (id uuid PRIMARY KEY, username text, display_name text);
    CREATE TABLE public.scan_members (scan_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, PRIMARY KEY(scan_id, user_id));
    CREATE TABLE public.scan_production_chapters (id uuid PRIMARY KEY, scan_id uuid NOT NULL);
    CREATE TABLE public.scan_workflow_stages (id uuid PRIMARY KEY, scan_id uuid NOT NULL, name text NOT NULL, slug text NOT NULL);
    CREATE TABLE public.scan_chapter_timeline (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scan_id uuid NOT NULL, production_chapter_id uuid NOT NULL,
      stage_id uuid, stage_slug text, event_type text NOT NULL, user_id uuid, user_name text,
      details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

function migration() {
  return readFileSync(resolve('yugabyte/migrations/20261002240000_scan_chapter_notes_ysql.sql'), 'utf8');
}

describe('scan chapter notes YSQL migration', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await createSchema(db);
    await db.exec(migration());
    await db.query('INSERT INTO public.scans VALUES ($1)', [ids.scan]);
    await db.query(`INSERT INTO public.members VALUES ($1, 'owner', 'Dona'), ($2, 'member', 'Membro'), ($3, 'outsider', 'Fora')`, [ids.owner, ids.member, ids.outsider]);
    await db.query(`INSERT INTO public.scan_members VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')`, [ids.scan, ids.owner, ids.member]);
    await db.query(`INSERT INTO public.scan_production_chapters VALUES ($1, $2)`, [ids.chapter, ids.scan]);
    await db.query(`INSERT INTO public.scan_workflow_stages VALUES ($1, $2, 'Tradução', 'traducao')`, [ids.stage, ids.scan]);
  });

  it('records a stage-aware note and an immutable audit event', async () => {
    const created = await db.query<{ result: { note_id: string } }>(
      `SELECT public.create_scan_chapter_note_ysql($1, $2, $3, false, $4, $5, 'IMPORTANT') AS result`,
      [ids.scan, ids.chapter, ids.member, ids.stage, 'Manter a onomatopeia original.']
    );
    const noteId = created.rows[0].result.note_id;
    expect((await db.query('SELECT kind, body FROM public.scan_chapter_notes WHERE id = $1', [noteId])).rows)
      .toEqual([{ kind: 'IMPORTANT', body: 'Manter a onomatopeia original.' }]);
    expect((await db.query('SELECT event_type FROM public.scan_chapter_note_events WHERE note_id = $1', [noteId])).rows)
      .toEqual([{ event_type: 'CREATED' }]);
    expect((await db.query(`SELECT event_type, stage_id FROM public.scan_chapter_timeline WHERE production_chapter_id = $1`, [ids.chapter])).rows)
      .toEqual([{ event_type: 'NOTE_ADDED', stage_id: ids.stage }]);
  });

  it('allows the author to edit/delete, but reserves pinning and moderation for leadership', async () => {
    const made = await db.query<{ result: { note_id: string } }>(
      `SELECT public.create_scan_chapter_note_ysql($1, $2, $3, false, $4, 'Checar página 17.', 'PENDING') AS result`,
      [ids.scan, ids.chapter, ids.member, ids.stage]
    );
    const noteId = made.rows[0].result.note_id;
    await expect(db.query(`SELECT public.pin_scan_chapter_note_ysql($1, $2, false, true)`, [noteId, ids.member]))
      .rejects.toThrow(/CHAPTER_NOTE_PIN_FORBIDDEN/);
    await db.query(`SELECT public.edit_scan_chapter_note_ysql($1, $2, false, $3, 'NORMAL')`, [noteId, ids.member, 'A página 17 foi checada.']);
    await db.query(`SELECT public.pin_scan_chapter_note_ysql($1, $2, false, true)`, [noteId, ids.owner]);
    expect((await db.query('SELECT body, kind, is_pinned FROM public.scan_chapter_notes WHERE id = $1', [noteId])).rows)
      .toEqual([{ body: 'A página 17 foi checada.', kind: 'NORMAL', is_pinned: true }]);
    await db.query(`SELECT public.delete_scan_chapter_note_ysql($1, $2, false)`, [noteId, ids.member]);
    expect((await db.query('SELECT deleted_at, is_pinned FROM public.scan_chapter_notes WHERE id = $1', [noteId])).rows[0])
      .toMatchObject({ is_pinned: false });
    expect((await db.query('SELECT event_type FROM public.scan_chapter_note_events WHERE note_id = $1 ORDER BY created_at', [noteId])).rows)
      .toEqual([{ event_type: 'CREATED' }, { event_type: 'EDITED' }, { event_type: 'PINNED' }, { event_type: 'DELETED' }]);
  });

  it('does not let a non-member read the chapter through a note mutation', async () => {
    await expect(db.query(
      `SELECT public.create_scan_chapter_note_ysql($1, $2, $3, false, $4, 'tentativa', 'NORMAL')`,
      [ids.scan, ids.chapter, ids.outsider, ids.stage]
    )).rejects.toThrow(/SCAN_MEMBERSHIP_REQUIRED/);
    expect((await db.query('SELECT * FROM public.scan_chapter_notes')).rows).toHaveLength(0);
  });
});
