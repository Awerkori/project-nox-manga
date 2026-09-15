-- Allow kind to default to 'generic' if omitted
ALTER TABLE public.notifications ALTER COLUMN kind SET DEFAULT 'generic';

-- Trigger to auto-sync kind and type if either is missing
CREATE OR REPLACE FUNCTION public.trg_notifications_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind IS NULL THEN
    NEW.kind := lower(COALESCE(NEW.type, 'generic'));
  END IF;
  IF NEW.type IS NULL THEN
    NEW.type := upper(COALESCE(NEW.kind, 'SYSTEM'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_before_insert ON public.notifications;
CREATE TRIGGER trg_notifications_before_insert
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notifications_before_insert();
