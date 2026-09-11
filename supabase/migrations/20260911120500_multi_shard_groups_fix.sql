-- ==============================================================================
-- PROJECT NOX — MULTI-SHARD GROUPS & BALANCED CHAPTER ROUTING
-- Migration: 20260911120000_multi_shard_groups.sql
-- ==============================================================================

-- 1. ENHANCE OPTIMAL SHARD SELECTOR FOR MULTI-SHARD CHAPTER GROUPS
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
  v_second_shard uuid;
  v_first_bot_ref text;
  v_is_overflow boolean := false;
BEGIN
  -- Resolve pool
  SELECT sp.id, sp.overflow_allowed INTO v_pool_id, v_allow_overflow
  FROM public.storage_pools sp
  WHERE sp.key = p_pool_key AND sp.enabled = true;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool de armazenamento inválido ou desativado: %', p_pool_key;
  END IF;

  -- 1. If chapter_id provided, inspect shard group affinity
  IF p_chapter_id IS NOT NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.storage_shard_groups sg
    WHERE sg.pool_id = v_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;

    IF v_group_id IS NOT NULL THEN
      -- Pick healthy shard from existing chapter group, balancing across members
      SELECT s.id INTO v_chosen_shard
      FROM public.storage_shard_group_members gm
      JOIN public.storage_shards s ON s.id = gm.shard_id
      WHERE gm.group_id = v_group_id
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY
        s.active_uploads ASC,
        (s.weight / GREATEST(1, 1 + s.recent_failures * 10)) DESC,
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
    ORDER BY s.active_uploads ASC
    LIMIT 1;
  END IF;

  -- 3. Standard weighted selection from target pool
  IF v_chosen_shard IS NULL THEN
    SELECT s.id, s.bot_reference INTO v_chosen_shard, v_first_bot_ref
    FROM public.storage_shards s
    WHERE s.pool_id = v_pool_id
      AND s.enabled = true
      AND s.write_status IN ('HEALTHY', 'DEGRADED')
      AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
    ORDER BY
      s.active_uploads ASC,
      (s.weight / GREATEST(1, 1 + s.active_uploads * 5 + s.queue_depth * 2)) DESC,
      s.latency_ms ASC
    LIMIT 1;
  END IF;

  -- 4. If all shards in pool are saturated/cooling down, check overflow pool
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

  -- 5. Fallback if still null: any available enabled shard
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

  -- 6. If chapter_id provided and group was missing, provision MULTI-SHARD GROUP
  IF p_chapter_id IS NOT NULL AND v_group_id IS NULL THEN
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
      -- Insert primary chosen shard into group
      INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
      VALUES (v_group_id, v_chosen_shard, 100, 1)
      ON CONFLICT DO NOTHING;

      -- Find a secondary distinct healthy shard (ideally distinct bot_reference for redundancy)
      SELECT s.id INTO v_second_shard
      FROM public.storage_shards s
      WHERE s.pool_id = v_pool_id
        AND s.id != v_chosen_shard
        AND s.enabled = true
        AND s.write_status IN ('HEALTHY', 'DEGRADED')
        AND (s.cooldown_until IS NULL OR s.cooldown_until <= now())
      ORDER BY
        (s.bot_reference != COALESCE(v_first_bot_ref, '')) DESC,
        s.active_uploads ASC,
        s.weight DESC
      LIMIT 1;

      IF v_second_shard IS NOT NULL THEN
        INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
        VALUES (v_group_id, v_second_shard, 100, 2)
        ON CONFLICT DO NOTHING;
      END IF;
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

-- 2. HELPER RPC TO EXPLICITLY PROVISION A MULTI-SHARD CHAPTER GROUP
CREATE OR REPLACE FUNCTION public.provision_chapter_shard_group(
  p_chapter_id uuid,
  p_pool_key text DEFAULT 'MANGA_STORAGE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_pool_id uuid;
  v_group_id uuid;
  v_shard1 uuid;
  v_shard2 uuid;
  v_shards jsonb;
BEGIN
  SELECT sp.id INTO v_pool_id FROM public.storage_pools sp WHERE sp.key = p_pool_key;
  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'Pool não encontrado: %', p_pool_key;
  END IF;

  -- Create or fetch group
  INSERT INTO public.storage_shard_groups (pool_id, scope_type, scope_id, strategy)
  VALUES (v_pool_id, 'CHAPTER', p_chapter_id, 'BALANCED')
  ON CONFLICT ON CONSTRAINT uq_storage_shard_group_scope DO NOTHING
  RETURNING id INTO v_group_id;

  IF v_group_id IS NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.storage_shard_groups sg
    WHERE sg.pool_id = v_pool_id AND sg.scope_type = 'CHAPTER' AND sg.scope_id = p_chapter_id;
  END IF;

  -- Pick shard from Bot 01
  SELECT s.id INTO v_shard1
  FROM public.storage_shards s
  WHERE s.pool_id = v_pool_id
    AND s.enabled = true
    AND s.write_status = 'HEALTHY'
    AND s.bot_reference = 'MANGA_STORAGE_01'
  ORDER BY s.active_uploads ASC, random()
  LIMIT 1;

  -- Pick shard from Bot 02
  SELECT s.id INTO v_shard2
  FROM public.storage_shards s
  WHERE s.pool_id = v_pool_id
    AND s.enabled = true
    AND s.write_status = 'HEALTHY'
    AND s.bot_reference = 'MANGA_STORAGE_2'
  ORDER BY s.active_uploads ASC, random()
  LIMIT 1;

  IF v_shard1 IS NOT NULL THEN
    INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
    VALUES (v_group_id, v_shard1, 100, 1)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_shard2 IS NOT NULL THEN
    INSERT INTO public.storage_shard_group_members (group_id, shard_id, weight, priority)
    VALUES (v_group_id, v_shard2, 100, 2)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'shard_id', s.id,
    'bot_reference', s.bot_reference,
    'display_name', s.display_name,
    'channel_id', s.channel_id
  )) INTO v_shards
  FROM public.storage_shard_group_members gm
  JOIN public.storage_shards s ON s.id = gm.shard_id
  WHERE gm.group_id = v_group_id;

  RETURN jsonb_build_object(
    'group_id', v_group_id,
    'chapter_id', p_chapter_id,
    'strategy', 'BALANCED',
    'shards', v_shards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_optimal_storage_shard(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_chapter_shard_group(uuid, text) TO service_role;
