import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) {
    throw redirect(303, `/entrar?redirect=/scans/${params.slug}/painel`);
  }

  const { data: scan } = await locals.db
    .from('scans')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!scan) {
    // Check slug history for 301/308 redirection
    const { data: hist } = await locals.db
      .from('scan_slug_history')
      .select('scan_id, scans(slug)')
      .eq('old_slug', params.slug)
      .maybeSingle();

    if (hist?.scans?.slug) {
      throw redirect(301, `/scans/${hist.scans.slug}/painel`);
    }

    throw error(404, 'Scan não encontrada');
  }

  // Check authorization
  if (locals.role !== 'ADMIN') {
    const { data: membership } = await locals.db
      .from('scan_members')
      .select('role')
      .eq('scan_id', scan.id)
      .eq('user_id', locals.user.id)
      .maybeSingle();

    if (!membership) {
      throw error(403, `Você não possui permissão para acessar o painel de ${scan.name}.`);
    }
  }

  // Redirect to unified /scan?id=...
  throw redirect(303, `/scan?id=${scan.id}`);
};
