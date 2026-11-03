import { redirect } from '@sveltejs/kit';
import { claimInvite } from '$lib/server/invites';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import {
  verifySessionJwtAny,
  getAuthSecret,
  signSessionJwt,
  setAuthCookie,
  type AuthSession
} from '$lib/server/yugabyte-auth';

export const GET = async ({ url, locals, cookies, platform }: any) => {
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash') || url.searchParams.get('token');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') === '/redefinir' ? '/redefinir' : '/biblioteca';

  if (code) {
    if (locals.db?.auth?.exchangeCodeForSession) {
      try {
        const { error } = await locals.db.auth.exchangeCodeForSession(code);
        if (!error) {
          await claimInvite(locals);
          redirect(303, next);
        }
      } catch (e: any) {
        if (e?.status === 303) throw e;
      }
    }
    console.warn(`[AUTH_CONFIRM] mode=code result=failed`);
  }

  if (token_hash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    // 1. Authoritative Web Crypto JWT verification for Brevo/Nox recovery & confirm tokens
    const verified = await verifySessionJwtAny(token_hash, platform?.env);
    if (verified && verified.sub && (verified as any).type === type) {
      if (type === 'signup') {
        try {
          await executeYugabyteSql(
            `UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1 AND email_confirmed_at IS NULL;`,
            [verified.sub],
            platform?.env
          );
        } catch (confirmErr) {
          console.warn('[CONFIRM_SIGNUP_SQL_WARN]', confirmErr);
        }
      }

      if (type === 'recovery' && (verified as any).fp) {
        try {
          const userRes = await executeYugabyteSql(
            `SELECT encrypted_password, updated_at FROM auth.users WHERE id = $1 LIMIT 1;`,
            [verified.sub],
            platform?.env
          );
          if (userRes.rows && userRes.rows[0]) {
            const currentFp = userRes.rows[0].encrypted_password ? userRes.rows[0].encrypted_password.slice(-10) : (userRes.rows[0].updated_at || 'initial');
            if (currentFp !== (verified as any).fp) {
              // Token was already used or password was already changed!
              redirect(303, '/entrar?erro=link-expirado');
            }
          }
        } catch (recErr: any) {
          if (recErr?.status === 303) throw recErr;
        }
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresIn = type === 'recovery' ? 3600 : 60 * 60 * 24 * 30; // 30 days for signup confirmation
      const exp = nowSec + expiresIn;
      const secret = getAuthSecret(platform?.env);
      const sessionJwt = await signSessionJwt(
        {
          aud: 'authenticated',
          exp,
          sub: verified.sub,
          email: verified.email,
          role: 'authenticated'
        },
        secret
      );
      const session: AuthSession = {
        access_token: sessionJwt,
        refresh_token: crypto.randomUUID(),
        token_type: 'bearer',
        expires_in: expiresIn,
        expires_at: exp,
        user: {
          id: verified.sub,
          email: verified.email || '',
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: new Date().toISOString()
        }
      };
      const isSecure = url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(url.hostname);
      setAuthCookie(cookies, session, isSecure);
      locals.user = session.user as any;
      locals.role = 'USER';
      try {
        if (platform?.env) {
          await claimInvite(locals, platform.env);
        } else {
          await claimInvite(locals);
        }
      } catch {}
      redirect(303, type === 'recovery' ? '/redefinir' : next);
    }

    // 2. Fallback to Supabase GoTrue OTP
    if (locals.db?.auth?.verifyOtp) {
      try {
        const { error } = await locals.db.auth.verifyOtp({ token_hash, type });
        if (!error) {
          await claimInvite(locals);
          redirect(303, type === 'recovery' ? '/redefinir' : next);
        }
      } catch (e: any) {
        if (e?.status === 303) throw e;
      }
    }
    // Never log token values or the full URL; keep only a safe provider code.
    console.warn(`[AUTH_CONFIRM] mode=otp type=${type} result=failed`);
  }

  redirect(303, '/entrar?erro=link-expirado');
};
