import { json } from '@sveltejs/kit';
import { clearAllAuthCookies } from '$lib/server/yugabyte-auth';

export const POST = async ({ locals, cookies }: any) => {
  try {
    if (locals.db?.auth?.signOut) {
      await locals.db.auth.signOut();
    }
  } catch {
    // Non-fatal if Supabase REST returns 402
  }
  clearAllAuthCookies(cookies);
  return json({ success: true });
};
