import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'administrador',
  'root',
  'staff',
  'editor',
  'mod',
  'moderador',
  'project-nox',
  'projectnox',
  'nox',
  'sistema',
  'system',
  'suporte',
  'support',
  'ajuda',
  'help',
  'api',
  'auth',
  'login',
  'cadastrar',
  'entrar',
  'sair',
  'recuperar',
  'redefinir',
  'scans',
  'scan',
  'catalogo',
  'ranking',
  'loja',
  'shop',
  'me',
  'u',
  'obra',
  'ler',
  'media',
  'termos',
  'privacidade',
  'sobre'
]);

export const GET = async ({ url, locals, platform }: any) => {
  const raw = (url.searchParams.get('username') || url.searchParams.get('q') || '').trim().toLowerCase();

  if (!raw) {
    return json({ available: false, reason: 'Informe um @handle.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (raw.length < 3) {
    return json({ available: false, reason: 'Mínimo de 3 caracteres.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (raw.length > 30) {
    return json({ available: false, reason: 'Máximo de 30 caracteres.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!/^[a-z0-9_]+$/.test(raw)) {
    return json({ available: false, reason: 'Use apenas letras minúsculas, números e sublinhados (_).' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (RESERVED_USERNAMES.has(raw)) {
    return json({ available: false, reason: 'Este @handle é reservado pelo Project Nox.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  let collision = false;

  try {
    const ybRes = await executeYugabyteSql(
      `SELECT id, username FROM members WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
      [raw],
      platform?.env
    );
    if (ybRes.rows && ybRes.rows.length > 0) {
      if (locals.user && ybRes.rows[0].id === locals.user.id) {
        return json({ available: true, username: raw, current: true }, { headers: { 'Cache-Control': 'no-store' } });
      }
      collision = true;
    }
  } catch {
    // Secondary fallback to Supabase privileged client
    try {
      if (locals.user) {
        const { data: currentMember } = await privileged()
          .from('members')
          .select('username')
          .eq('id', locals.user.id)
          .maybeSingle();

        if (currentMember?.username?.toLowerCase() === raw) {
          return json({ available: true, username: raw, current: true }, { headers: { 'Cache-Control': 'no-store' } });
        }
      }

      const { data: col, error: collisionError } = await privileged()
        .from('members')
        .select('id')
        .ilike('username', raw)
        .maybeSingle();

      if (collisionError) {
        console.warn(`[AUTH_HANDLE_CHECK] provider_error=${collisionError.code || 'UNKNOWN'}`);
        return json(
          { available: false, reason: 'Não foi possível verificar agora. Tente novamente.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      collision = Boolean(col);
    } catch {
      return json(
        { available: false, reason: 'Não foi possível verificar agora. Tente novamente.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  if (collision) {
    return json({ available: false, reason: 'Este @handle já está em uso.' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return json({ available: true, username: raw }, { headers: { 'Cache-Control': 'no-store' } });
};
