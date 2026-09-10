-- Migration: Seed Nexus Toons as an independent 6th source in importer_sources
insert into public.importer_sources (id, name, base_url, enabled, status, rate_limit_per_second, sync_interval_minutes, config)
values (
  'nexus_toons',
  'Nexus Toons',
  'https://nexustoons.com',
  true,
  'ACTIVE',
  2.00,
  10,
  jsonb_build_object(
    'api_url', 'https://nexustoons.com/api',
    'cdn_url', 'https://img.nx-toons.xyz'
  )
)
on conflict (id) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  status = excluded.status,
  updated_at = now();
