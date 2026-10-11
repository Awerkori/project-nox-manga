import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const phaseOne = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261011090000_add_reader_canonical_chapter_identity.sql'), 'utf8');
const phaseTwo = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261011091000_enable_reader_canonical_chapter_identity.sql'), 'utf8');

describe('canonical Reader chapter identity migration', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT '00000000-0000-4000-8000-000000000098'::uuid
      $$;
      CREATE FUNCTION public.is_editor() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
      CREATE TABLE public.works (id uuid PRIMARY KEY);
      CREATE TABLE public.chapters (
        id uuid PRIMARY KEY,
        work_id uuid NOT NULL REFERENCES public.works(id),
        number numeric NOT NULL,
        title text NOT NULL DEFAULT '',
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(work_id,number)
      );
      CREATE TABLE public.media (id uuid PRIMARY KEY);
      CREATE TABLE public.scans (id uuid PRIMARY KEY);
      CREATE TABLE public.work_scans (work_id uuid NOT NULL, scan_id uuid NOT NULL, PRIMARY KEY(work_id,scan_id));
      CREATE TABLE public.chapter_scans (chapter_id uuid NOT NULL, scan_id uuid NOT NULL, PRIMARY KEY(chapter_id,scan_id));
      CREATE TABLE public.audit_log (actor_id uuid, action text, target_id uuid, metadata jsonb);
      CREATE TABLE public.pages (
        chapter_id uuid NOT NULL REFERENCES public.chapters(id),
        position integer NOT NULL,
        media_id uuid NOT NULL REFERENCES public.media(id),
        PRIMARY KEY(chapter_id,position)
      );
      INSERT INTO public.works VALUES ('00000000-0000-4000-8000-000000000001');
      INSERT INTO public.media VALUES ('00000000-0000-4000-8000-000000000099');
      INSERT INTO public.chapters(id,work_id,number,title) VALUES
        ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',7,'Capítulo legado');
      INSERT INTO public.pages VALUES
        ('00000000-0000-4000-8000-000000000011',1,'00000000-0000-4000-8000-000000000099');
    `);
  });

  afterEach(async () => { await db.close(); });

  it('backfills legacy rows without changing their UUID then permits text-distinct future chapters', async () => {
    await db.exec(phaseOne);
    expect((await db.query(`SELECT public.backfill_reader_canonical_chapter_identity(1) AS changed`)).rows[0].changed).toBe(1);
    expect((await db.query(`SELECT public.backfill_reader_canonical_chapter_identity(1) AS changed`)).rows[0].changed).toBe(0);

    const legacy = await db.query(`SELECT id::text,number::text,display_number,canonical_chapter_key,chapter_order_key
      FROM public.chapters WHERE id='00000000-0000-4000-8000-000000000011'`);
    expect(legacy.rows[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000011',
      number: '7',
      display_number: '7',
      canonical_chapter_key: 'legacy:00000000-0000-4000-8000-000000000011'
    });
    expect((await db.query(`SELECT chapter_id::text,position,media_id::text FROM public.pages`)).rows).toEqual([{
      chapter_id: '00000000-0000-4000-8000-000000000011', position: 1,
      media_id: '00000000-0000-4000-8000-000000000099'
    }]);

    await db.exec(phaseTwo);
    await db.query(`INSERT INTO public.chapters(
      id,work_id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title
    ) VALUES
      ('00000000-0000-4000-8000-000000000021',$1,12.1,'12.1','pt-br|default|chapter|12.1|-','n|000000000012|100000000000|1||','chapter','default','pt-BR','Um'),
      ('00000000-0000-4000-8000-000000000022',$1,12.10,'12.10','pt-br|default|chapter|12.10|-','n|000000000012|100000000000|10||','chapter','default','pt-BR','Dez'),
      ('00000000-0000-4000-8000-000000000023',$1,NULL,'Prólogo','pt-br|default|special|pr%C3%B3logo|pr%C3%B3logo','z|pr%C3%B3logo|pr%C3%B3logo','special','default','pt-BR','Prólogo'),
      ('00000000-0000-4000-8000-000000000024',$1,12.1,'12.1','en|official|chapter|12.1|-','n|000000000012|100000000000|1||','chapter','official','en','One')`,
      ['00000000-0000-4000-8000-000000000001']);

    const rows = await db.query(`SELECT id::text,number::text,display_number,canonical_chapter_key,chapter_kind,edition,language
      FROM public.chapters WHERE work_id=$1 ORDER BY chapter_order_key,canonical_chapter_key`, ['00000000-0000-4000-8000-000000000001']);
    expect(rows.rows).toHaveLength(5);
    expect(rows.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ display_number: '12.1', canonical_chapter_key: 'pt-br|default|chapter|12.1|-' }),
      expect.objectContaining({ display_number: '12.10', canonical_chapter_key: 'pt-br|default|chapter|12.10|-' }),
      expect.objectContaining({ display_number: 'Prólogo', number: null, chapter_kind: 'special' }),
      expect.objectContaining({ display_number: '12.1', edition: 'official', language: 'en' })
    ]));
    await expect(db.query(`INSERT INTO public.chapters(
      id,work_id,number,display_number,canonical_chapter_key,chapter_order_key,chapter_kind,edition,language,title
    ) VALUES ('00000000-0000-4000-8000-000000000025',$1,99,'Duplicado','pt-br|default|chapter|12.10|-','n|999','chapter','default','pt-BR','Não pode')`,
      ['00000000-0000-4000-8000-000000000001'])).rejects.toThrow();
  });

  it('refuses phase two while any existing row has not been backfilled', async () => {
    await db.exec(phaseOne);
    await expect(db.exec(phaseTwo)).rejects.toThrow('backfill is incomplete');
  });

  it('writes textual manual identities atomically after the cutover schema is active', async () => {
    await db.exec(phaseOne);
    await db.query(`SELECT public.backfill_reader_canonical_chapter_identity(20)`);
    await db.exec(phaseTwo);
    await db.query(`INSERT INTO public.works VALUES ('00000000-0000-4000-8000-000000000002')`);

    const write = async (id: string, data: Record<string, unknown>) => db.query(
      `SELECT public.editor_chapter_identity_action($1::jsonb) AS result`,
      [JSON.stringify({ id, work_id: '00000000-0000-4000-8000-000000000002', scans: [], ...data })]
    );
    await write('00000000-0000-4000-8000-000000000031', {
      number: '12.1', display_number: '12.1', canonical_chapter_key: 'pt-br|default|chapter|12.1|-',
      chapter_order_key: 'n|000000000012|100000000000|1||', chapter_kind: 'chapter', edition: 'default', language: 'pt-BR', title: 'Um'
    });
    await write('00000000-0000-4000-8000-000000000032', {
      number: '12.10', display_number: '12.10', canonical_chapter_key: 'pt-br|default|chapter|12.10|-',
      chapter_order_key: 'n|000000000012|100000000000|10||', chapter_kind: 'chapter', edition: 'default', language: 'pt-BR', title: 'Dez'
    });
    await write('00000000-0000-4000-8000-000000000033', {
      number: null, display_number: 'Prólogo', canonical_chapter_key: 'pt-br|default|special|pr%C3%B3logo|pr%C3%B3logo',
      chapter_order_key: 'z|pr%C3%B3logo|pr%C3%B3logo', chapter_kind: 'special', edition: 'default', language: 'pt-BR', title: 'Prólogo'
    });
    await write('00000000-0000-4000-8000-000000000034', {
      number: '12.1', display_number: '12.1', canonical_chapter_key: 'en|official|chapter|12.1|-',
      chapter_order_key: 'n|000000000012|100000000000|1||', chapter_kind: 'chapter', edition: 'official', language: 'en', title: 'Official'
    });

    const rows = await db.query(`SELECT number::text,display_number,canonical_chapter_key,chapter_kind,edition,language
      FROM public.chapters WHERE work_id='00000000-0000-4000-8000-000000000002' ORDER BY canonical_chapter_key`);
    expect(rows.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ display_number: '12.1', canonical_chapter_key: 'pt-br|default|chapter|12.1|-' }),
      expect.objectContaining({ display_number: '12.10', canonical_chapter_key: 'pt-br|default|chapter|12.10|-' }),
      expect.objectContaining({ display_number: 'Prólogo', number: null, chapter_kind: 'special' }),
      expect.objectContaining({ edition: 'official', language: 'en' })
    ]));
    expect((await db.query(`SELECT count(*)::int AS count FROM public.audit_log WHERE action='chapter'`)).rows[0].count).toBe(4);
  });
});
