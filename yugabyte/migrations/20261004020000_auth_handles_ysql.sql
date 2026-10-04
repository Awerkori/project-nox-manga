-- Canonical @handle guard for the YSQL identity rows used by the site/Scans.
-- Authentication tokens remain owned by the configured auth provider; this
-- migration only hardens the public identity that the application exposes.

DO $$
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE EXCEPTION 'AUTH_HANDLE_YSQL_PREREQUISITES_MISSING: members';
  END IF;
END;
$$;

-- Do not silently pick a winner if legacy data already collides by case.
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

CREATE TABLE IF NOT EXISTS public.reserved_handles (
  handle text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reserved_handles(handle) VALUES
  ('admin'), ('administrator'), ('administrador'), ('root'), ('staff'),
  ('editor'), ('mod'), ('moderador'), ('project-nox'), ('projectnox'),
  ('nox'), ('sistema'), ('system'), ('suporte'), ('support'), ('ajuda'),
  ('help'), ('api'), ('auth'), ('login'), ('cadastrar'), ('entrar'),
  ('sair'), ('recuperar'), ('redefinir'), ('scans'), ('scan'), ('catalogo'),
  ('ranking'), ('loja'), ('shop'), ('me'), ('u'), ('obra'), ('ler'),
  ('media'), ('termos'), ('privacidade'), ('sobre')
ON CONFLICT (handle) DO NOTHING;

-- Case-insensitive uniqueness is the authoritative race-safe check. The
-- application availability endpoint remains an early UX hint only.
CREATE UNIQUE INDEX IF NOT EXISTS members_username_lower_unique
  ON public.members (lower(username));

