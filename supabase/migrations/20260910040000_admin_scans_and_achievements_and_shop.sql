-- Project Nox: Scans Management, 80+ Achievements & Cosmetics Overhaul
-- Migration: 20260910040000_admin_scans_and_achievements_and_shop.sql

-- 1. Ensure columns and drop obsolete check constraints
alter table public.achievements drop constraint if exists achievements_category_check;
alter table public.achievements drop constraint if exists achievements_rarity_check;
alter table public.shop_items drop constraint if exists shop_items_rarity_check;
alter table public.achievements add column if not exists rarity text not null default 'COMUM';
alter table public.shop_items add column if not exists rarity text not null default 'COMUM';
alter table public.shop_items add column if not exists status text not null default 'ACTIVE';
alter table public.shop_items add column if not exists thumbnail_url text;

-- 2. Enhanced editor_action function supporting scans, work scans, batch attribution, and shop items
create or replace function public.editor_action(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
  v_work_id uuid;
  wid uuid;
  cid uuid;
  v_rating text;
  v_adult_tag uuid;
  v_pornhwa_tag uuid;
  v_scan record;
  v_scan_id uuid;
begin
  if not public.is_editor() then
    raise exception 'Acesso editorial negado' using errcode='42501';
  end if;

  -- === WORK ===
  if p_action = 'work' then
    v_id := coalesce(nullif(p_data->>'id', '')::uuid, gen_random_uuid());
    v_rating := case when p_data->>'content_rating' = 'ADULT_18' or (p_data->>'age_rating')::integer >= 18 then 'ADULT_18' else 'GENERAL' end;

    insert into public.works(id, slug, title, aliases, synopsis, description, author, artist, kind, status, year, age_rating, content_rating, cover_id)
    values(
      v_id,
      p_data->>'slug',
      trim(p_data->>'title'),
      array(select jsonb_array_elements_text(coalesce(p_data->'aliases', '[]'))),
      coalesce(p_data->>'synopsis', ''),
      coalesce(p_data->>'description', ''),
      coalesce(p_data->>'author', ''),
      coalesce(p_data->>'artist', ''),
      p_data->>'kind',
      p_data->>'status',
      nullif(p_data->>'year', '')::integer,
      case when v_rating = 'ADULT_18' then 18 else coalesce((p_data->>'age_rating')::integer, 12) end,
      v_rating,
      nullif(p_data->>'cover_id', '')::uuid
    )
    on conflict(id) do update set
      slug = excluded.slug,
      title = excluded.title,
      aliases = excluded.aliases,
      synopsis = excluded.synopsis,
      description = excluded.description,
      author = excluded.author,
      artist = excluded.artist,
      kind = excluded.kind,
      status = excluded.status,
      year = excluded.year,
      age_rating = excluded.age_rating,
      content_rating = excluded.content_rating,
      cover_id = excluded.cover_id,
      updated_at = now();

    -- Tags preservation
    delete from public.work_tags where work_id = v_id and not system_generated;
    insert into public.work_tags(work_id, tag_id, system_generated)
    select v_id, value::uuid, false from jsonb_array_elements_text(coalesce(p_data->'tags', '[]'))
    on conflict do nothing;

    -- Content rating tags
    select id into v_adult_tag from public.tags where slug = 'adulto-18';
    select id into v_pornhwa_tag from public.tags where slug = 'pornhwa';
    if v_rating = 'ADULT_18' then
      if v_adult_tag is not null then
        insert into public.work_tags(work_id, tag_id, system_generated) values(v_id, v_adult_tag, true) on conflict do nothing;
      end if;
      if p_data->>'kind' = 'MANHWA' and v_pornhwa_tag is not null then
        insert into public.work_tags(work_id, tag_id, system_generated) values(v_id, v_pornhwa_tag, true) on conflict do nothing;
      else
        delete from public.work_tags where work_id = v_id and system_generated and tag_id = v_pornhwa_tag;
      end if;
    else
      delete from public.work_tags where work_id = v_id and system_generated and tag_id in (v_adult_tag, v_pornhwa_tag);
    end if;

    -- Work scans attribution
    if p_data ? 'scans' then
      delete from public.work_scans where work_id = v_id;
      insert into public.work_scans(work_id, scan_id, is_primary)
      select
        v_id,
        (s->>'scan_id')::uuid,
        coalesce((s->>'is_primary')::boolean, false)
      from jsonb_array_elements(p_data->'scans') as s;

      if coalesce((p_data->>'apply_to_chapters')::boolean, false) then
        delete from public.chapter_scans where chapter_id in (select id from public.chapters where work_id = v_id);
        insert into public.chapter_scans(chapter_id, scan_id)
        select c.id, ws.scan_id
        from public.chapters c
        cross join public.work_scans ws
        where c.work_id = v_id and ws.work_id = v_id
        on conflict do nothing;
      end if;
    end if;

  -- === TAG ===
  elsif p_action = 'tag' then
    v_id := coalesce(nullif(p_data->>'id', '')::uuid, gen_random_uuid());
    insert into public.tags(id, name, slug, kind)
    values(v_id, trim(p_data->>'name'), p_data->>'slug', p_data->>'kind')
    on conflict(id) do update set name = excluded.name, slug = excluded.slug, kind = excluded.kind;

  -- === SCAN MANAGEMENT ===
  elsif p_action = 'scan' then
    v_id := coalesce(nullif(p_data->>'id', '')::uuid, gen_random_uuid());
    insert into public.scans(id, name, slug, description, website, discord, status, is_official)
    values(
      v_id,
      trim(p_data->>'name'),
      lower(trim(p_data->>'slug')),
      coalesce(p_data->>'description', ''),
      coalesce(p_data->>'website', ''),
      coalesce(p_data->>'discord', ''),
      coalesce(p_data->>'status', 'ACTIVE'),
      coalesce((p_data->>'is_official')::boolean, false)
    )
    on conflict(id) do update set
      name = excluded.name,
      slug = excluded.slug,
      description = excluded.description,
      website = excluded.website,
      discord = excluded.discord,
      status = excluded.status,
      is_official = excluded.is_official,
      updated_at = now();

  elsif p_action = 'delete_scan' then
    v_id := (p_data->>'id')::uuid;
    if exists(select 1 from public.scans where id = v_id and is_official = true) then
      raise exception 'A scan oficial Project Nox não pode ser removida.';
    end if;
    delete from public.chapter_scans where scan_id = v_id;
    delete from public.work_scans where scan_id = v_id;
    delete from public.scan_members where scan_id = v_id;
    delete from public.scans where id = v_id;

  elsif p_action = 'apply_work_scans_to_chapters' then
    v_id := (p_data->>'work_id')::uuid;
    delete from public.chapter_scans where chapter_id in (select id from public.chapters where work_id = v_id);
    insert into public.chapter_scans(chapter_id, scan_id)
    select c.id, ws.scan_id
    from public.chapters c
    cross join public.work_scans ws
    where c.work_id = v_id and ws.work_id = v_id
    on conflict do nothing;

  -- === CHAPTER ===
  elsif p_action = 'chapter' then
    v_id := coalesce(nullif(p_data->>'id', '')::uuid, gen_random_uuid());
    v_work_id := (p_data->>'work_id')::uuid;

    perform 1 from public.chapters where id = v_id for update;
    if exists(select 1 from public.chapters where id = v_id and published_at is not null) then
      raise exception 'Despublique o capítulo antes de editar suas páginas';
    end if;

    insert into public.chapters(id, work_id, number, title)
    values(v_id, v_work_id, (p_data->>'number')::numeric, coalesce(p_data->>'title', ''))
    on conflict(id) do update set number = excluded.number, title = excluded.title;

    if p_data ? 'pages' then
      if jsonb_array_length(p_data->'pages') not between 1 and 500 then
        raise exception 'Selecione de 1 a 500 páginas';
      end if;
      delete from public.pages where chapter_id = v_id;
      insert into public.pages(chapter_id, position, media_id, width, height)
      select v_id, ordinality::integer, m.id, m.width, m.height
      from jsonb_array_elements_text(p_data->'pages') with ordinality p(value, ordinality)
      join public.media m on m.id = p.value::uuid;

      if (select count(*) from public.pages where chapter_id = v_id) <> jsonb_array_length(p_data->'pages') then
        raise exception 'Upload incompleto';
      end if;
    end if;

    -- Chapter scan attribution
    if p_data ? 'scans' then
      delete from public.chapter_scans where chapter_id = v_id;
      insert into public.chapter_scans(chapter_id, scan_id)
      select v_id, value::uuid
      from jsonb_array_elements_text(p_data->'scans')
      on conflict do nothing;
    else
      -- Inherit work scans by default for newly created chapters
      if not exists(select 1 from public.chapter_scans where chapter_id = v_id) then
        insert into public.chapter_scans(chapter_id, scan_id)
        select v_id, scan_id from public.work_scans where work_id = v_work_id
        on conflict do nothing;
      end if;
    end if;

  -- === PUBLISH / UNPUBLISH / ARCHIVE ===
  elsif p_action = 'publish' then
    v_id := (p_data->>'id')::uuid;
    select work_id into wid from public.chapters where id = v_id for update;
    if not found then raise exception 'Capítulo inexistente'; end if;
    if not exists(select 1 from public.pages where chapter_id = v_id) then raise exception 'Envie as páginas antes de publicar'; end if;
    if not exists(select 1 from public.works where id = wid and cover_id is not null and length(trim(synopsis)) > 0) then raise exception 'Preencha a capa e a sinopse da obra antes de publicar'; end if;
    if not coalesce((p_data->>'confirmed_final')::boolean, false) then raise exception 'Confirme que este é o material final revisado'; end if;
    if exists(select 1 from public.chapters where id = v_id and published_at is not null) then return jsonb_build_object('ok', true, 'id', v_id); end if;
    update public.chapters set published_at = now() where id = v_id;
    update public.works set published = true, updated_at = now() where id = wid;
    insert into public.notifications(user_id, kind, body, href, dedupe_key)
    select l.user_id, 'chapter', w.title || ': novo capítulo disponível.', '/ler/' || v_id, 'chapter:' || v_id
    from public.library l
    join public.works w on w.id = l.work_id
    where l.work_id = wid and l.following
    on conflict do nothing;

  elsif p_action = 'unpublish' then
    v_id := (p_data->>'id')::uuid;
    update public.chapters set published_at = null where id = v_id;

  elsif p_action = 'archive' then
    v_id := (p_data->>'id')::uuid;
    update public.works set published = false, updated_at = now() where id = v_id;

  -- === SHOP MANAGEMENT ===
  elsif p_action = 'shop_item' then
    insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
    values(
      trim(p_data->>'id'),
      trim(p_data->>'name'),
      coalesce(p_data->>'description', ''),
      p_data->>'kind',
      (p_data->>'price_xp')::integer,
      coalesce(p_data->>'rarity', 'COMUM'),
      coalesce((p_data->>'is_animated')::boolean, false),
      coalesce((p_data->>'min_level')::integer, 1),
      coalesce((p_data->>'is_active')::boolean, true),
      coalesce(p_data->>'status', 'ACTIVE'),
      coalesce((p_data->>'order_index')::integer, 99),
      coalesce(p_data->>'asset_url', ''),
      coalesce(p_data->'style_data', '{}'::jsonb)
    )
    on conflict(id) do update set
      name = excluded.name,
      description = excluded.description,
      kind = excluded.kind,
      price_xp = excluded.price_xp,
      rarity = excluded.rarity,
      is_animated = excluded.is_animated,
      min_level = excluded.min_level,
      is_active = excluded.is_active,
      status = excluded.status,
      order_index = excluded.order_index,
      asset_url = excluded.asset_url,
      style_data = excluded.style_data;

  elsif p_action = 'delete_shop_item' then
    if exists(select 1 from public.member_inventory where item_id = p_data->>'id') then
      -- Safe protection: mark inactive instead of hard deleting owned items
      update public.shop_items set is_active = false, status = 'ARCHIVED' where id = p_data->>'id';
      return jsonb_build_object('ok', true, 'archived', true, 'message', 'Item arquivado para proteger inventários de usuários.');
    else
      delete from public.shop_items where id = p_data->>'id';
    end if;

  else
    raise exception 'Ação editorial inválida: %', p_action;
  end if;

  insert into public.audit_log(actor_id, action, target_id, metadata)
  values(auth.uid(), p_action, v_id, p_data);

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- 3. Seed Achievements

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'first_step',
  'Despertar Cósmico',
  'Crie sua conta e dê os primeiros passos no universo Project Nox.',
  'INICIACAO',
  'COMUM',
  'Sparkles',
  '#a78bfa',
  50,
  'ACCOUNT_CREATED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'profile_setup',
  'Identidade Forjada',
  'Personalize sua bio e configure seu perfil de leitor.',
  'INICIACAO',
  'COMUM',
  'Feather',
  '#38bdf8',
  75,
  'PROFILE_UPDATED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'first_avatar',
  'Rosto no Abismo',
  'Faça upload do seu próprio avatar de perfil.',
  'INICIACAO',
  'COMUM',
  'User',
  '#c084fc',
  100,
  'AVATAR_UPLOADED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'first_banner_upload',
  'Horizonte Pessoal',
  'Personalize seu banner de perfil no Meu Espaço.',
  'INICIACAO',
  'INCOMUM',
  'Image',
  '#818cf8',
  150,
  'BANNER_UPLOADED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_1',
  'Primeira Folha',
  'Leia o seu primeiro capítulo no Project Nox.',
  'LEITURA',
  'COMUM',
  'BookOpen',
  '#34d399',
  50,
  'CHAPTERS_READ',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_5',
  'Adepto das Páginas',
  'Leia 5 capítulos de qualquer obra.',
  'LEITURA',
  'COMUM',
  'BookOpen',
  '#4ade80',
  100,
  'CHAPTERS_READ',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_15',
  'Apetite Literário',
  'Leia 15 capítulos no catálogo.',
  'LEITURA',
  'INCOMUM',
  'BookOpen',
  '#22c55e',
  200,
  'CHAPTERS_READ',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_30',
  'Devorador Noturno',
  'Leia 30 capítulos e adentre as profundezas da leitura.',
  'LEITURA',
  'INCOMUM',
  'BookOpen',
  '#10b981',
  350,
  'CHAPTERS_READ',
  30,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_60',
  'Explorador dos Mundos',
  'Leia 60 capítulos entre manhwas, mangas e webtoons.',
  'LEITURA',
  'RARA',
  'BookOpen',
  '#059669',
  600,
  'CHAPTERS_READ',
  60,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_100',
  'Centurião do Conhecimento',
  'Alcance a marca gloriosa de 100 capítulos lidos.',
  'LEITURA',
  'RARA',
  'BookOpen',
  '#3b82f6',
  1000,
  'CHAPTERS_READ',
  100,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_250',
  'Mestre da Vigília',
  'Leia 250 capítulos sem perder o fôlego.',
  'LEITURA',
  'EPICA',
  'BookOpen',
  '#6366f1',
  2000,
  'CHAPTERS_READ',
  250,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_500',
  'Guardião dos Tomos',
  'Leia 500 capítulos no catálogo Nox.',
  'LEITURA',
  'LENDARIA',
  'BookOpen',
  '#a855f7',
  4000,
  'CHAPTERS_READ',
  500,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'read_1000',
  'Soberano das Dimensões',
  'Alcançou a marca mítica de 1.000 capítulos lidos.',
  'LEITURA',
  'MITICA',
  'Crown',
  '#f59e0b',
  10000,
  'CHAPTERS_READ',
  1000,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'marathon_5',
  'Ritmo Acelerado',
  'Leia 5 capítulos de uma mesma obra seguidos.',
  'MARATONA',
  'COMUM',
  'Flame',
  '#f97316',
  120,
  'MARATHON_CHAPTERS',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'marathon_15',
  'Sem Freios',
  'Leia 15 capítulos consecutivos de uma mesma obra.',
  'MARATONA',
  'INCOMUM',
  'Flame',
  '#ea580c',
  300,
  'MARATHON_CHAPTERS',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'marathon_30',
  'Imersão Absoluta',
  'Leia 30 capítulos sem trocar de obra em uma sessão contínua.',
  'MARATONA',
  'RARA',
  'Flame',
  '#ef4444',
  700,
  'MARATHON_CHAPTERS',
  30,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'marathon_50',
  'Frenesi Imparável',
  'Maratone 50 capítulos sem interrupções.',
  'MARATONA',
  'EPICA',
  'Flame',
  '#dc2626',
  1500,
  'MARATHON_CHAPTERS',
  50,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'works_1',
  'Novo Começo',
  'Comece a ler sua primeira obra.',
  'OBRAS',
  'COMUM',
  'Compass',
  '#38bdf8',
  60,
  'WORKS_STARTED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'works_5',
  'Poliglota de Histórias',
  'Leia capítulos em pelo menos 5 obras distintas.',
  'OBRAS',
  'INCOMUM',
  'Compass',
  '#0ea5e9',
  200,
  'WORKS_STARTED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'works_15',
  'Navegador Eclético',
  'Explore e leia capítulos em 15 obras diferentes.',
  'OBRAS',
  'RARA',
  'Compass',
  '#0284c7',
  500,
  'WORKS_STARTED',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'works_30',
  'Cartógrafo do Cosmos',
  'Acompanhe 30 obras diferentes no Project Nox.',
  'OBRAS',
  'EPICA',
  'Compass',
  '#8b5cf6',
  1200,
  'WORKS_STARTED',
  30,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'works_50',
  'Omnipresença Literária',
  'Leia capítulos em mais de 50 obras de todo o acervo.',
  'OBRAS',
  'LENDARIA',
  'Compass',
  '#ec4899',
  3000,
  'WORKS_STARTED',
  50,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'completed_1',
  'Ponto Final',
  'Termine de ler todos os capítulos de uma obra finalizada.',
  'CONCLUSAO',
  'INCOMUM',
  'CheckCircle2',
  '#10b981',
  250,
  'WORKS_COMPLETED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'completed_3',
  'Colecionador de Finais',
  'Complete 3 obras do começo ao fim.',
  'CONCLUSAO',
  'RARA',
  'CheckCircle2',
  '#059669',
  600,
  'WORKS_COMPLETED',
  3,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'completed_5',
  'Mestre da Conclusão',
  'Leve 5 histórias completas até o último quadro.',
  'CONCLUSAO',
  'EPICA',
  'CheckCircle2',
  '#047857',
  1500,
  'WORKS_COMPLETED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'completed_10',
  'Epílogo Supremo',
  'Conclua 10 obras do início ao desfecho definitivo.',
  'CONCLUSAO',
  'LENDARIA',
  'Award',
  '#f59e0b',
  3500,
  'WORKS_COMPLETED',
  10,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'library_1',
  'Primeira Prateleira',
  'Adicione uma obra à sua biblioteca pessoal.',
  'BIBLIOTECA',
  'COMUM',
  'Library',
  '#a78bfa',
  50,
  'LIBRARY_COUNT',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'library_5',
  'Arquivo Inicial',
  'Adicione 5 obras à sua biblioteca.',
  'BIBLIOTECA',
  'COMUM',
  'Library',
  '#8b5cf6',
  100,
  'LIBRARY_COUNT',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'library_15',
  'Acervo Curado',
  'Mantenha 15 obras organizadas em sua biblioteca.',
  'BIBLIOTECA',
  'INCOMUM',
  'Library',
  '#7c3aed',
  250,
  'LIBRARY_COUNT',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'library_30',
  'Biblioteca do Astrônomo',
  'Colecione 30 obras ativas em sua biblioteca pessoal.',
  'BIBLIOTECA',
  'RARA',
  'Library',
  '#6d28d9',
  550,
  'LIBRARY_COUNT',
  30,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'library_50',
  'Grande Arquivista',
  'Alcance 50 obras cadastradas em sua biblioteca.',
  'BIBLIOTECA',
  'EPICA',
  'Library',
  '#5b21b6',
  1200,
  'LIBRARY_COUNT',
  50,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'fav_1',
  'Coração Escolhido',
  'Marque sua primeira obra favorita com uma estrela.',
  'FAVORITOS',
  'COMUM',
  'Heart',
  '#f43f5e',
  50,
  'FAVORITES_COUNT',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'fav_5',
  'Pantheon Pessoal',
  'Favorita 5 obras inesquecíveis.',
  'FAVORITOS',
  'INCOMUM',
  'Heart',
  '#e11d48',
  150,
  'FAVORITES_COUNT',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'fav_15',
  'Galeria do Afeto',
  'Marque 15 obras nos seus favoritos eternos.',
  'FAVORITOS',
  'RARA',
  'Heart',
  '#be123c',
  400,
  'FAVORITES_COUNT',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'fav_30',
  'Amor Incondicional',
  'Guarde 30 obras especiais em seu coração e favoritos.',
  'FAVORITOS',
  'EPICA',
  'Heart',
  '#9f1239',
  1000,
  'FAVORITES_COUNT',
  30,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_action',
  'Guerreiro das Arenas',
  'Leia 20 capítulos de obras do gênero Ação.',
  'GENEROS',
  'INCOMUM',
  'Swords',
  '#f97316',
  200,
  'GENRE_ACTION',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_romance',
  'Corações Entrelaçados',
  'Leia 20 capítulos de obras do gênero Romance.',
  'GENEROS',
  'INCOMUM',
  'Heart',
  '#ec4899',
  200,
  'GENRE_ROMANCE',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_fantasy',
  'Invocador Arcano',
  'Leia 20 capítulos de obras do gênero Fantasia ou Magia.',
  'GENEROS',
  'INCOMUM',
  'Sparkles',
  '#a855f7',
  200,
  'GENRE_FANTASY',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_scifi',
  'Viajante Cibernético',
  'Leia 20 capítulos de Ficção Científica ou Cyberpunk.',
  'GENEROS',
  'INCOMUM',
  'Zap',
  '#06b6d4',
  200,
  'GENRE_SCIFI',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_horror',
  'Olhos no Escuro',
  'Leia 15 capítulos de Terror, Sobrenatural ou Suspense sem hesitar.',
  'GENEROS',
  'RARA',
  'Eye',
  '#ef4444',
  350,
  'GENRE_HORROR',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_comedy',
  'Riso Descontraído',
  'Leia 15 capítulos de obras de Comédia e Vida Escolar.',
  'GENEROS',
  'INCOMUM',
  'Coffee',
  '#eab308',
  200,
  'GENRE_COMEDY',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_adult_curious',
  'Território Maduro',
  'Leia 10 capítulos em obras com classificação adulta (+18).',
  'GENEROS',
  'INCOMUM',
  'Flame',
  '#dc2626',
  250,
  'GENRE_ADULT',
  10,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'genre_adult_veteran',
  'Connoisseur da Meia-Noite',
  'Leia 50 capítulos adultos (+18) com verificação confirmada.',
  'GENEROS',
  'RARA',
  'Moon',
  '#b91c1c',
  700,
  'GENRE_ADULT',
  50,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'search_catalog',
  'Buscador Curioso',
  'Utilize a busca avançada para encontrar uma obra específica.',
  'EXPLORACAO',
  'COMUM',
  'Search',
  '#38bdf8',
  40,
  'SEARCH_USED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'explore_tags',
  'Rastreador de Gêneros',
  'Navegue pelo catálogo filtrando por múltiplos gêneros e tags.',
  'EXPLORACAO',
  'COMUM',
  'Target',
  '#2dd4bf',
  60,
  'TAG_FILTER_USED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'sort_views',
  'Na Crista da Onda',
  'Confira as obras Mais Lidas e populares da plataforma.',
  'EXPLORACAO',
  'COMUM',
  'Eye',
  '#a78bfa',
  40,
  'MOST_READ_CHECKED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'ranking_visit',
  'Olhar para o Olimpo',
  'Acesse o Ranking de Leitores e veja quem lidera a comunidade.',
  'EXPLORACAO',
  'COMUM',
  'Crown',
  '#fbbf24',
  50,
  'RANKING_VISITED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'official_nox_fan',
  'Selo Oficial Nox',
  'Leia 10 capítulos traduzidos pela equipe oficial Project Nox.',
  'SCANS',
  'INCOMUM',
  'Shield',
  '#c084fc',
  250,
  'OFFICIAL_SCAN_READ',
  10,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'partner_scan_supporter',
  'Aliado das Scans',
  'Leia obras traduzidas por grupos de scans parceiras.',
  'SCANS',
  'INCOMUM',
  'Users',
  '#34d399',
  200,
  'PARTNER_SCAN_READ',
  10,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'scan_profile_view',
  'Reconhecimento Editorial',
  'Visite a página de perfil de uma scan parceira no catálogo.',
  'SCANS',
  'COMUM',
  'ExternalLink',
  '#60a5fa',
  50,
  'SCAN_PAGE_VIEW',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'comment_1',
  'Voz na Multidão',
  'Publique seu primeiro comentário em um capítulo.',
  'COMUNIDADE',
  'COMUM',
  'MessageSquare',
  '#38bdf8',
  60,
  'COMMENTS_POSTED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'comment_5',
  'Crítico Participativo',
  'Publique 5 comentários compartilhando suas teorias.',
  'COMUNIDADE',
  'INCOMUM',
  'MessageSquare',
  '#0284c7',
  180,
  'COMMENTS_POSTED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'comment_20',
  'Orador do Abismo',
  'Deixe sua marca com 20 comentários na comunidade.',
  'COMUNIDADE',
  'RARA',
  'MessageSquare',
  '#6366f1',
  500,
  'COMMENTS_POSTED',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'like_received_5',
  'Ideia Aprovada',
  'Receba 5 curtidas em seus comentários.',
  'COMUNIDADE',
  'INCOMUM',
  'Heart',
  '#f43f5e',
  150,
  'LIKES_RECEIVED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'like_received_25',
  'Voz Respeitada',
  'Receba 25 curtidas somadas em comentários pela comunidade.',
  'COMUNIDADE',
  'RARA',
  'Award',
  '#e11d48',
  450,
  'LIKES_RECEIVED',
  25,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'like_received_100',
  'Ícone Comunitário',
  'Receba 100 curtidas da comunidade em suas análises e posts.',
  'COMUNIDADE',
  'EPICA',
  'Crown',
  '#eab308',
  1200,
  'LIKES_RECEIVED',
  100,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'offline_first',
  'Modo Avião',
  'Baixe seu primeiro capítulo para leitura offline no navegador.',
  'OFFLINE',
  'COMUM',
  'Download',
  '#34d399',
  80,
  'OFFLINE_DOWNLOADS',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'offline_5',
  'Mochila Literária',
  'Guarde 5 capítulos offline no IndexedDB.',
  'OFFLINE',
  'INCOMUM',
  'Download',
  '#10b981',
  200,
  'OFFLINE_DOWNLOADS',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'offline_20',
  'Refúgio Desconectado',
  'Armazene 20 capítulos offline para viagens ou sem rede.',
  'OFFLINE',
  'RARA',
  'Download',
  '#059669',
  500,
  'OFFLINE_DOWNLOADS',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'offline_batch',
  'Carga Máxima',
  'Utilize o botão "Baixar Todos" para salvar uma leva inteira.',
  'OFFLINE',
  'RARA',
  'Download',
  '#6366f1',
  400,
  'OFFLINE_BATCH',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'level_5',
  'Iniciado da Ordem',
  'Acumule XP e alcance o Nível 5 no Project Nox.',
  'PROGRESSAO',
  'COMUM',
  'Star',
  '#38bdf8',
  150,
  'LEVEL_REACHED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'level_10',
  'Cavaleiro das Páginas',
  'Alcance o Nível 10 de prestígio.',
  'PROGRESSAO',
  'INCOMUM',
  'Star',
  '#818cf8',
  350,
  'LEVEL_REACHED',
  10,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'level_20',
  'Arquimago da Vigília',
  'Alcance o Nível 20 e desbloqueie itens de alta patente na Loja.',
  'PROGRESSAO',
  'RARA',
  'Star',
  '#c084fc',
  800,
  'LEVEL_REACHED',
  20,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'level_35',
  'Semideus das Palavras',
  'Chegue ao Nível 35 com dedicação exemplar.',
  'PROGRESSAO',
  'EPICA',
  'Crown',
  '#f43f5e',
  1800,
  'LEVEL_REACHED',
  35,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'level_50',
  'Entidade Eterna',
  'Alcance o Nível 50. Seu nome ecoará na eternidade cósmica.',
  'PROGRESSAO',
  'LENDARIA',
  'Crown',
  '#eab308',
  5000,
  'LEVEL_REACHED',
  50,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_first_buy',
  'Primeiro Luxo',
  'Adquira seu primeiro item cosmético na Loja usando seus pontos de XP.',
  'LOJA',
  'COMUM',
  'ShoppingBag',
  '#a78bfa',
  100,
  'ITEMS_PURCHASED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_equip_frame',
  'Moldura Radiante',
  'Equipe uma moldura de avatar adquirida na loja.',
  'LOJA',
  'COMUM',
  'Sparkles',
  '#38bdf8',
  80,
  'FRAME_EQUIPPED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_equip_title',
  'Título Imponente',
  'Equipe um título cósmico para exibir ao lado do seu nome.',
  'LOJA',
  'COMUM',
  'Award',
  '#34d399',
  80,
  'TITLE_EQUIPPED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_equip_banner',
  'Painel Galáctico',
  'Equipe um banner de perfil exclusivo da Loja.',
  'LOJA',
  'INCOMUM',
  'Image',
  '#818cf8',
  150,
  'BANNER_EQUIPPED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_color_equip',
  'Cor da Alma',
  'Equipe uma cor especial de nome de usuário.',
  'LOJA',
  'INCOMUM',
  'Zap',
  '#f43f5e',
  150,
  'NAME_COLOR_EQUIPPED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_collector_5',
  'Guarda-Roupa Cósmico',
  'Adquira 5 itens cosméticos diferentes na Loja.',
  'LOJA',
  'RARA',
  'Gem',
  '#c084fc',
  500,
  'ITEMS_PURCHASED',
  5,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_collector_15',
  'Magnata do Estilo',
  'Adquira 15 itens cosméticos para seu inventário.',
  'LOJA',
  'EPICA',
  'Gem',
  '#eab308',
  1500,
  'ITEMS_PURCHASED',
  15,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'shop_mythic_owner',
  'Relíquia Suprema',
  'Adquira um cosmético de raridade Mítica na Loja.',
  'LOJA',
  'MITICA',
  'Crown',
  '#ec4899',
  3000,
  'MYTHIC_PURCHASED',
  1,
  false
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_midnight_reader',
  'Vigília da Madrugada',
  'Leu capítulos silenciosamente entre 03:00 e 05:00 da manhã.',
  'SECRETAS',
  'RARA',
  'Moon',
  '#6366f1',
  666,
  'MIDNIGHT_READING',
  1,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_distant_sky_fan',
  'Sobrevivente do Céu Distante',
  'Leu 10 capítulos da obra distópica Céu Distante.',
  'SECRETAS',
  'RARA',
  'CloudRain',
  '#38bdf8',
  500,
  'DISTANT_SKY_CHAPTERS',
  10,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_speed_reader',
  'Velocidade da Luz',
  'Leu 10 capítulos em menos de 15 minutos mantendo o foco.',
  'SECRETAS',
  'EPICA',
  'Zap',
  '#eab308',
  1000,
  'SPEED_READING',
  1,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_abyss_stare',
  'O Abismo Também Olha',
  'Passou mais de 30 minutos em um mesmo capítulo imerso nos detalhes da arte.',
  'SECRETAS',
  'EPICA',
  'Eye',
  '#9333ea',
  1200,
  'PROLONGED_CHAPTER',
  1,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_easter_egg_finder',
  'Arqueólogo Digital',
  'Descobriu uma mensagem oculta no código do Project Nox.',
  'SECRETAS',
  'LENDARIA',
  'Key',
  '#ec4899',
  2500,
  'EASTER_EGG',
  1,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

insert into public.achievements(id, title, description, category, rarity, icon, badge_color, xp_reward, condition_type, condition_value, is_secret)
values(
  'secret_perfectionist',
  'Templo Imaculado',
  'Completou 100% de leitura de todas as obras que iniciou.',
  'SECRETAS',
  'MITICA',
  'Crown',
  '#f59e0b',
  5000,
  'PERFECT_READ_RATIO',
  1,
  true
)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret;

-- 4. Seed Shop Items (Cosmetics)

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_basic_violet',
  'Anel Violeta',
  'Moldura fina em tons suaves de lavanda e violeta.',
  'AVATAR_FRAME',
  200,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  1,
  '',
  '{"border":"2px solid #a78bfa","boxShadow":"0 0 8px rgba(167, 139, 250, 0.4)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_basic_cyan',
  'Anel Ciano',
  'Contorno moderno em ciano elétrico.',
  'AVATAR_FRAME',
  200,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  2,
  '',
  '{"border":"2px solid #38bdf8","boxShadow":"0 0 8px rgba(56, 189, 248, 0.4)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_basic_emerald',
  'Anel Esmeralda',
  'Toque verde sutil e reconfortante.',
  'AVATAR_FRAME',
  250,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  3,
  '',
  '{"border":"2px solid #34d399","boxShadow":"0 0 8px rgba(52, 211, 153, 0.4)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_basic_amber',
  'Anel Âmbar',
  'Reflexo aconchegante de luz dourada.',
  'AVATAR_FRAME',
  250,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  4,
  '',
  '{"border":"2px solid #fbbf24","boxShadow":"0 0 8px rgba(251, 191, 36, 0.4)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_basic_rose',
  'Anel Rosa Pastel',
  'Delicadeza floral em tons suaves.',
  'AVATAR_FRAME',
  250,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  5,
  '',
  '{"border":"2px solid #f472b6","boxShadow":"0 0 8px rgba(244, 114, 182, 0.4)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_cyber_neon',
  'Circuito Cibernético',
  'Estrutura geométrica com cantos iluminados em neon turquesa.',
  'AVATAR_FRAME',
  450,
  'INCOMUM',
  false,
  3,
  true,
  'ACTIVE',
  6,
  '',
  '{"border":"2px solid #06b6d4","boxShadow":"0 0 12px #06b6d4, inset 0 0 6px #0891b2"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_lunar_whisper',
  'Sussurro Lunar',
  'Prata fosca com brilho perolado.',
  'AVATAR_FRAME',
  500,
  'INCOMUM',
  false,
  3,
  true,
  'ACTIVE',
  7,
  '',
  '{"border":"2px solid #e2e8f0","boxShadow":"0 0 14px rgba(226, 232, 240, 0.6)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_shadow_runes',
  'Runas Sombrias',
  'Inscrições arcanas gravadas em obsidiana.',
  'AVATAR_FRAME',
  550,
  'INCOMUM',
  false,
  4,
  true,
  'ACTIVE',
  8,
  '',
  '{"border":"2.5px dashed #8b5cf6","boxShadow":"0 0 12px rgba(139, 92, 246, 0.5)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_autumn_ember',
  'Brasas de Outono',
  'Folhas ardentes e gradiente alaranjado.',
  'AVATAR_FRAME',
  550,
  'INCOMUM',
  false,
  4,
  true,
  'ACTIVE',
  9,
  '',
  '{"border":"2.5px solid #f97316","boxShadow":"0 0 12px rgba(249, 115, 22, 0.5)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_frost_bite',
  'Geada Eterna',
  'Cristais de gelo translúcidos pontiagudos.',
  'AVATAR_FRAME',
  600,
  'INCOMUM',
  false,
  5,
  true,
  'ACTIVE',
  10,
  '',
  '{"border":"2.5px solid #67e8f9","boxShadow":"0 0 14px rgba(103, 232, 249, 0.6)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_aurora_mystic',
  'Aura Mística',
  'Moldura animada com pulso espectral violeta e ciano.',
  'AVATAR_FRAME',
  900,
  'RARA',
  true,
  6,
  true,
  'ACTIVE',
  11,
  '',
  '{"animation":"pulse-glow 3s infinite","border":"3px solid #c084fc","boxShadow":"0 0 18px rgba(192, 132, 252, 0.7)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_infernal_gate',
  'Portal Infernal',
  'Chamas carmesins dinâmicas circulando o avatar.',
  'AVATAR_FRAME',
  1000,
  'RARA',
  true,
  7,
  true,
  'ACTIVE',
  12,
  '',
  '{"animation":"infernal-pulse 2.5s infinite","border":"3px solid #ef4444","boxShadow":"0 0 18px rgba(239, 68, 68, 0.7)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_astral_compass',
  'Bússola Astral',
  'Ponteiros estelares com giroscópio cintilante.',
  'AVATAR_FRAME',
  1100,
  'RARA',
  true,
  8,
  true,
  'ACTIVE',
  13,
  '',
  '{"border":"3px solid #818cf8","boxShadow":"0 0 20px rgba(129, 140, 248, 0.7)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_toxic_overdrive',
  'Sobrecarga Tóxica',
  'Verde ácido radioativo pulsando com alta voltagem.',
  'AVATAR_FRAME',
  1150,
  'RARA',
  true,
  8,
  true,
  'ACTIVE',
  14,
  '',
  '{"border":"3px solid #a3e635","boxShadow":"0 0 18px rgba(163, 230, 53, 0.7)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_void_nebula',
  'Vórtice da Nebulosa',
  'Moldura animada giratória inspirada no horizonte cósmico da Nox.',
  'AVATAR_FRAME',
  1800,
  'EPICA',
  true,
  10,
  true,
  'ACTIVE',
  15,
  '',
  '{"animation":"spin-slow 20s linear infinite","border":"3.5px solid transparent","backgroundImage":"linear-gradient(45deg, #9333ea, #06b6d4)","boxShadow":"0 0 24px rgba(147, 51, 234, 0.8)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_crimson_eclipse',
  'Eclipse Carmesim',
  'Fogo lunar escarlate para os leitores mais audazes.',
  'AVATAR_FRAME',
  2000,
  'EPICA',
  true,
  12,
  true,
  'ACTIVE',
  16,
  '',
  '{"animation":"blood-pulse 2s infinite","border":"3.5px solid #dc2626","boxShadow":"0 0 25px rgba(220, 38, 38, 0.85)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_glitch_protocol',
  'Protocolo Glitch',
  'Efeito holográfico instável com aberração cromática.',
  'AVATAR_FRAME',
  2100,
  'EPICA',
  true,
  14,
  true,
  'ACTIVE',
  17,
  '',
  '{"animation":"glitch 1.8s infinite","border":"3.5px solid #ec4899","boxShadow":"0 0 24px rgba(236, 72, 153, 0.8)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_celestial_gold',
  'Coroa Celestial',
  'Ouro sagrado radiante com brilhos estelares e aura divina.',
  'AVATAR_FRAME',
  3500,
  'LENDARIA',
  true,
  18,
  true,
  'ACTIVE',
  18,
  '',
  '{"animation":"divine-shimmer 3s infinite","border":"4px solid #f59e0b","boxShadow":"0 0 30px rgba(245, 158, 11, 0.9), inset 0 0 10px rgba(255, 255, 255, 0.6)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_singularity_gate',
  'Horizonte de Eventos',
  'Buraco negro em miniatura curvando o espaço-tempo.',
  'AVATAR_FRAME',
  3800,
  'LENDARIA',
  true,
  20,
  true,
  'ACTIVE',
  19,
  '',
  '{"animation":"singularity 6s infinite","border":"4px solid #7c3aed","boxShadow":"0 0 32px rgba(124, 58, 237, 0.95)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'frame_primordial_nox',
  'Nox Primordial',
  'A essência pura do Project Nox. Uma joia viva que desafia a realidade.',
  'AVATAR_FRAME',
  6000,
  'MITICA',
  true,
  25,
  true,
  'ACTIVE',
  20,
  '',
  '{"animation":"mythic-prism 4s infinite alternate","border":"4px solid #ffffff","boxShadow":"0 0 40px rgba(192, 132, 252, 1), 0 0 20px rgba(56, 189, 248, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.9)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_cosmic_abyss',
  'Abismo Estelar',
  'Nebulosa púrpura profunda pontilhada de estrelas distantes.',
  'PROFILE_BANNER',
  400,
  'COMUM',
  false,
  2,
  true,
  'ACTIVE',
  21,
  '/banners/cosmic_abyss.webp',
  '{"background":"linear-gradient(135deg, #0d0b1a 0%, #1f143d 50%, #0d0b1a 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_cyber_grid',
  'Matrix Noturna',
  'Perspectiva cibernética em grelha geométrica neon violeta.',
  'PROFILE_BANNER',
  800,
  'INCOMUM',
  false,
  4,
  true,
  'ACTIVE',
  22,
  '/banners/cyber_grid.webp',
  '{"background":"linear-gradient(135deg, #080e1c 0%, #0c2340 50%, #170d2b 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_crimson_moon',
  'Lua Carmesim',
  'Céu noturno vermelho sangrento com lua cheia oculta pelas nuvens.',
  'PROFILE_BANNER',
  1000,
  'RARA',
  false,
  6,
  true,
  'ACTIVE',
  23,
  '/banners/crimson_moon.webp',
  '{"background":"linear-gradient(135deg, #2b0b0e 0%, #4a1017 50%, #170507 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_aurora_borealis',
  'Aurora Boreal',
  'Véus verde-esmeralda e turquesa dançando sobre montanhas geladas.',
  'PROFILE_BANNER',
  1500,
  'EPICA',
  false,
  8,
  true,
  'ACTIVE',
  24,
  '/banners/aurora.webp',
  '{"background":"linear-gradient(135deg, #052024 0%, #0b3d3b 50%, #071926 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_solar_flare',
  'Alvorecer Cósmico',
  'Explosão dourada astral emergindo de um quasar distante.',
  'PROFILE_BANNER',
  3200,
  'LENDARIA',
  true,
  15,
  true,
  'ACTIVE',
  25,
  '/banners/solar_flare.webp',
  '{"background":"linear-gradient(135deg, #381a04 0%, #78350f 50%, #b45309 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'banner_dimension_rift',
  'Fenda Dimensional',
  'A fronteira entre realidades se rompendo em pura energia etérea.',
  'PROFILE_BANNER',
  5500,
  'MITICA',
  true,
  22,
  true,
  'ACTIVE',
  26,
  '/banners/dimension_rift.webp',
  '{"background":"linear-gradient(135deg, #2e0854 0%, #581c87 50%, #0f172a 100%)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_iniciado',
  'Iniciado da Nox',
  'O primeiro manto concedido àqueles que iniciam sua jornada.',
  'TITLE',
  150,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  27,
  '',
  '{"color":"#b59af5"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_star_hunter',
  'Caçador de Estrelas',
  'Título honroso para os que vasculham os confins do catálogo.',
  'TITLE',
  250,
  'COMUM',
  false,
  2,
  true,
  'ACTIVE',
  28,
  '',
  '{"color":"#38bdf8"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_devorador_obras',
  'Devorador de Capítulos',
  'Para leitores cujo apetite por novas páginas nunca cessa.',
  'TITLE',
  450,
  'INCOMUM',
  false,
  3,
  true,
  'ACTIVE',
  29,
  '',
  '{"color":"#34d399"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_shadow_walker',
  'Andarilho das Sombras',
  'Silencioso e onipresente em todas as leituras noturnas.',
  'TITLE',
  500,
  'INCOMUM',
  false,
  4,
  true,
  'ACTIVE',
  30,
  '',
  '{"color":"#a78bfa"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_mestre_do_abismo',
  'Mestre do Abismo',
  'Conquistou as profundezas dos melhores títulos da plataforma.',
  'TITLE',
  900,
  'RARA',
  false,
  6,
  true,
  'ACTIVE',
  31,
  '',
  '{"color":"#60a5fa"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_vigilante_da_meia_noite',
  'Vigilante da Meia-Noite',
  'Seus olhos se abrem quando todos já adormeceram.',
  'TITLE',
  1100,
  'RARA',
  false,
  8,
  true,
  'ACTIVE',
  32,
  '',
  '{"color":"#c084fc"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_arcanista_celeste',
  'Arcanista Celeste',
  'Domínio total das histórias épicas e fantásticas.',
  'TITLE',
  1800,
  'EPICA',
  false,
  12,
  true,
  'ACTIVE',
  33,
  '',
  '{"color":"#f43f5e"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_abyssal_sovereign',
  'Soberano Abissal',
  'O topo indiscutível da cadeia cósmica.',
  'TITLE',
  3200,
  'LENDARIA',
  false,
  18,
  true,
  'ACTIVE',
  34,
  '',
  '{"color":"#f59e0b"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'title_entidade_infinita',
  'Entidade do Vazio Infinito',
  'Mais do que um leitor. Uma presença atemporal reverenciada em todo o universo Nox.',
  'TITLE',
  6000,
  'MITICA',
  true,
  25,
  true,
  'ACTIVE',
  35,
  '',
  '{"color":"#ffffff","textShadow":"0 0 10px #c084fc, 0 0 20px #38bdf8"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_neon_cyan',
  'Ciano Neon',
  'Destaca seu nome de usuário em azul elétrico vibrante.',
  'NAME_COLOR',
  250,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  36,
  '',
  '{"color":"#38bdf8"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_emerald_glow',
  'Esmeralda Mística',
  'Brilho vivo da floresta dos espíritos.',
  'NAME_COLOR',
  250,
  'COMUM',
  false,
  1,
  true,
  'ACTIVE',
  37,
  '',
  '{"color":"#34d399"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_amethyst_violet',
  'Ametista Imperial',
  'Púrpura nobre cintilante para sua assinatura.',
  'NAME_COLOR',
  500,
  'INCOMUM',
  false,
  4,
  true,
  'ACTIVE',
  38,
  '',
  '{"color":"#c084fc"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_infernal_flame',
  'Chama Infernal',
  'Gradiente dinâmico de fogo do âmbar ao rubi.',
  'NAME_COLOR',
  1000,
  'RARA',
  true,
  6,
  true,
  'ACTIVE',
  39,
  '',
  '{"color":"#f87171","gradient":"linear-gradient(90deg, #f87171, #f59e0b)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_astral_prism',
  'Prisma Astral',
  'Gradiente cósmico holográfico do violeta ao turquesa.',
  'NAME_COLOR',
  1800,
  'EPICA',
  true,
  10,
  true,
  'ACTIVE',
  40,
  '',
  '{"color":"#818cf8","gradient":"linear-gradient(90deg, #a78bfa, #38bdf8)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_golden_sovereign',
  'Ouro Real Supremo',
  'O brilho áureo da nobreza imperial com reflexos cintilantes.',
  'NAME_COLOR',
  3200,
  'LENDARIA',
  true,
  16,
  true,
  'ACTIVE',
  41,
  '',
  '{"color":"#fbbf24","gradient":"linear-gradient(90deg, #fef08a, #f59e0b, #d97706)"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;

insert into public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
values(
  'color_singularity_rainbow',
  'Vórtice Cromático',
  'Arco-íris dinâmico animado que muda de tom continuamente.',
  'NAME_COLOR',
  5500,
  'MITICA',
  true,
  22,
  true,
  'ACTIVE',
  42,
  '',
  '{"animation":"rainbow-text 5s linear infinite"}'::jsonb
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  rarity = excluded.rarity,
  is_animated = excluded.is_animated,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  status = excluded.status,
  order_index = excluded.order_index,
  asset_url = excluded.asset_url,
  style_data = excluded.style_data;
