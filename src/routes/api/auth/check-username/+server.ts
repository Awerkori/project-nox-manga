import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

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

export const GET = async ({ url, locals }) => {
  const raw = (url.searchParams.get('username') || url.searchParams.get('q') || '').trim().toLowerCase();

  if (!raw) {
    return json({ available: false, reason: 'Informe um nome de usuário.' });
  }

  if (raw.length < 3) {
    return json({ available: false, reason: 'Mínimo de 3 caracteres.' });
  }

  if (raw.length > 30) {
    return json({ available: false, reason: 'Máximo de 30 caracteres.' });
  }

  if (!/^[a-z0-9_]+$/.test(raw)) {
    return json({ available: false, reason: 'Use apenas letras minúsculas, números e sublinhados (_).' });
  }

  if (RESERVED_USERNAMES.has(raw)) {
    return json({ available: false, reason: 'Este nome de usuário é reservado.' });
  }

  // If current user already owns this username, it's available to them
  if (locals.user) {
    const { data: currentMember } = await privileged()
      .from('members')
      .select('username')
      .eq('id', locals.user.id)
      .maybeSingle();

    if (currentMember?.username?.toLowerCase() === raw) {
      return json({ available: true, username: raw, current: true });
    }
  }

  const { data: collision } = await privileged()
    .from('members')
    .select('id')
    .ilike('username', raw)
    .maybeSingle();

  if (collision) {
    return json({ available: false, reason: 'Este nome de usuário já está em uso.' });
  }

  return json({ available: true, username: raw });
};
