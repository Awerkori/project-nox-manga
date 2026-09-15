-- ==============================================================================
-- PROJECT NOX — ARQUITETURA DEFINITIVA DE STORAGE TELEGRAM
-- ISOLAMENTO POR FINALIDADE + BALANCEAMENTO REAL + PRODUCTION_STORAGE PRIVADO
-- Migration: 20260912220000_definitive_telegram_storage_pools_isolation_and_production_storage.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTEND STORAGE POOLS TABLE & REGISTER PRODUCTION_STORAGE
-- ------------------------------------------------------------------------------

INSERT INTO public.storage_pools (key, display_name, purpose, reserved, enabled, overflow_allowed)
VALUES (
  'PRODUCTION_STORAGE',
  'Private Editorial Pipeline Storage',
  'pipeline',
  true,
  true,
  false
)
ON CONFLICT (key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    purpose = EXCLUDED.purpose,
    reserved = EXCLUDED.reserved,
    enabled = EXCLUDED.enabled,
    overflow_allowed = EXCLUDED.overflow_allowed,
    updated_at = now();

-- Ensure purposes are updated for existing canonical pools
UPDATE public.storage_pools SET purpose = 'editorial', updated_at = now() WHERE key = 'MANGA_STORAGE';
UPDATE public.storage_pools SET purpose = 'staff_manual', updated_at = now() WHERE key = 'STAFF_STORAGE';
UPDATE public.storage_pools SET purpose = 'scan_chapter', updated_at = now() WHERE key = 'PARTNER_SCAN_STORAGE';
UPDATE public.storage_pools SET purpose = 'profile_media', updated_at = now() WHERE key = 'PROFILE_MEDIA';
UPDATE public.storage_pools SET purpose = 'scan_media', updated_at = now() WHERE key = 'SCAN_MEDIA';
UPDATE public.storage_pools SET purpose = 'overflow', updated_at = now() WHERE key = 'OVERFLOW_STORAGE';

-- ------------------------------------------------------------------------------
-- 2. ADD METRIC & TRACKING COLUMNS TO STORAGE_SHARDS
-- ------------------------------------------------------------------------------

ALTER TABLE public.storage_shards
  ADD COLUMN IF NOT EXISTS recent_bytes bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_writes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_chapters integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_write_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;

-- ------------------------------------------------------------------------------
-- 3. CANONICALIZE SHARDS PER POOL WITH STRICT ISOLATION
-- ------------------------------------------------------------------------------

-- Resolve pool IDs
DO $$
DECLARE
  v_manga_pool uuid;
  v_staff_pool uuid;
  v_prod_pool uuid;
  v_profile_pool uuid;
  v_scan_pool uuid;
  v_partner_pool uuid;
  v_overflow_pool uuid;
BEGIN
  SELECT id INTO v_manga_pool FROM public.storage_pools WHERE key = 'MANGA_STORAGE';
  SELECT id INTO v_staff_pool FROM public.storage_pools WHERE key = 'STAFF_STORAGE';
  SELECT id INTO v_prod_pool FROM public.storage_pools WHERE key = 'PRODUCTION_STORAGE';
  SELECT id INTO v_profile_pool FROM public.storage_pools WHERE key = 'PROFILE_MEDIA';
  SELECT id INTO v_scan_pool FROM public.storage_pools WHERE key = 'SCAN_MEDIA';
  SELECT id INTO v_partner_pool FROM public.storage_pools WHERE key = 'PARTNER_SCAN_STORAGE';
  SELECT id INTO v_overflow_pool FROM public.storage_pools WHERE key = 'OVERFLOW_STORAGE';

  -- A. MANGA_STORAGE: Ensure exactly the 9 canonical shards are enabled with weight 100
  UPDATE public.storage_shards
  SET pool_id = v_manga_pool,
      enabled = true,
      write_status = 'HEALTHY',
      read_status = 'HEALTHY',
      weight = 100,
      updated_at = now()
  WHERE id IN (
    '935e146d-de3f-4a8e-b393-692944c716fa', -- Nox Mangá
    '3a4be1a3-f5d2-40c9-9eab-697c2357b183', -- Nox Manga Storage 001
    'a3b6a10e-f53a-4873-9f19-d4cc8576de3a', -- Nox Manga Storage 002
    '424e8be1-dc8a-4d97-a904-119c7ef1c9b5', -- Nox Manga Storage 003
    'b8fd37d7-3923-4e04-be37-610a1079aa43', -- Nox Manga Storage 004
    '80ead41f-7b58-492d-a028-ae0b2669cd93', -- Nox Manga Storage 005
    '98701fd5-d376-4310-b664-6aa13bf0cbb1', -- Nox Manga Storage 006
    '3535da22-cb50-4b7b-b12f-96c25460d0b6', -- Nox Manga Storage 007
    '23518242-ad31-44e9-9997-add190b0a930'  -- Nox Manga Storage 008
  );

  -- B. STAFF_STORAGE: 2 dedicated shards
  UPDATE public.storage_shards
  SET pool_id = v_staff_pool,
      bot_reference = 'STAFF_STORAGE',
      enabled = true,
      weight = 100,
      updated_at = now()
  WHERE id IN (
    'd8052891-b209-4b26-8bc1-cd2ad8e47d6f', -- Nox Staff Storage 001 (-1003750605065)
    '94fdc936-3939-48c8-8eae-bf18dfddc920'  -- Nox Staff Storage 002 (-1003995934773)
  );

  -- C. PRODUCTION_STORAGE: Shard dedicated for Pipeline DAG
  -- Check if 'Staff Reserved Shard' (-1004440522630) can be promoted or insert dedicated shard
  IF EXISTS (SELECT 1 FROM public.storage_shards WHERE id = '25fc2523-3c02-4be9-ad3b-cacc2a5041ae') THEN
    UPDATE public.storage_shards
    SET pool_id = v_prod_pool,
        display_name = 'Nox Production Storage 001',
        bot_reference = 'STAFF_STORAGE',
        channel_id = '-1004440522630',
        enabled = true,
        reserved = true,
        weight = 100,
        write_status = 'HEALTHY',
        read_status = 'HEALTHY',
        updated_at = now()
    WHERE id = '25fc2523-3c02-4be9-ad3b-cacc2a5041ae';
  ELSE
    INSERT INTO public.storage_shards (
      id, pool_id, backend, bot_reference, channel_id, display_name, enabled, reserved, weight, write_status, read_status
    ) VALUES (
      '25fc2523-3c02-4be9-ad3b-cacc2a5041ae',
      v_prod_pool,
      'TELEGRAM',
      'STAFF_STORAGE',
      '-1004440522630',
      'Nox Production Storage 001',
      true,
      true,
      100,
      'HEALTHY',
      'HEALTHY'
    );
  END IF;

  -- D. PROFILE_MEDIA: 2 dedicated shards
  UPDATE public.storage_shards
  SET pool_id = v_profile_pool,
      bot_reference = 'PROFILE_MEDIA',
      enabled = true,
      weight = 100,
      updated_at = now()
  WHERE id IN (
    'dd32b875-a256-401a-8547-d68640041745', -- Nox Profile Media 001 (-1004374499632)
    '5f650604-8cd3-4fd3-8f74-24ba2137a923'  -- Nox Profile Media 002 (-1004382474976)
  );

  -- E. SCAN_MEDIA: 2 dedicated shards
  UPDATE public.storage_shards
  SET pool_id = v_scan_pool,
      bot_reference = 'SCAN_MEDIA',
      enabled = true,
      weight = 100,
      updated_at = now()
  WHERE id IN (
    'c67400aa-1fa0-47e5-8370-06bccdf5cb66', -- Nox Scan Media 001 (-1004444401291)
    'f6a462c3-0eb3-4bb2-9655-818fe8465a3b'  -- Nox Scan Media 002 (-1004418274783)
  );

  -- F. PARTNER_SCAN_STORAGE: 2 dedicated shards
  UPDATE public.storage_shards
  SET pool_id = v_partner_pool,
      bot_reference = 'PARTNER_STORAGE',
      enabled = true,
      weight = 100,
      updated_at = now()
  WHERE id IN (
    '8d2b8cf9-4a10-4d56-9f7e-80ba0903a7ad', -- Nox Partner Storage 001 (-1004475193204)
    '7a18db2a-3c54-4552-a1ad-ac7281176837'  -- Nox Partner Storage 002 (-1004367599245)
  );

  -- G. OVERFLOW_STORAGE: 1 dedicated emergency shard
  UPDATE public.storage_shards
  SET pool_id = v_overflow_pool,
      bot_reference = 'OVERFLOW_STORAGE',
      channel_id = '-1004482964230',
      enabled = true,
      reserved = true,
      weight = 100,
      updated_at = now()
  WHERE id = 'a985d7dc-05d0-47d7-a3b3-44689c00e09a';

  -- Disable old duplicate/misleading shards that shared channels with Nox Mangá or had weight 10
  UPDATE public.storage_shards
  SET enabled = false, updated_at = now()
  WHERE id IN (
    'c3139e3d-1f71-4f9c-b11c-9cdd5954fe8b', -- Profile Media Shard 1 (channel shared with Nox Mangá)
    'e258a5db-bdca-47fb-a870-831615650ed0', -- Overflow Shard 1 (channel shared with Nox Mangá)
    'cd97c15e-8400-499f-9354-1bb363ca7994', -- Scan Media Shard 1 (legacy weight 10)
    '9719e157-2ae1-4216-ba5d-179771fe7d09'  -- Partner Scans Shared Shard 1 (legacy weight 10)
  );

END $$;

-- ------------------------------------------------------------------------------
-- 4. UPLOAD SESSIONS TABLE (For manual uploads, pause/resume, and idempotency)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  pool_key text NOT NULL DEFAULT 'STAFF_STORAGE',
  status text NOT NULL DEFAULT 'IN_PROGRESS',
  total_pages integer NOT NULL DEFAULT 0,
  uploaded_pages integer NOT NULL DEFAULT 0,
  failed_pages integer NOT NULL DEFAULT 0,
  pages_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  paused_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_chapter ON public.upload_sessions(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON public.upload_sessions(status);

ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'upload_sessions' AND policyname = 'Upload session owner or admin read') THEN
    CREATE POLICY "Upload session owner or admin read"
      ON public.upload_sessions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'upload_sessions' AND policyname = 'Upload session owner insert') THEN
    CREATE POLICY "Upload session owner insert"
      ON public.upload_sessions FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'upload_sessions' AND policyname = 'Upload session owner update') THEN
    CREATE POLICY "Upload session owner update"
      ON public.upload_sessions FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR public.is_admin())
      WITH CHECK (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. EXTEND SCAN_PRODUCTION_FILES WITH STORAGE METADATA
-- ------------------------------------------------------------------------------

ALTER TABLE public.scan_production_files
  ADD COLUMN IF NOT EXISTS storage_pool_id uuid REFERENCES public.storage_pools(id),
  ADD COLUMN IF NOT EXISTS storage_shard_id uuid REFERENCES public.storage_shards(id),
  ADD COLUMN IF NOT EXISTS bot_reference text,
  ADD COLUMN IF NOT EXISTS telegram_file_id text,
  ADD COLUMN IF NOT EXISTS sha256 text;

CREATE INDEX IF NOT EXISTS idx_scan_production_files_telegram ON public.scan_production_files(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_scan_production_files_sha256 ON public.scan_production_files(sha256);

-- ------------------------------------------------------------------------------
-- 6. DEFINITIVE SELECT_OPTIMAL_STORAGE_SHARD WITH MULTI-DIMENSIONAL FAIRNESS
-- ------------------------------------------------------------------------------

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
#variable_conflict use_column
DECLARE
  v_target_pool_id uuid;
  v_overflow_pool_id uuid;
  v_allow_overflow boolean;
  v_group_id uuid;
  v_chosen_shard uuid;
  v_first_shard uuid;
  v_second_shard uuid;
  v_first_bot_ref text;
  v_is_overflow boolean := false;
BEGIN
  -- 1. Resolve target pool
  SELECT sp.id, sp.overflow_allowed INTO v_target_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_target_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- 2. Self-heal any shards whose cooldown has expired (across the target pool and overflow)
  UPDATE public.storage_shards AS ss
  SET write_status = 'HEALTHY',
      cooldown_until = NULL,
      recent_failures = 0,
      updated_at = now()
  WHERE ss.write_status = 'COOLDOWN'
    AND (ss.cooldown_until IS NULL OR ss.cooldown_until <= now());

  -- 3. If chapter_id provided, check if a storage shard group already exists
  IF p_chapter_id IS NOT NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.storage_shard_groups sg
    WHERE sg.pool_id = v_target_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;

    IF v_group_id IS NOT NULL THEN
      -- Select the least-loaded healthy shard from the existing chapter group
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shard_group_members gm
      JOIN public.storage_shards s ON s.id = gm.shard_id
      WHERE gm.group_id = v_group_id
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY
        s.active_uploads ASC,
        (s.recent_writes * 10 + s.recent_bytes / 1048576) ASC,
        random()
      LIMIT 1;
    END IF;
  END IF;

  -- 4. If partner scan dedicated shard exists
  IF v_chosen_shard IS NULL AND p_scan_id IS NOT NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_target_pool_id
      AND s.owner_scan_id = p_scan_id
      AND s.enabled = true
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
    ORDER BY s.active_uploads ASC, s.recent_writes ASC, random()
    LIMIT 1;
  END IF;

  -- 5. If chapter_id provided and group was missing, create a dynamic multi-shard pair
  IF v_chosen_shard IS NULL AND p_chapter_id IS NOT NULL THEN

    IF p_pool_key = 'MANGA_STORAGE' THEN
      -- A. MANGA_STORAGE: Pair one Bot 01 shard with one Bot 02 shard using multi-dimensional fairness
      -- Bot 01 candidates (Nox Mangá, Storage 001..004)
      SELECT s.id INTO v_first_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_target_pool_id
        AND s.bot_reference = 'MANGA_STORAGE_01'
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY
        (
          (s.active_uploads * 1000) +
          (s.recent_writes * 10) +
          (s.recent_bytes / 1048576) +
          (s.recent_chapters * 50) -
          (EXTRACT(EPOCH FROM (now() - COALESCE(s.last_selected_at, s.created_at))) / 60) +
          (random() * 5)
        ) ASC
      LIMIT 1;

      -- Bot 02 candidates (Storage 005..008)
      SELECT s.id INTO v_second_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_target_pool_id
        AND s.bot_reference = 'MANGA_STORAGE_2'
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY
        (
          (s.active_uploads * 1000) +
          (s.recent_writes * 10) +
          (s.recent_bytes / 1048576) +
          (s.recent_chapters * 50) -
          (EXTRACT(EPOCH FROM (now() - COALESCE(s.last_selected_at, s.created_at))) / 60) +
          (random() * 5)
        ) ASC
      LIMIT 1;

      -- If Bot 01 has no available shard, fall back to any other healthy shard in pool
      IF v_first_shard IS NULL THEN
        SELECT s.id INTO v_first_shard
        FROM public.storage_shards s
        WHERE s.pool_id = v_target_pool_id
          AND s.enabled = true
          AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
        ORDER BY s.active_uploads ASC, s.recent_writes ASC, random()
        LIMIT 1;
      END IF;

      -- Resolve bot reference of first shard
      IF v_first_shard IS NOT NULL THEN
        SELECT s.bot_reference INTO v_first_bot_ref
        FROM public.storage_shards s
        WHERE s.id = v_first_shard;
      END IF;

      -- If Bot 02 has no shard or is identical to first, select different healthy shard
      IF v_second_shard IS NULL OR v_second_shard = v_first_shard THEN
        SELECT s.id INTO v_second_shard
        FROM public.storage_shards s
        WHERE s.pool_id = v_target_pool_id
          AND s.id != v_first_shard
          AND s.enabled = true
          AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
        ORDER BY
          (s.bot_reference != COALESCE(v_first_bot_ref, '')) DESC,
          s.active_uploads ASC,
          s.recent_writes ASC,
          random()
        LIMIT 1;
      END IF;

    ELSE
      -- B. OTHER POOLS (STAFF_STORAGE, PARTNER_SCAN_STORAGE, etc.): Pair 1 or 2 least-loaded shards
      SELECT s.id INTO v_first_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_target_pool_id
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY
        s.active_uploads ASC,
        (s.recent_writes * 10 + s.recent_bytes / 1048576) ASC,
        random()
      LIMIT 1;

      IF v_first_shard IS NOT NULL THEN
        SELECT s.id INTO v_second_shard
        FROM public.storage_shards s
        WHERE s.pool_id = v_target_pool_id
          AND s.id != v_first_shard
          AND s.enabled = true
          AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
        ORDER BY
          s.active_uploads ASC,
          (s.recent_writes * 10 + s.recent_bytes / 1048576) ASC,
          random()
        LIMIT 1;
      END IF;
    END IF;

    -- Persist group and increment assignment counts
    IF v_first_shard IS NOT NULL THEN
      INSERT INTO public.storage_shard_groups (pool_id, scope_type, scope_id, strategy)
      VALUES (v_target_pool_id, 'CHAPTER', p_chapter_id, 'BALANCED')
      ON CONFLICT ON CONSTRAINT uq_storage_shard_group_scope DO NOTHING
      RETURNING id INTO v_group_id;

      IF v_group_id IS NULL THEN
        SELECT sg.id INTO v_group_id
        FROM public.storage_shard_groups sg
        WHERE sg.pool_id = v_target_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;
      END IF;

      IF v_group_id IS NOT NULL THEN
        INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
        VALUES (v_group_id, v_first_shard, 100, 1)
        ON CONFLICT DO NOTHING;

        UPDATE public.storage_shards AS ss
        SET assigned_chapters_count = ss.assigned_chapters_count + 1,
            recent_chapters = ss.recent_chapters + 1,
            last_selected_at = now()
        WHERE ss.id = v_first_shard;

        IF v_second_shard IS NOT NULL AND v_second_shard != v_first_shard THEN
          INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
          VALUES (v_group_id, v_second_shard, 100, 2)
          ON CONFLICT DO NOTHING;

          UPDATE public.storage_shards AS ss
          SET assigned_chapters_count = ss.assigned_chapters_count + 1,
              recent_chapters = ss.recent_chapters + 1,
              last_selected_at = now()
          WHERE ss.id = v_second_shard;
        END IF;
      END IF;

      v_chosen_shard := v_first_shard;
    END IF;
  END IF;

  -- 6. Standalone / non-chapter upload (avatars, banners, branding, pipeline files)
  IF v_chosen_shard IS NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_target_pool_id
      AND s.enabled = true
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
    ORDER BY
      s.active_uploads ASC,
      (s.recent_writes * 10 + s.recent_bytes / 1048576) ASC,
      s.recent_failures ASC,
      random()
    LIMIT 1;
  END IF;

  -- 7. Emergency overflow fallback if permitted
  IF v_chosen_shard IS NULL AND v_allow_overflow THEN
    SELECT sp.id INTO v_overflow_pool_id
    FROM public.storage_pools sp
    WHERE sp.key = 'OVERFLOW_STORAGE' AND sp.enabled = true;

    IF v_overflow_pool_id IS NOT NULL THEN
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_overflow_pool_id
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY s.active_uploads ASC, random()
      LIMIT 1;

      IF v_chosen_shard IS NOT NULL THEN
        v_is_overflow := true;
      END IF;
    END IF;
  END IF;

  IF v_chosen_shard IS NULL THEN
    RAISE EXCEPTION 'Nenhum shard de armazenamento saudável disponível para o pool [%]', p_pool_key;
  END IF;

  -- Return selected shard
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

-- ------------------------------------------------------------------------------
-- 7. UPDATED RECORD_SHARD_UPLOAD_START & RECORD_SHARD_UPLOAD_RESULT
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_shard_upload_start(p_shard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.storage_shards
  SET active_uploads = active_uploads + 1,
      last_selected_at = now()
  WHERE id = p_shard_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_shard_upload_result(
  p_shard_id uuid,
  p_success boolean,
  p_latency_ms integer DEFAULT 0,
  p_bytes bigint DEFAULT 0,
  p_error_code integer DEFAULT NULL,
  p_retry_after integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_success THEN
    UPDATE public.storage_shards
    SET active_uploads = GREATEST(0, active_uploads - 1),
        recent_writes = recent_writes + 1,
        recent_bytes = recent_bytes + p_bytes,
        recent_successes = recent_successes + 1,
        latency_ms = CASE WHEN latency_ms = 0 THEN p_latency_ms ELSE (latency_ms * 4 + p_latency_ms) / 5 END,
        last_write_at = now(),
        last_success_at = now(),
        write_status = 'HEALTHY',
        cooldown_until = NULL,
        recent_failures = 0,
        updated_at = now()
    WHERE id = p_shard_id;
  ELSE
    UPDATE public.storage_shards
    SET active_uploads = GREATEST(0, active_uploads - 1),
        recent_failures = recent_failures + 1,
        last_failure_at = now(),
        write_status = CASE
          WHEN p_error_code = 429 THEN 'COOLDOWN'
          WHEN recent_failures >= 3 THEN 'DEGRADED'
          ELSE write_status
        END,
        cooldown_until = CASE
          WHEN p_error_code = 429 THEN now() + (COALESCE(p_retry_after, 15) || ' seconds')::interval
          ELSE cooldown_until
        END,
        updated_at = now()
    WHERE id = p_shard_id;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. OBSERVABILITY: GET_STORAGE_BALANCE_METRICS RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_storage_balance_metrics(p_hours int DEFAULT 24)
RETURNS TABLE (
  pool_key text,
  shard_id uuid,
  display_name text,
  bot_reference text,
  channel_id text,
  write_status text,
  read_status text,
  cooldown_until timestamptz,
  recent_chapters int,
  recent_writes int,
  recent_bytes bigint,
  active_uploads int,
  media_count bigint,
  last_write_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.key AS pool_key,
    ss.id AS shard_id,
    ss.display_name,
    ss.bot_reference,
    ss.channel_id,
    ss.write_status,
    ss.read_status,
    ss.cooldown_until,
    ss.recent_chapters,
    ss.recent_writes,
    ss.recent_bytes,
    ss.active_uploads,
    COUNT(m.id)::bigint AS media_count,
    ss.last_write_at
  FROM public.storage_shards ss
  JOIN public.storage_pools sp ON sp.id = ss.pool_id
  LEFT JOIN public.media m ON m.storage_shard_id = ss.id AND m.created_at >= (now() - (p_hours || ' hours')::interval)
  WHERE ss.enabled = true
  GROUP BY sp.key, ss.id, ss.display_name, ss.bot_reference, ss.channel_id, ss.write_status, ss.read_status, ss.cooldown_until, ss.recent_chapters, ss.recent_writes, ss.recent_bytes, ss.active_uploads, ss.last_write_at
  ORDER BY sp.key ASC, ss.display_name ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. DECAY RPC: DECAY_STORAGE_SHARD_METRICS (Prevents historical skew)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decay_storage_shard_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.storage_shards
  SET recent_writes = GREATEST(0, (recent_writes * 0.7)::int),
      recent_bytes = GREATEST(0, (recent_bytes * 0.7)::bigint),
      recent_chapters = GREATEST(0, (recent_chapters * 0.7)::int),
      recent_successes = GREATEST(0, (recent_successes * 0.7)::int),
      updated_at = now()
  WHERE enabled = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_optimal_storage_shard(text, uuid, uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.record_shard_upload_start(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.record_shard_upload_result(uuid, boolean, integer, bigint, integer, integer) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_balance_metrics(int) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.decay_storage_shard_metrics() TO authenticated, service_role, anon;

COMMIT;
