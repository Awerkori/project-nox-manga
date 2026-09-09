begin;

create function pg_temp.assert_true(value boolean, label text)
returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end
$$;

create function pg_temp.denied(query text, label text)
returns void language plpgsql as $$
begin
  execute query;
  raise exception 'FAIL: % allowed', label;
exception
  when insufficient_privilege then null;
end
$$;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  ('12000001-0000-4000-8000-000000000001', 'adult@example.invalid', now(), '{}'),
  ('12000002-0000-4000-8000-000000000002', 'minor@example.invalid', now(), '{}'),
  ('12000003-0000-4000-8000-000000000003', 'editor-hardening@example.invalid', now(), '{}');

update public.members set age_status = 'ADULT' where id = '12000001-0000-4000-8000-000000000001';
update public.members set age_status = 'MINOR' where id = '12000002-0000-4000-8000-000000000002';
update public.access_roles set role = 'EDITOR' where user_id = '12000003-0000-4000-8000-000000000003';

insert into public.media(id, provider, provider_key, mime, width, height, bytes, sha256, created_by) values
  ('22000000-0000-4000-8000-000000000001', 'supabase', 'hardening-1', 'image/png', 10, 10, 100, 'h1', '12000003-0000-4000-8000-000000000003'),
  ('22000000-0000-4000-8000-000000000002', 'supabase', 'hardening-2', 'image/png', 10, 10, 100, 'h2', '12000003-0000-4000-8000-000000000003'),
  ('22000000-0000-4000-8000-000000000003', 'supabase', 'hardening-3', 'image/png', 10, 10, 100, 'h3', '12000003-0000-4000-8000-000000000003');

insert into public.works(id, slug, title, synopsis, published, content_rating) values
  ('32000000-0000-4000-8000-000000000001', 'adult-hardening', 'Adult hardening', 'Test', true, 'ADULT_18'),
  ('32000000-0000-4000-8000-000000000002', 'general-hardening', 'General hardening', 'Test', true, 'GENERAL');

insert into public.chapters(id, work_id, number, published_at) values
  ('42000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 1, now()),
  ('42000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000002', 1, now());

insert into public.pages(chapter_id, position, media_id, width, height) values
  ('42000000-0000-4000-8000-000000000001', 1, '22000000-0000-4000-8000-000000000001', 10, 10),
  ('42000000-0000-4000-8000-000000000002', 1, '22000000-0000-4000-8000-000000000001', 10, 10),
  ('42000000-0000-4000-8000-000000000002', 2, '22000000-0000-4000-8000-000000000002', 10, 10),
  ('42000000-0000-4000-8000-000000000002', 3, '22000000-0000-4000-8000-000000000003', 10, 10);

set local role anon;
select pg_temp.assert_true(
  not exists(select 1 from public.works where id = '32000000-0000-4000-8000-000000000001'),
  'anonymous cannot enumerate adult work'
);
select pg_temp.assert_true(
  not public.public_chapter('42000000-0000-4000-8000-000000000001'),
  'anonymous cannot enumerate adult chapter'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000002-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  not exists(select 1 from public.pages where chapter_id = '42000000-0000-4000-8000-000000000001'),
  'minor cannot enumerate adult pages'
);

select set_config('request.jwt.claim.sub', '12000001-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  public.public_chapter('42000000-0000-4000-8000-000000000001'),
  'adult member can read adult chapter'
);

set local role postgres;
insert into public.importer_staff_requests(work_id, requested_by, reason)
values (
  '32000000-0000-4000-8000-000000000002',
  '12000003-0000-4000-8000-000000000003',
  'security hardening test'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000003-0000-4000-8000-000000000003', true);
select pg_temp.denied(
  'update public.importer_staff_requests set priority_boost = 1000',
  'editor direct importer request mutation'
);

select set_config('request.jwt.claim.sub', '12000001-0000-4000-8000-000000000001', true);
select public.member_action(
  'read_start',
  '{"work_id":"32000000-0000-4000-8000-000000000002","chapter_id":"42000000-0000-4000-8000-000000000002"}'
);

set local role postgres;
update public.reading
set started_at = now() - interval '30 seconds'
where user_id = '12000001-0000-4000-8000-000000000001'
  and chapter_id = '42000000-0000-4000-8000-000000000002';
update public.reading_sessions
set accepted_at = now() - interval '4 seconds'
where user_id = '12000001-0000-4000-8000-000000000001'
  and chapter_id = '42000000-0000-4000-8000-000000000002';

set local role authenticated;
do $$
begin
  perform public.member_action(
    'read_page',
    '{"work_id":"32000000-0000-4000-8000-000000000002","chapter_id":"42000000-0000-4000-8000-000000000002","page":3}'
  );
  raise exception 'FAIL: final-page jump allowed';
exception
  when sqlstate '22023' then null;
end
$$;
select pg_temp.assert_true(
  (select xp = 0 from public.members where id = auth.uid()),
  'final-page jump earns no XP after minimum time'
);

select public.member_action(
  'read_page',
  '{"work_id":"32000000-0000-4000-8000-000000000002","chapter_id":"42000000-0000-4000-8000-000000000002","page":1}'
);
set local role postgres;
update public.reading_sessions set accepted_at = now() - interval '4 seconds'
where user_id = '12000001-0000-4000-8000-000000000001'
  and chapter_id = '42000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.member_action(
  'read_page',
  '{"work_id":"32000000-0000-4000-8000-000000000002","chapter_id":"42000000-0000-4000-8000-000000000002","page":2}'
);
set local role postgres;
update public.reading_sessions set accepted_at = now() - interval '4 seconds'
where user_id = '12000001-0000-4000-8000-000000000001'
  and chapter_id = '42000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.member_action(
  'read_page',
  '{"work_id":"32000000-0000-4000-8000-000000000002","chapter_id":"42000000-0000-4000-8000-000000000002","page":3}'
);
select pg_temp.assert_true(
  (select xp = 25 from public.members where id = auth.uid()),
  'sequential reading still earns XP'
);

set local role postgres;
select 'PASS: adult RLS, importer integrity and sequential XP invariants' as result;
rollback;
