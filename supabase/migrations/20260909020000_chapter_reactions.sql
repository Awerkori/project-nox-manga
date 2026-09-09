-- ==============================================================================
-- Project Nox Manga - Migration 20260909020000: Chapter Reactions System
-- ==============================================================================

create table if not exists public.chapter_reactions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  visitor_id text not null,
  emoji text not null check (emoji in ('heart', 'fire', 'cry', 'shock', 'laugh')),
  created_at timestamptz not null default now(),
  unique (chapter_id, visitor_id, emoji)
);

create index if not exists idx_chapter_reactions_chapter
  on public.chapter_reactions(chapter_id, emoji);

alter table public.chapter_reactions enable row level security;

-- RLS policies
drop policy if exists chapter_reactions_select on public.chapter_reactions;
create policy chapter_reactions_select on public.chapter_reactions
  for select to anon, authenticated using (true);

drop policy if exists chapter_reactions_insert on public.chapter_reactions;
create policy chapter_reactions_insert on public.chapter_reactions
  for insert to anon, authenticated with check (true);

drop policy if exists chapter_reactions_delete on public.chapter_reactions;
create policy chapter_reactions_delete on public.chapter_reactions
  for delete to anon, authenticated using (true);

grant select, insert, delete on public.chapter_reactions to anon, authenticated;

-- RPC helper to toggle reaction
create or replace function public.toggle_chapter_reaction(
  p_chapter_id uuid,
  p_visitor_id text,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_counts jsonb;
begin
  if p_emoji not in ('heart', 'fire', 'cry', 'shock', 'laugh') then
    raise exception 'Emoji de reação inválido';
  end if;

  select exists (
    select 1 from public.chapter_reactions
    where chapter_id = p_chapter_id
      and visitor_id = p_visitor_id
      and emoji = p_emoji
  ) into v_exists;

  if v_exists then
    delete from public.chapter_reactions
    where chapter_id = p_chapter_id
      and visitor_id = p_visitor_id
      and emoji = p_emoji;
  else
    insert into public.chapter_reactions (chapter_id, visitor_id, emoji)
    values (p_chapter_id, p_visitor_id, p_emoji)
    on conflict (chapter_id, visitor_id, emoji) do nothing;
  end if;

  -- Aggregate counts for this chapter
  select jsonb_object_agg(e, coalesce(c.cnt, 0)) into v_counts
  from (
    values ('heart'), ('fire'), ('cry'), ('shock'), ('laugh')
  ) as em(e)
  left join (
    select emoji, count(*)::int as cnt
    from public.chapter_reactions
    where chapter_id = p_chapter_id
    group by emoji
  ) as c on c.emoji = em.e;

  return jsonb_build_object(
    'success', true,
    'reacted', not v_exists,
    'counts', v_counts
  );
end;
$$;

revoke all on function public.toggle_chapter_reaction(uuid, text, text) from public;
grant execute on function public.toggle_chapter_reaction(uuid, text, text) to anon, authenticated;

-- RPC helper to fetch counts & user reactions
create or replace function public.get_chapter_reactions(
  p_chapter_id uuid,
  p_visitor_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb;
  v_user_reactions jsonb;
begin
  select jsonb_object_agg(e, coalesce(c.cnt, 0)) into v_counts
  from (
    values ('heart'), ('fire'), ('cry'), ('shock'), ('laugh')
  ) as em(e)
  left join (
    select emoji, count(*)::int as cnt
    from public.chapter_reactions
    where chapter_id = p_chapter_id
    group by emoji
  ) as c on c.emoji = em.e;

  if p_visitor_id is not null then
    select coalesce(jsonb_agg(emoji), '[]'::jsonb) into v_user_reactions
    from public.chapter_reactions
    where chapter_id = p_chapter_id
      and visitor_id = p_visitor_id;
  else
    v_user_reactions := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'counts', v_counts,
    'userReactions', v_user_reactions
  );
end;
$$;

revoke all on function public.get_chapter_reactions(uuid, text) from public;
grant execute on function public.get_chapter_reactions(uuid, text) to anon, authenticated;
