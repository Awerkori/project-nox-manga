begin;

create or replace function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end
$$;

create or replace function pg_temp.denied(query text, label text) returns void language plpgsql as $$
begin
  execute query;
  raise exception 'FAIL: % allowed', label;
exception when insufficient_privilege then
  null;
end
$$;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  ('13000001-0000-4000-8000-000000000001', 'reporter@example.invalid', now(), '{}'),
  ('13000002-0000-4000-8000-000000000002', 'editor@example.invalid', now(), '{}');
update public.access_roles set role = 'EDITOR' where user_id = '13000002-0000-4000-8000-000000000002';

insert into public.works(id, slug, title, published)
select
  ('2300000' || n || '-0000-4000-8000-000000000001')::uuid,
  'report-target-' || n,
  'Report target ' || n,
  true
from generate_series(1, 6) as n;
insert into public.works(id, slug, title, published) values
  ('23000009-0000-4000-8000-000000000001', 'report-private-target', 'Private target', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000001-0000-4000-8000-000000000001', true);
select pg_temp.denied(
  $$insert into public.reports(reporter_id, target_type, reason) values
    ('13000001-0000-4000-8000-000000000001', 'WORK', 'direct insert')$$,
  'authenticated direct report insert'
);

select pg_temp.assert_true(
  (public.submit_report('WORK', '23000001-0000-4000-8000-000000000001', 'Valid reason', null)->>'ok')::boolean,
  'RPC submits a valid report'
);
select pg_temp.assert_true(
  (select work_id = '23000001-0000-4000-8000-000000000001'
     and chapter_id is null and comment_id is null and target_user_id is null
   from public.reports where reporter_id = auth.uid()),
  'RPC stores exactly one matching target'
);
select pg_temp.assert_true(
  (public.submit_report('WORK', '23000001-0000-4000-8000-000000000001', 'Duplicate reason', null)->>'already_reported')::boolean,
  'duplicate open report is idempotent'
);

do $$
begin
  perform public.submit_report('WORK', '23000009-0000-4000-8000-000000000001', 'Private target', null);
  raise exception 'FAIL: private target accepted';
exception when invalid_parameter_value then
  null;
end
$$;

select public.submit_report('WORK', '23000002-0000-4000-8000-000000000001', 'Reason 2', null);
select public.submit_report('WORK', '23000003-0000-4000-8000-000000000001', 'Reason 3', null);
select public.submit_report('WORK', '23000004-0000-4000-8000-000000000001', 'Reason 4', null);
select public.submit_report('WORK', '23000005-0000-4000-8000-000000000001', 'Reason 5', null);
select pg_temp.assert_true(
  (public.submit_report('WORK', '23000006-0000-4000-8000-000000000001', 'Reason 6', null)->>'rate_limited')::boolean,
  'sixth report in one hour is rate limited'
);

set local role postgres;
select pg_temp.assert_true(
  (select count(*) = 5 from public.reports where reporter_id = '13000001-0000-4000-8000-000000000001'),
  'rate limit prevents the sixth row'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_log where actor_id = '13000001-0000-4000-8000-000000000001' and action = 'report_rate_limited'),
  'blocked attempt is audited'
);
do $$
begin
  insert into public.reports(reporter_id, target_type, reason)
  values ('13000001-0000-4000-8000-000000000001', 'WORK', 'Missing target');
  raise exception 'FAIL: inconsistent report accepted';
exception when check_violation then
  null;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000002-0000-4000-8000-000000000002', true);
select pg_temp.denied(
  $$update public.reports set reporter_id = '13000002-0000-4000-8000-000000000002', reason = 'tampered', created_at = now()$$,
  'editor direct immutable-field update'
);
select public.moderate_report(
  (select id from public.reports where work_id = '23000001-0000-4000-8000-000000000001'),
  'EM_ANALISE',
  'Reviewed safely'
);
select pg_temp.assert_true(
  (select status = 'EM_ANALISE'
     and assigned_to = '13000002-0000-4000-8000-000000000002'
     and reporter_id = '13000001-0000-4000-8000-000000000001'
     and reason = 'Valid reason'
   from public.reports where work_id = '23000001-0000-4000-8000-000000000001'),
  'moderation changes only controlled fields'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.report_audit
   where report_id = (select id from public.reports where work_id = '23000001-0000-4000-8000-000000000001')),
  'submission and moderation have append-only audit events'
);
select pg_temp.denied('update public.report_audit set new_status = ''RESOLVIDO''', 'editor audit tampering');

set local role anon;
select pg_temp.denied(
  $$select public.submit_report('WORK', '23000001-0000-4000-8000-000000000001', 'anonymous', null)$$,
  'anonymous report RPC'
);

set local role postgres;
select 'PASS: report constraints, RPC-only writes, rate limits, immutable fields and audit trail' as result;
rollback;
