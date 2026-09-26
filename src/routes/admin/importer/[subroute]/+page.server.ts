import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const tab = params.subroute || 'resumo';
  throw redirect(302, `/admin/importer?tab=${encodeURIComponent(tab)}`);
};
