begin;

create function public.member_public_stats(p_user uuid)
returns table(chapters_read bigint, completed_works bigint, favorites bigint)
language sql stable security definer set search_path='' as $$
 select
   (select count(*) from public.reading r join public.chapters c on c.id=r.chapter_id join public.works w on w.id=c.work_id where r.user_id=p_user and r.completed_at is not null and c.published_at is not null and w.published),
   (select count(*) from public.library l join public.works w on w.id=l.work_id where l.user_id=p_user and l.status='COMPLETED' and w.published),
   (select count(*) from public.library l join public.works w on w.id=l.work_id where l.user_id=p_user and l.favorite and w.published)
 where exists(select 1 from public.members where id=p_user)
$$;

revoke all on function public.member_public_stats(uuid) from public;
grant execute on function public.member_public_stats(uuid) to anon, authenticated;

commit;
