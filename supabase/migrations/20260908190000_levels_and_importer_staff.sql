-- ==============================================================================
-- Project Nox Manga - Migration 20260908190000:
-- 1. Member Progression (Equipped Titles & Badges)
-- 2. Importer Staff Prioritization & Editorial Telemetry Access
-- 3. Dynamic Priority Boost in importer_acquire_job
-- ==============================================================================

-- 1. MEMBER TITLES & BADGES COLUMNS
alter table public.members
  add column if not exists equipped_title_id text default 'nox-reader',
  add column if not exists equipped_badge_id text default 'marca-inicial',
  add column if not exists manual_title boolean not null default false,
  add column if not exists manual_badge boolean not null default false;

-- Grant selective access to member title/badge columns
grant select (equipped_title_id, equipped_badge_id, manual_title, manual_badge) on public.members to anon, authenticated;
grant update (equipped_title_id, equipped_badge_id, manual_title, manual_badge) on public.members to authenticated;

-- 1.1 CHAPTERS ORIGIN (MANUAL vs IMPORTER PROVENANCE)
alter table public.chapters
  add column if not exists origin text not null default 'MANUAL' check (origin in ('MANUAL', 'IMPORTER'));

update public.chapters
set origin = 'IMPORTER'
where id in (
  select chapter_id from public.importer_chapter_mappings where chapter_id is not null
);

grant select (origin) on public.chapters to anon, authenticated;

