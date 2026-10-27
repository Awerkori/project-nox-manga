-- Migration: 20261027160000_admin_search_works_rpc.sql
-- Description: Server-side search, accent-insensitivity, and pagination for admin works catalog

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE INDEX IF NOT EXISTS idx_works_search_unaccent_trgm
ON public.works
USING gin (immutable_unaccent(lower(COALESCE(search_text, ''))) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.admin_search_works(
  p_search text DEFAULT NULL,
  p_kind text DEFAULT 'ALL',
  p_status text DEFAULT 'ALL',
  p_page int DEFAULT 1,
  p_per_page int DEFAULT 25
)
RETURNS jsonb AS $$
DECLARE
  v_offset int;
  v_limit int;
  v_clean_search text;
  v_total bigint;
  v_works jsonb;
BEGIN
  v_limit := COALESCE(p_per_page, 25);
  IF v_limit < 1 THEN v_limit := 25; END IF;
  IF v_limit > 100 THEN v_limit := 100; END IF;

  v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;
  v_clean_search := trim(COALESCE(p_search, ''));

  SELECT count(*)
  INTO v_total
  FROM public.works w
  WHERE (
    p_kind = 'ALL' OR p_kind IS NULL OR w.kind = p_kind
  )
  AND (
    p_status = 'ALL' OR p_status IS NULL
    OR (p_status = 'PUBLISHED' AND w.published = true)
    OR (p_status = 'DRAFT' AND (w.published = false OR w.published IS NULL))
  )
  AND (
    v_clean_search = ''
    OR immutable_unaccent(lower(w.title)) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
    OR immutable_unaccent(lower(w.slug)) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
    OR immutable_unaccent(lower(COALESCE(w.search_text, ''))) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
    OR immutable_unaccent(lower(COALESCE(w.author, ''))) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
  );

  SELECT COALESCE(jsonb_agg(w_row), '[]'::jsonb)
  INTO v_works
  FROM (
    SELECT
      w.id,
      w.slug,
      w.title,
      w.aliases,
      w.synopsis,
      w.description,
      w.author,
      w.artist,
      w.kind,
      w.status,
      w.year,
      w.age_rating,
      w.published,
      w.featured,
      w.cover_id,
      w.updated_at,
      w.created_at,
      w.content_rating,
      w.views_total
    FROM public.works w
    WHERE (
      p_kind = 'ALL' OR p_kind IS NULL OR w.kind = p_kind
    )
    AND (
      p_status = 'ALL' OR p_status IS NULL
      OR (p_status = 'PUBLISHED' AND w.published = true)
      OR (p_status = 'DRAFT' AND (w.published = false OR w.published IS NULL))
    )
    AND (
      v_clean_search = ''
      OR immutable_unaccent(lower(w.title)) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
      OR immutable_unaccent(lower(w.slug)) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
      OR immutable_unaccent(lower(COALESCE(w.search_text, ''))) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
      OR immutable_unaccent(lower(COALESCE(w.author, ''))) ILIKE '%' || immutable_unaccent(lower(v_clean_search)) || '%'
    )
    ORDER BY
      CASE
        WHEN v_clean_search <> '' AND immutable_unaccent(lower(w.title)) = immutable_unaccent(lower(v_clean_search)) THEN 1
        WHEN v_clean_search <> '' AND immutable_unaccent(lower(w.title)) ILIKE immutable_unaccent(lower(v_clean_search)) || '%' THEN 2
        WHEN v_clean_search <> '' AND immutable_unaccent(lower(w.slug)) = immutable_unaccent(lower(v_clean_search)) THEN 3
        ELSE 4
      END,
      w.updated_at DESC
    LIMIT v_limit OFFSET v_offset
  ) w_row;

  RETURN jsonb_build_object(
    'works', v_works,
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 1), 1),
    'per_page', v_limit,
    'total_pages', CEIL(v_total::numeric / v_limit::numeric)::int
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_search_works TO authenticated, service_role, anon;
