import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { claimInvite } from '$lib/server/invites';
export const load = ({ params, url }) => ({
  mode: params.auth,
  error:
    params.auth === 'entrar' && url.searchParams.get('erro') === 'link-expirado'
      ? 'Este link é inválido ou expirou. Solicite um novo link de recuperação ou entre na sua conta.'
      : ''
});
export const actions = {
  default: async ({ request, locals, params, url }) => {
    const f = await request.formData(),
      mode = params.auth;
    const email = String(f.get('email') || '').trim(),
      password = String(f.get('password') || '');
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
      const { error } = await locals.db.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${url.origin}/auth/confirm` }
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
        redirectTo: `${url.origin}/auth/confirm?next=/redefinir`
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