-- 2. IMPORTER STAFF REQUESTS TABLE
create table if not exists public.importer_staff_requests (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  requested_by uuid not null references public.members(id) on delete cascade,
  priority_boost integer not null default 85,
  reason text,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'IMPORTING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_importer_staff_requests_active
  on public.importer_staff_requests(work_id, status)
  where status in ('QUEUED', 'IMPORTING');

alter table public.importer_staff_requests enable row level security;

-- Policies for importer_staff_requests
drop policy if exists staff_requests_select on public.importer_staff_requests;
create policy staff_requests_select on public.importer_staff_requests
  for select to authenticated using (public.is_editor());

drop policy if exists staff_requests_insert on public.importer_staff_requests;
create policy staff_requests_insert on public.importer_staff_requests
  for insert to authenticated with check (public.is_editor() and requested_by = auth.uid());

drop policy if exists staff_requests_update on public.importer_staff_requests;
create policy staff_requests_update on public.importer_staff_requests
  for update to authenticated using (public.is_editor());

grant select, insert, update on public.importer_staff_requests to authenticated;

-- 3. READ-ONLY ACCESS TO IMPORTER TELEMETRY AND QUEUE FOR EDITORIAL STAFF
grant select on public.importer_queue to authenticated;
grant select on public.importer_sources to authenticated;
grant select on public.importer_telemetry to authenticated;
grant select on public.importer_chapter_mappings to authenticated;

drop policy if exists importer_queue_staff_select on public.importer_queue;
create policy importer_queue_staff_select on public.importer_queue
  for select to authenticated using (public.is_editor());

drop policy if exists importer_sources_staff_select on public.importer_sources;
create policy importer_sources_staff_select on public.importer_sources
  for select to authenticated using (public.is_editor());

drop policy if exists importer_telemetry_staff_select on public.importer_telemetry;
create policy importer_telemetry_staff_select on public.importer_telemetry
  for select to authenticated using (public.is_editor());

drop policy if exists importer_chapter_mappings_staff_select on public.importer_chapter_mappings;
create policy importer_chapter_mappings_staff_select on public.importer_chapter_mappings
  for select to authenticated using (public.is_editor());

-- 4. UPDATE IMPORTER_ACQUIRE_JOB WITH STAFF PRIORITY
create or replace function public.importer_acquire_job(
  p_worker_id text,
  p_lease_duration interval default interval '5 minutes',
  p_source text default null
)
returns table (
  id uuid,
  task_type text,
  source text,
  priority integer,
  payload jsonb,
  dedupe_key text,
  status text,
  attempts integer,
  max_attempts integer,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  chapter_sort_key numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  select q.id into v_job_id
  from public.importer_queue q
  where (
    (q.status in ('QUEUED', 'RETRY') and q.next_run_at <= now())
    or
    (q.status = 'IMPORTING' and q.lease_expires_at < now())
  )
  and (p_source is null or q.source = p_source)
  and not exists (
    select 1 from public.importer_sources s
    where s.id = q.source
      and (s.enabled = false or s.status = 'PAUSED' or (s.cooldown_until is not null and s.cooldown_until > now()))
  )
  order by
    case
      -- 1. PRIORIDADE 90 PROGRESSIVE BLOCKER (Barreira Canônica):
      when q.task_type = 'IMPORT_CHAPTER'
       and q.payload->>'workId' is not null
       and q.chapter_sort_key is not null
       and exists (
         select 1
         from public.importer_chapter_mappings staged
         where staged.work_id = (q.payload->>'workId')::uuid
           and staged.status = 'STAGED'
           and staged.chapter_sort_key > q.chapter_sort_key
       )
       and not exists (
         select 1
         from public.importer_queue q2
         where q2.task_type = 'IMPORT_CHAPTER'
           and (q2.payload->>'workId')::text = q.payload->>'workId'
           and q2.status in ('QUEUED', 'RETRY', 'IMPORTING')
           and q2.id != q.id
           and q2.chapter_sort_key < q.chapter_sort_key
       )
       and not exists (
         select 1
         from public.importer_chapter_mappings m2
         left join public.chapters c2 on c2.id = m2.chapter_id
         where m2.work_id = (q.payload->>'workId')::uuid
           and m2.chapter_sort_key < q.chapter_sort_key
           and m2.status not in ('STAGED', 'COMPLETED')
           and m2.is_gap = false
           and (c2.published_at is null or c2.id is null)
       ) then 90

      -- 2. PRIORIDADE 85 MANUAL STAFF BOOST:
      when exists (
        select 1
        from public.importer_staff_requests sr
        where sr.work_id = (q.payload->>'workId')::uuid
          and sr.status in ('QUEUED', 'IMPORTING')
      ) then greatest(q.priority, 85)

      else q.priority
    end desc,
    q.chapter_sort_key asc nulls last,
    q.next_run_at asc,
    q.created_at asc
  limit 1
  for update skip locked;

  if v_job_id is not null then
    return query
    update public.importer_queue
    set
      status = 'IMPORTING',
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + p_lease_duration,
      attempts = public.importer_queue.attempts + 1,
      updated_at = now()
    where public.importer_queue.id = v_job_id
    returning
      public.importer_queue.id,
      public.importer_queue.task_type,
      public.importer_queue.source,
      public.importer_queue.priority,
      public.importer_queue.payload,
      public.importer_queue.dedupe_key,
      public.importer_queue.status,
      public.importer_queue.attempts,
      public.importer_queue.max_attempts,
      public.importer_queue.locked_by,
      public.importer_queue.locked_at,
      public.importer_queue.lease_expires_at,
      public.importer_queue.next_run_at,
      public.importer_queue.last_error,
      public.importer_queue.chapter_sort_key;
  end if;
end;
$$;

revoke all on function public.importer_acquire_job(text, interval, text) from public, anon, authenticated;
grant execute on function public.importer_acquire_job(text, interval, text) to service_role;

-- 5. RPC HELPER TO PRIORITIZE WORK SAFELY
create or replace function public.importer_prioritize_work(
  p_work_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_source text;
  v_active_exists boolean;
begin
  if not public.is_editor() then
    raise exception 'Apenas membros da equipe editorial podem priorizar obras.';
  end if;

  select exists(
    select 1 from public.importer_staff_requests
    where work_id = p_work_id
      and status in ('QUEUED', 'IMPORTING')
  ) into v_active_exists;

  if v_active_exists then
    return jsonb_build_object(
      'success', true,
      'already_queued', true,
      'message', 'Esta obra já possui uma priorização ativa na fila da Staff.'
    );
  end if;

  insert into public.importer_staff_requests (
    work_id,
    requested_by,
    priority_boost,
    reason,
    status
  ) values (
    p_work_id,
    auth.uid(),
    85,
    p_reason,
    'QUEUED'
  )
  returning id into v_request_id;

  -- Boost priority of any existing QUEUED jobs for this work
  update public.importer_queue
  set priority = greatest(priority, 85), updated_at = now()
  where (payload->>'workId')::text = p_work_id::text
    and status = 'QUEUED';

  -- If no pending jobs exist, find primary/viable source and enqueue a SYNC_WORK job
  if not exists (
    select 1 from public.importer_queue
    where (payload->>'workId')::text = p_work_id::text
      and status in ('QUEUED', 'IMPORTING', 'RETRY')
  ) then
    select source into v_source
    from public.importer_work_mappings
    where work_id = p_work_id
    limit 1;

    if v_source is null then
      v_source := 'nexus';
    end if;

    insert into public.importer_queue (
      task_type,
      source,
      dedupe_key,
      payload,
      priority,
      status
    ) values (
      'SYNC_WORK',
      v_source,
      'staff:sync:' || p_work_id::text || ':' || extract(epoch from now())::bigint,
      jsonb_build_object('workId', p_work_id, 'staffRequested', true, 'requestId', v_request_id),
      85,
      'QUEUED'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'Obra priorizada com sucesso! O Importer irá sincronizá-la com alta prioridade.'
  );
end;
$$;

revoke all on function public.importer_prioritize_work(uuid, text) from public, anon;
grant execute on function public.importer_prioritize_work(uuid, text) to authenticated;

-- 6. RPC HELPER TO CANCEL STAFF REQUEST
create or replace function public.importer_cancel_staff_request(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if not public.is_editor() then
    raise exception 'Apenas membros da equipe editorial podem cancelar solicitações.';
  end if;

  update public.importer_staff_requests
  set status = 'CANCELLED', updated_at = now()
  where id = p_request_id
    and status = 'QUEUED';

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    return jsonb_build_object('success', true, 'message', 'Solicitação cancelada com sucesso.');
  else
    return jsonb_build_object('success', false, 'message', 'Solicitação não pôde ser cancelada (já em andamento ou concluída).');
  end if;
end;
$$;

revoke all on function public.importer_cancel_staff_request(uuid) from public, anon;
grant execute on function public.importer_cancel_staff_request(uuid) to authenticated;
