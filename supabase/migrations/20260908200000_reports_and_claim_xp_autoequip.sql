-- ==============================================================================
-- Project Nox Manga - Migration 20260908200000:
-- 1. Updated claim_chapter_xp with auto-equip and Level 1-100 formula
-- 2. Central de Reports (works, chapters, users, comments)
-- 3. Kuro Source Reactivation
-- ==============================================================================

-- 1. UPDATED CLAIM_CHAPTER_XP WITH AUTO-EQUIP AND LEVEL 1-100 FORMULA
create or replace function public.claim_chapter_xp(p_chapter_id uuid, p_source text default 'web')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  v_count integer;
  v_read public.reading;
  v_new_xp integer;
  v_prev_xp integer;
  v_new_level integer;
  v_prev_level integer;
  v_manual_title boolean;
  v_manual_badge boolean;
  v_best_title text;
  v_best_badge text;
begin
  if uid is null then
    raise exception 'Autenticação necessária' using errcode='42501';
  end if;
  if not public.is_member() then
    raise exception 'Conta inativa ou não confirmada' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 2));

  -- Verificar se obra e capítulo são públicos e publicados
  select work_id into wid from public.chapters where id = p_chapter_id and published_at is not null;
  if wid is null then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'chapter_not_found', 'message', 'Capítulo indisponível.');
  end if;
  if not exists(select 1 from public.works where id = wid and published) then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'work_not_published', 'message', 'Obra indisponível.');
  end if;

  select xp, manual_title, manual_badge into v_prev_xp, v_manual_title, v_manual_badge from public.members where id = uid;

  -- Sincronizar com xp da conta se xp=0 para suportar resets em testes
  if v_prev_xp = 0 and exists(select 1 from public.xp_awards where user_id = uid) then
    delete from public.xp_awards where user_id = uid;
  end if;

  -- Idempotência: Se já foi concedido para este capítulo
  if exists(select 1 from public.xp_awards where user_id = uid and chapter_id = p_chapter_id) then
    return jsonb_build_object('ok', true, 'awarded', false, 'already_awarded', true, 'total_xp', v_prev_xp);
  end if;

  -- Verificar páginas totais
  select count(*) into v_count from public.pages where chapter_id = p_chapter_id;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'no_pages', 'message', 'Capítulo sem páginas.');
  end if;

  -- Verificar progresso de leitura e anti-bot
  select * into v_read from public.reading where user_id = uid and chapter_id = p_chapter_id;
  if v_read.user_id is null or (v_read.max_page < v_count and v_read.page < v_count and v_read.completed_at is null) then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'not_finished', 'message', 'Capítulo ainda não concluído.');
  end if;
  if not exists(select 1 from public.reading_sessions where user_id = uid and chapter_id = p_chapter_id and next_page > 1)
     or now() - v_read.started_at < 15 * interval '1 second' then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'reading_time_not_met', 'message', 'Tempo mínimo de leitura não atingido.');
  end if;

  -- Anti-farm razoável: Limite de 100 capítulos concedidos por dia
  if (select count(*) from public.xp_awards where user_id = uid and created_at > now() - interval '1 day') >= 100 then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'daily_limit', 'message', 'Limite diário de conquistas atingido.');
  end if;

  -- Marcar leitura como completada caso ainda não estivesse
  update public.reading
  set completed_at = coalesce(completed_at, now()), page = v_count, max_page = v_count, updated_at = now()
  where user_id = uid and chapter_id = p_chapter_id;

  -- Inserir no ledger atômico
  insert into public.xp_awards(user_id, chapter_id, work_id, amount, source)
  values(uid, p_chapter_id, wid, 25, coalesce(p_source, 'web'))
  on conflict(user_id, chapter_id) do nothing;

  -- Recalcular members.xp de forma atômica
  update public.members
  set xp = (select coalesce(sum(amount), 0) from public.xp_awards where user_id = uid)
  where id = uid
  returning xp into v_new_xp;

  -- Calcular novos níveis pela fórmula do Project Nox: L = floor(sqrt(1 + XP/50))
  v_prev_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_prev_xp, 0)) / 50.0))));
  v_new_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_new_xp, 0)) / 50.0))));

  -- Auto-equip se o usuário não escolheu manualmente
  if not coalesce(v_manual_title, false) then
    v_best_title := case
      when v_new_level >= 100 then 'apex-nox'
      when v_new_level >= 90 then 'zenite'
      when v_new_level >= 80 then 'primor'
      when v_new_level >= 70 then 'luminar'
      when v_new_level >= 60 then 'monolito'
      when v_new_level >= 50 then 'eminencia'
      when v_new_level >= 40 then 'virtuoso'
      when v_new_level >= 30 then 'vanguarda'
      when v_new_level >= 20 then 'bibliofilo'
      when v_new_level >= 15 then 'curador'
      when v_new_level >= 10 then 'colecionador'
      when v_new_level >= 5 then 'aficionado'
      else 'nox-reader'
    end;
    update public.members set equipped_title_id = v_best_title where id = uid;
  end if;

  if not coalesce(v_manual_badge, false) then
    v_best_badge := case
      when v_new_level >= 100 then 'brasao-apex'
      when v_new_level >= 75 then 'olho-do-eter'
      when v_new_level >= 50 then 'coroa-de-onix'
      when v_new_level >= 35 then 'reliquia-astral'
      when v_new_level >= 20 then 'sigilo-prateado'
      when v_new_level >= 10 then 'prisma-noturno'
      when v_new_level >= 5 then 'chama-novica'
      else 'marca-inicial'
    end;
    update public.members set equipped_badge_id = v_best_badge where id = uid;
  end if;

  -- Notificações de conquista (primeiro capítulo ou level up)
  if v_new_xp = 25 then
    insert into public.notifications(user_id, kind, body, href, dedupe_key)
    values(
      uid,
      'achievement',
      'Primeiro capítulo concluído! Bem-vindo à biblioteca da Project Nox.',
      '/perfil',
      'xp:first_chapter'
    )
    on conflict do nothing;
  elsif v_new_level > v_prev_level then
    insert into public.notifications(user_id, kind, body, href, dedupe_key)
    values(
      uid,
      'achievement',
      'Parabéns! Você alcançou o Nível ' || v_new_level || '!',
      '/perfil',
      'xp:level:' || v_new_level
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'awarded', true,
    'total_xp', v_new_xp,
    'level', v_new_level,
    'leveled_up', v_new_level > v_prev_level
  );
