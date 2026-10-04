-- Auth-provider identity guard. This is not application CRUD: it keeps the
-- auth trigger and its public member mirror atomic while the application data
-- plane remains Yugabyte/YSQL.

DO $$
BEGIN
  IF EXISTS (
    SELECT lower(trim(username))
    FROM public.members
    GROUP BY lower(trim(username))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'AUTH_HANDLE_DUPLICATE_LEGACY_DATA: resolve duplicate usernames before applying this migration';
  END IF;
END;
$$;

UPDATE public.members
SET username = lower(trim(username))
WHERE username <> lower(trim(username));

CREATE UNIQUE INDEX IF NOT EXISTS members_username_lower_unique
  ON public.members (lower(username));

CREATE OR REPLACE FUNCTION public.new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  v_display_name text := trim(coalesce(new.raw_user_meta_data->>'display_name', ''));
BEGIN
  IF v_username = '' OR v_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'AUTH_HANDLE_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF v_username = ANY(ARRAY[
    'admin','administrator','administrador','root','staff','editor','mod',
    'moderador','project-nox','projectnox','nox','sistema','system',
    'suporte','support','ajuda','help','api','auth','login','cadastrar',
    'entrar','sair','recuperar','redefinir','scans','scan','catalogo',
    'ranking','loja','shop','me','u','obra','ler','media','termos',
    'privacidade','sobre'
  ]) THEN
    RAISE EXCEPTION 'AUTH_HANDLE_RESERVED' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.members WHERE lower(username) = v_username) THEN
    RAISE EXCEPTION 'AUTH_HANDLE_TAKEN' USING ERRCODE = '23505';
  END IF;

  IF v_display_name = '' THEN
    v_display_name := 'Leitor Nox';
  END IF;

  INSERT INTO public.members(id, username, display_name)
  VALUES (new.id, v_username, v_display_name)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name;

  INSERT INTO public.access_roles(user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

