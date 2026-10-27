import { redirect } from '@sveltejs/kit';

export const load = async ({ url }) => {
  const targetParams = new URLSearchParams(url.searchParams);
  if (!targetParams.has('tab')) {
    targetParams.set('tab', 'relatorios');
  }
  throw redirect(302, `/admin/tickets?${targetParams.toString()}`);
};
