CREATE OR REPLACE FUNCTION public.update_work_latest_chapter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.published_at IS NOT NULL THEN
      UPDATE public.works
      SET latest_chapter_published_at = NEW.published_at
      WHERE id = NEW.work_id AND (latest_chapter_published_at IS NULL OR latest_chapter_published_at < NEW.published_at);
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      IF NEW.published_at IS NOT NULL THEN
        -- Only update if it's strictly greater, saving locks on older chapters
        UPDATE public.works
        SET latest_chapter_published_at = NEW.published_at
        WHERE id = NEW.work_id AND (latest_chapter_published_at IS NULL OR latest_chapter_published_at < NEW.published_at);
      ELSE
        -- If unpublished, we MUST recalculate
        UPDATE public.works
        SET latest_chapter_published_at = (
          SELECT MAX(published_at)
          FROM public.chapters
          WHERE work_id = NEW.work_id AND published_at IS NOT NULL
        )
        WHERE id = NEW.work_id;
      END IF;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.published_at IS NOT NULL THEN
      UPDATE public.works
      SET latest_chapter_published_at = (
        SELECT MAX(published_at)
        FROM public.chapters
        WHERE work_id = OLD.work_id AND published_at IS NOT NULL
      )
      WHERE id = OLD.work_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_work_latest_chapter ON public.chapters;
CREATE TRIGGER trg_update_work_latest_chapter
AFTER INSERT OR UPDATE OF published_at OR DELETE
ON public.chapters
FOR EACH ROW
EXECUTE FUNCTION public.update_work_latest_chapter();

