begin;

-- Internal import identifiers are server-only, including for logged-in readers/editors.
-- Row-level policies still decide which published/draft rows each caller may read.
-- Explicit column grants also prevent future internal columns from becoming public by default.
revoke select on public.works, public.chapters from public, anon, authenticated;
grant select (
  id, slug, title, aliases, synopsis, description, author, artist, kind, status,
  year, age_rating, published, featured, cover_id, updated_at, created_at, search_text
) on public.works to anon, authenticated;
grant select (id, work_id, number, title, published_at, created_at)
  on public.chapters to anon, authenticated;

commit;
