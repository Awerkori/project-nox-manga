-- ============================================================
-- Migration: Auth SignUp Metadata & new_member() trigger update
-- ============================================================

create or replace function public.new_member() returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_username text;
  v_display_name text;
begin
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_display_name := trim(coalesce(new.raw_user_meta_data->>'display_name', ''));

  -- Validate username format (3 to 30 lowercase alphanumeric/underscore) and collision
  if v_username = '' or not (v_username ~ '^[a-z0-9_]{3,30}$') or exists(select 1 from public.members where lower(username) = v_username) then
    v_username := 'nox_' || substr(replace(new.id::text, '-', ''), 1, 24);
  end if;

  if v_display_name = '' then
    v_display_name := coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''), 'Leitor Nox');
  end if;

  insert into public.members(id, username, display_name)
  values(new.id, v_username, v_display_name)
  on conflict (id) do update set
    username = case when public.members.username like 'nox_%' then excluded.username else public.members.username end,
    display_name = coalesce(nullif(excluded.display_name, ''), public.members.display_name);

  insert into public.access_roles(user_id)
  values(new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;
