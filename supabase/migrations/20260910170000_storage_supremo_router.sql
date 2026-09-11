-- ==============================================================================
-- PROJECT NOX — STORAGE SUPREMO DISTRIBUÍDO (CONTROL PLANE & ROUTER)
-- Migration: 20260910170000_storage_supremo_router.sql
-- ==============================================================================

-- 1. STORAGE POOLS TABLE
CREATE TABLE IF NOT EXISTS public.storage_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  purpose text NOT NULL,
  reserved boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  overflow_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. STORAGE SHARDS TABLE
CREATE TABLE IF NOT EXISTS public.storage_shards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.storage_pools(id) ON DELETE CASCADE,
  backend text NOT NULL DEFAULT 'TELEGRAM',
  bot_reference text NOT NULL,
  channel_id text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  reserved boolean NOT NULL DEFAULT false,
  owner_scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  write_status text NOT NULL DEFAULT 'HEALTHY',
  read_status text NOT NULL DEFAULT 'HEALTHY',
  active_uploads integer NOT NULL DEFAULT 0,
  queue_depth integer NOT NULL DEFAULT 0,
  recent_successes integer NOT NULL DEFAULT 0,
  recent_failures integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  throughput numeric NOT NULL DEFAULT 0,
  error_rate numeric NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  weight integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_shard_write_status CHECK (write_status IN ('HEALTHY', 'DEGRADED', 'COOLDOWN', 'OFFLINE', 'DISABLED', 'READ_ONLY')),
  CONSTRAINT chk_shard_read_status CHECK (read_status IN ('HEALTHY', 'DEGRADED', 'OFFLINE', 'DISABLED'))
);

CREATE INDEX IF NOT EXISTS idx_storage_shards_pool ON public.storage_shards(pool_id);
CREATE INDEX IF NOT EXISTS idx_storage_shards_status ON public.storage_shards(write_status, read_status);
CREATE INDEX IF NOT EXISTS idx_storage_shards_owner_scan ON public.storage_shards(owner_scan_id);

