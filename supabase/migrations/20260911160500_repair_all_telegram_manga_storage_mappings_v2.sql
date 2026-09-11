-- Migration: 20260911160000_repair_all_telegram_manga_storage_mappings.sql
-- Description: Deterministically backfills and repairs all telegram manga storage mappings in public.media and media_locations

CREATE OR REPLACE FUNCTION safe_decode_hex(val text) RETURNS text AS $$
DECLARE
  clean_val text;
  pad_len int;
BEGIN
  IF val IS NULL OR length(val) < 20 THEN
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update trigger function to also handle base64 padding correctly
CREATE OR REPLACE FUNCTION auto_assign_manga_storage_shard()
RETURNS TRIGGER AS $$
DECLARE
  v_key_hex text;
BEGIN
  IF NEW.provider = 'telegram' AND (NEW.bot_reference IS NULL OR NEW.bot_reference = 'primary' OR NEW.storage_shard_id IS NULL) THEN
    v_key_hex := safe_decode_hex(NEW.provider_key);

    IF v_key_hex != '' THEN
      -- Match channel hex signature
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
$$ LANGUAGE plpgsql;

-- 1. Shard 000: Site Mangá (-1004353931378, hex 0383b872 or 103837872) -> MANGA_STORAGE_01
UPDATE public.media
SET storage_shard_id = '935e146d-de3f-4a8e-b393-692944c716fa',
    bot_reference = 'MANGA_STORAGE_01',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%0383b872%' OR safe_decode_hex(provider_key) LIKE '%103837872%');

-- 2. Shard 001: Nox Manga Storage 001 (-1003525800137, hex d22770c9) -> MANGA_STORAGE_01
UPDATE public.media
SET storage_shard_id = '3a4be1a3-f5d2-40c9-9eab-697c2357b183',
    bot_reference = 'MANGA_STORAGE_01',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND safe_decode_hex(provider_key) LIKE '%d22770c9%';

-- 3. Shard 002: Nox Manga Storage 002 (-1003686965009, hex dbc29f11) -> MANGA_STORAGE_01
UPDATE public.media
SET storage_shard_id = 'a3b6a10e-f53a-4873-9f19-d4cc8576de3a',
    bot_reference = 'MANGA_STORAGE_01',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND safe_decode_hex(provider_key) LIKE '%dbc29f11%';

-- 4. Shard 003: Nox Manga Storage 003 (-1004400799763, hex 064ee013 or 1064ea813) -> MANGA_STORAGE_01
UPDATE public.media
SET storage_shard_id = '424e8be1-dc8a-4d97-a904-119c7ef1c9b5',
    bot_reference = 'MANGA_STORAGE_01',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%064ee013%' OR safe_decode_hex(provider_key) LIKE '%1064ea813%');

-- 5. Shard 004: Nox Manga Storage 004 (-1004382627509, hex 053996b5 or 1053966b5) -> MANGA_STORAGE_01
UPDATE public.media
SET storage_shard_id = 'b8fd37d7-3923-4e04-be37-610a1079aa43',
    bot_reference = 'MANGA_STORAGE_01',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%053996b5%' OR safe_decode_hex(provider_key) LIKE '%1053966b5%');

-- 6. Shard 005: Nox Manga Storage 005 (-1003889300195, hex e7d202e3) -> MANGA_STORAGE_2
UPDATE public.media
SET storage_shard_id = '80ead41f-7b58-492d-a028-ae0b2669cd93',
    bot_reference = 'MANGA_STORAGE_2',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND safe_decode_hex(provider_key) LIKE '%e7d202e3%';

-- 7. Shard 006: Nox Manga Storage 006 (-1004356622185, hex 03acc769 or 103ac8769) -> MANGA_STORAGE_2
UPDATE public.media
SET storage_shard_id = '98701fd5-d376-4310-b664-6aa13bf0cbb1',
    bot_reference = 'MANGA_STORAGE_2',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%03acc769%' OR safe_decode_hex(provider_key) LIKE '%103ac8769%');

-- 8. Shard 007: Nox Manga Storage 007 (-1004413066858, hex 070a0e6a or 107094e6a) -> MANGA_STORAGE_2
UPDATE public.media
SET storage_shard_id = '3535da22-cb50-4b7b-b12f-96c25460d0b6',
    bot_reference = 'MANGA_STORAGE_2',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%070a0e6a%' OR safe_decode_hex(provider_key) LIKE '%107094e6a%');

-- 9. Shard 008: Nox Manga Storage 008 (-1004337541258, hex 0289a08a or 10289a08a) -> MANGA_STORAGE_2
UPDATE public.media
SET storage_shard_id = '23518242-ad31-44e9-9997-add190b0a930',
    bot_reference = 'MANGA_STORAGE_2',
    storage_pool_id = '9ad5dac9-c8f7-4774-b488-59837fcef9c3'
WHERE provider = 'telegram'
  AND (storage_shard_id IS NULL OR bot_reference = 'primary' OR bot_reference IS NULL)
  AND (safe_decode_hex(provider_key) LIKE '%0289a08a%' OR safe_decode_hex(provider_key) LIKE '%10289a08a%');

-- Populate media_locations for all assigned media that don't have it yet
INSERT INTO public.media_locations (media_id, storage_shard_id, bot_reference, channel_id, file_id, role, status)
SELECT 
  m.id, 
  m.storage_shard_id, 
  m.bot_reference,
  s.channel_id, 
  m.provider_key, 
  'PRIMARY', 
  'HEALTHY'
FROM public.media m
JOIN public.storage_shards s ON s.id = m.storage_shard_id
WHERE m.provider = 'telegram'
  AND m.storage_shard_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.media_locations ml WHERE ml.media_id = m.id
  );
