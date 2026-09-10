-- ==============================================================================
-- Project Nox Manga — Migration 20260910010000
-- 1. Scans & Translation Groups (Partner scans, attribution, RBAC)
-- 2. Views & Analytics (Chapter read tracking, anti-inflation dedupe, totals)
-- 3. Profile & Media (GIF-ready banners, cosmetics, equipped slots)
-- 4. Social & Community (Follows, blocks, comment mentions)
-- 5. Achievements Engine (~50 data-driven achievements & member progress)
-- 6. Nox Shop & Unified XP Economy (Atomic XP purchase, Discord-style frames)
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. ACCESS ROLES & SCANS RBAC
-- ------------------------------------------------------------------------------
alter table public.access_roles drop constraint if exists access_roles_role_check;
alter table public.access_roles add constraint access_roles_role_check
  check (role in ('USER', 'SCAN_PARTNER', 'EDITOR', 'ADMIN'));

-- Table: public.scans
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 2 and 100),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check(length(description) <= 2000),
  logo_id uuid references public.media(id) on delete set null,
  banner_id uuid references public.media(id) on delete set null,
  website text not null default '',
  discord text not null default '',
  fluxer text not null default '',
  is_official boolean not null default false,
  status text not null default 'ACTIVE' check(status in ('ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: public.scan_members
create table if not exists public.scan_members (
  scan_id uuid not null references public.scans(id) on delete cascade,
  user_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'MEMBER' check(role in ('OWNER', 'ADMIN', 'UPLOADER', 'MEMBER')),
  created_at timestamptz not null default now(),
  primary key(scan_id, user_id)
);

-- Table: public.work_scans
create table if not exists public.work_scans (
  work_id uuid not null references public.works(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(work_id, scan_id)
);

-- Table: public.chapter_scans
create table if not exists public.chapter_scans (
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(chapter_id, scan_id)
);

-- Indices
create index if not exists idx_scans_slug on public.scans(slug);
create index if not exists idx_scans_status on public.scans(status);
create index if not exists idx_scan_members_user on public.scan_members(user_id);
create index if not exists idx_work_scans_scan on public.work_scans(scan_id);
create index if not exists idx_chapter_scans_scan on public.chapter_scans(scan_id);

-- RLS for Scans
alter table public.scans enable row level security;
alter table public.scan_members enable row level security;
alter table public.work_scans enable row level security;
alter table public.chapter_scans enable row level security;

drop policy if exists scans_select on public.scans;
create policy scans_select on public.scans for select to anon, authenticated
  using (status = 'ACTIVE' or (auth.uid() is not null and exists (
    select 1 from public.scan_members sm where sm.scan_id = id and sm.user_id = auth.uid()
  )) or public.is_editor());

drop policy if exists scans_editor_all on public.scans;
create policy scans_editor_all on public.scans for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

drop policy if exists scan_members_select on public.scan_members;
create policy scan_members_select on public.scan_members for select to anon, authenticated
  using (true);

drop policy if exists scan_members_manage on public.scan_members;
create policy scan_members_manage on public.scan_members for all to authenticated
  using (
    public.is_editor() or exists (
      select 1 from public.scan_members sm
      where sm.scan_id = scan_members.scan_id and sm.user_id = auth.uid() and sm.role in ('OWNER', 'ADMIN')
    )
  );

drop policy if exists work_scans_select on public.work_scans;
create policy work_scans_select on public.work_scans for select to anon, authenticated
  using (true);

drop policy if exists work_scans_manage on public.work_scans;
create policy work_scans_manage on public.work_scans for all to authenticated
  using (
    public.is_editor() or exists (
      select 1 from public.scan_members sm
      where sm.scan_id = work_scans.scan_id and sm.user_id = auth.uid() and sm.role in ('OWNER', 'ADMIN', 'UPLOADER')
    )
  );

drop policy if exists chapter_scans_select on public.chapter_scans;
create policy chapter_scans_select on public.chapter_scans for select to anon, authenticated
  using (true);

drop policy if exists chapter_scans_manage on public.chapter_scans;
create policy chapter_scans_manage on public.chapter_scans for all to authenticated
  using (
    public.is_editor() or exists (
      select 1 from public.scan_members sm
      where sm.scan_id = chapter_scans.scan_id and sm.user_id = auth.uid() and sm.role in ('OWNER', 'ADMIN', 'UPLOADER')
    )
  );

grant select on public.scans to anon, authenticated;
grant select on public.scan_members to anon, authenticated;
grant select on public.work_scans to anon, authenticated;
grant select on public.chapter_scans to anon, authenticated;

-- Seed Official Scan: Project Nox
insert into public.scans (name, slug, description, is_official, status)
values ('Project Nox', 'project-nox', 'Scan oficial e núcleo editorial do Project Nox.', true, 'ACTIVE')
on conflict (slug) do update set is_official = true, status = 'ACTIVE';

-- Associate existing works and chapters to Project Nox scan if not already associated
insert into public.work_scans (work_id, scan_id, is_primary)
select w.id, s.id, true
from public.works w
cross join (select id from public.scans where slug = 'project-nox' limit 1) s
on conflict do nothing;

insert into public.chapter_scans (chapter_id, scan_id)
select c.id, s.id
from public.chapters c
cross join (select id from public.scans where slug = 'project-nox' limit 1) s
on conflict do nothing;

-- ------------------------------------------------------------------------------
-- 2. VIEWS & ANALYTICS ARCHITECTURE
-- ------------------------------------------------------------------------------
alter table public.chapters add column if not exists views_total bigint not null default 0 check (views_total >= 0);
alter table public.works add column if not exists views_total bigint not null default 0 check (views_total >= 0);

create table if not exists public.chapter_views (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid references public.members(id) on delete set null,
  anonymous_hash text,
  origin text not null default 'WEB' check(origin in ('WEB', 'MIHON')),
  viewed_at timestamptz not null default now()
);

create index if not exists idx_chapter_views_dedupe_user
  on public.chapter_views(chapter_id, user_id, viewed_at desc)
  where user_id is not null;

create index if not exists idx_chapter_views_dedupe_anon
  on public.chapter_views(chapter_id, anonymous_hash, viewed_at desc)
  where anonymous_hash is not null;

create index if not exists idx_chapter_views_work_views
  on public.chapter_views(work_id, viewed_at desc);

alter table public.chapter_views enable row level security;
drop policy if exists chapter_views_select on public.chapter_views;
create policy chapter_views_select on public.chapter_views for select to anon, authenticated
  using (true);

grant select on public.chapter_views to anon, authenticated;
grant select (views_total) on public.chapters to anon, authenticated;
grant select (views_total) on public.works to anon, authenticated;

-- Backfill initial views from existing reading table
update public.chapters c
set views_total = coalesce((
  select count(*) from public.reading r where r.chapter_id = c.id
), 0)
where views_total = 0;

update public.works w
set views_total = coalesce((
  select sum(c.views_total) from public.chapters c where c.work_id = w.id
), 0)
where views_total = 0;

-- Function: record_chapter_view (Anti-inflation 30-min window)
create or replace function public.record_chapter_view(
  p_chapter_id uuid,
  p_user_id uuid default null,
  p_anon_hash text default null,
  p_origin text default 'WEB'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_work_id uuid;
  v_recent boolean := false;
  v_new_chapter_views bigint;
  v_new_work_views bigint;
begin
  select work_id into v_work_id from public.chapters where id = p_chapter_id;
  if v_work_id is null then
    return jsonb_build_object('counted', false, 'reason', 'chapter_not_found');
  end if;

  if p_user_id is not null then
    select exists(
      select 1 from public.chapter_views
      where chapter_id = p_chapter_id and user_id = p_user_id
        and viewed_at > now() - interval '30 minutes'
    ) into v_recent;
  elsif p_anon_hash is not null then
    select exists(
      select 1 from public.chapter_views
      where chapter_id = p_chapter_id and anonymous_hash = p_anon_hash
        and viewed_at > now() - interval '30 minutes'
    ) into v_recent;
  end if;

  if not v_recent then
    insert into public.chapter_views (chapter_id, work_id, user_id, anonymous_hash, origin)
    values (p_chapter_id, v_work_id, p_user_id, p_anon_hash, coalesce(p_origin, 'WEB'));

    update public.chapters
    set views_total = views_total + 1
    where id = p_chapter_id
    returning views_total into v_new_chapter_views;

    update public.works
    set views_total = views_total + 1
    where id = v_work_id
    returning views_total into v_new_work_views;

    return jsonb_build_object(
      'counted', true,
      'chapter_views', v_new_chapter_views,
      'work_views', v_new_work_views
    );
  end if;

  return jsonb_build_object('counted', false, 'reason', 'deduplicated');
end;
$$;

grant execute on function public.record_chapter_view(uuid, uuid, text, text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. MEMBERS PROFILE CUSTOMIZATIONS & GIF SUPPORT
-- ------------------------------------------------------------------------------
alter table public.members
  add column if not exists banner_id uuid references public.media(id) on delete set null,
  add column if not exists banner_position text not null default 'center',
  add column if not exists avatar_frame_id text default null,
  add column if not exists name_color text default null,
  add column if not exists equipped_medal_id text default null,
  add column if not exists equipped_comment_banner_id text default null,
  add column if not exists is_onboarded boolean not null default true;

grant select (banner_id, banner_position, avatar_frame_id, name_color, equipped_medal_id, equipped_comment_banner_id, is_onboarded) on public.members to anon, authenticated;
grant update (banner_id, banner_position, avatar_frame_id, name_color, equipped_medal_id, equipped_comment_banner_id, is_onboarded) on public.members to authenticated;

-- ------------------------------------------------------------------------------
-- 4. SOCIAL & COMMUNITY (FOLLOWS, BLOCKS, MENTIONS)
-- ------------------------------------------------------------------------------
create table if not exists public.user_follows (
  follower_id uuid not null references public.members(id) on delete cascade,
  following_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, following_id),
  constraint check_cannot_follow_self check (follower_id <> following_id)
);

create table if not exists public.user_blocks (
  user_id uuid not null references public.members(id) on delete cascade,
  blocked_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, blocked_id),
  constraint check_cannot_block_self check (user_id <> blocked_id)
);

create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(comment_id, mentioned_user_id)
);

create index if not exists idx_user_follows_following on public.user_follows(following_id);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);
create index if not exists idx_comment_mentions_user on public.comment_mentions(mentioned_user_id);

alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.comment_mentions enable row level security;

drop policy if exists user_follows_select on public.user_follows;
create policy user_follows_select on public.user_follows for select to anon, authenticated
  using (true);

drop policy if exists user_follows_manage on public.user_follows;
create policy user_follows_manage on public.user_follows for all to authenticated
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select on public.user_blocks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_blocks_manage on public.user_blocks;
create policy user_blocks_manage on public.user_blocks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comment_mentions_select on public.comment_mentions;
create policy comment_mentions_select on public.comment_mentions for select to anon, authenticated
  using (true);

grant select on public.user_follows to anon, authenticated;
grant all on public.user_follows to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select on public.comment_mentions to anon, authenticated;
grant insert on public.comment_mentions to authenticated;

-- Function: follow_user / unfollow_user
create or replace function public.toggle_follow_user(p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  v_is_following boolean;
  v_followers_count integer;
  v_actor_name text;
begin
  if uid is null then
    raise exception 'Entre para seguir usuários' using errcode='42501';
  end if;
  if uid = p_target_user_id then
    raise exception 'Você não pode seguir a si mesmo' using errcode='22023';
  end if;

  if exists (select 1 from public.user_follows where follower_id = uid and following_id = p_target_user_id) then
    delete from public.user_follows where follower_id = uid and following_id = p_target_user_id;
    v_is_following := false;
  else
    insert into public.user_follows (follower_id, following_id) values (uid, p_target_user_id);
    v_is_following := true;

    select display_name into v_actor_name from public.members where id = uid;
    insert into public.notifications (user_id, kind, body, href, dedupe_key)
    values (
      p_target_user_id,
      'follow',
      coalesce(v_actor_name, 'Um usuário') || ' começou a seguir você.',
      '/u/' || (select username from public.members where id = uid),
      'follow:' || uid || ':' || p_target_user_id
    ) on conflict do nothing;
  end if;

  select count(*) into v_followers_count from public.user_follows where following_id = p_target_user_id;

  return jsonb_build_object(
    'following', v_is_following,
    'followers_count', v_followers_count
  );
end;
$$;

grant execute on function public.toggle_follow_user(uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. ACHIEVEMENTS ENGINE (~50 DATA-DRIVEN ACHIEVEMENTS)
-- ------------------------------------------------------------------------------
create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  category text not null check(category in ('READING', 'DIVERSITY', 'COMPLETIONS', 'COLLECTION', 'COMMUNITY', 'SECRET')),
  icon text not null default 'Sparkles',
  badge_color text not null default '#8b5cf6',
  xp_reward integer not null default 0 check(xp_reward >= 0),
  condition_type text not null,
  condition_value integer not null default 1,
  is_secret boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.member_achievements (
  user_id uuid not null references public.members(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key(user_id, achievement_id)
);

create index if not exists idx_achievements_cat on public.achievements(category, order_index);
create index if not exists idx_member_achievements_user on public.member_achievements(user_id, unlocked_at desc);

alter table public.achievements enable row level security;
alter table public.member_achievements enable row level security;

drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to anon, authenticated
  using (true);

drop policy if exists member_achievements_select on public.member_achievements;
create policy member_achievements_select on public.member_achievements for select to anon, authenticated
  using (true);

grant select on public.achievements to anon, authenticated;
grant select on public.member_achievements to anon, authenticated;

-- Seed Achievements
insert into public.achievements (id, title, description, category, icon, badge_color, xp_reward, condition_type, condition_value, is_secret, order_index)
values
  -- Leitura
  ('first_page', 'Primeiro Passo', 'Leu o seu primeiríssimo capítulo no Project Nox.', 'READING', 'BookOpen', '#38bdf8', 50, 'chapters_read', 1, false, 1),
  ('reader_5', 'Adepto das Páginas', 'Leu 5 capítulos de qualquer obra.', 'READING', 'BookOpen', '#38bdf8', 100, 'chapters_read', 5, false, 2),
  ('reader_25', 'Leitor Voraz', 'Leu 25 capítulos.', 'READING', 'BookOpen', '#60a5fa', 250, 'chapters_read', 25, false, 3),
  ('reader_50', 'Maratonista Noturno', 'Leu 50 capítulos.', 'READING', 'BookOpen', '#818cf8', 500, 'chapters_read', 50, false, 4),
  ('reader_100', 'Centurião do Conhecimento', 'Leu 100 capítulos.', 'READING', 'BookOpen', '#a78bfa', 1000, 'chapters_read', 100, false, 5),
  ('reader_250', 'Mestre dos Volumes', 'Leu 250 capítulos.', 'READING', 'BookOpen', '#c084fc', 2000, 'chapters_read', 250, false, 6),
  ('reader_500', 'Lorde do Crepúsculo', 'Leu 500 capítulos pelo reino.', 'READING', 'BookOpen', '#e879f9', 3500, 'chapters_read', 500, false, 7),
  ('reader_1000', 'Erudito Imortal', 'Alcançou a incrível marca de 1.000 capítulos lidos.', 'READING', 'Sparkles', '#f43f5e', 7000, 'chapters_read', 1000, false, 8),
  ('reader_2500', 'Lenda Viva da Biblioteca', 'Leu 2.500 capítulos.', 'READING', 'Crown', '#fbbf24', 15000, 'chapters_read', 2500, false, 9),

  -- Diversidade de Conteúdo
  ('kind_manhwa', 'Viajante de Seul', 'Leu pelo menos 10 capítulos de Manhwas.', 'DIVERSITY', 'Compass', '#34d399', 150, 'manhwa_read', 10, false, 10),
  ('kind_manga', 'Tradição do Sol Nascente', 'Leu pelo menos 10 capítulos de Mangás.', 'DIVERSITY', 'Compass', '#10b981', 150, 'manga_read', 10, false, 11),
  ('kind_manhua', 'Caminho do Cultivador', 'Leu pelo menos 10 capítulos de Manhuas.', 'DIVERSITY', 'Compass', '#059669', 150, 'manhua_read', 10, false, 12),
  ('kind_webtoon', 'Rolagem Infinita', 'Leu pelo menos 10 capítulos em formato Webtoon.', 'DIVERSITY', 'Compass', '#047857', 150, 'webtoon_read', 10, false, 13),
  ('genre_isekai', 'Outro Mundo', 'Leu 5 obras com a tag Isekai.', 'DIVERSITY', 'Globe', '#06b6d4', 200, 'genre_isekai', 5, false, 14),
  ('genre_murim', 'Pugilista de Jianghu', 'Leu 5 obras de Artes Marciais / Murim.', 'DIVERSITY', 'Flame', '#f97316', 200, 'genre_murim', 5, false, 15),
  ('genre_romance', 'Coração Apaixonado', 'Leu 5 obras do gênero Romance.', 'DIVERSITY', 'Heart', '#ec4899', 200, 'genre_romance', 5, false, 16),
  ('genre_fantasy', 'Explorador Arcano', 'Leu 5 obras de Fantasia épica.', 'DIVERSITY', 'Wand2', '#8b5cf6', 200, 'genre_fantasy', 5, false, 17),
  ('genre_action', 'Adrenalina Pura', 'Leu 5 obras de Ação intensa.', 'DIVERSITY', 'Zap', '#eab308', 200, 'genre_action', 5, false, 18),
  ('genre_drama', 'Lágrimas e Sombras', 'Leu 5 obras dramáticas profundas.', 'DIVERSITY', 'Eye', '#64748b', 200, 'genre_drama', 5, false, 19),
  ('genre_adult_seeker', 'Maturidade Absoluta', 'Leu 10 capítulos de obras adultas (+18).', 'DIVERSITY', 'ShieldAlert', '#ef4444', 250, 'adult_read', 10, false, 20),

  -- Conclusões de Obras
  ('complete_1', 'Ponto Final', 'Concluiu a leitura de 1 obra completa.', 'COMPLETIONS', 'CheckCircle', '#22c55e', 200, 'works_completed', 1, false, 21),
  ('complete_3', 'Trilogia Encerrada', 'Concluiu 3 obras completas.', 'COMPLETIONS', 'CheckCircle', '#16a34a', 500, 'works_completed', 3, false, 22),
  ('complete_5', 'Colecionador de Epílogos', 'Concluiu 5 obras completas.', 'COMPLETIONS', 'CheckCircle', '#15803d', 1000, 'works_completed', 5, false, 23),
  ('complete_10', 'Guardião dos Finais', 'Concluiu 10 obras completas.', 'COMPLETIONS', 'Trophy', '#eab308', 2500, 'works_completed', 10, false, 24),
  ('complete_25', 'Arquivista de Destinos', 'Concluiu 25 obras completas.', 'COMPLETIONS', 'Crown', '#f59e0b', 6000, 'works_completed', 25, false, 25),

  -- Coleção e Biblioteca
  ('fav_1', 'Primeiro Amor', 'Marcou sua primeira obra favorita.', 'COLLECTION', 'Bookmark', '#f43f5e', 50, 'favorites_count', 1, false, 26),
  ('fav_10', 'Prateleira Especial', 'Marcou 10 obras favoritas na biblioteca.', 'COLLECTION', 'Bookmark', '#e11d48', 150, 'favorites_count', 10, false, 27),
  ('fav_25', 'Acervo Pessoal', 'Marcou 25 obras favoritas.', 'COLLECTION', 'Bookmark', '#be123c', 350, 'favorites_count', 25, false, 28),
  ('lib_5', 'Biblioteca Inaugurada', 'Adicionou 5 obras à sua biblioteca.', 'COLLECTION', 'FolderHeart', '#8b5cf6', 100, 'library_count', 5, false, 29),
  ('lib_20', 'Estante Crescente', 'Adicionou 20 obras à sua biblioteca.', 'COLLECTION', 'FolderHeart', '#7c3aed', 300, 'library_count', 20, false, 30),
  ('lib_50', 'Grande Santuário', 'Adicionou 50 obras à sua biblioteca.', 'COLLECTION', 'FolderHeart', '#6d28d9', 750, 'library_count', 50, false, 31),

  -- Comunidade e Social
  ('first_comment', 'Primeira Palavra', 'Publicou seu primeiro comentário.', 'COMMUNITY', 'MessageSquare', '#38bdf8', 50, 'comments_count', 1, false, 32),
  ('comment_10', 'Crítico Emergente', 'Publicou 10 comentários construtivos.', 'COMMUNITY', 'MessageSquare', '#0284c7', 200, 'comments_count', 10, false, 33),
  ('comment_50', 'Voz da Comunidade', 'Publicou 50 comentários pelo site.', 'COMMUNITY', 'MessageSquare', '#0369a1', 600, 'comments_count', 50, false, 34),
  ('social_first_follow', 'Primeiro Vínculo', 'Seguiu outro leitor ou criador.', 'COMMUNITY', 'UserPlus', '#a855f7', 100, 'following_count', 1, false, 35),
  ('social_followers_5', 'Pequeno Círculo', 'Alcançou 5 seguidores em seu perfil.', 'COMMUNITY', 'Users', '#9333ea', 300, 'followers_count', 5, false, 36),
  ('social_followers_20', 'Influenciador Astral', 'Alcançou 20 seguidores em seu perfil.', 'COMMUNITY', 'Users', '#7e22ce', 1000, 'followers_count', 20, false, 37),
  ('reaction_10', 'Expressão Sincera', 'Reagiu a 10 capítulos com emojis.', 'COMMUNITY', 'Smile', '#facc15', 100, 'reactions_count', 10, false, 38),
  ('reaction_50', 'Alma Vibrante', 'Reagiu a 50 capítulos.', 'COMMUNITY', 'Smile', '#eab308', 350, 'reactions_count', 50, false, 39),

  -- Segredos e Marcos Especiais
  ('night_owl', 'Coruja da Madrugada', 'Leu um capítulo entre as 03:00 e 05:00 da manhã.', 'SECRET', 'Moon', '#6366f1', 250, 'night_owl', 1, true, 40),
  ('marathon_day', 'Dia Sem Fim', 'Leu mais de 20 capítulos em um único dia.', 'SECRET', 'Zap', '#ec4899', 500, 'daily_marathon', 20, true, 41),
  ('speed_demon', 'Devorador Relâmpago', 'Leu 10 capítulos de uma mesma obra consecutivamente.', 'SECRET', 'Flame', '#f97316', 400, 'streak_same_work', 10, true, 42),
  ('profile_perfectionist', 'Identidade Forjada', 'Personalizou seu avatar, banner e biografia.', 'SECRET', 'Sparkles', '#10b981', 300, 'profile_completed', 1, true, 43),
  ('supporter_scan', 'Apoiador das Scans', 'Visitou e conheceu uma página oficial de Scan parceira.', 'SECRET', 'Users', '#8b5cf6', 150, 'scans_visited', 1, false, 44),
  ('offline_pioneer', 'Mundo Desconectado', 'Armazenou um capítulo para leitura offline.', 'SECRET', 'Download', '#06b6d4', 200, 'offline_download', 1, false, 45)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  icon = excluded.icon,
  badge_color = excluded.badge_color,
  xp_reward = excluded.xp_reward,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_secret = excluded.is_secret,
  order_index = excluded.order_index;

-- ------------------------------------------------------------------------------
-- 6. NOX SHOP & UNIFIED XP ECONOMY
-- ------------------------------------------------------------------------------
create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  description text not null default '',
  kind text not null check(kind in ('AVATAR_FRAME', 'PROFILE_BANNER', 'NAME_COLOR', 'TITLE', 'BADGE', 'COMMENT_BANNER')),
  price_xp integer not null check(price_xp >= 0),
  is_animated boolean not null default false,
  asset_url text not null default '',
  style_data jsonb not null default '{}',
  min_level integer not null default 1 check(min_level >= 1),
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.member_inventory (
  user_id uuid not null references public.members(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key(user_id, item_id)
);

create index if not exists idx_shop_items_kind on public.shop_items(kind, order_index);
create index if not exists idx_member_inventory_user on public.member_inventory(user_id);

alter table public.shop_items enable row level security;
alter table public.member_inventory enable row level security;

drop policy if exists shop_items_select on public.shop_items;
create policy shop_items_select on public.shop_items for select to anon, authenticated
  using (is_active = true or public.is_editor());

drop policy if exists member_inventory_select on public.member_inventory;
create policy member_inventory_select on public.member_inventory for select to anon, authenticated
  using (true);

grant select on public.shop_items to anon, authenticated;
grant select on public.member_inventory to anon, authenticated;

-- Seed Nox Shop Catalog (Discord-style avatar frames, banners, colors, titles)
insert into public.shop_items (id, name, description, kind, price_xp, is_animated, asset_url, style_data, min_level, is_active, order_index)
values
  -- Molduras de Avatar (Discord Style)
  ('frame_aurora_mystic', 'Aura Mística', 'Moldura com pulso espectral violeta e ciano.', 'AVATAR_FRAME', 500, true, '', '{"border": "2px solid #8b5cf6", "boxShadow": "0 0 16px rgba(139, 92, 246, 0.7)", "animation": "pulse-glow 3s infinite"}', 2, true, 1),
  ('frame_cyber_neon', 'Circuito Cibernético', 'Estrutura geométrica com cantos iluminados em neon turquesa.', 'AVATAR_FRAME', 800, false, '', '{"border": "2px solid #06b6d4", "boxShadow": "0 0 12px rgba(6, 182, 212, 0.6)", "borderRadius": "16px"}', 3, true, 2),
  ('frame_void_nebula', 'Vórtice da Nebulosa', 'Moldura animada giratória inspirada no horizonte cósmico da Nox.', 'AVATAR_FRAME', 1500, true, '', '{"border": "3px solid transparent", "background": "linear-gradient(#090a0f, #090a0f) padding-box, linear-gradient(135deg, #a855f7, #3b82f6, #ec4899) border-box", "boxShadow": "0 0 20px rgba(168, 85, 247, 0.8)"}', 5, true, 3),
  ('frame_crimson_eclipse', 'Eclipse Carmesim', 'Fogo lunar escarlate para os leitores mais audazes.', 'AVATAR_FRAME', 2500, true, '', '{"border": "3px solid #ef4444", "boxShadow": "0 0 22px rgba(239, 68, 68, 0.85)", "animation": "crimson-pulse 2s infinite"}', 8, true, 4),
  ('frame_celestial_gold', 'Coroa Celestial', 'Ouro sagrado radiante com brilhos estelares.', 'AVATAR_FRAME', 5000, true, '', '{"border": "3px solid #f59e0b", "boxShadow": "0 0 25px rgba(245, 158, 11, 0.9)", "animation": "gold-shine 4s infinite"}', 12, true, 5),

  -- Cores de Nome
  ('color_neon_cyan', 'Ciano Neon', 'Destaca seu nome de usuário em azul elétrico vibrante.', 'NAME_COLOR', 300, false, '', '{"color": "#38bdf8", "textShadow": "0 0 8px rgba(56, 189, 248, 0.5)"}', 2, true, 6),
  ('color_amethyst_violet', 'Ametista Imperial', 'Púrpura nobre cintilante para sua assinatura.', 'NAME_COLOR', 600, false, '', '{"color": "#c084fc", "textShadow": "0 0 8px rgba(192, 132, 252, 0.5)"}', 4, true, 7),
  ('color_infernal_flame', 'Chama Infernal', 'Gradiente dinâmico de fogo do âmbar ao rubi.', 'NAME_COLOR', 1200, true, '', '{"backgroundImage": "linear-gradient(90deg, #f59e0b, #ef4444)", "WebkitBackgroundClip": "text", "WebkitTextFillColor": "transparent"}', 6, true, 8),
  ('color_astral_prism', 'Prisma Astral', 'Gradiente cósmico holográfico do violeta ao turquesa.', 'NAME_COLOR', 2000, true, '', '{"backgroundImage": "linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)", "WebkitBackgroundClip": "text", "WebkitTextFillColor": "transparent"}', 10, true, 9),

  -- Títulos Cosméticos Especiais
  ('title_star_hunter', 'Caçador de Estrelas', 'Título honroso para os que vasculham os confins do catálogo.', 'TITLE', 400, false, '', '{}', 2, true, 10),
  ('title_shadow_walker', 'Andarilho das Sombras', 'Silencioso e onipresente em todas as leituras.', 'TITLE', 800, false, '', '{}', 4, true, 11),
  ('title_abyssal_sovereign', 'Soberano Abissal', 'O topo indiscutível da cadeia cósmica.', 'TITLE', 3000, false, '', '{}', 10, true, 12),

  -- Banners de Perfil Estilizados
  ('banner_cosmic_abyss', 'Abismo Estelar', 'Banner abstrato de estrelas profundas e nebulosas.', 'PROFILE_BANNER', 1000, false, '/banners/cosmic_abyss.webp', '{"background": "linear-gradient(135deg, #090a0f 0%, #1e1b4b 50%, #030712 100%)"}', 3, true, 13),
  ('banner_cyber_grid', 'Matrix Noturna', 'Linhas de fuga neon violeta sob céu escuro.', 'PROFILE_BANNER', 1800, false, '/banners/cyber_grid.webp', '{"background": "radial-gradient(ellipse at bottom, #2e1065 0%, #090a0f 100%)"}', 5, true, 14),
  ('banner_solar_flare', 'Alvorecer Cósmico', 'Explosão dourada de luz astral emergindo do horizonte.', 'PROFILE_BANNER', 3500, true, '/banners/solar_flare.webp', '{"background": "linear-gradient(135deg, #451a03 0%, #78350f 40%, #090a0f 100%)"}', 8, true, 15)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  kind = excluded.kind,
  price_xp = excluded.price_xp,
  is_animated = excluded.is_animated,
  style_data = excluded.style_data,
  min_level = excluded.min_level,
  is_active = excluded.is_active,
  order_index = excluded.order_index;

-- Function: Atomic Shop Purchase (Using REAL XP, deducting from members.xp)
create or replace function public.purchase_shop_item(p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  v_item record;
  v_current_xp integer;
  v_user_level integer;
  v_new_xp integer;
begin
  if uid is null then
    raise exception 'Entre em sua conta para adquirir itens' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 100));

  select * into v_item from public.shop_items where id = p_item_id and is_active = true;
  if v_item.id is null then
    raise exception 'Item não encontrado ou indisponível' using errcode='P0002';
  end if;

  if exists(select 1 from public.member_inventory where user_id = uid and item_id = p_item_id) then
    raise exception 'Você já possui este item em seu inventário' using errcode='23505';
  end if;

  select xp into v_current_xp from public.members where id = uid;
  if v_current_xp is null then
    raise exception 'Perfil não encontrado' using errcode='P0002';
  end if;

  v_user_level := floor(sqrt(1 + v_current_xp / 50));
  if v_user_level < v_item.min_level then
    raise exception 'Nível insuficiente. Este item exige Nível %', v_item.min_level using errcode='22023';
  end if;

  if v_current_xp < v_item.price_xp then
    raise exception 'XP insuficiente. Você possui % XP mas o item custa % XP', v_current_xp, v_item.price_xp using errcode='22023';
  end if;

  v_new_xp := v_current_xp - v_item.price_xp;

  insert into public.member_inventory(user_id, item_id) values (uid, p_item_id);

  update public.members
  set xp = v_new_xp
  where id = uid;

  insert into public.notifications(user_id, kind, body, href, dedupe_key)
  values (
    uid,
    'shop',
    'Você adquiriu ' || v_item.name || ' por ' || v_item.price_xp || ' XP!',
    '/me?tab=inventario',
    'shop:' || p_item_id || ':' || extract(epoch from now())::bigint
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'price_paid', v_item.price_xp,
    'remaining_xp', v_new_xp
  );
end;
$$;

grant execute on function public.purchase_shop_item(text) to authenticated;

-- Function: Equip / Unequip Cosmetic Items
create or replace function public.equip_cosmetic_item(p_kind text, p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Entre para equipar itens' using errcode='42501';
  end if;

  if p_item_id is not null and p_item_id <> '' then
    if not exists(select 1 from public.member_inventory where user_id = uid and item_id = p_item_id) then
      raise exception 'Item não adquirido' using errcode='42501';
    end if;
  end if;

  if p_kind = 'AVATAR_FRAME' then
    update public.members set avatar_frame_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'NAME_COLOR' then
    update public.members set name_color = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'TITLE' then
    update public.members set equipped_title_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'BADGE' then
    update public.members set equipped_badge_id = nullif(p_item_id, '') where id = uid;
  elsif p_kind = 'PROFILE_BANNER' then
    update public.members set equipped_comment_banner_id = nullif(p_item_id, '') where id = uid;
  else
    raise exception 'Tipo de cosmético desconhecido: %', p_kind using errcode='22023';
  end if;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'item_id', p_item_id);
end;
$$;

grant execute on function public.equip_cosmetic_item(text, text) to authenticated;

commit;
