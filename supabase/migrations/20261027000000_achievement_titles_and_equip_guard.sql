-- Migration 20261027000000: 11 Seasonal Achievement Titles & Equip Title Guard
-- Registers the 11 cosmic achievement titles into shop_items (as non-purchasable ARCHIVED items)
-- and updates public.member_action to allow equipping achievement titles, shop titles, and Hall of Fame titles.

-- 1. Insert/Update the 11 Seasonal Achievement Titles in shop_items
insert into public.shop_items (id, name, description, kind, rarity, price_xp, is_active, status, style_data)
values
  (
    'titulo-nv1-centelha-veu',
    'Centelha do Véu Cósmico',
    'A primeira faísca primordial que desperta no silêncio do cosmos e inicia a jornada entre as páginas do infinito.',
    'TITLE',
    'COMUM',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#818cf8', 'min_level', 1)
  ),
  (
    'titulo-nv10-tecelao-sombras',
    'Tecelão das Sombras Astrais',
    'Aprendeu a entrelaçar as correntes da noite e moldar a essência das primeiras grandes obras decifradas.',
    'TITLE',
    'INCOMUM',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#a78bfa', 'min_level', 10)
  ),
  (
    'titulo-nv20-peregrino-eter',
    'Peregrino do Éter Noturno',
    'Caminhante intrépido que atravessou os limites terrenos para trilhar as rotas silenciosas das nebulosas.',
    'TITLE',
    'RARA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#38bdf8', 'min_level', 20)
  ),
  (
    'titulo-nv30-sentinela-eclipse',
    'Sentinela do Eclipse Eterno',
    'Guardião imutável no limiar sagrado onde a luz estelar é absorvida pelo mistério primordial.',
    'TITLE',
    'RARA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#c084fc', 'min_level', 30)
  ),
  (
    'titulo-nv40-geometra-constelacoes',
    'Geômetra das Constelações',
    'Mente analítica que decifra a geometria secreta dos mundos e mapeia cada arco do universo.',
    'TITLE',
    'EPICA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#f472b6', 'min_level', 40)
  ),
  (
    'titulo-nv50-hierofante-abismo',
    'Hierofante do Abismo',
    'Portador dos ritos profundos de Nox, canalizando a energia dos tomos esquecidos pelas eras.',
    'TITLE',
    'EPICA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#fb923c', 'min_level', 50)
  ),
  (
    'titulo-nv60-suserano-noite',
    'Suserano da Noite Infinita',
    'Comandante das marés celestes cuja presença impõe respeito através de incontáveis bibliotecas estelares.',
    'TITLE',
    'LENDARIA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#e879f9', 'min_level', 60)
  ),
  (
    'titulo-nv70-oraculo-singularidade',
    'Oráculo da Singularidade',
    'Visão transcendente que ultrapassa o horizonte de eventos e antecipa o ápice de cada história.',
    'TITLE',
    'LENDARIA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#4ade80', 'min_level', 70)
  ),
  (
    'titulo-nv80-arconte-primordial',
    'Arconte do Véu Primordial',
    'Entidade de sabedoria ancestral que zela pelos segredos forjados antes do próprio nascimento do tempo.',
    'TITLE',
    'MITICA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#2dd4bf', 'min_level', 80)
  ),
  (
    'titulo-nv90-soberano-supremo',
    'Soberano do Crepúsculo Supremo',
    'Regente quase divino do espaço liminar entre a luz cósmica e a escuridão absoluta.',
    'TITLE',
    'MITICA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#facc15', 'min_level', 90)
  ),
  (
    'titulo-nv100-apex-nox',
    'Apex Nox: Invocador do Eclipse',
    'A maestria máxima da temporada — a encarnação viva do eclipse eterno e da imortalidade literária.',
    'TITLE',
    'MITICA',
    0,
    false,
    'ARCHIVED',
    jsonb_build_object('badge_color', '#f43f5e', 'min_level', 100)
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  rarity = excluded.rarity,
  price_xp = excluded.price_xp,
  is_active = excluded.is_active,
  status = excluded.status,
  style_data = excluded.style_data;

-- 2. Update member_action RPC to handle equip_title and all standard member actions cleanly
create or replace function public.member_action(
  p_action text,
  p_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  cid uuid;
  v_id uuid;
  v_page integer := 1;
  v_count integer := 1;
  v_read public.reading;
  v_session public.reading_sessions;
  v_comment_id uuid;
  v_title_id text;
  v_badge_id text;
  v_req_level int;
  v_xp int;
  v_level int;
  v_res jsonb := jsonb_build_object('awarded', false);
begin
  if uid is null then
    raise exception 'Entre em sua conta' using errcode='42501';
  end if;

  if not public.is_member() then
    raise exception 'Entre em uma conta confirmada e ativa' using errcode='42501';
  end if;

  if p_action = 'profile' then
    update public.members
    set
      username = coalesce(nullif(lower(trim(p_data->>'username')), ''), username),
      display_name = coalesce(nullif(trim(p_data->>'display_name'), ''), display_name),
      bio = coalesce(p_data->>'bio', bio)
    where id = uid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'equip_title' then
    v_title_id := nullif(trim(coalesce(p_data->>'title_id', '')), '');
    if v_title_id is null or v_title_id = 'none' then
      update public.members set equipped_title_id = null, manual_title = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_title_id', null);
    end if;

    v_req_level := case v_title_id
      when 'titulo-nv1-centelha-veu' then 1
      when 'titulo-nv10-tecelao-sombras' then 10
      when 'titulo-nv20-peregrino-eter' then 20
      when 'titulo-nv30-sentinela-eclipse' then 30
      when 'titulo-nv40-geometra-constelacoes' then 40
      when 'titulo-nv50-hierofante-abismo' then 50
      when 'titulo-nv60-suserano-noite' then 60
      when 'titulo-nv70-oraculo-singularidade' then 70
      when 'titulo-nv80-arconte-primordial' then 80
      when 'titulo-nv90-soberano-supremo' then 90
      when 'titulo-nv100-apex-nox' then 100
      when 'nox-reader' then 1
      when 'iniciado-nox' then 1
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

    select coalesce(season_xp, xp, 0) into v_xp from public.members where id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    if v_req_level is not null then
      if v_level < v_req_level then
        raise exception 'Você precisa atingir o nível % para equipar este título.', v_req_level using errcode='42501';
      end if;
      insert into public.member_inventory(user_id, item_id, origin)
      values (uid, v_title_id, 'ACHIEVEMENT')
      on conflict (user_id, item_id) do nothing;

      update public.members set equipped_title_id = v_title_id, manual_title = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);
    end if;

    if exists(select 1 from public.member_inventory where user_id = uid and item_id = v_title_id)
       or exists(select 1 from public.shop_items where id = v_title_id and (price_xp = 0 or kind = 'TITLE')) then
      insert into public.member_inventory(user_id, item_id, origin)
      values (uid, v_title_id, 'EVENT')
      on conflict (user_id, item_id) do nothing;

      update public.members set equipped_title_id = v_title_id, manual_title = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);
    else
      raise exception 'Título não adquirido ou nível insuficiente.' using errcode='42501';
    end if;

  elsif p_action = 'equip_badge' then
    v_badge_id := nullif(trim(coalesce(p_data->>'badge_id', '')), '');
    if v_badge_id is null or v_badge_id = 'none' then
      update public.members set equipped_badge_id = null, manual_badge = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_badge_id', null);
    end if;

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
      raise exception 'Insígnia inválida.' using errcode='22023';
    end if;

    select coalesce(season_xp, xp, 0) into v_xp from public.members where id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    if v_level < v_req_level then
      raise exception 'Você precisa atingir o nível % para equipar esta insígnia.', v_req_level using errcode='42501';
    end if;

    update public.members set equipped_badge_id = v_badge_id, manual_badge = true where id = uid;
    return jsonb_build_object('ok', true, 'equipped_badge_id', v_badge_id);

  elsif p_action = 'equip' then
    if (p_data->>'clear')::boolean then
      update public.members
      set avatar_frame_id = null, equipped_badge_id = null, equipped_title_id = null
      where id = uid;
      return jsonb_build_object('ok', true);
    end if;

    v_id := (p_data->>'frame_id')::uuid;
    if v_id is not null and not exists(
      select 1 from public.media where id = v_id and created_by = uid and purpose = 'avatar_frame'
    ) then
      raise exception 'Moldura inválida';
    end if;

    update public.members set avatar_frame_id = v_id::text where id = uid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'notifications' then
    update public.notifications set read_at = now() where user_id = uid and read_at is null;
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
    if wid is not null and not exists(select 1 from public.works where id = wid) then
      insert into public.works (id, slug, title, published, kind, status, content_rating)
      values (
        wid,
        coalesce(nullif(regexp_replace(lower(coalesce(p_data->>'work_slug', wid::text)), '[^a-z0-9]+', '-', 'g'), ''), 'obra-' || substr(wid::text, 1, 8)),
        coalesce(nullif(p_data->>'work_title', ''), 'Obra'),
        true,
        'MANHWA',
        'ONGOING',
        'GENERAL'
      )
      on conflict (id) do nothing;
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

      if coalesce((p_data->>'favorite')::boolean, false) and (p_data ? 'work_title' or p_data ? 'work_slug') then
        v_res := public.award_xp('FAVORITE_WORK', wid::text, jsonb_build_object('description', 'Obra favoritada'));
      end if;

      return jsonb_build_object('ok', true, 'xp_award', v_res);

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

-- Ensure trigger on chapters cleans up reading and reading_sessions on chapter delete
create or replace function public.on_chapter_deleted() returns trigger language plpgsql security definer as $$
begin
  delete from public.reading where chapter_id = old.id;
  delete from public.reading_sessions where chapter_id = old.id;
  return old;
end;
$$;
drop trigger if exists tr_chapter_cleanup_reading on public.chapters;
create trigger tr_chapter_cleanup_reading
after delete on public.chapters
for each row execute function public.on_chapter_deleted();
