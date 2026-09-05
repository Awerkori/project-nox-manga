begin;
create or replace function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;end$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('11000001-0000-4000-8000-000000000001','owner@example.invalid',now(),'{}'),
 ('11000002-0000-4000-8000-000000000002','editor@example.invalid',null,'{"role":"EDITOR"}');
update public.access_roles set role='ADMIN' where user_id='11000001-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','11000001-0000-4000-8000-000000000001',true);
select public.invite_editor('editor@example.invalid');
select set_config('request.jwt.claim.sub','11000002-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(not public.claim_editor_invite(),'unconfirmed email cannot claim invitation');
select pg_temp.assert_true((select count(*)=0 from public.editor_invites),'invite email not exposed to another user');
do $$begin perform public.invite_editor('attacker@example.invalid');raise exception 'FAIL: user created editor invitation';exception when insufficient_privilege then null;end$$;
set local role postgres;
update auth.users set email_confirmed_at=now() where id='11000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.assert_true(public.claim_editor_invite(),'verified exact email can claim');
select pg_temp.assert_true(public.current_role()='EDITOR','invitation grants editor only');
select pg_temp.assert_true(not public.claim_editor_invite(),'invitation single use');
do $$begin perform public.revoke_editor_invite('someone@example.invalid');raise exception 'FAIL: editor revoked invitation';exception when insufficient_privilege then null;end$$;
do $$begin perform public.reserve_media(gen_random_uuid(),auth.uid(),'supabase','image/png',1,1,1,'hash','editorial');raise exception 'FAIL: direct client bypassed media server';exception when insufficient_privilege then null;end$$;
set local role postgres;
insert into public.media(provider,provider_key,mime,width,height,bytes,sha256,created_by) select 'supabase','quota-test-'||i,'image/png',1000,2000,18750000,'test','11000002-0000-4000-8000-000000000002' from generate_series(1,40)i;
set local role service_role;
do $$begin perform public.reserve_media(gen_random_uuid(),'11000002-0000-4000-8000-000000000002','supabase','image/png',1000,2000,1,'hash','editorial');raise exception 'FAIL: free storage cap exceeded';exception when raise_exception then if sqlerrm not like '%armazenamento gratuito%' then raise;end if;end$$;
set local role postgres;
select 'PASS: verified invitations, single use, email privacy, server-only media and free storage cap' as result;
rollback;
