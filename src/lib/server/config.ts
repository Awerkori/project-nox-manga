import { env } from '$env/dynamic/public';

export function databaseConfig() {
  const url = env.PUBLIC_SUPABASE_URL || '';
  const key = env.PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key };
}
