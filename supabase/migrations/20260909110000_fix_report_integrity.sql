begin;

alter table public.reports
  add constraint reports_target_matches_type check (
    (target_type = 'WORK' and work_id is not null and chapter_id is null and comment_id is null and target_user_id is null)
    or (target_type = 'CHAPTER' and work_id is null and chapter_id is not null and comment_id is null and target_user_id is null)
    or (target_type = 'COMMENT' and work_id is null and chapter_id is null and comment_id is not null and target_user_id is null)
    or (target_type = 'USER' and work_id is null and chapter_id is null and comment_id is null and target_user_id is not null)
  );

drop policy if exists reports_reporter_insert on public.reports;
drop policy if exists reports_staff_update on public.reports;
revoke insert, update on public.reports from authenticated;

create table public.report_audit (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports(id) on delete restrict,
  actor_id uuid not null references public.members(id) on delete restrict,
  old_status text,
  new_status text not null,
  created_at timestamptz not null default now(),
  check (old_status is null or old_status in ('NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO')),
  check (new_status in ('NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO'))
);

create index report_audit_report_created_idx on public.report_audit(report_id, created_at desc);
alter table public.report_audit enable row level security;
create policy report_audit_staff_select on public.report_audit
  for select to authenticated
  using (public.is_editor());
revoke all on public.report_audit from public, anon, authenticated;
grant select on public.report_audit to authenticated;

create function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_type text := upper(trim(coalesce(p_target_type, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_details text := nullif(trim(coalesce(p_details, '')), '');
  v_report_id uuid;
begin
  if not public.is_member() then
    raise exception 'Conta confirmada e ativa necessária' using errcode = '42501';
  end if;
  if v_type not in ('WORK', 'CHAPTER', 'USER', 'COMMENT') or p_target_id is null then
    raise exception 'Alvo da denúncia inválido' using errcode = '22023';
  end if;
  if length(v_reason) not between 2 and 200 then
    raise exception 'Motivo da denúncia deve ter entre 2 e 200 caracteres' using errcode = '22023';
  end if;
  if v_details is not null and length(v_details) > 2000 then
    raise exception 'Detalhes não podem exceder 2000 caracteres' using errcode = '22023';
  end if;

  if (v_type = 'WORK' and not exists (
      select 1 from public.works where id = p_target_id and published
    )) or (v_type = 'CHAPTER' and not exists (
      select 1 from public.chapters c
      join public.works w on w.id = c.work_id
      where c.id = p_target_id and c.published_at is not null and w.published
    )) or (v_type = 'COMMENT' and not exists (
      select 1 from public.comments c
      join public.works w on w.id = c.work_id
      where c.id = p_target_id and not c.removed and w.published
    )) or (v_type = 'USER' and not exists (
      select 1 from public.members where id = p_target_id
    )) then
    raise exception 'Alvo da denúncia não encontrado' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 903));

  select id into v_report_id
  from public.reports
  where reporter_id = v_user
    and target_type = v_type
    and status in ('NOVO', 'EM_ANALISE', 'ATRIBUIDO')
    and case v_type
      when 'WORK' then work_id = p_target_id
      when 'CHAPTER' then chapter_id = p_target_id
      when 'COMMENT' then comment_id = p_target_id
      when 'USER' then target_user_id = p_target_id
      else false
    end
  order by created_at desc
  limit 1;

  if v_report_id is not null then
    return jsonb_build_object('ok', true, 'already_reported', true, 'report_id', v_report_id);
  end if;

  if (select count(*) >= 5 from public.reports where reporter_id = v_user and created_at >= now() - interval '1 hour')
    or (select count(*) >= 20 from public.reports where reporter_id = v_user and created_at >= now() - interval '24 hours') then
    insert into public.audit_log(actor_id, action, target_id)
    values (v_user, 'report_rate_limited', v_user);
    return jsonb_build_object('ok', false, 'rate_limited', true);
  end if;

  insert into public.reports(
    reporter_id, target_type, work_id, chapter_id, comment_id, target_user_id, reason, details
  ) values (
    v_user,
    v_type,
    case when v_type = 'WORK' then p_target_id end,
    case when v_type = 'CHAPTER' then p_target_id end,
    case when v_type = 'COMMENT' then p_target_id end,
    case when v_type = 'USER' then p_target_id end,
    v_reason,
    v_details
  ) returning id into v_report_id;

  insert into public.report_audit(report_id, actor_id, old_status, new_status)
  values (v_report_id, v_user, null, 'NOVO');
  insert into public.audit_log(actor_id, action, target_id)
  values (v_user, 'report_submitted', v_report_id);

  return jsonb_build_object('ok', true, 'already_reported', false, 'report_id', v_report_id);
end;
$$;

create function public.moderate_report(
  p_report_id uuid,
  p_status text,
  p_resolution_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old_status text;
  v_new_status text := upper(trim(coalesce(p_status, '')));
  v_notes text := nullif(trim(coalesce(p_resolution_notes, '')), '');
begin
  if not public.is_editor() then
    raise exception 'Acesso editorial necessário' using errcode = '42501';
  end if;
  if p_report_id is null or v_new_status not in ('NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO') then
    raise exception 'Status ou denúncia inválidos' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 2000 then
    raise exception 'Notas não podem exceder 2000 caracteres' using errcode = '22023';
  end if;

  select status into v_old_status
  from public.reports
  where id = p_report_id
  for update;
  if not found then
    raise exception 'Denúncia não encontrada' using errcode = '22023';
  end if;

  update public.reports
  set status = v_new_status,
      assigned_to = case
        when v_new_status in ('EM_ANALISE', 'ATRIBUIDO') then v_actor
        else assigned_to
      end,
      resolution_notes = coalesce(v_notes, resolution_notes),
      updated_at = now()
  where id = p_report_id;

  insert into public.report_audit(report_id, actor_id, old_status, new_status)
  values (p_report_id, v_actor, v_old_status, v_new_status);
  insert into public.audit_log(actor_id, action, target_id)
  values (v_actor, 'report_moderated', p_report_id);

  return jsonb_build_object('ok', true, 'report_id', p_report_id, 'status', v_new_status);
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
revoke all on function public.moderate_report(uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.moderate_report(uuid, text, text) to authenticated;

commit;
