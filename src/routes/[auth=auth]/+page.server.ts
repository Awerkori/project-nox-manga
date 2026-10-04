import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { claimInvite } from '$lib/server/invites';

const DEFAULT_SITE_ORIGIN = 'https://manga.project-nox-awerkori.workers.dev';

function authOrigin(url: URL): string {
  // Keep local development/tests on their own origin, but ensure production
  // auth callbacks never point at an obsolete/custom hostname.
  if (['localhost', '127.0.0.1', 'nox.invalid'].includes(url.hostname)) return url.origin;
  return DEFAULT_SITE_ORIGIN;
}

function isUnconfirmedEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: unknown; status?: unknown; message?: unknown };
  if (details.code === 'email_not_confirmed') return true;
  return (
    details.status === 400 &&
    typeof details.message === 'string' &&
    /^email not confirmed$/i.test(details.message.trim())
  );
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

    if ((mode === 'cadastrar' || mode === 'entrar') && intent === 'resend_confirmation') {
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
      return {
        success: true,
        resend: true,
        unconfirmed: mode === 'entrar',
        email,
        message: 'Enviamos uma nova confirmação. Abra o e-mail mais recente.'
      };
    }
    if (mode !== 'redefinir' && !z.email().safeParse(email).success)
      return fail(400, { message: 'Informe um e-mail válido.' });
    if (mode !== 'recuperar' && password.length < 10)
      return fail(400, { message: 'Use uma senha com pelo menos 10 caracteres.' });
    if (password.length > 128) return fail(400, { message: 'A senha pode ter até 128 caracteres.' });
    if (mode === 'entrar') {
      const { error } = await locals.db.auth.signInWithPassword({ email, password });
      if (error && isUnconfirmedEmailError(error)) {
        return fail(400, {
          message: 'Verifique seu e-mail para continuar.',
          unconfirmed: true,
          email
        });
      }
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
      if (!rawUsername) {
        return fail(400, { message: 'Informe um @handle para criar sua conta.' });
      }
      if (rawUsername.length < 3 || rawUsername.length > 30) {
        return fail(400, { message: 'O nome de usuário (@) deve ter entre 3 e 30 caracteres.' });
      }
      if (!/^[a-z0-9_]+$/.test(rawUsername)) {
        return fail(400, { message: 'O nome de usuário deve conter apenas letras minúsculas, números e sublinhados (_).' });
      }

      // This is only an early UX check. Existing production schema remains
      // authoritative for the final uniqueness decision.
      if (typeof locals.db.from === 'function') {
        const { data: collision, error: collisionError } = await locals.db
          .from('members')
          .select('id')
          .ilike('username', rawUsername)
          .maybeSingle();

        if (collisionError) {
          console.warn(`[AUTH_HANDLE_CHECK] provider_error=${collisionError.code || 'UNKNOWN'}`);
          return fail(503, { message: 'Não foi possível verificar o nome agora. Tente novamente.' });
        }
        if (collision) {
          return fail(400, { message: `O nome de usuário @${rawUsername} já está em uso.` });
        }
      }

      const signUpOptions: { emailRedirectTo: string; data?: Record<string, string> } = {
        emailRedirectTo: `${redirectOrigin}/auth/confirm`
      };
      signUpOptions.data = {
        username: rawUsername,
        ...(displayName ? { display_name: displayName } : {})
      };

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
