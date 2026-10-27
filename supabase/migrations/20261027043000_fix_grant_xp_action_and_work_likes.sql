-- Migration 20261027043000: Fix grant_xp_action, harmonize award_xp, and support work likes with idempotency
-- Authoritative fix for "function public.grant_xp_action(uuid, unknown, jsonb) does not exist"

-- 1. Ensure xp_ledger supports LIKE_WORK and enforces unique action per work
ALTER TABLE public.xp_ledger DROP CONSTRAINT IF EXISTS xp_ledger_kind_check;
ALTER TABLE public.xp_ledger ADD CONSTRAINT xp_ledger_kind_check
  CHECK (kind IN ('READ_CHAPTER', 'FAVORITE_WORK', 'RATE_WORK', 'COMMENT', 'REPLY', 'COMMENT_LIKE', 'LIKE_WORK', 'SHOP_PURCHASE', 'MANUAL_ADJUSTMENT'));

DROP INDEX IF EXISTS idx_xp_ledger_unique_action;
CREATE UNIQUE INDEX idx_xp_ledger_unique_action ON public.xp_ledger(user_id, kind, source_id)
  WHERE (kind IN ('READ_CHAPTER', 'FAVORITE_WORK', 'RATE_WORK', 'LIKE_WORK'));

-- 2. Update public.award_xp to handle LIKE_WORK and maintain atomic 3D XP accounting
CREATE OR REPLACE FUNCTION public.award_xp(
  p_kind text,
  p_source_id text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_current_xp integer;
  v_current_lifetime integer;
  v_current_season integer;
  v_new_xp integer;
  v_new_lifetime integer;
  v_new_season integer;
  v_prev_level integer;
  v_new_level integer;
  v_amount integer := 0;
  v_desc text := '';
  v_cooldown_interval interval := interval '0 seconds';
  v_daily_limit integer := 1000;
  v_today_count integer := 0;
  v_last_created timestamptz;
  v_seconds_remaining integer := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'awarded', false, 'reason', 'unauthenticated');
  END IF;

  -- Advisory lock per user to serialize concurrent XP requests safely
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 42));

  SELECT xp, COALESCE(lifetime_xp, xp, 0), COALESCE(season_xp, xp, 0)
  INTO v_current_xp, v_current_lifetime, v_current_season
  FROM public.members WHERE id = uid;

  IF v_current_xp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'awarded', false, 'reason', 'member_not_found');
  END IF;

  -- Define rules per activity
  IF p_kind = 'READ_CHAPTER' THEN
    v_amount := 150;
    v_desc := coalesce(p_meta->>'description', 'Leitura de capítulo concluída');
    v_cooldown_interval := interval '90 seconds';
    v_daily_limit := 40;

    -- Check if already awarded for this chapter
    IF EXISTS(SELECT 1 FROM public.xp_ledger WHERE user_id = uid AND kind = 'READ_CHAPTER' AND source_id = p_source_id)
       OR EXISTS(SELECT 1 FROM public.xp_awards WHERE user_id = uid AND chapter_id = p_source_id::uuid) THEN
      RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_awarded', 'total_xp', v_current_xp);
    END IF;

  ELSIF p_kind = 'FAVORITE_WORK' THEN
    v_amount := 75;
    v_desc := coalesce(p_meta->>'description', 'Obra adicionada aos favoritos');
    v_daily_limit := 10;

    -- Idempotent: once per work forever
    IF EXISTS(SELECT 1 FROM public.xp_ledger WHERE user_id = uid AND kind = 'FAVORITE_WORK' AND source_id = p_source_id) THEN
      RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_awarded', 'total_xp', v_current_xp);
    END IF;

  ELSIF p_kind = 'LIKE_WORK' THEN
    v_amount := 15;
    v_desc := coalesce(p_meta->>'description', 'Obra curtida');
    v_daily_limit := 20;

    -- Idempotent: once per work forever
    IF EXISTS(SELECT 1 FROM public.xp_ledger WHERE user_id = uid AND kind = 'LIKE_WORK' AND source_id = p_source_id) THEN
      RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_awarded', 'total_xp', v_current_xp);
    END IF;

  ELSIF p_kind = 'RATE_WORK' THEN
    v_amount := 50;
    v_desc := coalesce(p_meta->>'description', 'Avaliação de obra registrada');
    v_daily_limit := 10;

    IF EXISTS(SELECT 1 FROM public.xp_ledger WHERE user_id = uid AND kind = 'RATE_WORK' AND source_id = p_source_id) THEN
      RETURN jsonb_build_object('ok', true, 'awarded', false, 'reason', 'already_awarded', 'total_xp', v_current_xp);
    END IF;

  ELSIF p_kind = 'COMMENT' THEN
    v_amount := 30;
    v_desc := coalesce(p_meta->>'description', 'Comentário publicado');
    v_cooldown_interval := interval '60 seconds';
    v_daily_limit := 5;

  ELSIF p_kind = 'REPLY' THEN
    v_amount := 20;
    v_desc := coalesce(p_meta->>'description', 'Resposta enviada');
    v_cooldown_interval := interval '60 seconds';
    v_daily_limit := 5;

  ELSIF p_kind = 'COMMENT_LIKE' THEN
    v_amount := 5;
    v_desc := coalesce(p_meta->>'description', 'Curtida em comentário');
    v_cooldown_interval := interval '10 seconds';
    v_daily_limit := 10;

  ELSE
    RETURN jsonb_build_object('ok', false, 'awarded', false, 'reason', 'invalid_kind');
  END IF;

  -- Cooldown enforcement
  IF v_cooldown_interval > interval '0 seconds' THEN
    SELECT created_at INTO v_last_created
    FROM public.xp_ledger
    WHERE user_id = uid AND kind = p_kind
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_created IS NOT NULL AND now() - v_last_created < v_cooldown_interval THEN
      v_seconds_remaining := ceil(extract(epoch from (v_last_created + v_cooldown_interval - now())))::integer;
      RETURN jsonb_build_object(
        'ok', true,
        'awarded', false,
        'reason', 'cooldown_active',
        'cooldown_seconds', v_seconds_remaining,
        'total_xp', v_current_xp
      );
    END IF;
  END IF;

  -- Daily limit enforcement
  SELECT count(*) INTO v_today_count
  FROM public.xp_ledger
  WHERE user_id = uid AND kind = p_kind AND created_at > now() - interval '24 hours';

  IF v_today_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'ok', true,
      'awarded', false,
      'reason', 'daily_limit_reached',
      'total_xp', v_current_xp
    );
  END IF;

  -- Apply atomic XP credit across all 3 dimensions
  v_new_xp := v_current_xp + v_amount;
  v_new_lifetime := v_current_lifetime + v_amount;
  v_new_season := v_current_season + v_amount;

  UPDATE public.members
  SET xp = v_new_xp,
      lifetime_xp = v_new_lifetime,
      season_xp = v_new_season
  WHERE id = uid;

  -- Insert into immutable ledger
  INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description, created_at)
  VALUES (uid, v_amount, v_new_xp, p_kind, p_source_id, v_desc, now())
  ON CONFLICT DO NOTHING;

  -- Legacy table sync for chapter reads
  IF p_kind = 'READ_CHAPTER' THEN
    BEGIN
      INSERT INTO public.xp_awards (user_id, chapter_id, work_id, amount, source, created_at)
      VALUES (
        uid,
        p_source_id::uuid,
        coalesce((p_meta->>'work_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
        v_amount,
        'web',
        now()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Silently ignore if foreign key constraint triggers
    END;
  END IF;

  -- Calculate permanent reader level from lifetime_xp (Max Level = 100)
  v_prev_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_current_lifetime, 0)) / 50.0))));
  v_new_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_new_lifetime, 0)) / 50.0))));

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', true,
    'amount', v_amount,
    'total_xp', v_new_xp,
    'lifetime_xp', v_new_lifetime,
    'season_xp', v_new_season,
    'level', v_new_level,
    'prev_level', v_prev_level,
    'level_up', (v_new_level > v_prev_level),
    'is_max_level', (v_new_level >= 100)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(text, text, jsonb) TO authenticated;