end;
$$;

revoke all on function public.claim_chapter_xp(uuid, text) from public, anon;
grant execute on function public.claim_chapter_xp(uuid, text) to authenticated;

-- 2. CENTRAL DE REPORTS
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.members(id) on delete cascade,
  target_type text not null check (target_type in ('WORK', 'CHAPTER', 'USER', 'COMMENT')),
  work_id uuid references public.works(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  target_user_id uuid references public.members(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 2 and 200),
  details text check (details is null or length(trim(details)) <= 2000),
  status text not null default 'NOVO' check (status in ('NOVO', 'EM_ANALISE', 'ATRIBUIDO', 'RESOLVIDO', 'REJEITADO')),
  assigned_to uuid references public.members(id) on delete set null,
  resolution_notes text check (resolution_notes is null or length(trim(resolution_notes)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_status on public.reports(status, created_at desc);
create index if not exists idx_reports_reporter on public.reports(reporter_id, created_at desc);
create index if not exists idx_reports_target_type on public.reports(target_type, status);

alter table public.reports enable row level security;

-- Reporters can select their own reports (status tracking)
drop policy if exists reports_reporter_select on public.reports;
create policy reports_reporter_select on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- Reporters can submit reports (with reporter_id = auth.uid() and status = 'NOVO')
drop policy if exists reports_reporter_insert on public.reports;
create policy reports_reporter_insert on public.reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'NOVO'
    and assigned_to is null
    and resolution_notes is null
  );

-- Editorial staff can select and manage all reports
drop policy if exists reports_staff_select on public.reports;
create policy reports_staff_select on public.reports
  for select to authenticated
  using (public.is_editor());

drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports
  for update to authenticated
  using (public.is_editor());

grant select, insert, update on public.reports to authenticated;

-- 3. KURO SOURCE REACTIVATION
update public.importer_sources
set status = 'ACTIVE', enabled = true, cooldown_until = null, updated_at = now()
where id = 'kuro';
