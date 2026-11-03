import { redirect } from '@sveltejs/kit';
import { clearAllAuthCookies } from '$lib/server/yugabyte-auth';

export const POST = async ({ locals, cookies }) => {
  try {
    if (locals.db?.auth?.signOut) {
      await locals.db.auth.signOut();
    }
  } catch {
    // Non-fatal if Supabase REST returns 402
  }
  clearAllAuthCookies(cookies);
  redirect(303, '/');
};

export const GET = async ({ cookies }) => {
  clearAllAuthCookies(cookies);
  redirect(303, '/');
};

