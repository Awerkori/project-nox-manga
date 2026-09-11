-- Migration: 20260911150000_auto_assign_manga_storage_shard.sql
-- Description: Deterministically populates bot_reference and storage_shard_id on public.media

CREATE OR REPLACE FUNCTION auto_assign_manga_storage_shard()
RETURNS TRIGGER AS $$
DECLARE
  v_key_hex text;
  v_buf bytea;
BEGIN
  IF NEW.provider = 'telegram' AND (NEW.bot_reference IS NULL OR NEW.bot_reference = 'primary' OR NEW.storage_shard_id IS NULL) THEN
    BEGIN
      v_buf := decode(replace(replace(NEW.provider_key, '-', '+'), '_', '/'), 'base64');
      v_key_hex := encode(v_buf, 'hex');

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
    EXCEPTION WHEN OTHERS THEN
      -- In case of base64 error, continue gracefully
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_manga_storage_shard ON public.media;
CREATE TRIGGER trg_auto_assign_manga_storage_shard
BEFORE INSERT ON public.media
FOR EACH ROW
EXECUTE FUNCTION auto_assign_manga_storage_shard();
