-- ==============================================================================
-- PROJECT NOX — STORAGE FAIR CATCH-UP BALANCING & 9 ACTIVE MANGA SHARDS
-- Migration: 20260911140000_storage_fair_catchup_balancing.sql
-- ==============================================================================

BEGIN;

-- 1. Ensure tracking columns exist on storage_shards
ALTER TABLE public.storage_shards
  ADD COLUMN IF NOT EXISTS assigned_chapters_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_pages_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_selected_at timestamptz DEFAULT now();

-- 2. Canonicalize Site Mangá as an ACTIVE/ACTIVE write shard (weight 100, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Site Mangá (Storage 000)',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1004353931378',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    updated_at = now()
WHERE id = '935e146d-557a-4ec6-ba64-8f20a7b458b6'
   OR channel_id = '-1004353931378';

-- 3. Ensure all other 8 Manga Storage shards (001 to 008) have weight = 100 and HEALTHY status
UPDATE public.storage_shards
SET weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    updated_at = now()
WHERE pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3';

-- 4. Update record_shard_upload_result to track assigned_pages_count and last_selected_at
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
        assigned_pages_count = assigned_pages_count + 1,
        latency_ms = CASE WHEN latency_ms = 0 THEN p_latency_ms ELSE (latency_ms * 4 + p_latency_ms) / 5 END,
        throughput = throughput + p_bytes,
        last_selected_at = now(),
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

-- 5. Master RPC: select_optimal_storage_shard with Fair Balancing and Catch-Up
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
  v_first_shard uuid;
  v_second_shard uuid;
  v_is_overflow boolean := false;
BEGIN
  -- Resolve target pool
  SELECT sp.id, sp.overflow_allowed INTO v_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- 1. If chapter_id provided, check existing shard group
  IF p_chapter_id IS NOT NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.storage_shard_groups sg
    WHERE sg.pool_id = v_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;

    IF v_group_id IS NOT NULL THEN
      -- Pick healthy shard from existing chapter group, balancing across its members
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shard_group_members gm
      JOIN public.storage_shards s ON s.id = gm.shard_id
      WHERE gm.group_id = v_group_id
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY
        s.active_uploads ASC,
        s.assigned_pages_count ASC,
        random()
      LIMIT 1;
    END IF;
  END IF;

  -- 2. If dedicated scan shard exists for partner scan
  IF v_chosen_shard IS NULL AND p_scan_id IS NOT NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.owner_scan_id = p_scan_id
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY s.active_uploads ASC, s.assigned_pages_count ASC, random()
    LIMIT 1;
  END IF;

  -- 3. If chapter_id provided and group was missing, create a dynamic multi-shard pair!
  -- Pair one Bot 01 shard with one Bot 02 shard dynamically based on least recent usage / catch-up
  IF v_chosen_shard IS NULL AND p_chapter_id IS NOT NULL THEN
    -- Select Bot 01 shard (Site Mangá, 001, 002, 003, 004)
    SELECT s.id INTO v_first_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.bot_reference = 'MANGA_STORAGE_01'
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY
      s.assigned_chapters_count ASC,
      s.assigned_pages_count ASC,
      s.active_uploads ASC,
      random()
    LIMIT 1;

    -- Select Bot 02 shard (005, 006, 007, 008)
    SELECT s.id INTO v_second_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.bot_reference = 'MANGA_STORAGE_2'
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY
      s.assigned_chapters_count ASC,
      s.assigned_pages_count ASC,
      s.active_uploads ASC,
      random()
    LIMIT 1;

    -- If one bot is completely unavailable, fall back to another healthy shard in pool
    IF v_first_shard IS NULL THEN
      SELECT s.id INTO v_first_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_pool_id
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY s.assigned_chapters_count ASC, s.assigned_pages_count ASC, random()
      LIMIT 1;
    END IF;

    IF v_second_shard IS NULL OR v_second_shard = v_first_shard THEN
      SELECT s.id INTO v_second_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_pool_id
        AND s.id != v_first_shard
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY
        (s.bot_reference != (SELECT bot_reference FROM public.storage_shards WHERE id = v_first_shard)) DESC,
        s.assigned_chapters_count ASC,
        s.assigned_pages_count ASC,
        random()
      LIMIT 1;
    END IF;

    IF v_first_shard IS NOT NULL THEN
      -- Create the chapter group
      INSERT INTO public.storage_shard_groups (pool_id, scope_type, scope_id, strategy)
      VALUES (v_pool_id, 'CHAPTER', p_chapter_id, 'BALANCED')
      ON CONFLICT ON CONSTRAINT uq_storage_shard_group_scope DO NOTHING
      RETURNING id INTO v_group_id;

      IF v_group_id IS NULL THEN
        SELECT sg.id INTO v_group_id
        FROM public.storage_shard_groups sg
        WHERE sg.pool_id = v_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;
      END IF;

      IF v_group_id IS NOT NULL THEN
        INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
        VALUES (v_group_id, v_first_shard, 100, 1)
        ON CONFLICT DO NOTHING;

        UPDATE public.storage_shards
        SET assigned_chapters_count = assigned_chapters_count + 1,
            last_selected_at = now()
        WHERE id = v_first_shard;

        IF v_second_shard IS NOT NULL THEN
          INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
          VALUES (v_group_id, v_second_shard, 100, 2)
          ON CONFLICT DO NOTHING;

          UPDATE public.storage_shards
          SET assigned_chapters_count = assigned_chapters_count + 1,
              last_selected_at = now()
          WHERE id = v_second_shard;
        END IF;
      END IF;

      -- Pick either first or second shard for the initial page
      IF v_second_shard IS NOT NULL AND random() < 0.5 THEN
        v_chosen_shard := v_second_shard;
      ELSE
        v_chosen_shard := v_first_shard;
      END IF;
    END IF;
  END IF;

  -- 4. Standard weighted selection if no chapter_id or group couldn't be formed
  IF v_chosen_shard IS NULL THEN
    SELECT s.id INTO v_chosen_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY
      s.active_uploads ASC,
      s.assigned_pages_count ASC,
      random()
    LIMIT 1;
  END IF;

  -- 5. Contingency: If all shards in pool are saturated/cooling down, check overflow pool
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
      ORDER BY
        s.weight DESC,
        s.active_uploads ASC,
        s.assigned_pages_count ASC,
        random()
      LIMIT 1;

      IF v_chosen_shard IS NOT NULL THEN
        v_is_overflow := true;
      END IF;
    END IF;
  END IF;

  -- 6. Absolute Fallback: any enabled shard in target pool
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

GRANT EXECUTE ON FUNCTION public.record_shard_upload_result(uuid, boolean, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.select_optimal_storage_shard(text, uuid, uuid) TO service_role;

COMMIT;
