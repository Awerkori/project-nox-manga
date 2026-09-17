import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { claimInvite } from '$lib/server/invites';
import { db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq, ilike } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const load = ({ params, url }) => ({
  mode: params.auth,
  error:
    params.auth === 'entrar' && url.searchParams.get('erro') === 'link-expirado'
      ? 'Este link  invlido ou expirou. Solicite um novo link de recuperao ou entre na sua conta.'
      : ''
});

export const actions = {
  default: async ({ request, locals, params, url }) => {
    const f = await request.formData(),
      mode = params.auth;
    const email = String(f.get('email') || '').trim(),
      password = String(f.get('password') || '');
    if (mode !== 'redefinir' && !z.email().safeParse(email).success)
      return fail(400, { message: 'Informe um e-mail vlido.' });
    if (mode !== 'recuperar' && password.length < 10)
      return fail(400, { message: 'Use uma senha com pelo menos 10 caracteres.' });
    if (password.length > 128) return fail(400, { message: 'A senha pode ter at 128 caracteres.' });

    if (mode === 'entrar') {
      let error = null;
      try {
        await auth.api.signInEmail({
          body: { email, password },
          headers: request.headers
        });
      } catch (err: any) {
        error = err;
      }
      if (error)
        return fail(400, {
          message: 'No foi possvel entrar. Confira o e-mail, a senha e a confirmao da conta.'
        });
      await claimInvite(locals);
      redirect(303, '/biblioteca');
    }

    if (mode === 'cadastrar') {
      const displayName = String(f.get('displayName') || '').trim();
      const rawUsername = String(f.get('username') || '').trim().toLowerCase();

      if (displayName && (displayName.length < 2 || displayName.length > 50)) {
        return fail(400, { message: 'Nome de exibio deve ter entre 2 e 50 caracteres.'});
      }
      if (rawUsername) {
        if (rawUsername.length < 3 || rawUsername.length > 30) {
          return fail(400, { message: 'O nome de usurio (@) deve ter entre 3 e 30 caracteres.' });
        }
        if (!/^[a-z0-9_]+$/.test(rawUsername)) {
          return fail(400, { message: 'O nome de usurio deve conter apenas letras minsculas, nmeros e sublinhados (_).' });
        }

        // Check username collision
        const { data: collision } = await safeQuerySingle(
          db.select({ id: schema.members.id })
            .from(schema.members)
            .where(ilike(schema.members.username, rawUsername))
        );

        if (collision) {
          return fail(400, { message: `O nome de usurio @${rawUsername} j est em uso.` });
        }
      }

      let error = null;
      try {
        await auth.api.signUpEmail({
          body: {
            email,
            password,
            name: displayName || rawUsername || email.split('@')[0],
            callbackURL: `${url.origin}/auth/confirm`
          }
        });
      } catch (err: any) {
        error = err;
      }
      
      if (error)
        return fail(400, {
          message: 'No foi possvel enviar a confirmao. Tente novamente mais tarde.'
        });
      return { success: true, message: 'Confira seu e-mail e abra o link para confirmar sua conta.' };
    }

    if (mode === 'recuperar') {
      let error = null;
      try {
        await auth.api.forgetPassword({
          body: {
            email,
            redirectTo: `${url.origin}/auth/confirm?next=/redefinir`
          }
        });
      } catch (err: any) {
        error = err;
      }
      
      if (error)
        return fail(400, { message: 'No foi possvel enviar o e-mail agora. Tente novamente mais tarde.' });
      return {
        success: true,
        message: 'Se houver uma conta com esse e-mail, voc receber um link de recuperao.'
      };
    }

    if (!locals.user) return fail(401, { message: 'Abra o link de recuperao enviado para seu e-mail.' });
    
    let updateError = null;
    try {
      await auth.api.changePassword({
        body: {
          newPassword: password
        },
        headers: request.headers
      });
    } catch (err: any) {
      updateError = err;
    }
    
    if (updateError) return fail(400, { message: 'No foi possvel alterar a senha. Solicite um novo link.' });
    return { success: true, message: 'Senha alterada. Voc j pode acessar sua biblioteca.' };
  }
};
