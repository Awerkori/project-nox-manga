-- Keep adult classification in one canonical taxonomy term.
-- This migration is deliberately idempotent: it can be reapplied safely when
-- restoring a database or reconciling an interrupted deployment.
begin;

do $$
declare
  v_canonical_id uuid;
  v_legacy_ids uuid[];
begin
  -- Prefer the long-lived system term. If a previous environment only has the
  -- display name, promote that exact row instead of creating a second term.
  select id
    into v_canonical_id
    from public.tags
   where slug = 'adulto-18'
   order by id
   limit 1
   for update;

  if v_canonical_id is null then
    select id
      into v_canonical_id
      from public.tags
     where lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = 'adulto (+18)'
     order by id
     limit 1
     for update;

    if v_canonical_id is not null then
      update public.tags
         set name = 'Adulto (+18)', slug = 'adulto-18', kind = 'GENRE'
       where id = v_canonical_id;
    else
      insert into public.tags(name, slug, kind)
      values ('Adulto (+18)', 'adulto-18', 'GENRE')
      returning id into v_canonical_id;
    end if;
  else
    -- Its stable slug is the contract used by editorial and importer flows.
    update public.tags
       set name = 'Adulto (+18)', kind = 'GENRE'
     where id = v_canonical_id
       and (name is distinct from 'Adulto (+18)' or kind is distinct from 'GENRE');
  end if;

  select array_agg(id)
    into v_legacy_ids
    from public.tags
   where id <> v_canonical_id
     and lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) in (
       'adulto', '+18', '18+', 'adult', 'adulto +18', 'adulto (+18)'
     );

  if coalesce(array_length(v_legacy_ids, 1), 0) > 0 then
    -- If the canonical association already exists, keep its provenance exactly
    -- as-is. Otherwise retain whether any retired association was system made.
    insert into public.work_tags(work_id, tag_id, system_generated)
    select wt.work_id, v_canonical_id, bool_or(wt.system_generated)
      from public.work_tags wt
     where wt.tag_id = any(v_legacy_ids)
     group by wt.work_id
    on conflict (work_id, tag_id) do nothing;

    delete from public.work_tags where tag_id = any(v_legacy_ids);
    delete from public.tags where id = any(v_legacy_ids);
  end if;
end
$$;

-- Enforce the same normalization for every write path, including direct
-- importer writes. The importer also normalizes before lookup; this is the
-- database safety net that prevents an old client from recreating aliases.
create or replace function public.normalize_taxonomy_term()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized_name text;
  v_is_adult_alias boolean;
begin
  new.name := regexp_replace(btrim(coalesce(new.name, '')), '\\s+', ' ', 'g');
  if new.name = '' then
    raise exception 'O nome do termo é obrigatório';
  end if;

  v_normalized_name := lower(new.name);
  v_is_adult_alias := v_normalized_name in (
    'adulto', '+18', '18+', 'adult', 'adulto +18', 'adulto (+18)'
  );

  if v_is_adult_alias then
    new.name := 'Adulto (+18)';
    new.slug := 'adulto-18';
    new.kind := 'GENRE';
  else
    new.slug := lower(btrim(coalesce(new.slug, '')));
  end if;

  if coalesce(new.slug, '') = '' then
    raise exception 'O slug do termo é obrigatório';
  end if;

  if exists (
    select 1
      from public.tags t
     where t.id <> new.id
       and lower(regexp_replace(btrim(t.name), '\\s+', ' ', 'g')) = lower(new.name)
  ) then
    raise exception 'Já existe um gênero ou tag com esse nome';
  end if;

  return new;
end
$$;

drop trigger if exists tags_normalize_before_write on public.tags;
create trigger tags_normalize_before_write
before insert or update of name, slug, kind on public.tags
for each row execute function public.normalize_taxonomy_term();

create unique index if not exists tags_normalized_name_unique
  on public.tags ((lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))));

-- Deletion is intentionally separate from editor_action: taxonomy deletion is
-- an owner-only destructive action, while editors can still create and edit.
create or replace function public.delete_taxonomy_term(
  p_tag_id uuid,
  p_confirm_unassign boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.tags%rowtype;
  v_work_count integer;
  v_removed integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Somente administradores podem excluir gêneros e tags' using errcode = '42501';
  end if;

  select * into v_tag from public.tags where id = p_tag_id for update;
  if not found then
    raise exception 'Gênero ou tag não encontrado';
  end if;

  if v_tag.slug = 'adulto-18' then
    raise exception 'A classificação canônica Adulto (+18) é protegida';
  end if;

  select count(*) into v_work_count from public.work_tags where tag_id = p_tag_id;
  if v_work_count > 0 and not coalesce(p_confirm_unassign, false) then
    raise exception 'Este termo está associado a % obra(s). Confirme a remoção das associações para excluí-lo.', v_work_count;
  end if;

  delete from public.work_tags where tag_id = p_tag_id;
  get diagnostics v_removed = row_count;
  delete from public.tags where id = p_tag_id;

  insert into public.audit_log(actor_id, action, target_id, metadata)
  values (
    auth.uid(),
    'delete_taxonomy_term',
    p_tag_id,
    jsonb_build_object('name', v_tag.name, 'kind', v_tag.kind, 'removed_work_associations', v_removed)
  );

  return jsonb_build_object('ok', true, 'id', p_tag_id, 'removed_work_associations', v_removed);
end
$$;

commit;
