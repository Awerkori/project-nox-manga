import { redirect } from '@sveltejs/kit';
import { clearAllAuthCookies } from '$lib/server/yugabyte-auth';
import { invalidateUserSession } from '$lib/server/session-cache';

export const POST = async ({ locals, cookies }: any) => {
  if (locals.user?.id) {
    invalidateUserSession(locals.user.id);
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


