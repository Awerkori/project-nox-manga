-- Migration: 20260911130000_staff_site_role_migration.sql
-- Description: Establishes STAFF_SITE as the canonical global editorial role (USER, STAFF_SITE, ADMIN)
-- while preserving legacy EDITOR compatibility.

BEGIN;

-- 1. Expand check constraint on public.access_roles
ALTER TABLE public.access_roles DROP CONSTRAINT IF EXISTS access_roles_role_check;
ALTER TABLE public.access_roles ADD CONSTRAINT access_roles_role_check
  CHECK (role IN ('USER', 'SCAN_PARTNER', 'STAFF_SITE', 'EDITOR', 'ADMIN'));

-- 2. Migrate existing EDITOR users safely to canonical STAFF_SITE
UPDATE public.access_roles
SET role = 'STAFF_SITE'
WHERE role = 'EDITOR';

-- 3. Update public.is_editor() helper to accept STAFF_SITE, ADMIN, and legacy EDITOR
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(public.current_role() IN ('ADMIN', 'STAFF_SITE', 'EDITOR'), false)
$$;

-- 4. Update reserve_media to recognize STAFF_SITE
CREATE OR REPLACE FUNCTION public.reserve_media(
  p_id uuid,
  p_user uuid,
  p_provider text,
  p_mime text,
  p_width integer,
  p_height integer,
  p_bytes integer,
  p_sha256 text,
  p_purpose text DEFAULT 'editorial'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(547291046);

  -- Authorization check: allow ADMIN, STAFF_SITE, legacy EDITOR, or specialized media purposes
  IF NOT EXISTS (
    SELECT 1 FROM public.access_roles a
    JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = p_user
      AND NOT a.suspended
      AND u.email_confirmed_at IS NOT NULL
      AND (
        a.role IN ('ADMIN', 'STAFF_SITE', 'EDITOR')
        OR p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner')
        OR (
          p_purpose IN ('scan_logo', 'scan_banner')
          AND EXISTS (
            SELECT 1 FROM public.scan_members sm
            WHERE sm.user_id = p_user
              AND sm.role IN ('OWNER', 'ADMIN', 'UPLOADER')
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Upload não autorizado' USING errcode = '42501';
  END IF;

  -- IN-FLIGHT CONCURRENCY LOCK (Replaces artificial hourly limit)
  -- Allows unlimited uploads, only throttles concurrent spam within a 15-second window
  IF p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner') THEN
    IF (
      SELECT count(*) FROM public.media
      WHERE created_by = p_user
        AND storage_ready = false
        AND created_at > now() - interval '15 seconds'
    ) >= 5 THEN
      RAISE EXCEPTION 'Upload em andamento. Aguarde alguns instantes antes de enviar novamente.';
    END IF;
  END IF;

  -- Clean up stale unready reservations older than 5 minutes for this user
  DELETE FROM public.media
  WHERE created_by = p_user
    AND storage_ready = false
    AND created_at < now() - interval '5 minutes';

  -- Free storage cap ONLY for supabase provider (not applied to telegram)
  IF p_provider = 'supabase' AND (
    SELECT coalesce(sum(bytes), 0) FROM public.media WHERE provider = 'supabase'
  ) + p_bytes > 750000000 THEN
    RAISE EXCEPTION 'A reserva de armazenamento gratuito foi atingida';
  END IF;

  INSERT INTO public.media(
    id, provider, provider_key, mime, width, height, bytes, sha256, created_by, storage_ready, purpose
  ) VALUES (
    p_id, p_provider, p_id::text, p_mime, p_width, p_height, p_bytes, p_sha256, p_user, false, p_purpose
  );
END;
$$;

-- 5. Update media policies for access_class
DROP POLICY IF EXISTS storage_supremo_media_select ON public.media;
CREATE POLICY storage_supremo_media_select ON public.media
  FOR SELECT TO anon, authenticated
  USING (
    access_class = 'PUBLIC'
    OR created_by = auth.uid()
    OR (access_class = 'STAFF_ONLY' AND EXISTS (
      SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role IN ('STAFF_SITE', 'EDITOR', 'ADMIN')
    ))
    OR (access_class = 'ADMIN_ONLY' AND EXISTS (
      SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role = 'ADMIN'
    ))
  );

DROP POLICY IF EXISTS storage_supremo_media_update ON public.media;
CREATE POLICY storage_supremo_media_update ON public.media
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role IN ('STAFF_SITE', 'EDITOR', 'ADMIN')
    )
  );

COMMIT;
