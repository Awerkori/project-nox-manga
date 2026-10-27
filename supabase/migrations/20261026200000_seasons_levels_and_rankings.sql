-- ==============================================================================
-- Project Nox Manga - Migration 20261026200000:
-- Seasons, Permanent Lifetime XP, Reader Levels (1-100), and Ranking Overhaul
-- 1. Add lifetime_xp and season_xp to public.members
-- 2. Create public.seasons, public.season_resets, public.season_winners
-- 3. Update public.award_xp to feed xp, lifetime_xp, and season_xp
-- 4. Update public.purchase_shop_item to debit ONLY spendable xp without de-leveling
-- 5. Update public.member_action with dedicated 'like' toggle support
-- ==============================================================================

-- 1. ADD LIFETIME_XP AND SEASON_XP TO MEMBERS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'lifetime_xp'
  ) THEN
    ALTER TABLE public.members ADD COLUMN lifetime_xp integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'season_xp'
  ) THEN
    ALTER TABLE public.members ADD COLUMN season_xp integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill existing XP into lifetime_xp and season_xp
UPDATE public.members
SET lifetime_xp = GREATEST(COALESCE(lifetime_xp, 0), COALESCE(xp, 0)),
    season_xp = GREATEST(COALESCE(season_xp, 0), COALESCE(xp, 0))
WHERE lifetime_xp = 0 AND xp > 0;

CREATE INDEX IF NOT EXISTS idx_members_season_xp ON public.members (season_xp DESC);
CREATE INDEX IF NOT EXISTS idx_members_lifetime_xp ON public.members (lifetime_xp DESC);

-- 2. SEASONS TABLES
CREATE TABLE IF NOT EXISTS public.seasons (
  id text PRIMARY KEY,
  name text NOT NULL,
  number integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  rules_text text NOT NULL DEFAULT 'Pontos de Temporada são zerados a cada ciclo trimestral (90 dias). Seu Nível Permanente e cosméticos comprados na Loja são eternos e nunca são perdidos.',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.season_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL,
  admin_user_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  admin_email text,
  total_members_reset integer NOT NULL DEFAULT 0,
  total_season_xp_reset bigint NOT NULL DEFAULT 0,
  executed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS public.season_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL,
  place integer NOT NULL,
  user_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_id text,
  avatar_crop text,
  avatar_frame_id text,
  name_color text,
  season_xp integer NOT NULL,
  final_level integer NOT NULL,
  equipped_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, place)
);

-- Seed initial season 1 if not exists
INSERT INTO public.seasons (id, name, number, starts_at, ends_at, is_active, rules_text)
VALUES (
  'season_1',
  'Temporada 1 — Despertar Cósmico',
  1,
  '2026-10-01 00:00:00+00',
  '2026-12-31 23:59:59+00',
  true,
  'Pontos de Temporada são zerados a cada ciclo trimestral (90 dias). Seu Nível Permanente e cosméticos comprados na Loja são eternos e nunca são perdidos.'
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS and grants
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view seasons" ON public.seasons;
CREATE POLICY "Public can view seasons" ON public.seasons FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view season winners" ON public.season_winners;
CREATE POLICY "Public can view season winners" ON public.season_winners FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can view season resets" ON public.season_resets;
CREATE POLICY "Admins can view season resets" ON public.season_resets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.access_roles WHERE user_id = auth.uid() AND role = 'ADMIN' AND suspended = false)
  OR (auth.uid() = '732fbe87-5040-41fb-9983-0aedb2af44c8'::uuid)
);

GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT SELECT ON public.season_winners TO anon, authenticated;
GRANT SELECT ON public.season_resets TO authenticated;

-- 3. UPDATED AWARD_XP FUNCTION WITH ARCHITECTURAL XP SEPARATION
CREATE OR REPLACE FUNCTION public.award_xp(
  p_kind text,
  p_source_id text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF EXISTS(SELECT 1 FROM public.xp_ledger WHERE user_id = uid AND kind = 'FAVORITE_WORK' AND source_id = p_source_id) THEN
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

  -- Legacy table sync
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

-- 4. UPDATED PURCHASE_SHOP_ITEM (DEBITS ONLY XP, NEVER DE-LEVELS)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  v_item record;
  v_current_xp integer;
  v_lifetime_xp integer;
  v_user_level integer;
  v_new_xp integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Entre em sua conta para adquirir itens' USING errcode = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 100));

  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id AND is_active = true;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado ou indisponível' USING errcode = 'P0002';
  END IF;

  IF EXISTS(SELECT 1 FROM public.member_inventory WHERE user_id = uid AND item_id = p_item_id) THEN
    RAISE EXCEPTION 'Você já possui este item em seu inventário' USING errcode = '23505';
  END IF;

  SELECT xp, COALESCE(lifetime_xp, xp, 0)
  INTO v_current_xp, v_lifetime_xp
  FROM public.members WHERE id = uid;

  IF v_current_xp IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING errcode = 'P0002';
  END IF;

  -- Level check uses permanent lifetime_xp (never drops upon purchase!)
  v_user_level := least(100, greatest(1, floor(sqrt(1.0 + greatest(0, v_lifetime_xp) / 50.0))));
  IF v_user_level < v_item.min_level THEN
    RAISE EXCEPTION 'Nível insuficiente. Este item exige Nível %', v_item.min_level USING errcode = '22023';
  END IF;

  IF v_current_xp < v_item.price_xp THEN
    RAISE EXCEPTION 'XP insuficiente. Você possui % XP mas o item custa % XP', v_current_xp, v_item.price_xp USING errcode = '22023';
  END IF;

  -- Deduct ONLY from spendable balance
  v_new_xp := v_current_xp - v_item.price_xp;

  INSERT INTO public.member_inventory(user_id, item_id, origin)
  VALUES (uid, p_item_id, 'SHOP')
  ON CONFLICT (user_id, item_id) DO NOTHING;

  UPDATE public.members
  SET xp = v_new_xp
  WHERE id = uid;

  -- Log debit to xp_ledger
  INSERT INTO public.xp_ledger (user_id, amount, balance_after, kind, source_id, description, created_at)
  VALUES (uid, -v_item.price_xp, v_new_xp, 'SHOP_PURCHASE', p_item_id, 'Compra na Loja Cósmica: ' || v_item.name, now());

  INSERT INTO public.notifications(user_id, kind, body, href, dedupe_key)
  VALUES (
    uid,
    'shop',
    'Você adquiriu ' || v_item.name || ' por ' || v_item.price_xp || ' XP!',
    '/me?tab=inventario',
    'shop:' || p_item_id || ':' || extract(epoch from now())::bigint
  );

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'price_paid', v_item.price_xp,
    'remaining_xp', v_new_xp,
    'level', v_user_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text) TO authenticated;

-- 5. UPDATED MEMBER_ACTION WITH LIKE TOGGLE SUPPORT
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Entre em sua conta' USING errcode = '42501';
  END IF;

  wid := (p_data->>'work_id')::uuid;

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

    -- Award XP if genuine comment (>= 15 chars for comment, >= 10 for reply)
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

GRANT EXECUTE ON FUNCTION public.member_action(text, jsonb) TO authenticated;

-- RLS POLICIES FOR LIKES TABLE
DROP POLICY IF EXISTS likes_insert ON public.likes;
CREATE POLICY likes_insert ON public.likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS likes_delete ON public.likes;
CREATE POLICY likes_delete ON public.likes FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT INSERT, DELETE ON public.likes TO authenticated;

