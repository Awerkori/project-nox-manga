begin;
do $$
declare target_role text; target_table text;
begin
  foreach target_role in array array['anon','authenticated'] loop
    foreach target_table in array array['works','chapters'] loop
      if has_column_privilege(target_role, 'public.' || target_table, 'source_id', 'SELECT') then
        raise exception 'Internal source identifiers readable by % on %', target_role, target_table;
      end if;
      if not has_column_privilege(target_role, 'public.' || target_table, 'title', 'SELECT') then
        raise exception 'Public title not readable by % on %', target_role, target_table;
      end if;
    end loop;
  end loop;
end $$;
set local role anon;
do $$
begin
  begin
    perform source_id from public.works;
    raise exception 'Anonymous source column unexpectedly readable';
  exception when insufficient_privilege then null;
  end;
  perform id,title from public.works;
  perform id,title from public.chapters;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform source_id from public.chapters;
    raise exception 'Authenticated source column unexpectedly readable';
  exception when insufficient_privilege then null;
  end;
  perform id,title from public.works;
  perform id,title from public.chapters;
end $$;
reset role;
select 'PASS: internal source identifiers denied to anon/authenticated, public columns remain available' as result;
rollback;
