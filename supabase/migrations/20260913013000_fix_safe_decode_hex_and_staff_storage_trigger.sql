-- Migration: 20260913013000_fix_safe_decode_hex_and_staff_storage_trigger.sql
-- Description: Sets search_path on safe_decode_hex and auto_assign_manga_storage_shard to prevent 502/42883 errors during reserve_media, and strictly isolates STAFF_STORAGE and PRODUCTION_STORAGE.

CREATE OR REPLACE FUNCTION public.safe_decode_hex(val text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  clean_val text;
  pad_len int;
BEGIN
  IF val IS NULL OR length(val) < 20 OR val LIKE '%-%' OR val LIKE 'reserving:%' THEN
    RETURN '';
  END IF;
  clean_val := replace(replace(val, '-', '+'), '_', '/');
  pad_len := (4 - (length(clean_val) % 4)) % 4;
  IF pad_len > 0 THEN
    clean_val := clean_val || repeat('=', pad_len);
  END IF;
  RETURN encode(decode(clean_val, 'base64'), 'hex');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_decode_hex(text) TO authenticated, anon, service_role;

-- Update trigger function: set explicit search_path and isolate non-manga storage
CREATE OR REPLACE FUNCTION public.auto_assign_manga_storage_shard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_key_hex text;
BEGIN
  -- Strict isolation: NEVER modify records belonging to other pools
  IF NEW.storage_pool_id IS NOT NULL AND NEW.storage_pool_id != '9ad5dac9-c8f7-4774-b488-59837fcef9c3'::uuid THEN
    RETURN NEW;
  END IF;

  IF NEW.bot_reference IS NOT NULL AND NEW.bot_reference NOT IN ('primary', 'MANGA_STORAGE_01', 'MANGA_STORAGE_2') THEN
    RETURN NEW;
  END IF;

  IF NEW.purpose IS NOT NULL AND NEW.purpose NOT IN ('editorial', 'manga') THEN
    RETURN NEW;
  END IF;

  IF NEW.provider = 'telegram' AND (NEW.bot_reference IS NULL OR NEW.bot_reference = 'primary' OR NEW.storage_shard_id IS NULL) THEN
    -- Guard: skip temporary reservation keys, UUIDs, or short strings
    IF NEW.provider_key IS NULL OR NEW.provider_key LIKE 'reserving:%' OR NEW.provider_key LIKE '%-%' OR length(NEW.provider_key) < 20 THEN
      RETURN NEW;
    END IF;

    v_key_hex := public.safe_decode_hex(NEW.provider_key);

    IF v_key_hex != '' THEN
      -- Channel hex signatures for the 9 canonical manga shards
      IF position('103837872' in v_key_hex) > 0 OR position('0383b872' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '935e146d-de3f-4a8e-b393-692944c716fa';
        NEW.bot_reference := 'MANGA_STORAGE_01';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('d22770c9' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '3a4be1a3-f5d2-40c9-9eab-697c2357b183';
        NEW.bot_reference := 'MANGA_STORAGE_01';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('dbc29f11' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := 'a3b6a10e-f53a-4873-9f19-d4cc8576de3a';
        NEW.bot_reference := 'MANGA_STORAGE_01';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('1064ea813' in v_key_hex) > 0 OR position('064ee013' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '424e8be1-dc8a-4d97-a904-119c7ef1c9b5';
        NEW.bot_reference := 'MANGA_STORAGE_01';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('1053966b5' in v_key_hex) > 0 OR position('053996b5' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := 'b8fd37d7-3923-4e04-be37-610a1079aa43';
        NEW.bot_reference := 'MANGA_STORAGE_01';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('e7d202e3' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '80ead41f-7b58-492d-a028-ae0b2669cd93';
        NEW.bot_reference := 'MANGA_STORAGE_2';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('103ac8769' in v_key_hex) > 0 OR position('03acc769' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '98701fd5-d376-4310-b664-6aa13bf0cbb1';
        NEW.bot_reference := 'MANGA_STORAGE_2';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('107094e6a' in v_key_hex) > 0 OR position('070a0e6a' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '3535da22-cb50-4b7b-b12f-96c25460d0b6';
        NEW.bot_reference := 'MANGA_STORAGE_2';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      ELSIF position('10289a08a' in v_key_hex) > 0 OR position('0289a08a' in v_key_hex) > 0 THEN
        NEW.storage_shard_id := '23518242-ad31-44e9-9997-add190b0a930';
        NEW.bot_reference := 'MANGA_STORAGE_2';
        NEW.storage_pool_id := '9ad5dac9-c8f7-4774-b488-59837fcef9c3';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
