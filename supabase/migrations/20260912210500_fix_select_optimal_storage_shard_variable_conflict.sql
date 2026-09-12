-- ==============================================================================
-- PROJECT NOX — FIX SELECT_OPTIMAL_STORAGE_SHARD VARIABLE CONFLICT & CLEANUP
-- Migration: 20260912210500_fix_select_optimal_storage_shard_variable_conflict.sql
-- ==============================================================================

BEGIN;

-- 1. Restore Profile Media & Overflow Shards mislabeled during previous pass
UPDATE public.storage_shards
SET display_name = 'Profile Media Shard 1',
    bot_reference = 'profile',
    updated_at = now()
WHERE id = 'c3139e3d-1f71-4f9c-b11c-9cdd5954fe8b';

UPDATE public.storage_shards
SET display_name = 'Overflow Shard 1',
    bot_reference = 'overflow',
    updated_at = now()
WHERE id = 'e258a5db-bdca-47fb-a870-831615650ed0';

-- 2. Definitive select_optimal_storage_shard with #variable_conflict use_column and full table qualifying
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
  -- Resolve target pool
  SELECT sp.id, sp.overflow_allowed INTO v_target_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_target_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- 0. Self-heal any shards whose cooldown has expired
  UPDATE public.storage_shards AS ss
  SET write_status = 'HEALTHY',
      cooldown_until = NULL,
      recent_failures = 0
  WHERE ss.pool_id = v_target_pool_id
    AND ss.write_status = 'COOLDOWN'
    AND (ss.cooldown_until IS NULL OR ss.cooldown_until <= now());

  -- 1. If chapter_id provided, check existing shard group
  IF p_chapter_id IS NOT NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.storage_shard_groups sg
    WHERE sg.pool_id = v_target_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;

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
    WHERE s.pool_id = v_target_pool_id
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
    WHERE s.pool_id = v_target_pool_id
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
    WHERE s.pool_id = v_target_pool_id
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
      WHERE s.pool_id = v_target_pool_id
        AND s.enabled = true
        AND (s.write_status IN ('HEALTHY', 'DEGRADED') OR (s.write_status = 'COOLDOWN' AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())))
      ORDER BY s.assigned_chapters_count ASC, s.assigned_pages_count ASC, random()
      LIMIT 1;
    END IF;

    -- Resolve bot reference of first shard unambiguously
    IF v_first_shard IS NOT NULL THEN
      SELECT s.bot_reference INTO v_first_bot_ref
      FROM public.storage_shards s
      WHERE s.id = v_first_shard;
    END IF;

    -- If Bot 02 has no shard or duplicate of first, select a different healthy shard prioritizing different bot
    IF v_second_shard IS NULL OR v_second_shard = v_first_shard THEN
      SELECT s.id INTO v_second_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_target_pool_id
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
            last_selected_at = now()
        WHERE ss.id = v_first_shard;

        IF v_second_shard IS NOT NULL AND v_second_shard != v_first_shard THEN
          INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
          VALUES (v_group_id, v_second_shard, 100, 2)
          ON CONFLICT DO NOTHING;

          UPDATE public.storage_shards AS ss
          SET assigned_chapters_count = ss.assigned_chapters_count + 1,
              last_selected_at = now()
          WHERE ss.id = v_second_shard;
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
    WHERE s.pool_id = v_target_pool_id
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
    WHERE s.pool_id = v_target_pool_id AND s.enabled = true
    ORDER BY s.active_uploads ASC
    LIMIT 1;
  END IF;

  IF v_chosen_shard IS NULL THEN
    RAISE EXCEPTION 'Nenhum shard de armazenamento disponível no momento para o pool: %', p_pool_key;
  END IF;

  -- 7. Ensure selected shard is HEALTHY if cooldown has passed
  UPDATE public.storage_shards AS ss
  SET write_status = 'HEALTHY',
      cooldown_until = NULL
  WHERE ss.id = v_chosen_shard
    AND ss.write_status = 'COOLDOWN'
    AND (ss.cooldown_until IS NULL OR ss.cooldown_until <= now());

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
