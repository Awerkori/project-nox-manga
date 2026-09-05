import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite({ extensions: { pg_trgm } });
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
  // gen_random_uuid is built into PostgreSQL; hosted pgcrypto is not needed in this local test.
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const migration = readFileSync(`supabase/migrations/${file}`, 'utf8').replace(
      'create extension if not exists pgcrypto;',
      ''
    );
    await db.exec(migration);
  }
  const results = await db.exec(readFileSync('tests/rls.sql', 'utf8'));
  console.log(results.flatMap((r) => r.rows).filter((r) => r.result));
  const limits = await db.exec(readFileSync('tests/limits.sql', 'utf8'));
  console.log(limits.flatMap((r) => r.rows).filter((r) => r.result));
  const counts = await db.query('select count(*)::integer as users from auth.users');
  if (counts.rows[0].users !== 0) throw new Error('Test transaction was not rolled back');
  console.log('PASS: no test users or content retained. Local PostgreSQL only.');
} catch (e) {
  console.error({ message: e.message, position: e.position, where: e.where });
  process.exitCode = 1;
} finally {
  await db.close();
}
