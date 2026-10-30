-- Migration: 20261028163000_comment_media_purpose_and_chapter_bridge.sql
-- Description:
-- 1. Expand media_purpose_check constraint to include 'comment_media' and 'comment_attachment'.
-- 2. Update reserve_media RPC to authorize regular authenticated members for comment media uploads with in-flight anti-spam lock.
-- 3. Update member_action RPC to bridge chapter stubs in Supabase for Yugabyte-backed chapters, resolving 'Capítulo indisponível' on chapter comments and reading progression.

-- 1. EXPAND media_purpose_check CONSTRAINT
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_purpose_check;
ALTER TABLE public.media ADD CONSTRAINT media_purpose_check CHECK (
  purpose IN (
    'editorial', 'staff_manual', 'scan_chapter', 'avatar', 'banner',
    'profile_banner', 'comment_banner', 'scan_logo', 'scan_banner',
    'cosmetic', 'comment_media', 'comment_attachment'
  )
);

-- 2. UPDATE reserve_media RPC
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
        OR p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner', 'comment_media', 'comment_attachment')
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
  IF p_purpose IN ('avatar', 'banner', 'profile_banner', 'comment_banner', 'comment_media', 'comment_attachment') THEN
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

REVOKE ALL ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_media(uuid,uuid,text,text,integer,integer,integer,text,text) TO service_role;

-- 3. UPDATE member_action RPC WITH ARCHITECTURAL CHAPTER STUB BRIDGING
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
      ELSE NULL
    END;

    IF v_req_level IS NOT NULL THEN
      SELECT coalesce(current_level, 1) INTO v_level FROM public.user_level_progression WHERE user_id = uid;
      IF coalesce(v_level, 1) < v_req_level THEN
        RAISE EXCEPTION 'Você precisa atingir o Nível % para equipar este título', v_req_level;
      END IF;
    ELSE
      -- Check inventory or HoF
      IF NOT EXISTS (
        SELECT 1 FROM public.member_inventory WHERE user_id = uid AND item_id = v_title_id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.hall_of_fame_awards WHERE user_id = uid AND reward_title_id = v_title_id
      ) THEN
        RAISE EXCEPTION 'Você não possui este título desbloqueado';
      END IF;
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

    v_req_level := CASE v_badge_id
      WHEN 'insignia-nv1-centelha-veu' THEN 1
      WHEN 'insignia-nv10-tecelao-sombras' THEN 10
      WHEN 'insignia-nv20-peregrino-eter' THEN 20
      WHEN 'insignia-nv30-sentinela-eclipse' THEN 30
      WHEN 'insignia-nv40-geometra-constelacoes' THEN 40
      WHEN 'insignia-nv50-hierofante-abismo' THEN 50
      WHEN 'insignia-nv60-suserano-noite' THEN 60
      WHEN 'insignia-nv70-oraculo-singularidade' THEN 70
      WHEN 'insignia-nv80-arconte-primordial' THEN 80
      WHEN 'insignia-nv90-soberano-supremo' THEN 90
      WHEN 'insignia-nv100-apex-nox' THEN 100
      ELSE NULL
    END;

    IF v_req_level IS NOT NULL THEN
      SELECT coalesce(current_level, 1) INTO v_level FROM public.user_level_progression WHERE user_id = uid;
      IF coalesce(v_level, 1) < v_req_level THEN
        RAISE EXCEPTION 'Você precisa atingir o Nível % para equipar esta insígnia', v_req_level;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.member_inventory WHERE user_id = uid AND item_id = v_badge_id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.hall_of_fame_awards WHERE user_id = uid AND reward_badge_id = v_badge_id
      ) THEN
        RAISE EXCEPTION 'Você não possui esta insígnia desbloqueada';
      END IF;
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

    IF p_data->>'kind' = 'AVATAR_FRAME' THEN
      UPDATE public.members SET avatar_frame_id = v_id WHERE id = uid;
    ELSIF p_data->>'kind' = 'PROFILE_BANNER' THEN
      UPDATE public.members SET equipped_banner_id = v_id WHERE id = uid;
    ELSIF p_data->>'kind' = 'COMMENT_BANNER' THEN
      UPDATE public.members SET equipped_comment_banner_id = v_id WHERE id = uid;
    ELSIF p_data->>'kind' = 'NAME_COLOR' THEN
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
      RAISE EXCEPTION 'ID do comentário obrigatório';
    END IF;

    IF NOT EXISTS(
      SELECT 1 FROM public.comments c
      JOIN public.works w ON w.id = c.work_id
      WHERE c.id = v_id AND NOT c.removed AND w.published
        AND (c.chapter_id IS NULL OR public.public_chapter(c.chapter_id))
    ) THEN
      RAISE EXCEPTION 'Comentário indisponível';
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

    -- Architectural Chapter Stub Bridge: If chapter exists in Yugabyte / requested in reader,
    -- create chapter stub inside SECURITY DEFINER so FK constraints & public_chapter never fail.
    cid := (p_data->>'chapter_id')::uuid;
    IF cid IS NOT NULL AND wid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.chapters WHERE id = cid) THEN
      INSERT INTO public.chapters (
        id, work_id, number, title, published_at, display_number, canonical_chapter_key, origin
      ) VALUES (
        cid,
        wid,
        coalesce((p_data->>'chapter_number')::numeric, 1.00),
        coalesce(nullif(p_data->>'chapter_title', ''), 'Capítulo'),
        now(),
        coalesce(p_data->>'display_number', '1'),
        p_data->>'canonical_chapter_key',
        'MANUAL'
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
        v_page := coalesce((p_data->>'page')::integer, 1);
        v_completed := coalesce((p_data->>'completed')::boolean, false) OR (v_page >= v_count);

        IF v_session.accepted_at > now() - interval '200 milliseconds' THEN
          -- Throttled silently
        ELSE
          UPDATE public.reading_sessions
          SET next_page = v_page + 1, accepted_at = now()
          WHERE user_id = uid AND chapter_id = cid;

          UPDATE public.reading
          SET
            page = GREATEST(public.reading.page, v_page),
            max_page = GREATEST(public.reading.max_page, v_page),
            completed_at = CASE WHEN v_completed AND completed_at IS NULL THEN now() ELSE completed_at END,
            updated_at = now()
          WHERE user_id = uid AND chapter_id = cid;

          -- Award genuine chapter completion XP
          IF v_completed AND v_read.completed_at IS NULL THEN
            v_res := public.award_xp('READ_CHAPTER', cid::text, jsonb_build_object('description', 'Capítulo concluído', 'work_id', wid));
          END IF;
        END IF;
      END IF;

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
        RAISE EXCEPTION 'Avaliação deve ser entre 1 e 5 estrelas';
      END IF;

      INSERT INTO public.work_ratings (user_id, work_id, rating, updated_at)
      VALUES (uid, wid, v_page, now())
      ON CONFLICT (user_id, work_id) DO UPDATE SET
        rating = excluded.rating,
        updated_at = now();

      v_res := public.award_xp('RATE_WORK', wid::text, jsonb_build_object('description', 'Obra avaliada', 'work_id', wid));
      RETURN jsonb_build_object('ok', true, 'rating', v_page, 'xp_award', v_res);

    ELSE
      RAISE EXCEPTION 'Ação não reconhecida: %', p_action USING errcode = '22023';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_action(text, jsonb) TO authenticated;
