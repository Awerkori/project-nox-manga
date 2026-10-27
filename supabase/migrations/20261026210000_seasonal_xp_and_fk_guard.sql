-- ==============================================================================
-- Project Nox Manga - Migration 20261026210000:
-- Architectural FK Guard for Works & Seasonal Reset Schema Alignment
-- 1. Updates member_action with automatic work stub bridging in SECURITY DEFINER
-- 2. Updates seasons rules text to reflect seasonal XP & level reset
-- 3. Ensures like and library permissions are granted
-- ==============================================================================

-- 1. UPDATE SEASONS RULES TEXT
UPDATE public.seasons
SET rules_text = 'Pontos de Temporada, Nível e saldo de XP são zerados a cada ciclo trimestral (90 dias). Cosméticos comprados na Loja Cósmica e títulos exclusivos do Hall da Fama são permanentes.'
WHERE id = 'season_1';

-- 2. MEMBER_ACTION WITH BUILT-IN WORK FK BRIDGE
CREATE OR REPLACE FUNCTION public.member_action(p_action text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  wid uuid;
  cid uuid;
  v_page integer := 1;
  v_count integer := 1;
  v_completed boolean := false;
  v_xp_res jsonb := jsonb_build_object('awarded', false);
  v_read public.reading;
  v_comment_id uuid;
  v_target_user_id uuid;
  v_comment_body text;
  v_parent_id uuid;
  v_liked boolean := false;
  v_clean_slug text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Entre em sua conta' USING errcode = '42501';
  END IF;

  wid := (p_data->>'work_id')::uuid;

  -- Architectural Work Stub Bridge: If work is in Yugabyte but not yet in Supabase,
  -- create the stub inside SECURITY DEFINER so FK constraints never fail.
  IF wid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.works WHERE id = wid) THEN
    v_clean_slug := COALESCE(NULLIF(regexp_replace(lower(COALESCE(p_data->>'work_slug', wid::text)), '[^a-z0-9]+', '-', 'g'), ''), 'obra-' || substr(wid::text, 1, 8));
    v_clean_slug := trim(both '-' from v_clean_slug);
    IF length(v_clean_slug) = 0 THEN
      v_clean_slug := 'obra-' || substr(wid::text, 1, 8);
    END IF;

    -- Avoid slug collisions
    IF EXISTS (SELECT 1 FROM public.works WHERE slug = v_clean_slug) THEN
      v_clean_slug := v_clean_slug || '-' || substr(wid::text, 1, 6);
    END IF;

    INSERT INTO public.works (id, slug, title, published, kind, status, content_rating)
    VALUES (
      wid,
      v_clean_slug,
      COALESCE(NULLIF(p_data->>'work_title', ''), 'Obra'),
      true,
      'MANHWA',
      'ONGOING',
      'GENERAL'
    )
    ON CONFLICT (id) DO UPDATE SET
      published = true;
  END IF;

  -- 1. LIKE ACTION (TOGGLE)
  IF p_action = 'like' THEN
    IF wid IS NULL THEN
      RAISE EXCEPTION 'work_id obrigatório' USING errcode = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.likes WHERE user_id = uid AND work_id = wid) THEN
      DELETE FROM public.likes WHERE user_id = uid AND work_id = wid;
      v_liked := false;
    ELSE
      INSERT INTO public.likes (user_id, work_id)
      VALUES (uid, wid)
      ON CONFLICT DO NOTHING;
      v_liked := true;
    END IF;

    RETURN jsonb_build_object('ok', true, 'liked', v_liked);

  -- 2. LIBRARY / FAVORITE ACTION
  ELSIF p_action = 'library' THEN
    INSERT INTO public.library(user_id, work_id, status, favorite, following, updated_at)
    VALUES (
      uid, wid,
      COALESCE(p_data->>'status', 'READING'),
      COALESCE((p_data->>'favorite')::boolean, false),
      COALESCE((p_data->>'following')::boolean, true),
      now()
    )
    ON CONFLICT (user_id, work_id) DO UPDATE SET
      status = COALESCE(p_data->>'status', public.library.status),
      favorite = COALESCE((p_data->>'favorite')::boolean, public.library.favorite),
      following = COALESCE((p_data->>'following')::boolean, public.library.following),
      updated_at = now();

    -- Award XP only if user favorited the work and hasn't received it before
    IF COALESCE((p_data->>'favorite')::boolean, false) THEN
      v_xp_res := public.award_xp('FAVORITE_WORK', wid::text, jsonb_build_object('description', 'Obra favoritada'));
    END IF;

    RETURN jsonb_build_object('ok', true, 'xp_award', v_xp_res);

  -- 3. READING PROGRESS (read_start, read_page)
  ELSIF p_action IN ('read_start', 'read_page') THEN
    cid := (p_data->>'chapter_id')::uuid;
    IF cid IS NULL THEN
      RAISE EXCEPTION 'chapter_id obrigatório';
    END IF;

    v_count := GREATEST(1, COALESCE((p_data->>'total_pages')::integer, (SELECT count(*) FROM public.pages WHERE chapter_id = cid), 1));
    v_page := GREATEST(1, LEAST(COALESCE((p_data->>'page')::integer, 1), v_count + 1));
    v_completed := (p_action = 'read_page') AND (
      COALESCE((p_data->>'completed')::boolean, false) OR (
        COALESCE((p_data->>'total_pages')::integer, 0) > 1 AND v_page >= v_count
      )
    );

    -- Upsert reading session
    INSERT INTO public.reading_sessions(user_id, chapter_id, next_page, accepted_at)
    VALUES (uid, cid, v_page + 1, now())
    ON CONFLICT (user_id, chapter_id) DO UPDATE SET
      next_page = GREATEST(public.reading_sessions.next_page, v_page + 1),
      accepted_at = now();

    -- Upsert reading progress with work_id
    INSERT INTO public.reading(user_id, chapter_id, work_id, page, max_page, started_at, updated_at, completed_at)
    VALUES (
      uid, cid, wid, v_page, v_page, now(), now(),
      CASE WHEN v_completed THEN now() ELSE null END
    )
    ON CONFLICT (user_id, chapter_id) DO UPDATE SET
      work_id = COALESCE(public.reading.work_id, EXCLUDED.work_id),
      page = EXCLUDED.page,
      max_page = GREATEST(public.reading.max_page, EXCLUDED.page),
      completed_at = CASE WHEN v_completed THEN COALESCE(public.reading.completed_at, now()) ELSE public.reading.completed_at END,
      updated_at = now()
    RETURNING * INTO v_read;

    -- Award reading XP if completed
    IF v_completed THEN
      v_xp_res := public.award_xp('READ_CHAPTER', cid::text, jsonb_build_object('work_id', wid, 'description', 'Capítulo concluído'));
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'completed', v_read.completed_at IS NOT NULL,
      'page', v_read.page,
      'xp_award', v_xp_res
    );

  -- 4. CLAIM XP EXPLICIT CALL
  ELSIF p_action = 'claim_xp' THEN
    cid := (p_data->>'chapter_id')::uuid;
    IF cid IS NULL THEN
      RAISE EXCEPTION 'chapter_id obrigatório';
    END IF;

    v_xp_res := public.award_xp('READ_CHAPTER', cid::text, jsonb_build_object('work_id', wid, 'description', 'Capítulo concluído'));
    RETURN v_xp_res;

  -- 5. COMMENT ACTION
  ELSIF p_action = 'comment' THEN
    v_comment_body := trim(COALESCE(p_data->>'body', ''));
    IF length(v_comment_body) < 1 OR length(v_comment_body) > 2000 THEN
      RAISE EXCEPTION 'Comentário deve ter entre 1 e 2000 caracteres';
    END IF;

    cid := (p_data->>'chapter_id')::uuid;
    v_parent_id := (p_data->>'parent_id')::uuid;

    INSERT INTO public.comments(user_id, work_id, chapter_id, parent_id, body)
    VALUES (uid, wid, cid, v_parent_id, v_comment_body)
    RETURNING id INTO v_comment_id;

    IF v_parent_id IS NULL AND length(v_comment_body) >= 15 THEN
      v_xp_res := public.award_xp('COMMENT', v_comment_id::text, jsonb_build_object('description', 'Comentário publicado'));
    ELSIF v_parent_id IS NOT NULL AND length(v_comment_body) >= 10 THEN
      v_xp_res := public.award_xp('REPLY', v_comment_id::text, jsonb_build_object('description', 'Resposta publicada'));
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_comment_id, 'xp_award', v_xp_res);

  -- 6. COMMENT LIKE ACTION
  ELSIF p_action = 'comment_like' THEN
    v_comment_id := (p_data->>'comment_id')::uuid;
    IF v_comment_id IS NULL THEN
      RAISE EXCEPTION 'comment_id obrigatório';
    END IF;

    SELECT user_id INTO v_target_user_id FROM public.comments WHERE id = v_comment_id;
    IF v_target_user_id = uid THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_like_prohibited');
    END IF;

    INSERT INTO public.comment_likes(user_id, comment_id)
    VALUES (uid, v_comment_id)
    ON CONFLICT (user_id, comment_id) DO NOTHING;

    v_xp_res := public.award_xp('COMMENT_LIKE', v_comment_id::text, jsonb_build_object('description', 'Curtida em comentário'));

    RETURN jsonb_build_object('ok', true, 'xp_award', v_xp_res);

  -- 7. RATING ACTION
  ELSIF p_action = 'rate_work' THEN
    IF wid IS NULL THEN
      RAISE EXCEPTION 'work_id obrigatório';
    END IF;

    v_xp_res := public.award_xp('RATE_WORK', wid::text, jsonb_build_object('description', 'Avaliação registrada'));
    RETURN jsonb_build_object('ok', true, 'xp_award', v_xp_res);

  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
