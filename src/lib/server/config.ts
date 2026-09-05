import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

export function databaseConfig() {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) error(503, 'A plataforma está em manutenção. Volte em instantes.');
  return { url, key };
}
