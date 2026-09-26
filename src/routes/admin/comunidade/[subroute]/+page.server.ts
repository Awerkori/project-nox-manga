import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  if (params.subroute === 'moderacao') {
    throw redirect(302, '/admin/reports');
  }
  throw redirect(302, '/admin/gestao');
};