-- 3. STORAGE SHARD GROUPS (For Chapter Shard Affinity)
CREATE TABLE IF NOT EXISTS public.storage_shard_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.storage_pools(id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'CHAPTER',
  scope_id uuid NOT NULL,
  strategy text NOT NULL DEFAULT 'STICKY',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_storage_shard_group_scope UNIQUE (pool_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS public.storage_shard_group_members (
  group_id uuid NOT NULL REFERENCES public.storage_shard_groups(id) ON DELETE CASCADE,
  shard_id uuid NOT NULL REFERENCES public.storage_shards(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 100,
  priority integer NOT NULL DEFAULT 1,
  PRIMARY KEY (group_id, shard_id)
);

-- 4. ENHANCE MEMBERS TABLE WITH AVATAR & BANNER CROP COORDINATES
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS avatar_crop jsonb DEFAULT '{"x": 50, "y": 50, "zoom": 1}'::jsonb,
  ADD COLUMN IF NOT EXISTS banner_crop jsonb DEFAULT '{"x": 50, "y": 50, "zoom": 1}'::jsonb;

-- 5. ENHANCE MEDIA TABLE WITH ROUTER COLUMNS
ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS storage_pool_id uuid REFERENCES public.storage_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_shard_id uuid REFERENCES public.storage_shards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bot_reference text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS access_class text DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS pending_delete_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_pool_shard ON public.media(storage_pool_id, storage_shard_id);
CREATE INDEX IF NOT EXISTS idx_media_access_status ON public.media(access_class, status);
CREATE INDEX IF NOT EXISTS idx_media_pending_delete ON public.media(pending_delete_at) WHERE status = 'PENDING_DELETE';

-- 6. MEDIA RECORDS (Comprehensive Registry)
CREATE TABLE IF NOT EXISTS public.media_records (
  id uuid PRIMARY KEY,
  purpose text NOT NULL,
  storage_pool_id uuid REFERENCES public.storage_pools(id) ON DELETE SET NULL,
  storage_shard_id uuid REFERENCES public.storage_shards(id) ON DELETE SET NULL,
  backend text NOT NULL DEFAULT 'TELEGRAM',
  bot_reference text NOT NULL DEFAULT 'primary',
  channel_id text,
  message_id text,
  file_id text,
  unique_file_id text,
  checksum text,
  size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_class text NOT NULL DEFAULT 'PUBLIC',
  status text NOT NULL DEFAULT 'ACTIVE',
  pending_delete_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_media_records_access CHECK (access_class IN ('PUBLIC', 'AUTHENTICATED', 'STAFF_ONLY', 'SCAN_MEMBER', 'ADMIN_ONLY', 'STAGING')),
  CONSTRAINT chk_media_records_status CHECK (status IN ('ACTIVE', 'PENDING_DELETE', 'DELETED'))
);

CREATE INDEX IF NOT EXISTS idx_media_records_pool ON public.media_records(storage_pool_id);
CREATE INDEX IF NOT EXISTS idx_media_records_shard ON public.media_records(storage_shard_id);
CREATE INDEX IF NOT EXISTS idx_media_records_scan ON public.media_records(scan_id);
CREATE INDEX IF NOT EXISTS idx_media_records_chapter ON public.media_records(chapter_id);

-- 7. MEDIA LOCATIONS TABLE (For Replication & Multi-Location)
CREATE TABLE IF NOT EXISTS public.media_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL,
  storage_shard_id uuid NOT NULL REFERENCES public.storage_shards(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'PRIMARY',
  bot_reference text NOT NULL DEFAULT 'primary',
  channel_id text,
  message_id text,
  file_id text NOT NULL,
  status text NOT NULL DEFAULT 'HEALTHY',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_media_location_role CHECK (role IN ('PRIMARY', 'REPLICA')),
  CONSTRAINT chk_media_location_status CHECK (status IN ('HEALTHY', 'DEGRADED', 'OFFLINE'))
);

CREATE INDEX IF NOT EXISTS idx_media_locations_media ON public.media_locations(media_id);
CREATE INDEX IF NOT EXISTS idx_media_locations_shard ON public.media_locations(storage_shard_id);

-- 8. SCAN STORAGE USAGE (Fair Scheduler & Quota Tracking)
CREATE TABLE IF NOT EXISTS public.scan_storage_usage (
  scan_id uuid PRIMARY KEY REFERENCES public.scans(id) ON DELETE CASCADE,
  pages bigint NOT NULL DEFAULT 0,
  bytes bigint NOT NULL DEFAULT 0,
  uploads bigint NOT NULL DEFAULT 0,
  failures bigint NOT NULL DEFAULT 0,
  active_uploads integer NOT NULL DEFAULT 0,
  throughput numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. CONTROL PLANE BACKUPS (Disaster Recovery & Snapshots)
CREATE TABLE IF NOT EXISTS public.control_plane_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id text NOT NULL UNIQUE,
  schema_version text NOT NULL,
  record_counts jsonb NOT NULL,
  checksum text NOT NULL,
  data_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. SEED THE 6 CANONICAL STORAGE POOLS & INITIAL SHARDS
INSERT INTO public.storage_pools (key, display_name, purpose, reserved, enabled, overflow_allowed)
VALUES
  ('MANGA_STORAGE', 'Manga Pages & Chapters Storage', 'editorial', false, true, true),
  ('STAFF_STORAGE', 'Staff Dedicated Upload Pool', 'staff_manual', true, true, false),
  ('PARTNER_SCAN_STORAGE', 'Partner Scans Upload Pool', 'scan_chapter', false, true, true),
  ('PROFILE_MEDIA', 'User Profiles & Cosmetics Media', 'profile_media', false, true, true),
  ('SCAN_MEDIA', 'Scan Identities & Banners Media', 'scan_media', false, true, true),
  ('OVERFLOW_STORAGE', 'Emergency Overflow Contingency Pool', 'overflow', true, true, false)
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  purpose = EXCLUDED.purpose,
  reserved = EXCLUDED.reserved,
  enabled = EXCLUDED.enabled,
  overflow_allowed = EXCLUDED.overflow_allowed,
  updated_at = now();

-- Seed initial shard for each pool (pointing to configured primary telegram bot/channel)
DO $$
DECLARE
  v_manga_pool uuid;
  v_staff_pool uuid;
  v_partner_pool uuid;
  v_profile_pool uuid;
  v_scan_pool uuid;
  v_overflow_pool uuid;
BEGIN
  SELECT id INTO v_manga_pool FROM public.storage_pools WHERE key = 'MANGA_STORAGE';
  SELECT id INTO v_staff_pool FROM public.storage_pools WHERE key = 'STAFF_STORAGE';
  SELECT id INTO v_partner_pool FROM public.storage_pools WHERE key = 'PARTNER_SCAN_STORAGE';
  SELECT id INTO v_profile_pool FROM public.storage_pools WHERE key = 'PROFILE_MEDIA';
  SELECT id INTO v_scan_pool FROM public.storage_pools WHERE key = 'SCAN_MEDIA';
  SELECT id INTO v_overflow_pool FROM public.storage_pools WHERE key = 'OVERFLOW_STORAGE';

  -- Manga Storage Shard 1
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_manga_pool AND bot_reference = 'primary') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, weight)
    VALUES (v_manga_pool, 'TELEGRAM', 'primary', '-1004440522630', 'Manga Primary Shard 1', 100);
  END IF;

  -- Staff Dedicated Shard
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_staff_pool AND bot_reference = 'staff') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, reserved, weight)
    VALUES (v_staff_pool, 'TELEGRAM', 'staff', '-1004440522630', 'Staff Reserved Shard', true, 100);
  END IF;

  -- Partner Scan Shard 1
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_partner_pool AND bot_reference = 'partner') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, weight)
    VALUES (v_partner_pool, 'TELEGRAM', 'partner', '-1004440522630', 'Partner Scans Shared Shard 1', 100);
  END IF;

  -- Profile Media Shard 1
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_profile_pool AND bot_reference = 'profile') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, weight)
    VALUES (v_profile_pool, 'TELEGRAM', 'profile', '-1004440522630', 'Profile Media Shard 1', 100);
  END IF;

  -- Scan Media Shard 1
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_scan_pool AND bot_reference = 'scan_media') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, weight)
    VALUES (v_scan_pool, 'TELEGRAM', 'scan_media', '-1004440522630', 'Scan Media Shard 1', 100);
  END IF;

  -- Overflow Shard 1
  IF NOT EXISTS (SELECT 1 FROM public.storage_shards WHERE pool_id = v_overflow_pool AND bot_reference = 'overflow') THEN
    INSERT INTO public.storage_shards (pool_id, backend, bot_reference, channel_id, display_name, reserved, weight)
    VALUES (v_overflow_pool, 'TELEGRAM', 'overflow', '-1004440522630', 'Emergency Contingency Shard 1', true, 50);
  END IF;
