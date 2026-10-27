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

-- 2. Update member_action RPC to handle equip_title cleanly
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
  uid uuid;
  v_work_id uuid;
  v_work_slug text;
  v_work_title text;
  v_target_user_id uuid;
  v_title_id text;
  v_badge_id text;
  v_req_level int;
  v_xp int;
  v_level int;
  v_fav boolean;
  v_status text;
  v_res jsonb;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Não autenticado' using errcode='42501';
  end if;

  if p_action = 'profile' then
    update public.members
    set
      username = lower(trim(p_data->>'username')),
      display_name = trim(p_data->>'display_name'),
      bio = coalesce(p_data->>'bio', '')
    where id = uid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'equip_title' then
    v_title_id := nullif(trim(coalesce(p_data->>'title_id', '')), '');
    
    if v_title_id is null or v_title_id = 'none' then
      update public.members set equipped_title_id = null, manual_title = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_title_id', null);
    end if;

    -- Seasonal Achievement Titles (Levels 1 to 100)
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
      -- Legacy fallback IDs
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

      -- Add achievement title to member_inventory so it satisfies foreign key & inventory queries
      insert into public.member_inventory(user_id, item_id, origin)
      values (uid, v_title_id, 'ACHIEVEMENT')
      on conflict (user_id, item_id) do nothing;

      update public.members set equipped_title_id = v_title_id, manual_title = true where id = uid;
      return jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);
    end if;

    -- If not an achievement title, check if it is an owned shop cosmetic or Hall of Fame title
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

  elsif p_action = 'like' then
    v_work_id := (p_data->>'work_id')::uuid;
    v_work_slug := p_data->>'work_slug';
    v_work_title := p_data->>'work_title';

    if v_work_id is null then
      raise exception 'work_id obrigatório' using errcode='22023';
    end if;

    if not exists(select 1 from public.works where id = v_work_id) then
      insert into public.works (id, slug, title, published, kind, status, content_rating)
      values (
        v_work_id,
        coalesce(v_work_slug, 'obra-' || substr(v_work_id::text, 1, 8)),
        coalesce(v_work_title, 'Obra'),
        true,
        'MANHWA',
        'ONGOING',
        'GENERAL'
      )
      on conflict (id) do nothing;
    end if;

    if exists(select 1 from public.likes where user_id = uid and work_id = v_work_id) then
      delete from public.likes where user_id = uid and work_id = v_work_id;
      return jsonb_build_object('ok', true, 'liked', false);
    else
      insert into public.likes(user_id, work_id) values (uid, v_work_id)
      on conflict (user_id, work_id) do nothing;

      select public.grant_xp_action(
        uid,
        'LIKE_WORK',
        jsonb_build_object('work_id', v_work_id)
      ) into v_res;

      return jsonb_build_object('ok', true, 'liked', true, 'xp_award', v_res);
    end if;

  elsif p_action = 'library' then
    v_work_id := (p_data->>'work_id')::uuid;
    v_work_slug := p_data->>'work_slug';
    v_work_title := p_data->>'work_title';
    v_fav := coalesce((p_data->>'favorite')::boolean, false);
    v_status := coalesce(p_data->>'status', 'READING');

    if v_work_id is null then
      raise exception 'work_id obrigatório' using errcode='22023';
    end if;

    if not exists(select 1 from public.works where id = v_work_id) then
      insert into public.works (id, slug, title, published, kind, status, content_rating)
      values (
        v_work_id,
        coalesce(v_work_slug, 'obra-' || substr(v_work_id::text, 1, 8)),
        coalesce(v_work_title, 'Obra'),
        true,
        'MANHWA',
        'ONGOING',
        'GENERAL'
      )
      on conflict (id) do nothing;
    end if;

    insert into public.library(user_id, work_id, favorite, status, updated_at)
    values (uid, v_work_id, v_fav, v_status, now())
    on conflict (user_id, work_id) do update set
      favorite = excluded.favorite,
      status = excluded.status,
      updated_at = now();

    if v_fav then
      select public.grant_xp_action(
        uid,
        'FAVORITE_WORK',
        jsonb_build_object('work_id', v_work_id)
      ) into v_res;
    else
      v_res := jsonb_build_object('awarded', false);
    end if;

    return jsonb_build_object('ok', true, 'favorite', v_fav, 'status', v_status, 'xp_award', v_res);

  else
    raise exception 'Ação desconhecida: %', p_action using errcode='22023';
  end if;
end;
$$;
