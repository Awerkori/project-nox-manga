import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { databaseConfig } from './config';
import { error } from '@sveltejs/kit';
export const WORK_FIELDS =
  'id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,published,featured,cover_id,updated_at,created_at,content_rating,views_total';
export function privileged() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) error(503, 'Armazenamento temporariamente indisponível');
  return createClient(databaseConfig().url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
export function check(result: { error: { message: string } | null }) {
  if (result.error) error(400, result.error.message);
}
export function member(locals: App.Locals) {
  if (!locals.user || !locals.role) error(401, 'Entre em uma conta confirmada para continuar.');
  return locals.user.id;
}
export function editor(locals: App.Locals) {
  member(locals);
  if (!['EDITOR', 'ADMIN'].includes(locals.role || '')) error(403, 'Acesso editorial negado');
}
