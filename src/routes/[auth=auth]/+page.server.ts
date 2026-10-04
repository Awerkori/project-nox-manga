import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { claimInvite } from '$lib/server/invites';

const DEFAULT_SITE_ORIGIN = 'https://manga.project-nox-awerkori.workers.dev';
const RESERVED_HANDLES = new Set([
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

function authOrigin(url: URL): string {
  // Keep local tests/dev on their own origin, but never generate production
  // auth links for a legacy/custom host.  Auth templates must use the same
  // canonical Worker origin that is allow-listed by the provider.
  if (['localhost', '127.0.0.1', 'nox.invalid'].includes(url.hostname)) return url.origin;
  return DEFAULT_SITE_ORIGIN;
}

export const load = ({ params, url }) => ({
  mode: params.auth,
  error:
    params.auth === 'entrar' && url.searchParams.get('erro') === 'link-expirado'
      ? 'Este link é inválido, já foi utilizado ou expirou. Solicite um novo link e abra o e-mail mais recente.'
      : ''
});
export const actions = {
  default: async ({ request, locals, params, url }) => {
    const f = await request.formData(),
      mode = params.auth;
    const email = String(f.get('email') || '').trim(),
      password = String(f.get('password') || ''),
      intent = String(f.get('intent') || '');
    const redirectOrigin = authOrigin(url);

    if (mode === 'cadastrar' && intent === 'resend_confirmation') {
      if (!z.email().safeParse(email).success) {
        return fail(400, { message: 'Informe um e-mail válido para reenviar a confirmação.' });
      }
      const { error } = await locals.db.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${redirectOrigin}/auth/confirm` }
      });
      if (error) {
        return fail(400, { message: 'Não foi possível reenviar agora. Aguarde alguns segundos e tente novamente.' });
      }
      return { success: true, resend: true, message: 'Enviamos uma nova confirmação. Abra o e-mail mais recente.' };
    }

    if (mode !== 'redefinir' && !z.email().safeParse(email).success)
      return fail(400, { message: 'Informe um e-mail válido.' });
    if (mode !== 'recuperar' && password.length < 10)
      return fail(400, { message: 'Use uma senha com pelo menos 10 caracteres.' });
    if (password.length > 128) return fail(400, { message: 'A senha pode ter até 128 caracteres.' });
    if (mode === 'entrar') {
      const { error } = await locals.db.auth.signInWithPassword({ email, password });
      if (error)
        return fail(400, {
          message: 'Não foi possível entrar. Confira o e-mail, a senha e a confirmação da conta.'
        });
      await claimInvite(locals);
      redirect(303, '/biblioteca');
    }
    if (mode === 'cadastrar') {
      const displayName = String(f.get('displayName') || f.get('display_name') || '').trim();
      const rawUsername = String(f.get('username') || '').trim().toLowerCase();

      if (displayName && (displayName.length < 2 || displayName.length > 50)) {
        return fail(400, { message: 'Nome de exibição deve ter entre 2 e 50 caracteres.' });
      }
      if (rawUsername.length < 3 || rawUsername.length > 30) {
        return fail(400, { message: 'Escolha um @handle com 3 a 30 caracteres.' });
      }
      if (!/^[a-z0-9_]+$/.test(rawUsername)) {
        return fail(400, { message: 'O @handle deve conter apenas letras minúsculas, números e sublinhados (_).' });
      }
      if (RESERVED_HANDLES.has(rawUsername)) {
        return fail(400, { message: 'Este @handle é reservado pelo Project Nox.' });
      }

      // The database UNIQUE constraint remains authoritative. This check is
      // only an early UX response; two simultaneous signups can still race
      // and are rejected by the constraint/trigger at commit time.
      if (typeof locals.db.from === 'function') {
        const { data: collision, error: collisionError } = await locals.db
          .from('members')
          .select('id')
          .ilike('username', rawUsername)
          .maybeSingle();

        if (collisionError) {
          console.warn(`[AUTH_HANDLE_CHECK] provider_error=${collisionError.code || 'UNKNOWN'}`);
          return fail(503, { message: 'Não foi possível verificar este @handle agora. Tente novamente.' });
        }
        if (collision) {
          return fail(400, { message: `O @${rawUsername} já está em uso.` });
        }
      }

      const signUpOptions: { emailRedirectTo: string; data?: Record<string, string> } = {
        emailRedirectTo: `${redirectOrigin}/auth/confirm`
      };
      if (rawUsername || displayName) {
        signUpOptions.data = {
          ...(rawUsername ? { username: rawUsername } : {}),
          ...(displayName ? { display_name: displayName } : {})
        };
      }

      const { error } = await locals.db.auth.signUp({
        email,
        password,
        options: signUpOptions
      });
      if (error)
        return fail(400, {
          message:
            error.code === 'over_email_send_rate_limit'
              ? 'Limite de envio atingido. Tente novamente mais tarde.'
              : 'Não foi possível enviar a confirmação. Tente novamente mais tarde.'
        });
      return { success: true, message: 'Confira seu e-mail e abra o link para confirmar sua conta.' };
    }
    if (mode === 'recuperar') {
      const { error } = await locals.db.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectOrigin}/auth/confirm?next=/redefinir`
      });
      if (error)
        return fail(400, { message: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' });
      return {
        success: true,
        message: 'Se houver uma conta com esse e-mail, você receberá um link de recuperação.'
      };
    }
    if (!locals.user) return fail(401, { message: 'Abra o link de recuperação enviado para seu e-mail.' });
    const { error } = await locals.db.auth.updateUser({ password });
    if (error) return fail(400, { message: 'Não foi possível alterar a senha. Solicite um novo link.' });
    return { success: true, message: 'Senha alterada. Você já pode acessar sua biblioteca.' };
  }
};
