import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { databaseConfig } from './config';
import { error } from '@sveltejs/kit';
import { createYugabyteClient } from './yugabyte';

export const WORK_FIELDS =
  'id,slug,title,aliases,synopsis,description,author,artist,kind,status,year,age_rating,published,featured,cover_id,updated_at,created_at,content_rating,views_total';

export function privileged(platformEnv?: any) {
  let supa: any = null;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      supa = createClient(databaseConfig().url, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch {
      // ignore
    }
  }

  const yb = createYugabyteClient(platformEnv);

  return new Proxy(yb as any, {
    get(target, prop, _receiver) {
      if (prop === 'storage') {
        if (!supa) error(503, 'Armazenamento temporariamente indisponível');
        return supa.storage;
      }
      if (prop === 'auth') {
        if (!supa) error(503, 'Autenticação temporariamente indisponível');
        return supa.auth;
      }
      if (prop in target) {
        return (target as any)[prop];
      }
      if (supa && prop in supa) {
        return supa[prop];
      }
      return (target as any)[prop];
    }
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
  if (!['STAFF_SITE', 'ADMIN', 'EDITOR'].includes(locals.role || '')) error(403, 'Acesso editorial negado');
}

