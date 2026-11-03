import { redirect } from '@sveltejs/kit';
import { clearAllAuthCookies } from '$lib/server/yugabyte-auth';
import { invalidateUserSession } from '$lib/server/session-cache';
import { withTimeout } from '$lib/server/resilience';

export const POST = async ({ locals, cookies }: any) => {
  if (locals.user?.id) {
    invalidateUserSession(locals.user.id);
  }
  try {
    if (locals.db?.auth?.signOut) {
      await withTimeout(locals.db.auth.signOut(), 300, null, 'sair_supa');
    }
  } catch {
    // Non-fatal if Supabase REST returns 402 or hangs
  }
  clearAllAuthCookies(cookies);
  redirect(303, '/');
};

export const GET = async ({ locals, cookies }: any) => {
  if (locals.user?.id) {
    invalidateUserSession(locals.user.id);
  }
  clearAllAuthCookies(cookies);
  redirect(303, '/');
};


