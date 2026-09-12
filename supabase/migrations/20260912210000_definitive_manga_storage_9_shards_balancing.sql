-- ==============================================================================
-- PROJECT NOX — DEFINITIVE MANGA STORAGE 9 SHARDS BALANCING & BUGFIXES
-- Migration: 20260912210000_definitive_manga_storage_9_shards_balancing.sql
-- ==============================================================================

BEGIN;

-- 1. Canonicalize all 9 Manga Storage shards in MANGA_STORAGE pool (9ad5dac9-c8f7-4774-b488-59837fcef9c3)
-- Shard 1: Nox Mangá (-1004353931378, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Nox Mangá',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1004353931378',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '935e146d-de3f-4a8e-b393-692944c716fa'
   OR channel_id = '-1004353931378';

-- Shard 2: Nox Manga Storage 001 (-1003525800137, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 001',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1003525800137',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '3a4be1a3-f5d2-40c9-9eab-697c2357b183'
   OR channel_id = '-1003525800137';

-- Shard 3: Nox Manga Storage 002 (-1003686965009, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 002',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1003686965009',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = 'a3b6a10e-f53a-4873-9f19-d4cc8576de3a'
   OR channel_id = '-1003686965009';

-- Shard 4: Nox Manga Storage 003 (-1004400799763, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 003',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1004400799763',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '424e8be1-dc8a-4d97-a904-119c7ef1c9b5'
   OR channel_id = '-1004400799763';

-- Shard 5: Nox Manga Storage 004 (-1004382627509, MANGA_STORAGE_01)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 004',
    bot_reference = 'MANGA_STORAGE_01',
    channel_id = '-1004382627509',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = 'b8fd37d7-3923-4e04-be37-610a1079aa43'
   OR channel_id = '-1004382627509';

-- Shard 6: Nox Manga Storage 005 (-1003889300195, MANGA_STORAGE_2)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 005',
    bot_reference = 'MANGA_STORAGE_2',
    channel_id = '-1003889300195',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '80ead41f-7b58-492d-a028-ae0b2669cd93'
   OR channel_id = '-1003889300195';

-- Shard 7: Nox Manga Storage 006 (-1004356622185, MANGA_STORAGE_2)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 006',
    bot_reference = 'MANGA_STORAGE_2',
    channel_id = '-1004356622185',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '98701fd5-d376-4310-b664-6aa13bf0cbb1'
   OR channel_id = '-1004356622185';

-- Shard 8: Nox Manga Storage 007 (-1004413066858, MANGA_STORAGE_2)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 007',
    bot_reference = 'MANGA_STORAGE_2',
    channel_id = '-1004413066858',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '3535da22-cb50-4b7b-b12f-96c25460d0b6'
   OR channel_id = '-1004413066858';

-- Shard 9: Nox Manga Storage 008 (-1004337541258, MANGA_STORAGE_2)
UPDATE public.storage_shards
SET display_name = 'Nox Manga Storage 008',
    bot_reference = 'MANGA_STORAGE_2',
    channel_id = '-1004337541258',
    weight = 100,
    enabled = true,
    write_status = 'HEALTHY',
    read_status = 'HEALTHY',
    cooldown_until = NULL,
    active_uploads = 0,
    queue_depth = 0,
    recent_failures = 0,
    updated_at = now()
WHERE id = '23518242-ad31-44e9-9997-add190b0a930'
   OR channel_id = '-1004337541258';

-- Clean up any invalid or empty chapter groups
DELETE FROM public.storage_shard_groups
WHERE id NOT IN (SELECT group_id FROM public.storage_shard_group_members);

-- 2. Update record_shard_upload_result
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
        recent_failures = GREATEST(0, recent_failures - 1),
        assigned_pages_count = assigned_pages_count + 1,
        latency_ms = CASE WHEN latency_ms = 0 THEN p_latency_ms ELSE (latency_ms * 4 + p_latency_ms) / 5 END,
        throughput = throughput + p_bytes,
        last_selected_at = now(),
        write_status = 'HEALTHY',
        cooldown_until = NULL,
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

-- 3. Definitive select_optimal_storage_shard with Ambiguity Fix, Deadlock Resolution, and Fair Active/Active Balancing
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
  v_first_bot_ref text;
  v_is_overflow boolean := false;
BEGIN
  -- Resolve target pool
  SELECT sp.id, sp.overflow_allowed INTO v_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- 0. Self-heal any shards whose cooldown has expired
  UPDATE public.storage_shards
  SET write_status = 'HEALTHY',
      cooldown_until = NULL,
      recent_failures = 0
  WHERE pool_id = v_pool_id
    AND write_status = 'COOLDOWN'
    AND (cooldown_until IS NULL OR cooldown_until <= now());

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
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
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
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
    ORDER BY s.active_uploads ASC, s.assigned_pages_count ASC, random()
    LIMIT 1;
  END IF;

  -- 3. If chapter_id provided and group was missing, create a dynamic multi-shard pair!
  -- Pair one Bot 01 shard with one Bot 02 shard dynamically based on least recent usage / fair catch-up
  IF v_chosen_shard IS NULL AND p_chapter_id IS NOT NULL THEN
    -- Select Bot 01 shard (Nox Mangá, 001, 002, 003, 004)
    SELECT s.id INTO v_first_shard
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.bot_reference = 'MANGA_STORAGE_01'
      AND s.enabled = true
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
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
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
    ORDER BY
      s.assigned_chapters_count ASC,
      s.assigned_pages_count ASC,
      s.active_uploads ASC,
      random()
    LIMIT 1;

    -- If Bot 01 has no available shard, fall back to any other healthy shard in pool
    IF v_first_shard IS NULL THEN
      SELECT s.id INTO v_first_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_pool_id
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY s.assigned_chapters_count ASC, s.assigned_pages_count ASC, random()
      LIMIT 1;
    END IF;

    -- Resolve bot reference of first shard unambiguously into local variable
    IF v_first_shard IS NOT NULL THEN
      SELECT s.bot_reference INTO v_first_bot_ref
      FROM public.storage_shards s
      WHERE s.id = v_first_shard;
    END IF;

    -- If Bot 02 has no shard or duplicate of first, select a different healthy shard prioritizing different bot
    IF v_second_shard IS NULL OR v_second_shard = v_first_shard THEN
      SELECT s.id INTO v_second_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_pool_id
        AND s.id != v_first_shard
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY
        (s.bot_reference != COALESCE(v_first_bot_ref, '')) DESC,
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

        IF v_second_shard IS NOT NULL AND v_second_shard != v_first_shard THEN
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
      AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
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
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
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

  -- 7. Ensure selected shard is HEALTHY if cooldown has passed
  UPDATE public.storage_shards
  SET write_status = 'HEALTHY',
      cooldown_until = NULL
  WHERE id = v_chosen_shard
    AND write_status = 'COOLDOWN'
    AND (cooldown_until IS NULL OR cooldown_until <= now());

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
