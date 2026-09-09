-- ==============================================================================
-- Project Nox Manga - Migration 20260908191000:
-- Server-side validation for equipping Titles and Badges in member_action
-- ==============================================================================

create or replace function public.member_action(p_action text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  cid uuid;
  v_id uuid;
  v_comment_id uuid;
  v_page integer;
  v_count integer;
  v_xp integer;
  v_level integer;
  v_req_level integer;
  v_title_id text;
  v_badge_id text;
  v_read public.reading;
  v_session public.reading_sessions;
begin
  if not public.is_member() then
    raise exception 'Entre em uma conta confirmada e ativa' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if p_action = 'profile' then
    update public.members
    set
      username = lower(trim(p_data->>'username')),
      display_name = trim(p_data->>'display_name'),
      bio = coalesce(p_data->>'bio', '')
    where id = uid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'equip_title' then
    v_title_id := p_data->>'title_id';
    v_req_level := case v_title_id
      when 'nox-reader' then 1
      when 'aficionado' then 5
      when 'colecionador' then 10
      when 'curador' then 15
      when 'bibliofilo' then 20
      when 'vanguarda' then 30
      when 'virtuoso' then 40
      when 'eminencia' then 50
      when 'monolito' then 60
      when 'luminar' then 70
      when 'primor' then 80
      when 'zenite' then 90
      when 'apex-nox' then 100
      else null
    end;

    if v_req_level is null then
      raise exception 'Título inválido.';
    end if;

    select xp into v_xp from public.members where id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    if v_level < v_req_level then
      raise exception 'Você precisa atingir o nível % para equipar este título.', v_req_level;
    end if;

    update public.members set equipped_title_id = v_title_id, manual_title = true where id = uid;
    return jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);

  elsif p_action = 'equip_badge' then
    v_badge_id := p_data->>'badge_id';
    v_req_level := case v_badge_id
      when 'marca-inicial' then 1
      when 'chama-novica' then 5
      when 'prisma-noturno' then 10
      when 'sigilo-prateado' then 20
      when 'reliquia-astral' then 35
      when 'coroa-de-onix' then 50
      when 'olho-do-eter' then 75
      when 'brasao-apex' then 100
      else null
    end;

    if v_req_level is null then
      raise exception 'Insígnia inválida.';
    end if;

    select xp into v_xp from public.members where id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    if v_level < v_req_level then
      raise exception 'Você precisa atingir o nível % para equipar esta insígnia.', v_req_level;
    end if;

    update public.members set equipped_badge_id = v_badge_id, manual_badge = true where id = uid;
    return jsonb_build_object('ok', true, 'equipped_badge_id', v_badge_id);

  elsif p_action = 'preferences' then
    if p_data ? 'blur_nsfw' then
      update public.members set blur_nsfw = (p_data->>'blur_nsfw')::boolean where id = uid;
    end if;
    if p_data ? 'age_status' and (p_data->>'age_status') in ('MINOR', 'ADULT') then
      update public.members set age_status = p_data->>'age_status' where id = uid and age_status = 'UNKNOWN';
    end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'clear_history' then
    delete from public.reading where user_id = uid;
    delete from public.reading_sessions where user_id = uid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'claim_xp' then
    return public.claim_chapter_xp((p_data->>'chapter_id')::uuid, 'web');

  elsif p_action = 'notifications' then
    update public.notifications set read_at = now() where user_id = uid and read_at is null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'comment_edit' or p_action = 'comment_delete' then
    update public.comments
    set
      body = case when p_action = 'comment_edit' then trim(p_data->>'body') else body end,
      removed = p_action = 'comment_delete',
      updated_at = now()
    where id = (p_data->>'id')::uuid and user_id = uid and not removed;
    if not found then raise exception 'Comentário indisponível'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'comment_like' then
    v_id := (p_data->>'id')::uuid;
    if not exists(
      select 1 from public.comments c
      join public.works w on w.id = c.work_id
      where c.id = v_id and not c.removed and w.published
        and (c.chapter_id is null or public.public_chapter(c.chapter_id))
    ) then
      raise exception 'Comentário indisponível';
    end if;
    delete from public.comment_likes where user_id = uid and comment_id = v_id;
    if not found then insert into public.comment_likes values(uid, v_id); end if;
    return jsonb_build_object('ok', true);

  else
    wid := (p_data->>'work_id')::uuid;
    if not exists(select 1 from public.works where id = wid and published) then
      raise exception 'Obra indisponível';
    end if;

    if p_action = 'library' then
      insert into public.library(user_id, work_id, status, favorite, following)
      values(
        uid,
        wid,
        p_data->>'status',
        coalesce((p_data->>'favorite')::boolean, false),
        coalesce((p_data->>'following')::boolean, true)
      )
      on conflict (user_id, work_id) do update
      set
        status = excluded.status,
        favorite = excluded.favorite,
        following = excluded.following,
        updated_at = now();

      if p_data->>'status' = 'COMPLETED' then
        insert into public.notifications(user_id, kind, body, href, dedupe_key)
        select uid, 'achievement', 'Você concluiu ' || title || '! Mais uma grande história na sua jornada.', '/obra/' || slug, 'completed:' || wid
        from public.works where id = wid
        on conflict do nothing;
      end if;
      return jsonb_build_object('ok', true);

    elsif p_action = 'like' then
      delete from public.likes where user_id = uid and work_id = wid;
      if not found then insert into public.likes values(uid, wid); end if;
      return jsonb_build_object('ok', true);

    elsif p_action = 'comment' then
      if exists(select 1 from public.comments where user_id = uid and created_at > now() - interval '30 seconds') then
        raise exception 'Aguarde 30 segundos para comentar novamente';
      end if;
      if (select count(*) from public.comments where user_id = uid and created_at > now() - interval '1 day') >= 100 then
        raise exception 'Limite diário de comentários atingido';
      end if;
      cid := (p_data->>'chapter_id')::uuid;
      if cid is not null and not exists(select 1 from public.chapters where id = cid and work_id = wid and public.public_chapter(id)) then
        raise exception 'Capítulo indisponível';
      end if;
      v_id := (p_data->>'parent_id')::uuid;
      if v_id is not null and not exists(select 1 from public.comments where id = v_id and work_id = wid and chapter_id is not distinct from cid and not removed and parent_id is null) then
        raise exception 'Resposta inválida';
      end if;
      insert into public.comments(user_id, work_id, chapter_id, parent_id, body)
      values(uid, wid, cid, v_id, trim(p_data->>'body'))
      returning id into v_comment_id;

      if v_id is not null then
        insert into public.notifications(user_id, kind, body, href, dedupe_key)
        select user_id, 'reply', 'Uma nova resposta ao seu comentário.',
          case when cid is not null then '/ler/' || cid else '/obra/' || (select slug from public.works where id = wid) end,
          'reply:' || v_comment_id
        from public.comments where id = v_id and user_id <> uid
        on conflict do nothing;
      end if;
      return jsonb_build_object('ok', true, 'id', v_comment_id);

    elsif p_action in ('read_start', 'read_page') then
      cid := (p_data->>'chapter_id')::uuid;
      if not exists(select 1 from public.chapters where id = cid and work_id = wid and public.public_chapter(id)) then
        raise exception 'Capítulo indisponível';
      end if;
      select count(*) into v_count from public.pages where chapter_id = cid;
      if v_count = 0 then raise exception 'Capítulo sem páginas'; end if;

      insert into public.reading(user_id, chapter_id) values(uid, cid) on conflict do nothing;
      insert into public.reading_sessions(user_id, chapter_id) values(uid, cid) on conflict do nothing;
      select * into v_read from public.reading where user_id = uid and chapter_id = cid for update;
      select * into v_session from public.reading_sessions where user_id = uid and chapter_id = cid for update;

      if p_action = 'read_page' then
        v_page := (p_data->>'page')::integer;
        if v_page < 1 or v_page > v_count then raise exception 'Página inválida'; end if;
        update public.reading
        set page = v_page, max_page = greatest(max_page, v_page), updated_at = now()
        where user_id = uid and chapter_id = cid;

        if v_page >= v_session.next_page and now() - v_session.accepted_at >= interval '2 seconds' then
          update public.reading_sessions
          set next_page = greatest(next_page, v_page + 1), accepted_at = now()
          where user_id = uid and chapter_id = cid;
        end if;

        if (v_page = v_count or coalesce((p_data->>'completed')::boolean, false)) and v_read.completed_at is null
           and exists(select 1 from public.reading_sessions where user_id = uid and chapter_id = cid and next_page > 1)
           and now() - v_read.started_at >= 15 * interval '1 second' then
             update public.reading set completed_at = now(), page = v_count, max_page = v_count where user_id = uid and chapter_id = cid;
             perform public.claim_chapter_xp(cid, 'web');
        end if;
      end if;
      return jsonb_build_object('ok', true);
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
