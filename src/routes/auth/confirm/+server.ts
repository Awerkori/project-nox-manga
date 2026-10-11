import { redirect } from '@sveltejs/kit';
import { claimInvite } from '$lib/server/invites';
export const GET = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') === '/redefinir' ? '/redefinir' : '/biblioteca';
  if (code) {
    const { error } = await locals.db.auth.exchangeCodeForSession(code);
    if (!error) {
      await claimInvite(locals);
      redirect(303, next);
    }
    console.warn(`[AUTH_CONFIRM] mode=code result=failed provider_code=${error?.code || 'UNKNOWN'}`);
  }
  if (token_hash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    const { error } = await locals.db.auth.verifyOtp({ token_hash, type });
    if (!error) {
      await claimInvite(locals);
      redirect(303, type === 'recovery' ? '/redefinir' : next);
    }
    // Never log token values or the full URL; keep only a safe provider code.
    console.warn(`[AUTH_CONFIRM] mode=otp type=${type} result=failed provider_code=${error?.code || 'UNKNOWN'}`);
  }
  redirect(303, '/entrar?erro=link-expirado');
};
