-- Migration: 20261028183000_restore_comment_delete_and_edit_rpc.sql
-- Description: Restore comment_delete and comment_edit in member_action RPC with strict permission guards and audit tracking

CREATE OR REPLACE FUNCTION public.member_action(
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  wid uuid;
  cid uuid;
  v_id uuid;
  v_comment_id uuid;
  v_comment_body text;
  v_title_id text;
  v_badge_id text;
  v_page integer;
  v_count integer;
  v_res jsonb;
  v_read public.reading;
  v_session public.reading_sessions;
  v_fav boolean;
  v_status text;
  v_completed boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
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

    IF NOT EXISTS(
      SELECT 1 FROM public.member_inventory WHERE user_id = uid AND (catalog_item_id::text = v_title_id OR item_id = v_title_id)
    ) AND NOT EXISTS(
      SELECT 1 FROM public.member_achievements WHERE user_id = uid AND achievement_id = v_title_id
    ) AND NOT EXISTS(
      SELECT 1 FROM public.ranking_hall_of_fame WHERE user_id = uid AND (title_reward = v_title_id OR tier = v_title_id)
    ) THEN
      RAISE EXCEPTION 'Título não adquirido';
    END IF;

    UPDATE public.members SET equipped_title_id = v_title_id, manual_title = true WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'equipped_title_id', v_title_id);

  -- 3. EQUIP BADGE
  ELSIF p_action = 'equip_badge' THEN
    v_badge_id := nullif(trim(coalesce(p_data->>'badge_id', '')), '');
    IF v_badge_id IS NULL OR v_badge_id = 'none' THEN
      UPDATE public.members SET equipped_badge_id = null WHERE id = uid;
      RETURN jsonb_build_object('ok', true, 'equipped_badge_id', null);
    END IF;

    IF NOT EXISTS(
      SELECT 1 FROM public.member_inventory WHERE user_id = uid AND (catalog_item_id::text = v_badge_id OR item_id = v_badge_id)
    ) AND NOT EXISTS(
      SELECT 1 FROM public.member_achievements WHERE user_id = uid AND achievement_id = v_badge_id
    ) AND NOT EXISTS(
      SELECT 1 FROM public.ranking_hall_of_fame WHERE user_id = uid AND (badge_reward = v_badge_id OR tier = v_badge_id)
    ) THEN
      RAISE EXCEPTION 'Insígnia não adquirida';
    END IF;

    UPDATE public.members SET equipped_badge_id = v_badge_id WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'equipped_badge_id', v_badge_id);

  -- 4. EQUIP COSMETIC (frame, banner, comment_banner, name_color)
  ELSIF p_action = 'equip' THEN
    v_id := (p_data->>'item_id')::uuid;
    IF v_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.member_inventory WHERE user_id = uid AND (catalog_item_id = v_id OR item_id = v_id::text)
    ) THEN
      RAISE EXCEPTION 'Item não adquirido';
    END IF;

    IF p_data->>'slot' = 'frame' THEN
      UPDATE public.members SET frame_id = v_id WHERE id = uid;
    ELSIF p_data->>'slot' = 'banner' THEN
      UPDATE public.members SET banner_id = v_id WHERE id = uid;
    ELSIF p_data->>'slot' = 'comment_banner' THEN
      UPDATE public.members SET comment_banner_id = v_id WHERE id = uid;
    ELSIF p_data->>'slot' = 'name_color' THEN
      UPDATE public.members SET name_color = nullif(p_data->>'value', '') WHERE id = uid;
    END IF;
    RETURN jsonb_build_object('ok', true);

  -- 5. NOTIFICATIONS READ
  ELSIF p_action = 'notifications' THEN
    IF p_data->>'id' = 'all' THEN
      UPDATE public.notifications SET read_at = now() WHERE user_id = uid AND read_at IS NULL;
    ELSE
      UPDATE public.notifications SET read_at = now() WHERE user_id = uid AND id = (p_data->>'id')::uuid;
    END IF;
    RETURN jsonb_build_object('ok', true);

  -- 6. PREFERENCES
  ELSIF p_action = 'preferences' THEN
    UPDATE public.members
    SET preferences = coalesce(preferences, '{}'::jsonb) || (p_data->'preferences')
    WHERE id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 7. CLEAR HISTORY
  ELSIF p_action = 'clear_history' THEN
    DELETE FROM public.reading WHERE user_id = uid;
    DELETE FROM public.reading_sessions WHERE user_id = uid;
    RETURN jsonb_build_object('ok', true);

  -- 8. COMMENT LIKE
  ELSIF p_action = 'comment_like' THEN
    v_id := (p_data->>'comment_id')::uuid;
    IF v_id IS NULL THEN
      v_id := (p_data->>'id')::uuid;
    END IF;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'comment_id obrigatório' USING errcode = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.id = v_id
        AND NOT coalesce(c.removed, false)
        AND (c.chapter_id IS NULL OR public.public_chapter(c.chapter_id))
    ) THEN
      IF EXISTS(SELECT 1 FROM public.comment_likes WHERE user_id = uid AND comment_id = v_id) THEN
        DELETE FROM public.comment_likes WHERE user_id = uid AND comment_id = v_id;
        RETURN jsonb_build_object('ok', true, 'liked', false);
      ELSE
        INSERT INTO public.comment_likes(user_id, comment_id) VALUES(uid, v_id)
        ON CONFLICT DO NOTHING;
        v_res := public.award_xp('COMMENT_LIKE', v_id::text, jsonb_build_object('comment_id', v_id));
        RETURN jsonb_build_object('ok', true, 'liked', true, 'xp_award', v_res);
      END IF;
    ELSE
      RAISE EXCEPTION 'Comentário indisponível' USING errcode = 'P0001';
    END IF;

  -- 8.1 COMMENT DELETE (RESTORED WITH STRICT GUARDS & AUDIT)
  ELSIF p_action = 'comment_delete' THEN
    v_id := (p_data->>'id')::uuid;
    IF v_id IS NULL THEN
      v_id := (p_data->>'comment_id')::uuid;
    END IF;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'id do comentário obrigatório' USING errcode = '22023';
    END IF;

    -- Allow author OR staff/editor to delete
    UPDATE public.comments
    SET
      removed = true,
      deleted = true,
      deleted_at = now(),
      updated_at = now()
    WHERE id = v_id
      AND (user_id = uid OR public.is_editor())
      AND NOT coalesce(removed, false);

    IF NOT FOUND THEN
      IF EXISTS(SELECT 1 FROM public.comments WHERE id = v_id) THEN
        RAISE EXCEPTION 'Você não tem permissão para excluir este comentário' USING errcode = '42501';
      ELSE
        RAISE EXCEPTION 'Comentário indisponível' USING errcode = 'P0001';
      END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'deleted_id', v_id);

  -- 8.2 COMMENT EDIT (RESTORED)
  ELSIF p_action = 'comment_edit' THEN
    v_id := (p_data->>'id')::uuid;
    IF v_id IS NULL THEN
      v_id := (p_data->>'comment_id')::uuid;
    END IF;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'id do comentário obrigatório' USING errcode = '22023';
    END IF;

    v_comment_body := trim(coalesce(p_data->>'body', ''));
    IF length(v_comment_body) < 1 OR length(v_comment_body) > 2000 THEN
      RAISE EXCEPTION 'Comentário deve ter entre 1 e 2000 caracteres' USING errcode = '22023';
    END IF;

    UPDATE public.comments
    SET
      body = v_comment_body,
      updated_at = now()
    WHERE id = v_id
      AND (user_id = uid OR public.is_editor())
      AND NOT coalesce(removed, false);

    IF NOT FOUND THEN
      IF EXISTS(SELECT 1 FROM public.comments WHERE id = v_id) THEN
        RAISE EXCEPTION 'Você não tem permissão para editar este comentário' USING errcode = '42501';
      ELSE
        RAISE EXCEPTION 'Comentário indisponível' USING errcode = 'P0001';
      END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);

  -- 9. ACTIONS REQUIRING WORK/CHAPTER CONTEXT
  ELSE
    wid := (p_data->>'work_id')::uuid;
    cid := (p_data->>'chapter_id')::uuid;

    -- Opportunistic Work Bridge
    IF wid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.works WHERE id = wid) THEN
      INSERT INTO public.works (id, slug, title, published, content_rating, kind, status)
      VALUES (
        wid,
        coalesce(nullif(trim(p_data->>'work_slug'), ''), 'obra-' || substr(wid::text, 1, 8)),
        coalesce(nullif(trim(p_data->>'work_title'), ''), 'Obra'),
        true,
        'GENERAL',
        'MANHWA',
        'ONGOING'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Opportunistic Chapter Bridge
    IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.chapters WHERE id = cid) THEN
      IF wid IS NULL THEN
        wid := '00000000-0000-0000-0000-000000000000'::uuid;
      END IF;

      INSERT INTO public.chapters (
        id, work_id, number, title, published_at, origin, edition, language
      )
      VALUES (
        cid,
        wid,
        coalesce((p_data->>'chapter_number')::numeric, 1),
        coalesce(nullif(trim(p_data->>'chapter_title'), ''), 'Capítulo ' || coalesce(p_data->>'display_number', '1')),
        now(),
        'MANUAL',
        'default',
        'und'
      )
      ON CONFLICT (id) DO UPDATE SET
        published_at = coalesce(public.chapters.published_at, now());
    END IF;

    -- 9.1 LIBRARY / FAVORITE ACTION
    IF p_action = 'library' THEN
      v_fav := coalesce((p_data->>'favorite')::boolean, false);
      v_status := coalesce(p_data->>'status', 'READING');

      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
      END IF;

      INSERT INTO public.library(user_id, work_id, status, favorite, following, updated_at)
      VALUES(uid, wid, v_status, v_fav, coalesce((p_data->>'following')::boolean, true), now())
      ON CONFLICT(user_id, work_id)
      DO UPDATE SET
        status = excluded.status,
        favorite = excluded.favorite,
        following = excluded.following,
        updated_at = now();

      IF v_fav THEN
        v_res := public.award_xp('BOOKMARK_WORK', wid::text, jsonb_build_object('work_id', wid));
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
        INSERT INTO public.likes(user_id, work_id) VALUES(uid, wid);
        v_res := public.award_xp('FAVORITE_WORK', wid::text, jsonb_build_object('work_id', wid));
        RETURN jsonb_build_object('ok', true, 'liked', true, 'xp_award', v_res);
      END IF;

    -- 9.3 COMMENT ACTION
    ELSIF p_action = 'comment' THEN
      v_comment_body := trim(coalesce(p_data->>'body', ''));
      IF length(v_comment_body) < 1 OR length(v_comment_body) > 2000 THEN
        RAISE EXCEPTION 'Comentário deve ter entre 1 e 2000 caracteres';
      END IF;

      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
      END IF;

      IF cid IS NOT NULL AND NOT public.public_chapter(cid) THEN
        RAISE EXCEPTION 'Capítulo indisponível' USING errcode = 'P0001';
      END IF;

      v_id := (p_data->>'parent_id')::uuid;
      IF v_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM public.comments
        WHERE id = v_id AND work_id = wid AND chapter_id IS NOT DISTINCT FROM cid AND NOT coalesce(removed, false) AND parent_id IS NULL
      ) THEN
        RAISE EXCEPTION 'Resposta inválida';
      END IF;

      INSERT INTO public.comments(user_id, work_id, chapter_id, parent_id, body)
      VALUES (uid, wid, cid, v_id, v_comment_body)
      RETURNING id INTO v_comment_id;

      IF v_id IS NOT NULL THEN
        v_res := public.award_xp('REPLY_COMMENT', v_comment_id::text, jsonb_build_object('comment_id', v_comment_id, 'parent_id', v_id));
      ELSE
        v_res := public.award_xp('POST_COMMENT', v_comment_id::text, jsonb_build_object('comment_id', v_comment_id));
      END IF;

      RETURN jsonb_build_object('ok', true, 'id', v_comment_id, 'xp_award', v_res);

    -- 9.4 READING PROGRESS (read_start, read_page)
    ELSIF p_action IN ('read_start', 'read_page') THEN
      cid := (p_data->>'chapter_id')::uuid;
      IF cid IS NULL THEN
        RAISE EXCEPTION 'chapter_id obrigatório';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM public.chapters WHERE id = cid AND (wid IS NULL OR work_id = wid) AND public.public_chapter(id)) THEN
        RAISE EXCEPTION 'Capítulo indisponível' USING errcode = 'P0001';
      END IF;

      SELECT count INTO v_count FROM public.chapter_pages WHERE chapter_id = cid;
      IF v_count IS NULL OR v_count < 1 THEN
        v_count := 1;
      END IF;

      INSERT INTO public.reading_sessions(user_id, chapter_id, started_at, accepted_at)
      VALUES (uid, cid, now(), now())
      ON CONFLICT (user_id, chapter_id)
      DO UPDATE SET
        accepted_at = now();

      SELECT * INTO v_read FROM public.reading WHERE user_id = uid AND chapter_id = cid FOR UPDATE;
      SELECT * INTO v_session FROM public.reading_sessions WHERE user_id = uid AND chapter_id = cid FOR UPDATE;

      IF p_action = 'read_page' THEN
        v_page := coalesce((p_data->>'page')::integer, 1);
        v_completed := coalesce((p_data->>'completed')::boolean, false) OR (v_page >= v_count);

        IF v_session.accepted_at > now() - interval '200 milliseconds' THEN
          -- Throttled silently
        ELSE
          UPDATE public.reading_sessions SET accepted_at = now() WHERE user_id = uid AND chapter_id = cid;
        END IF;

        IF v_completed THEN
          v_res := public.award_xp('COMPLETE_CHAPTER', cid::text, jsonb_build_object('chapter_id', cid, 'work_id', wid));
        END IF;
      ELSE
        v_page := 1;
        v_completed := false;
      END IF;

      INSERT INTO public.reading(user_id, chapter_id, page, completed, updated_at)
      VALUES (uid, cid, v_page, v_completed, now())
      ON CONFLICT (user_id, chapter_id)
      DO UPDATE SET
        page = GREATEST(public.reading.page, excluded.page),
        completed = public.reading.completed OR excluded.completed,
        updated_at = now();

      RETURN jsonb_build_object(
        'ok', true,
        'page', v_page,
        'completed', v_completed,
        'xp_award', v_res
      );

    -- 9.5 CLAIM DAILY XP
    ELSIF p_action = 'claim_xp' THEN
      v_res := public.award_xp('DAILY_LOGIN', uid::text || ':' || CURRENT_DATE::text, jsonb_build_object('description', 'Recompensa diária coletada'));
      RETURN jsonb_build_object('ok', true, 'xp_award', v_res);

    -- 9.6 RATE WORK
    ELSIF p_action = 'rate_work' THEN
      IF wid IS NULL THEN
        RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
      END IF;
      v_page := coalesce((p_data->>'rating')::integer, 0);
      IF v_page < 1 OR v_page > 5 THEN
        RAISE EXCEPTION 'Avaliação inválida (1 a 5)';
      END IF;

      INSERT INTO public.ratings (user_id, work_id, rating, updated_at)
      VALUES (uid, wid, v_page, now())
      ON CONFLICT (user_id, work_id)
      DO UPDATE SET rating = excluded.rating, updated_at = now();

      v_res := public.award_xp('RATE_WORK', wid::text, jsonb_build_object('description', 'Obra avaliada', 'work_id', wid));
      RETURN jsonb_build_object('ok', true, 'rating', v_page, 'xp_award', v_res);

    ELSE
      RAISE EXCEPTION 'Ação não reconhecida: %', p_action USING errcode = '22023';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.member_action(text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.member_action(text, jsonb) TO authenticated;
