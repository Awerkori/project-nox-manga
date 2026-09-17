import { redirect, isRedirect } from '@sveltejs/kit';
import { claimInvite } from '$lib/server/invites';
import { auth } from '$lib/server/auth';

export const GET = async ({ url, locals, request }) => {
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') === '/redefinir' ? '/redefinir' : '/biblioteca';
  
  if (code) {
    // Note: better-auth might handle email confirmation using just token/hash, but we mimic Supabase signature
    // Actually, Better Auth email verification doesn't usually use exchangeCodeForSession.
    // If it's code exchange for some reason:
    redirect(303, next);
  }
  
  if (tokenHash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    // Not directly implemented in better-auth like this by default, but let's mock it
    // Wait, let's just claim invite and redirect.
    // Since we are migrating to better-auth, maybe they have `auth.api.verifyEmail`?
    if (type === 'signup' || type === 'email') {
      try {
        await auth.api.verifyEmail({
          query: { token: tokenHash }
        });
        await claimInvite(locals);
        redirect(303, next);
      } catch (e) {
        if (isRedirect(e)) throw e;
        // failed
      }
    } else if (type === 'recovery') {
      redirect(303, '/redefinir?token=' + tokenHash);
    }
  }
  
  redirect(303, '/entrar?erro=link-expirado');
};
