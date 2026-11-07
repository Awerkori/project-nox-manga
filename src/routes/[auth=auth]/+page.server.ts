import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { claimInvite } from '$lib/server/invites';
import { createNotification } from '$lib/server/notifications';
import {
  authenticateWithYugabyte,
  registerWithYugabyte,
  setAuthCookie,
  getAuthSecret,
  signSessionJwt
} from '$lib/server/yugabyte-auth';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import { sendBrevoEmail } from '$lib/server/brevo';
import { invalidateUserSession } from '$lib/server/session-cache';
import { checkAuthRateLimit } from '$lib/server/auth-rate-limit';

const DEFAULT_SITE_ORIGIN = 'https://projectnox.org';

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
  return details.status === 400 && typeof details.message === 'string' &&
    /^email not confirmed$/i.test(details.message.trim());
}

export const load = ({ params, url }) => ({
  mode: params.auth,
  error:
    params.auth === 'entrar' && url.searchParams.get('erro') === 'link-expirado'
      ? 'Este link é inválido, já foi utilizado ou expirou. Solicite um novo link e abra o e-mail mais recente.'
      : ''
});
export const actions = {
  default: async ({ request, locals, params, url, platform, cookies }: any) => {
    const f = await request.formData(),
      mode = params.auth;
    const email = String(f.get('email') || '').trim(),
      password = String(f.get('password') || ''),
      intent = String(f.get('intent') || '');
    const redirectOrigin = authOrigin(url);

    const rateDecision = await checkAuthRateLimit(request, platform?.env, mode, email);
    if (rateDecision === 'limited') {
      return fail(429, { message: 'Muitas tentativas. Aguarde um pouco e tente novamente.' });
    }
    if (rateDecision === 'unavailable') {
      return fail(503, { message: 'Não foi possível verificar a solicitação. Tente novamente mais tarde.' });
    }

    if ((mode === 'cadastrar' || mode === 'entrar') && intent === 'resend_confirmation') {
      if (!z.email().safeParse(email).success) {
        return fail(400, { message: 'Informe um e-mail válido para reenviar a confirmação.' });
      }
      try {
        const userRes = await executeYugabyteSql(
          `SELECT id, email, email_confirmed_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
          [email],
          platform?.env
        );
        if (userRes.rows && userRes.rows[0]) {
          const targetUser = userRes.rows[0];
          if (targetUser.email_confirmed_at) {
            return {
              success: true,
              resend: true,
              unconfirmed: false,
              email,
              message: 'Sua conta já está confirmada! Você já pode entrar com seu e-mail e senha.'
            };
          }

          const secret = getAuthSecret(platform?.env);
          const nowSec = Math.floor(Date.now() / 1000);
          const confirmToken = await signSessionJwt(
            {
              sub: targetUser.id,
              email: targetUser.email,
              type: 'signup',
              exp: nowSec + 86400 // 24 hours
            },
            secret
          );
          const confirmUrl = `${redirectOrigin}/auth/confirm?token_hash=${confirmToken}&type=signup`;
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c0a13; color: #f1f0f5; border-radius: 12px; border: 1px solid #2a243a;">
              <h2 style="color: #b59af5; margin-top: 0;">Confirmação de Conta</h2>
              <p style="color: #c4c0d0; line-height: 1.6;">Você solicitou um novo link para confirmar sua conta no Project Nox.</p>
              <div style="margin: 28px 0;">
                <a href="${confirmUrl}" style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Confirmar Minha Conta</a>
              </div>
              <p style="color: #8a859b; font-size: 13px; line-height: 1.5;">O link é válido por 24 horas.</p>
            </div>
          `;
          await sendBrevoEmail({
            toEmail: targetUser.email,
            subject: '[Project Nox] Confirme sua conta',
            htmlContent: emailHtml,
            tags: ['email-confirmation']
          });

          return {
            success: true,
            resend: true,
            unconfirmed: mode === 'entrar',
            email,
            message: 'Enviamos uma nova confirmação para o seu e-mail. Abra o e-mail mais recente.'
          };
        }
      } catch (ybErr) {
        console.warn('[AUTH_RESEND_YUGABYTE_WARN]', ybErr);
      }


      return {
        success: true,
        resend: true,
        unconfirmed: false,
        email,
        message: 'Sua conta já está pronta! Você já pode entrar com seu e-mail e senha.'
      };
    }
    if (mode !== 'redefinir' && !z.email().safeParse(email).success)
      return fail(400, { message: 'Informe um e-mail válido.' });
    if (mode !== 'recuperar' && password.length < 10)
      return fail(400, { message: 'Use uma senha com pelo menos 10 caracteres.' });
    if (password.length > 128) return fail(400, { message: 'A senha pode ter até 128 caracteres.' });
    if (mode === 'entrar') {
      let authSuccess = false;
      let authError: any = null;

      // 1. Authoritative direct YugabyteDB authentication (bcrypt in SQL, zero Supabase dependency)
      const ybResult = await authenticateWithYugabyte(email, password, platform?.env);
      if (ybResult.success && ybResult.session) {
        authSuccess = true;
        const isSecure = url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(url.hostname);
        setAuthCookie(cookies, ybResult.session, isSecure);
        locals.user = ybResult.session.user as any;
        locals.role = ybResult.session.user.role || 'USER';
      } else if (ybResult.error?.unconfirmed || isUnconfirmedEmailError(ybResult.error)) {
        return fail(400, {
          message: 'Verifique seu e-mail para continuar.',
          unconfirmed: true,
          email
        });
      } else {
        authError = ybResult.error;
      }



      if (!authSuccess) {
        return fail(400, {
          message: authError?.message || 'Não foi possível entrar. Confira o e-mail, a senha e a confirmação da conta.'
        });
      }

      try {
        if (platform?.env) {
          await claimInvite(locals, platform.env);
        } else {
          await claimInvite(locals);
        }
      } catch {
        // Non-fatal
      }
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

      // 1. Authoritative direct YugabyteDB registration
      const registrationData = { username: rawUsername };
      const ybReg = await registerWithYugabyte(email, password, registrationData.username, displayName, platform?.env);
      if (ybReg.success && ybReg.user) {
        try {
          const secret = getAuthSecret(platform?.env);
          const nowSec = Math.floor(Date.now() / 1000);
          const confirmToken = await signSessionJwt(
            {
              sub: ybReg.user.id,
              email: ybReg.user.email,
              type: 'signup',
              exp: nowSec + 86400 // 24 hours
            },
            secret
          );
          // Standard confirmation callback target (contract: emailRedirectTo: `${redirectOrigin}/auth/confirm`)
          const confirmUrl = `${redirectOrigin}/auth/confirm?token_hash=${confirmToken}&type=signup`;
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c0a13; color: #f1f0f5; border-radius: 12px; border: 1px solid #2a243a;">
              <h2 style="color: #b59af5; margin-top: 0;">Bem-vindo ao Project Nox!</h2>
              <p style="color: #c4c0d0; line-height: 1.6;">Obrigado por se cadastrar. Confirme seu e-mail para ativar sua conta e acessar todas as obras e recursos.</p>
              <div style="margin: 28px 0;">
                <a href="${confirmUrl}" style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Confirmar Minha Conta</a>
              </div>
              <p style="color: #8a859b; font-size: 13px; line-height: 1.5;">O link expira em 24 horas.</p>
            </div>
          `;
          await sendBrevoEmail({
            toEmail: ybReg.user.email,
            subject: '[Project Nox] Confirme sua conta',
            htmlContent: emailHtml,
            tags: ['email-confirmation']
          });
        } catch (mailErr) {
          console.warn('[SIGNUP_EMAIL_WARN]', mailErr);
        }
        return { success: true, message: 'Confira seu e-mail e abra o link para confirmar sua conta.' };
      }
      return fail(400, {
        message: ybReg.error?.message || 'Não foi possível cadastrar no momento. Tente novamente mais tarde.'
      });
    }
    if (mode === 'recuperar') {
      try {
        const userRes = await executeYugabyteSql(
          `SELECT id, email, encrypted_password, updated_at FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
          [email],
          platform?.env
        );
        if (userRes.rows && userRes.rows[0]) {
          const targetUser = userRes.rows[0];
          const secret = getAuthSecret(platform?.env);
          const nowSec = Math.floor(Date.now() / 1000);
          const fp = targetUser.encrypted_password ? targetUser.encrypted_password.slice(-10) : (targetUser.updated_at || 'initial');
          const recoveryToken = await signSessionJwt(
            {
              sub: targetUser.id,
              email: targetUser.email,
              type: 'recovery',
              fp,
              exp: nowSec + 3600 // 1 hour expiration
            },
            secret
          );
          const recoveryUrl = `${redirectOrigin}/auth/confirm?token_hash=${recoveryToken}&type=recovery`;
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #0c0a13; color: #f1f0f5; border-radius: 12px; border: 1px solid #2a243a;">
              <h2 style="color: #b59af5; margin-top: 0;">Recuperação de Senha</h2>
              <p style="color: #c4c0d0; line-height: 1.6;">Recebemos uma solicitação para redefinir a senha da sua conta Project Nox.</p>
              <div style="margin: 28px 0;">
                <a href="${recoveryUrl}" style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Redefinir Minha Senha</a>
              </div>
              <p style="color: #8a859b; font-size: 13px; line-height: 1.5;">Se você não solicitou a recuperação, pode ignorar esta mensagem com segurança. O link expira em 1 hora.</p>
            </div>
          `;
          await sendBrevoEmail({
            toEmail: targetUser.email,
            subject: '[Project Nox] Recuperação de Senha',
            htmlContent: emailHtml,
            tags: ['password-recovery']
          });
        }
      } catch (ybRecErr) {
        console.warn('[AUTH_RECOVERY_YUGABYTE_WARN]', ybRecErr);
      }



      return {
        success: true,
        message: 'Se houver uma conta com esse e-mail, você receberá um link de recuperação.'
      };
    }
    if (mode === 'redefinir') {
      if (!locals.user) return fail(401, { message: 'Abra o link de recuperação enviado para seu e-mail.' });

      let passwordUpdated = false;
      try {
        const ybUpdate = await executeYugabyteSql(
          `UPDATE auth.users
           SET encrypted_password = crypt($2, gen_salt('bf', 10)),
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               updated_at = now()
           WHERE id = $1;`,
          [locals.user.id, password],
          platform?.env
        );
        if (ybUpdate.rowCount > 0) {
          passwordUpdated = true;
        }
      } catch (ybErr) {
        console.error('[YUGABYTE_PASSWORD_UPDATE_ERROR]', ybErr);
      }



      if (!passwordUpdated) {
        return fail(400, { message: 'Não foi possível alterar a senha. Solicite um novo link.' });
      }

      invalidateUserSession(locals.user.id);

      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresIn = 60 * 60 * 24 * 30; // 30 days
        const exp = nowSec + expiresIn;
        const secret = getAuthSecret(platform?.env);
        const sessionJwt = await signSessionJwt(
          {
            aud: 'authenticated',
            exp,
            iat: nowSec,
            sub: locals.user.id,
            email: locals.user.email,
            role: 'authenticated'
          },
          secret
        );
        const freshSession: any = {
          access_token: sessionJwt,
          refresh_token: crypto.randomUUID(),
          token_type: 'bearer',
          expires_in: expiresIn,
          expires_at: exp,
          user: {
            id: locals.user.id,
            email: locals.user.email || '',
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString()
          }
        };
        const isSecure = url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(url.hostname);
        setAuthCookie(cookies, freshSession, isSecure);
      } catch {
        // Password update remains authoritative if session refresh fails.
      }

      // Disparar notificação de segurança e e-mail transacional de senha alterada
      try {
        await createNotification(
          {
            recipientUserId: locals.user.id,
            type: 'SECURITY_PASSWORD_CHANGED',
            title: 'Senha alterada com sucesso',
            body: 'A senha da sua conta Project Nox foi alterada com sucesso. Se você realizou esta alteração, nenhuma ação é necessária. Caso não reconheça, redefina sua senha imediatamente.',
            deepLink: '/perfil?tab=security',
            priority: 'URGENT',
            platform
          },
          platform
        );
      } catch (notifErr) {
        console.warn('[AUTH] Falha ao disparar notificação de segurança de senha:', notifErr);
      }

      return { success: true, message: 'Senha alterada. Você já pode acessar sua biblioteca.' };
    }
    return fail(400, { message: 'Operação inválida.' });
  }
};