END $$;

-- 11. RPC: OPTIMAL SHARD SELECTOR (Weighted least-connections & health score)
CREATE OR REPLACE FUNCTION public.select_optimal_storage_shard(
  p_pool_key text,
  p_chapter_id uuid DEFAULT NULL,
  p_scan_id uuid DEFAULT NULL
)
RETURNS TABLE (
  shard_id uuid,
  pool_id uuid,
  backend text,
  bot_reference text,
  channel_id text,
  display_name text,
  write_status text,
  is_overflow boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_pool_id uuid;
  v_overflow_pool_id uuid;
  v_allow_overflow boolean;
  v_group_id uuid;
  v_chosen_shard uuid;
  v_is_overflow boolean := false;
BEGIN
  -- Resolve pool
  SELECT sp.id, sp.overflow_allowed INTO v_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- If chapter_id provided, inspect shard group affinity
  IF p_chapter_id IS NOT NULL THEN
    SELECT id INTO v_group_id
    FROM public.storage_shard_groups
    WHERE pool_id = v_pool_id AND scope_type = 'CHAPTER' AND scope_id = p_chapter_id;

    IF v_group_id IS NOT NULL THEN
      -- Pick healthy shard from existing chapter group
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shard_group_members gm
      JOIN public.storage_shards s ON s.id = gm.shard_id
      WHERE gm.group_id = v_group_id
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY
        (s.weight / GREATEST(1, 1 + s.active_uploads * 5 + s.queue_depth * 2)) DESC,
        gm.priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- If dedicated scan shard exists for partner scan
  IF v_chosen_shard IS NULL AND p_scan_id IS NOT NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.owner_scan_id = p_scan_id
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY s.active_uploads ASC
    LIMIT 1;
  END IF;

  -- Standard weighted selection from target pool
  IF v_chosen_shard IS NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY
      (s.weight / GREATEST(1, 1 + s.active_uploads * 5 + s.queue_depth * 2)) DESC,
      s.latency_ms ASC
    LIMIT 1;
  END IF;

  -- If all shards in pool are saturated/cooling down, check overflow pool
  IF v_chosen_shard IS NULL AND v_allow_overflow THEN
    SELECT sp.id INTO v_overflow_pool_id
    FROM public.storage_pools sp
    WHERE sp.key = 'OVERFLOW_STORAGE' AND sp.enabled = true;

    IF v_overflow_pool_id IS NOT NULL THEN
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_overflow_pool_id
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY s.active_uploads ASC
      LIMIT 1;

      IF v_chosen_shard IS NOT NULL THEN
        v_is_overflow := true;
      END IF;
    END IF;
  END IF;

  -- If still null, try any available enabled shard with lowest active uploads
  IF v_chosen_shard IS NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id AND s.enabled = true
    ORDER BY s.active_uploads ASC
    LIMIT 1;
  END IF;

  IF v_chosen_shard IS NULL THEN
    RAISE EXCEPTION 'Nenhum shard de armazenamento disponível no momento para o pool: %', p_pool_key;
  END IF;

  -- If chapter_id provided and group was missing, create sticky chapter group
  IF p_chapter_id IS NOT NULL AND v_group_id IS NULL THEN
    INSERT INTO public.storage_shard_groups (pool_id, scope_type, scope_id, strategy)
    VALUES (v_pool_id, 'CHAPTER', p_chapter_id, 'STICKY')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_group_id;

    IF v_group_id IS NOT NULL THEN
      INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
      VALUES (v_group_id, v_chosen_shard, 100, 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS shard_id,
    s.pool_id,
    s.backend,
    s.bot_reference,
    s.channel_id,
    s.display_name,
    s.write_status,
    v_is_overflow AS is_overflow
  FROM public.storage_shards s
  WHERE s.id = v_chosen_shard;
END;
$$;

-- 12. RPC: RECORD SHARD UPLOAD START
CREATE OR REPLACE FUNCTION public.record_shard_upload_start(p_shard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.storage_shards
  SET active_uploads = active_uploads + 1,
      queue_depth = GREATEST(0, queue_depth + 1),
      updated_at = now()
  WHERE id = p_shard_id;
END;
$$;

-- 13. RPC: RECORD SHARD UPLOAD RESULT (With Independent Read/Write Circuit Breaker)
CREATE OR REPLACE FUNCTION public.record_shard_upload_result(
  p_shard_id uuid,
  p_success boolean,
  p_latency_ms integer DEFAULT 0,
  p_bytes integer DEFAULT 0,
  p_error_code integer DEFAULT NULL,
  p_retry_after integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cooldown_seconds integer;
BEGIN
  IF p_success THEN
    UPDATE public.storage_shards
    SET active_uploads = GREATEST(0, active_uploads - 1),
        queue_depth = GREATEST(0, queue_depth - 1),
        recent_successes = recent_successes + 1,
        latency_ms = CASE WHEN latency_ms = 0 THEN p_latency_ms ELSE (latency_ms * 4 + p_latency_ms) / 5 END,
        throughput = throughput + p_bytes,
        write_status = CASE
          WHEN write_status = 'COOLDOWN' AND (cooldown_until IS NULL OR cooldown_until <= now()) THEN 'HEALTHY'
          ELSE write_status
        END,
        updated_at = now()
    WHERE id = p_shard_id;
  ELSE
    v_cooldown_seconds := GREATEST(5, COALESCE(p_retry_after, 15));

    UPDATE public.storage_shards
    SET active_uploads = GREATEST(0, active_uploads - 1),
        queue_depth = GREATEST(0, queue_depth - 1),
        recent_failures = recent_failures + 1,
        write_status = CASE
          WHEN p_error_code = 429 THEN 'COOLDOWN'
          WHEN recent_failures >= 5 THEN 'DEGRADED'
          ELSE write_status
        END,
        cooldown_until = CASE
          WHEN p_error_code = 429 THEN now() + (v_cooldown_seconds || ' seconds')::interval
          ELSE cooldown_until
        END,
        updated_at = now()
    WHERE id = p_shard_id;
  END IF;
END;
$$;

-- 14. RPC: COMMIT MEDIA RECORD & REPLICA LOCATIONS
CREATE OR REPLACE FUNCTION public.commit_media_record(
  p_id uuid,
  p_shard_id uuid,
  p_provider_key text,
  p_message_id text DEFAULT NULL,
  p_unique_file_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_pool_id uuid;
  v_bot_ref text;
  v_chan_id text;
  v_scan_id uuid;
  v_bytes integer;
BEGIN
  SELECT pool_id, bot_reference, channel_id INTO v_pool_id, v_bot_ref, v_chan_id
  FROM public.storage_shards
  WHERE id = p_shard_id;

  -- Update media table
  UPDATE public.media
  SET provider = 'telegram',
      provider_key = p_provider_key,
      storage_ready = true,
      storage_pool_id = v_pool_id,
      storage_shard_id = p_shard_id,
      bot_reference = v_bot_ref
  WHERE id = p_id
  RETURNING scan_id, bytes INTO v_scan_id, v_bytes;

  -- Upsert media_records
  INSERT INTO public.media_records (
    id, purpose, storage_pool_id, storage_shard_id, backend,
    bot_reference, channel_id, message_id, file_id, unique_file_id,
    checksum, size, mime_type, scan_id, work_id, chapter_id,
    uploaded_by, access_class, status
  )
  SELECT
    m.id, m.purpose, v_pool_id, p_shard_id, 'TELEGRAM',
    v_bot_ref, v_chan_id, p_message_id, p_provider_key, p_unique_file_id,
    m.sha256, m.bytes, m.mime, m.scan_id, NULL, m.chapter_id,
    m.created_by, m.access_class, 'ACTIVE'
  FROM public.media m
  WHERE m.id = p_id
  ON CONFLICT (id) DO UPDATE SET
    storage_pool_id = EXCLUDED.storage_pool_id,
    storage_shard_id = EXCLUDED.storage_shard_id,
    bot_reference = EXCLUDED.bot_reference,
    channel_id = EXCLUDED.channel_id,
    message_id = EXCLUDED.message_id,
    file_id = EXCLUDED.file_id,
    status = 'ACTIVE';

  -- Primary location entry
  INSERT INTO public.media_locations (
    media_id, storage_shard_id, role, bot_reference, channel_id, message_id, file_id, status
  ) VALUES (
    p_id, p_shard_id, 'PRIMARY', v_bot_ref, v_chan_id, p_message_id, p_provider_key, 'HEALTHY'
  );

  -- Update scan usage if scan_id is present
  IF v_scan_id IS NOT NULL THEN
    INSERT INTO public.scan_storage_usage (scan_id, pages, bytes, uploads)
    VALUES (v_scan_id, 1, COALESCE(v_bytes, 0), 1)
    ON CONFLICT (scan_id) DO UPDATE SET
      pages = public.scan_storage_usage.pages + 1,
      bytes = public.scan_storage_usage.bytes + COALESCE(v_bytes, 0),
      uploads = public.scan_storage_usage.uploads + 1,
      updated_at = now();
  END IF;
END;
$$;

-- 15. RPC: RESERVE MEDIA (ZERO ARTIFICIAL HOURLY LIMITS, ONLY IN-FLIGHT DEBOUNCE)
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

  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM public.access_roles a
    JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = p_user
      AND NOT a.suspended
      AND u.email_confirmed_at IS NOT NULL
      AND (
        a.role IN ('EDITOR', 'ADMIN')
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
    ) >= 3 THEN
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

-- 16. RPC: QUARANTINE MEDIA (Grace period before hard deletion)
CREATE OR REPLACE FUNCTION public.quarantine_media_record(
  p_id uuid,
  p_grace_days integer DEFAULT 7
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.media
  SET status = 'PENDING_DELETE',
      pending_delete_at = now() + (p_grace_days || ' days')::interval
  WHERE id = p_id;

  UPDATE public.media_records
  SET status = 'PENDING_DELETE',
      pending_delete_at = now() + (p_grace_days || ' days')::interval
  WHERE id = p_id;
END;
$$;

-- 17. RPC: CONTROL PLANE DISASTER RECOVERY BACKUP
CREATE OR REPLACE FUNCTION public.execute_control_plane_backup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_backup_id text;
  v_counts jsonb;
  v_checksum text;
BEGIN
  v_backup_id := 'backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');

  SELECT jsonb_build_object(
    'pools', (SELECT count(*) FROM public.storage_pools),
    'shards', (SELECT count(*) FROM public.storage_shards),
    'groups', (SELECT count(*) FROM public.storage_shard_groups),
    'media_records', (SELECT count(*) FROM public.media_records),
    'media_locations', (SELECT count(*) FROM public.media_locations),
    'scan_storage_usage', (SELECT count(*) FROM public.scan_storage_usage),
    'timestamp', now()
  ) INTO v_counts;

  v_checksum := encode(sha256(v_counts::text::bytea), 'hex');

  INSERT INTO public.control_plane_backups (
    backup_id, schema_version, record_counts, checksum
  ) VALUES (
    v_backup_id, '1.0.0', v_counts, v_checksum
  );

  RETURN v_backup_id;
END;
$$;

-- 18. ENABLE ROW LEVEL SECURITY ON ALL NEW TABLES
ALTER TABLE IF EXISTS public.importer_staff_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_shards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_shard_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_shard_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_plane_backups ENABLE ROW LEVEL SECURITY;

-- 19. RLS POLICIES
DROP POLICY IF EXISTS storage_pools_read_public ON public.storage_pools;
CREATE POLICY storage_pools_read_public ON public.storage_pools FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS storage_shards_read_public ON public.storage_shards;
CREATE POLICY storage_shards_read_public ON public.storage_shards FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS media_records_read_access ON public.media_records;
CREATE POLICY media_records_read_access ON public.media_records FOR SELECT TO authenticated, anon
  USING (
    access_class = 'PUBLIC'
    OR (access_class = 'AUTHENTICATED' AND auth.uid() IS NOT NULL)
    OR (access_class = 'STAFF_ONLY' AND EXISTS (SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role IN ('EDITOR', 'ADMIN')))
    OR (access_class = 'ADMIN_ONLY' AND EXISTS (SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role = 'ADMIN'))
    OR (access_class = 'SCAN_MEMBER' AND EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = media_records.scan_id AND user_id = auth.uid()))
  );

DROP POLICY IF EXISTS scan_storage_usage_read ON public.scan_storage_usage;
CREATE POLICY scan_storage_usage_read ON public.scan_storage_usage FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.scan_members WHERE scan_id = scan_storage_usage.scan_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role IN ('EDITOR', 'ADMIN'))
  );

-- Service role bypass policies for administration
CREATE POLICY storage_pools_service ON public.storage_pools FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY storage_shards_service ON public.storage_shards FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY storage_shard_groups_service ON public.storage_shard_groups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY storage_shard_group_members_service ON public.storage_shard_group_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY media_records_service ON public.media_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY media_locations_service ON public.media_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY scan_storage_usage_service ON public.scan_storage_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY control_plane_backups_service ON public.control_plane_backups FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 20. PERMISSIONS & RPC GRANTS
REVOKE ALL ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.select_optimal_storage_shard(text,uuid,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.select_optimal_storage_shard(text,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_shard_upload_start(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_shard_upload_start(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_shard_upload_result(uuid,boolean,integer,integer,integer,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_shard_upload_result(uuid,boolean,integer,integer,integer,integer) TO service_role;

REVOKE ALL ON FUNCTION public.commit_media_record(uuid,uuid,text,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_media_record(uuid,uuid,text,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.quarantine_media_record(uuid,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quarantine_media_record(uuid,integer) TO service_role;

REVOKE ALL ON FUNCTION public.execute_control_plane_backup() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_control_plane_backup() TO service_role;

-- Table permissions
GRANT SELECT ON public.storage_pools TO authenticated, anon;
GRANT SELECT ON public.storage_shards TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_pools TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_shards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_shard_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_shard_group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_storage_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_plane_backups TO service_role;

GRANT UPDATE (
  display_name,
  bio,
  blur_nsfw,
  privacy_show_achievements,
  privacy_show_cosmetics,
  privacy_show_favorites,
  privacy_show_reading_history,
  avatar_id,
  banner_id,
  banner_position,
  avatar_crop,
  banner_crop
) ON public.members TO authenticated;
