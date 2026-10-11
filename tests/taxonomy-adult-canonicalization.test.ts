import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve('supabase/migrations/20261001010000_taxonomy_adult_canonicalization.sql'),
  'utf8'
);

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create type public.tag_kind as enum ('TAG', 'GENRE');
    create table public.tags (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      slug text not null unique,
      kind public.tag_kind not null
    );
    create table public.works (id uuid primary key default gen_random_uuid());
    create table public.work_tags (
      work_id uuid not null references public.works(id) on delete cascade,
      tag_id uuid not null references public.tags(id) on delete cascade,
      system_generated boolean not null default false,
      primary key (work_id, tag_id)
    );
    create table public.audit_log (
      id uuid primary key default gen_random_uuid(),
      actor_id uuid,
      action text,
      target_id uuid,
      metadata jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function public.is_owner() returns boolean language sql stable as $$
      select coalesce(current_setting('app.taxonomy_owner', true), 'false') = 'true'
    $$;
  `);
  return db;
}

describe('adult taxonomy canonicalization migration', () => {
  it('moves every known adult alias to one canonical relationship idempotently', async () => {
    const db = await database();
    try {
      await db.exec(`
        insert into public.tags(id, name, slug, kind) values
          ('10000000-0000-4000-8000-000000000001', 'Adulto (+18)', 'adulto-18', 'GENRE'),
          ('10000000-0000-4000-8000-000000000002', 'Adulto', 'adulto', 'TAG'),
          ('10000000-0000-4000-8000-000000000003', '+18', '18', 'TAG');
        insert into public.works(id) values
          ('20000000-0000-4000-8000-000000000001'),
          ('20000000-0000-4000-8000-000000000002');
        insert into public.work_tags(work_id, tag_id, system_generated) values
          ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', false),
          ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', true),
          ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', true),
          ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', true);
      `);

      await db.exec(migration);
      await db.exec(migration);

      const tags = await db.query(`select id, name, slug, kind from public.tags order by slug`);
      expect(tags.rows).toEqual([
        { id: '10000000-0000-4000-8000-000000000001', name: 'Adulto (+18)', slug: 'adulto-18', kind: 'GENRE' }
      ]);
      const relations = await db.query(
        `select work_id, tag_id, system_generated from public.work_tags order by work_id`
      );
      expect(relations.rows).toEqual([
        {
          work_id: '20000000-0000-4000-8000-000000000001',
          tag_id: '10000000-0000-4000-8000-000000000001',
          system_generated: false
        },
        {
          work_id: '20000000-0000-4000-8000-000000000002',
          tag_id: '10000000-0000-4000-8000-000000000001',
          system_generated: true
        }
      ]);

      await expect(
        db.exec(`insert into public.tags(name, slug, kind) values ('18+', '18-plus', 'TAG')`)
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  it('keeps deletion owner-only and requires explicit unassignment', async () => {
    const db = await database();
    try {
      await db.exec(migration);
      await db.exec(`
        insert into public.tags(id, name, slug, kind) values ('30000000-0000-4000-8000-000000000001', 'Murim', 'murim', 'TAG');
        insert into public.works(id) values ('40000000-0000-4000-8000-000000000001');
        insert into public.work_tags(work_id, tag_id) values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
      `);

      await expect(
        db.query(`select public.delete_taxonomy_term('30000000-0000-4000-8000-000000000001', true)`)
      ).rejects.toThrow();

      await db.exec(`select set_config('app.taxonomy_owner', 'true', false)`);
      await expect(
        db.query(`select public.delete_taxonomy_term('30000000-0000-4000-8000-000000000001', false)`)
      ).rejects.toThrow();
      await db.query(`select public.delete_taxonomy_term('30000000-0000-4000-8000-000000000001', true)`);
      expect(
        (await db.query(`select count(*)::int as count from public.tags where slug = 'murim'`)).rows[0]
      ).toEqual({ count: 0 });
    } finally {
      await db.close();
    }
  });
});
