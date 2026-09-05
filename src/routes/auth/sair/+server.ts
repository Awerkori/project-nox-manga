import { redirect } from '@sveltejs/kit';
export const POST = async ({ locals }) => {
  await locals.db.auth.signOut();
  redirect(303, '/');
};
