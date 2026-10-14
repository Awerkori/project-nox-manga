-- Keep public catalog search_text in sync with aliases written by the
-- Importer over direct YSQL connections (which may not have the older trigger).
CREATE OR REPLACE FUNCTION public.index_work_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.title, '') || ' ' ||
    array_to_string(COALESCE(NEW.aliases, ARRAY[]::text[]), ' ');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.index_work_search() FROM PUBLIC;

DROP TRIGGER IF EXISTS works_search_text ON public.works;
CREATE TRIGGER works_search_text
  BEFORE INSERT OR UPDATE OF title, aliases ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.index_work_search();

-- Repair only rows where the denormalized public search field is stale.
UPDATE public.works
SET search_text = COALESCE(title, '') || ' ' ||
  array_to_string(COALESCE(aliases, ARRAY[]::text[]), ' ')
WHERE search_text IS DISTINCT FROM
  COALESCE(title, '') || ' ' || array_to_string(COALESCE(aliases, ARRAY[]::text[]), ' ');
