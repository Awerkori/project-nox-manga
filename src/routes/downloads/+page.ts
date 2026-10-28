import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ parent, url }) => {
  const data = await parent();
  if (!data.user) {
    throw redirect(303, `/entrar?redirect=${encodeURIComponent(url.pathname)}`);
  }
  return {
    metaTitle: 'Biblioteca de Downloads'
  };
};