-- 3. Compatibility wrapper for legacy / external calls to grant_xp_action
CREATE OR REPLACE FUNCTION public.grant_xp_action(
  p_user_id uuid,
  p_kind text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_id text := coalesce(p_meta->>'work_id', p_meta->>'chapter_id', p_meta->>'source_id', '');
BEGIN
  RETURN public.award_xp(p_kind, v_source_id, p_meta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_xp_action(uuid, text, jsonb) TO authenticated, service_role, anon;

-- 4. Definitive public.member_action RPC
CREATE OR REPLACE FUNCTION public.member_action(
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  wid uuid;
  cid uuid;
  v_id uuid;
  v_page integer := 1;
  v_count integer := 1;
  v_read public.reading;
  v_session public.reading_sessions;
  v_comment_id uuid;
  v_title_id text;
  v_badge_id text;
  v_req_level int;
  v_xp int;
  v_level int;
  v_fav boolean;
  v_status text;
  v_completed boolean := false;
  v_res jsonb := jsonb_build_object('awarded', false);
  v_target_user_id uuid;
  v_comment_body text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Entre em sua conta' USING errcode = '42501';
  END IF;

  IF NOT public.is_member() THEN
    RAISE EXCEPTION 'Entre em uma conta confirmada e ativa' USING errcode = '42501';
  END IF;

  -- 1. PROFILE UPDATE
  IF p_action = 'profile' THEN
    UPDATE public.members
    SET
      username = coalesce(nullif(lower(trim(p_data->>'username')), ''), username),
      display_name = coalesce(nullif(trim(p_data->>'display_name'), ''), display_name),
      bio = coalesce(p_data->>'bio', bio)
    WHERE id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 2. EQUIP TITLE
  ELSIF p_action = 'equip_title' THEN
    v_title_id := nullif(trim(coalesce(p_data->>'title_id', '')), '');
    IF v_title_id IS NULL OR v_title_id = 'none' THEN
      UPDATE public.members SET equipped_title_id = null, manual_title = true WHERE id = uid;
      RETURN jsonb_build_object('ok', true, 'equipped_title_id', null);
    END IF;

    -- Achievement level requirements (Levels 1 to 100)
    v_req_level := CASE v_title_id
      WHEN 'titulo-nv1-centelha-veu' THEN 1
      WHEN 'titulo-nv10-tecelao-sombras' THEN 10
      WHEN 'titulo-nv20-peregrino-eter' THEN 20
      WHEN 'titulo-nv30-sentinela-eclipse' THEN 30
      WHEN 'titulo-nv40-geometra-constelacoes' THEN 40
      WHEN 'titulo-nv50-hierofante-abismo' THEN 50
      WHEN 'titulo-nv60-suserano-noite' THEN 60
      WHEN 'titulo-nv70-oraculo-singularidade' THEN 70
      WHEN 'titulo-nv80-arconte-primordial' THEN 80
      WHEN 'titulo-nv90-soberano-supremo' THEN 90
      WHEN 'titulo-nv100-apex-nox' THEN 100
      WHEN 'nox-reader' THEN 1
      WHEN 'iniciado-nox' THEN 1
      WHEN 'aficionado' THEN 5
      WHEN 'colecionador' THEN 10
      WHEN 'curador' THEN 15
      WHEN 'bibliofilo' THEN 20
      WHEN 'vanguarda' THEN 30
      WHEN 'virtuoso' THEN 40
      WHEN 'eminencia' THEN 50
      WHEN 'monolito' THEN 60
      WHEN 'luminar' THEN 70
      WHEN 'primor' THEN 80
      WHEN 'zenite' THEN 90
      WHEN 'apex-nox' THEN 100
      ELSE null
    END;

    SELECT coalesce(season_xp, xp, 0) INTO v_xp FROM public.members WHERE id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    IF v_req_level IS NOT NULL THEN
      IF v_level < v_req_level THEN
        RAISE EXCEPTION 'Você precisa atingir o nível % para equipar este título.', v_req_level USING errcode = '42501';
      END IF;
      INSERT INTO public.member_inventory(user_id, item_id, origin)
      VALUES (uid, v_title_id, 'ACHIEVEMENT')
      ON CONFLICT (user_id, item_id) DO NOTHING;

      UPDATE public.members SET equipped_title_id = v_title_id, manual_title = true WHERE id = uid;
      RETURN jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);
    END IF;

    IF EXISTS(SELECT 1 FROM public.member_inventory WHERE user_id = uid AND (item_id = v_title_id OR item_id = split_part(v_title_id, ':', 1)))
       OR EXISTS(SELECT 1 FROM public.shop_items WHERE (id = v_title_id OR id = split_part(v_title_id, ':', 1)) AND (price_xp = 0 OR kind = 'TITLE')) THEN
      INSERT INTO public.member_inventory(user_id, item_id, origin)
      VALUES (uid, split_part(v_title_id, ':', 1), 'EVENT')
      ON CONFLICT (user_id, item_id) DO NOTHING;

      UPDATE public.members SET equipped_title_id = v_title_id, manual_title = true WHERE id = uid;
      RETURN jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);
    ELSE
      RAISE EXCEPTION 'Título não adquirido ou nível insuficiente.' USING errcode = '42501';
    END IF;

  -- 3. EQUIP BADGE
  ELSIF p_action = 'equip_badge' THEN
    v_badge_id := nullif(trim(coalesce(p_data->>'badge_id', '')), '');
    IF v_badge_id IS NULL OR v_badge_id = 'none' THEN
      UPDATE public.members SET equipped_badge_id = null, manual_badge = true WHERE id = uid;
      RETURN jsonb_build_object('ok', true, 'equipped_badge_id', null);
    END IF;

    v_req_level := CASE v_badge_id
      WHEN 'marca-inicial' THEN 1
      WHEN 'chama-novica' THEN 5
      WHEN 'prisma-noturno' THEN 10
      WHEN 'sigilo-prateado' THEN 20
      WHEN 'reliquia-astral' THEN 35
      WHEN 'coroa-de-onix' THEN 50
      WHEN 'olho-do-eter' THEN 75
      WHEN 'brasao-apex' THEN 100
      ELSE null
    END;

    IF v_req_level IS NULL THEN
      RAISE EXCEPTION 'Insígnia inválida.' USING errcode = '22023';
    END IF;

    SELECT coalesce(season_xp, xp, 0) INTO v_xp FROM public.members WHERE id = uid;
    v_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, coalesce(v_xp, 0)) / 50.0))));

    IF v_level < v_req_level THEN
      RAISE EXCEPTION 'Você precisa atingir o nível % para equipar esta insígnia.', v_req_level USING errcode = '42501';
    END IF;

    UPDATE public.members SET equipped_badge_id = v_badge_id, manual_badge = true WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'equipped_badge_id', v_badge_id);

  -- 4. EQUIP FRAME
  ELSIF p_action = 'equip' THEN
    IF (p_data->>'clear')::boolean THEN
      UPDATE public.members
      SET avatar_frame_id = null, equipped_badge_id = null, equipped_title_id = null
      WHERE id = uid;
      RETURN jsonb_build_object('ok', true);
    END IF;

    v_id := (p_data->>'frame_id')::uuid;
    IF v_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.media WHERE id = v_id AND created_by = uid AND purpose = 'avatar_frame'
    ) THEN
      RAISE EXCEPTION 'Moldura inválida';
    END IF;

    UPDATE public.members SET avatar_frame_id = v_id::text WHERE id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 5. NOTIFICATIONS
  ELSIF p_action = 'notifications' THEN
    UPDATE public.notifications SET read_at = now() WHERE user_id = uid AND read_at IS NULL;
    RETURN jsonb_build_object('ok', true);

  -- 6. PREFERENCES
  ELSIF p_action = 'preferences' THEN
    UPDATE public.members
    SET
      age_status = COALESCE(p_data->>'age_status', age_status),
      blur_nsfw = COALESCE((p_data->>'blur_nsfw')::boolean, blur_nsfw)
    WHERE id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 7. CLEAR HISTORY
  ELSIF p_action = 'clear_history' THEN
    DELETE FROM public.reading WHERE user_id = uid;
    DELETE FROM public.reading_sessions WHERE user_id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 8. COMMENT LIKE
  ELSIF p_action = 'comment_like' THEN
    v_id := (p_data->>'id')::uuid;
    IF v_id IS NULL THEN
      v_id := (p_data->>'comment_id')::uuid;
    END IF;

    IF NOT EXISTS(
      SELECT 1 FROM public.comments c
      JOIN public.works w ON w.id = c.work_id
      WHERE c.id = v_id AND NOT c.removed AND w.published
        AND (c.chapter_id IS NULL OR public.public_chapter(c.chapter_id))
    ) THEN
      RAISE EXCEPTION 'Comentário indisponível';
    END IF;

    SELECT user_id INTO v_target_user_id FROM public.comments WHERE id = v_id;
    IF v_target_user_id = uid THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_like_prohibited');
    END IF;

    DELETE FROM public.comment_likes WHERE user_id = uid AND comment_id = v_id;
    IF NOT FOUND THEN
      INSERT INTO public.comment_likes VALUES (uid, v_id);
      v_res := public.award_xp('COMMENT_LIKE', v_id::text, jsonb_build_object('description', 'Curtida em comentário'));
      RETURN jsonb_build_object('ok', true, 'liked', true, 'xp_award', v_res);
    ELSE
      RETURN jsonb_build_object('ok', true, 'liked', false);
    END IF;

  -- 9. ACTIONS TIED TO WORK (library, like, comment, read_*, claim_xp, rate_work)
  ELSE
    wid := (p_data->>'work_id')::uuid;
    IF wid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.works WHERE id = wid) THEN
      INSERT INTO public.works (id, slug, title, published, kind, status, content_rating)
      VALUES (
        wid,
        coalesce(nullif(regexp_replace(lower(coalesce(p_data->>'work_slug', wid::text)), '[^a-z0-9]+', '-', 'g'), ''), 'obra-' || substr(wid::text, 1, 8)),
        coalesce(nullif(p_data->>'work_title', ''), 'Obra'),
        true,
        'MANHWA',
        'ONGOING',
        'GENERAL'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 9.1 LIBRARY / FAVORITE ACTION
    IF p_action = 'library' THEN
      v_fav := coalesce((p_data->>'favorite')::boolean, false);
      v_status := coalesce(p_data->>'status', 'READING');

      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
      END IF;

      INSERT INTO public.library(user_id, work_id, status, favorite, following, updated_at)
      VALUES(
        uid,
        wid,
        v_status,
        v_fav,
        coalesce((p_data->>'following')::boolean, true),
        now()
      )
      ON CONFLICT (user_id, work_id) DO UPDATE
      SET
        status = excluded.status,
        favorite = excluded.favorite,
        following = excluded.following,
        updated_at = now();

      IF v_status = 'COMPLETED' THEN
        INSERT INTO public.notifications(user_id, kind, body, href, dedupe_key)
        SELECT uid, 'achievement', 'Você concluiu ' || title || '! Mais uma grande história na sua jornada.', '/obra/' || slug, 'completed:' || wid
        FROM public.works WHERE id = wid
        ON CONFLICT DO NOTHING;
      END IF;

      -- Award XP if favorited
      IF v_fav THEN
        v_res := public.award_xp(
          'FAVORITE_WORK',
          wid::text,
          jsonb_build_object('description', 'Obra favoritada', 'work_id', wid)
        );
      ELSE
        v_res := jsonb_build_object('awarded', false);
      END IF;

      RETURN jsonb_build_object('ok', true, 'favorite', v_fav, 'status', v_status, 'xp_award', v_res);

    -- 9.2 WORK LIKE ACTION (TOGGLE + XP)
    ELSIF p_action = 'like' THEN
      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
      END IF;

      IF EXISTS(SELECT 1 FROM public.likes WHERE user_id = uid AND work_id = wid) THEN
        DELETE FROM public.likes WHERE user_id = uid AND work_id = wid;
        RETURN jsonb_build_object('ok', true, 'liked', false);
      ELSE
        INSERT INTO public.likes(user_id, work_id)
        VALUES (uid, wid)
        ON CONFLICT (user_id, work_id) DO NOTHING;

        v_res := public.award_xp(
          'LIKE_WORK',
          wid::text,
          jsonb_build_object('description', 'Obra curtida', 'work_id', wid)
        );

        RETURN jsonb_build_object('ok', true, 'liked', true, 'xp_award', v_res);
      END IF;

    -- 9.3 COMMENT ACTION
    ELSIF p_action = 'comment' THEN
      v_comment_body := trim(coalesce(p_data->>'body', ''));
      IF length(v_comment_body) < 1 OR length(v_comment_body) > 2000 THEN
        RAISE EXCEPTION 'Comentário deve ter entre 1 e 2000 caracteres';
      END IF;

      IF EXISTS(SELECT 1 FROM public.comments WHERE user_id = uid AND created_at > now() - interval '30 seconds') THEN
        RAISE EXCEPTION 'Aguarde 30 segundos para comentar novamente';
      END IF;
      IF (SELECT count(*) FROM public.comments WHERE user_id = uid AND created_at > now() - interval '1 day') >= 100 THEN
        RAISE EXCEPTION 'Limite diário de comentários atingido';
      END IF;

      cid := (p_data->>'chapter_id')::uuid;
      IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.chapters WHERE id = cid AND work_id = wid AND public.public_chapter(id)) THEN
        RAISE EXCEPTION 'Capítulo indisponível';
      END IF;

      v_id := (p_data->>'parent_id')::uuid;
      IF v_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.comments WHERE id = v_id AND work_id = wid AND chapter_id IS NOT DISTINCT FROM cid AND NOT removed AND parent_id IS NULL) THEN
        RAISE EXCEPTION 'Resposta inválida';
      END IF;

      INSERT INTO public.comments(user_id, work_id, chapter_id, parent_id, body)
      VALUES (uid, wid, cid, v_id, v_comment_body)
      RETURNING id INTO v_comment_id;

      IF v_id IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, kind, body, href, dedupe_key)
        SELECT user_id, 'reply', 'Uma nova resposta ao seu comentário.',
          CASE WHEN cid IS NOT NULL THEN '/ler/' || cid ELSE '/obra/' || (SELECT slug FROM public.works WHERE id = wid) END,
          'reply:' || v_comment_id
        FROM public.comments WHERE id = v_id AND user_id <> uid
        ON CONFLICT DO NOTHING;
      END IF;

      -- Award genuine comment XP
      IF v_id IS NULL AND length(v_comment_body) >= 15 THEN
        v_res := public.award_xp('COMMENT', v_comment_id::text, jsonb_build_object('description', 'Comentário publicado', 'work_id', wid));
      ELSIF v_id IS NOT NULL AND length(v_comment_body) >= 10 THEN
        v_res := public.award_xp('REPLY', v_comment_id::text, jsonb_build_object('description', 'Resposta enviada', 'work_id', wid));
      END IF;

      RETURN jsonb_build_object('ok', true, 'id', v_comment_id, 'xp_award', v_res);

    -- 9.4 READING PROGRESS (read_start, read_page)
    ELSIF p_action IN ('read_start', 'read_page') THEN
      cid := (p_data->>'chapter_id')::uuid;
      IF cid IS NULL THEN
        RAISE EXCEPTION 'chapter_id obrigatório';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM public.chapters WHERE id = cid AND (wid IS NULL OR work_id = wid) AND public.public_chapter(id)) THEN
        RAISE EXCEPTION 'Capítulo indisponível';
      END IF;

      SELECT count(*) INTO v_count FROM public.pages WHERE chapter_id = cid;
      IF v_count = 0 THEN
        v_count := GREATEST(1, coalesce((p_data->>'total_pages')::integer, 1));
      END IF;

      INSERT INTO public.reading(user_id, chapter_id, work_id, page, max_page, started_at, updated_at)
      VALUES (uid, cid, wid, 1, 1, now(), now())
      ON CONFLICT (user_id, chapter_id) DO UPDATE SET
        work_id = coalesce(public.reading.work_id, excluded.work_id),
        updated_at = now();

      INSERT INTO public.reading_sessions(user_id, chapter_id, next_page, accepted_at)
      VALUES (uid, cid, 2, now())
      ON CONFLICT (user_id, chapter_id) DO UPDATE SET
        accepted_at = now();

      SELECT * INTO v_read FROM public.reading WHERE user_id = uid AND chapter_id = cid FOR UPDATE;
      SELECT * INTO v_session FROM public.reading_sessions WHERE user_id = uid AND chapter_id = cid FOR UPDATE;

      IF p_action = 'read_page' THEN
        v_page := (p_data->>'page')::integer;
        IF v_page < 1 OR v_page > v_count + 1 THEN
          RAISE EXCEPTION 'Página inválida';
        END IF;

        UPDATE public.reading
        SET page = v_page, max_page = greatest(max_page, v_page), updated_at = now()
        WHERE user_id = uid AND chapter_id = cid;

        IF v_page >= v_session.next_page AND now() - v_session.accepted_at >= interval '2 seconds' THEN
          UPDATE public.reading_sessions
          SET next_page = greatest(next_page, v_page + 1), accepted_at = now()
          WHERE user_id = uid AND chapter_id = cid;
        END IF;

        v_completed := (v_page >= v_count OR coalesce((p_data->>'completed')::boolean, false))
          AND v_read.completed_at IS NULL
          AND EXISTS(SELECT 1 FROM public.reading_sessions WHERE user_id = uid AND chapter_id = cid AND next_page > 1)
          AND (now() - v_read.started_at >= 15 * interval '1 second');

        IF v_completed THEN
          UPDATE public.reading
          SET completed_at = now(), page = v_count, max_page = v_count, updated_at = now()
          WHERE user_id = uid AND chapter_id = cid;

          v_res := public.award_xp(
            'READ_CHAPTER',
            cid::text,
            jsonb_build_object('work_id', wid, 'description', 'Capítulo concluído')
          );
        END IF;
      END IF;

      RETURN jsonb_build_object('ok', true, 'completed', v_completed, 'page', v_page, 'xp_award', v_res);

    -- 9.5 CLAIM XP FOR CHAPTER
    ELSIF p_action = 'claim_xp' THEN
      cid := (p_data->>'chapter_id')::uuid;
      IF cid IS NULL THEN
        RAISE EXCEPTION 'chapter_id obrigatório';
      END IF;

      v_res := public.award_xp(
        'READ_CHAPTER',
        cid::text,
        jsonb_build_object('work_id', wid, 'description', 'Capítulo concluído')
      );
      RETURN jsonb_build_object('ok', true, 'xp_award', v_res);

    -- 9.6 RATE WORK
    ELSIF p_action = 'rate_work' THEN
      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório';
      END IF;

      v_res := public.award_xp(
        'RATE_WORK',
        wid::text,
        jsonb_build_object('description', 'Avaliação registrada', 'work_id', wid)
      );
      RETURN jsonb_build_object('ok', true, 'xp_award', v_res);

    ELSE
      RAISE EXCEPTION 'Ação desconhecida: %', p_action USING errcode = '22023';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_action(text, jsonb) TO authenticated;
