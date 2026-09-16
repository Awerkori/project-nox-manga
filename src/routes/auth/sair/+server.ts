import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

export const POST = async ({ request, locals }) => {
  // Better auth signs out using the headers/cookies from the request
  await auth.api.signOut({
    headers: request.headers
  });
  
  locals.user = null;
  locals.session = null;
  
  redirect(303, '/');
};
