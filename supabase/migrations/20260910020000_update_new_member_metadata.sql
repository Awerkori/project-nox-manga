-- ==============================================================================
-- Project Nox Manga — Migration 20260910020000
-- Update new_member trigger to accept chosen username & display_name from metadata
-- ==============================================================================

begin;

create or replace function public.new_member() returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_raw_username text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_raw_display text := trim(coalesce(new.raw_user_meta_data->>'display_name', ''));
  v_username text;
  v_display text;
  v_onboarded boolean := false;
begin
  if v_raw_username ~ '^[a-z0-9_]{3,30}$' and not exists (select 1 from public.members where lower(username) = v_raw_username) then
    v_username := v_raw_username;
    v_onboarded := true;
  else
    v_username := 'nox_' || substr(replace(new.id::text,'-',''), 1, 24);
    v_onboarded := false;
  end if;

  if length(v_raw_display) between 1 and 60 then
    v_display := v_raw_display;
  else
    v_display := coalesce(nullif(v_raw_username, ''), 'Leitor Nox');
  end if;

  insert into public.members(id, username, display_name, is_onboarded)
  values(new.id, v_username, v_display, v_onboarded)
  on conflict (id) do update set
    username = case when public.members.username like 'nox_%' and v_username not like 'nox_%' then v_username else public.members.username end,
    display_name = case when public.members.display_name = 'Leitor Nox' and v_display <> 'Leitor Nox' then v_display else public.members.display_name end,
    is_onboarded = case when v_onboarded then true else public.members.is_onboarded end;

  insert into public.access_roles(user_id) values(new.id) on conflict do nothing;
  return new;
end $$;

commit;
