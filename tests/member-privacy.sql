begin;

create function pg_temp.assert_true(value boolean, label text)
returns void
language plpgsql
as $$
begin
  if value is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
end
$$;

create function pg_temp.denied(query text, label text)
returns void
language plpgsql
as $$
begin
  execute query;
  raise exception 'FAIL: % allowed', label;
exception
  when insufficient_privilege then null;
end
$$;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  ('12000001-0000-4000-8000-000000000001', 'private-member@example.invalid', now(), '{}'),
  ('12000002-0000-4000-8000-000000000002', 'public-ranking@example.invalid', now(), '{}'),
  ('12000003-0000-4000-8000-000000000003', 'test-ranking@example.invalid', now(), '{}');

update public.members
set age_status = 'MINOR', blur_nsfw = false, is_test = true, xp = 100
where id = '12000001-0000-4000-8000-000000000001';

update public.members
set xp = 50
where id = '12000002-0000-4000-8000-000000000002';

update public.members
set is_test = true, xp = 500
where id = '12000003-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  not has_column_privilege('anon', 'public.members', 'age_status', 'SELECT'),
  'anonymous role has no age_status privilege'
);
select pg_temp.assert_true(
  not has_column_privilege('anon', 'public.members', 'blur_nsfw', 'SELECT'),
  'anonymous role has no blur_nsfw privilege'
);
select pg_temp.assert_true(
  not has_column_privilege('anon', 'public.members', 'is_test', 'SELECT'),
  'anonymous role has no is_test privilege'
);
select pg_temp.assert_true(
  not has_column_privilege('authenticated', 'public.members', 'manual_title', 'SELECT'),
  'authenticated role has no manual_title privilege'
);
select pg_temp.assert_true(
  not has_column_privilege('authenticated', 'public.members', 'manual_badge', 'SELECT'),
  'authenticated role has no manual_badge privilege'
);

set local role anon;
select pg_temp.denied('select age_status from public.members', 'anonymous age_status read');
select pg_temp.denied('select blur_nsfw from public.members', 'anonymous blur preference read');
select pg_temp.denied('select is_test from public.members', 'anonymous test-account flag read');
select pg_temp.assert_true(
  (select count(*) = 3 from public.members),
  'public profile fields remain readable'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.member_public_ranking()),
  'public ranking excludes private test accounts'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000001-0000-4000-8000-000000000001', true);
select pg_temp.denied('select age_status from public.members', 'authenticated direct age_status read');
select pg_temp.assert_true(
  (
    select count(*) = 1
      and bool_and(id = auth.uid())
      and bool_and(age_status = 'MINOR')
      and bool_and(not blur_nsfw)
    from public.member_self_profile()
  ),
  'authenticated member receives only their private profile'
);

reset role;
select 'PASS: private member columns denied; self profile and safe public ranking available' as result;
rollback;
