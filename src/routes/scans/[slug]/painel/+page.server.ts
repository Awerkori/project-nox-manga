import { error, redirect } from '@sveltejs/kit';
import { executeYugabyteSql } from '$lib/server/yugabyte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
  if (!locals.user) {
    throw redirect(303, `/entrar?redirect=/scans/${params.slug}/painel`);
  }

  const scanResult = await executeYugabyteSql<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM public.scans WHERE slug = $1 LIMIT 1`,
    [params.slug],
    platform?.env
  );
  const scan = scanResult.rows[0] || null;

  if (!scan) {
    // Check slug history for 301/308 redirection
    const historyResult = await executeYugabyteSql<{ slug: string }>(
      `SELECT current_scan.slug
       FROM public.scan_slug_history history
       JOIN public.scans current_scan ON current_scan.id = history.scan_id
       WHERE history.old_slug = $1
       LIMIT 1`,
      [params.slug],
      platform?.env
    );
    const hist = historyResult.rows[0] || null;

    if (hist?.slug) {
      throw redirect(301, `/scans/${hist.slug}/painel`);
    }

    throw error(404, 'Scan não encontrada');
  }

  // Check authorization
  if (locals.role !== 'ADMIN') {
    const membershipResult = await executeYugabyteSql<{ role: string }>(
      `SELECT role
       FROM public.scan_members
       WHERE scan_id = $1 AND user_id = $2
       LIMIT 1`,
      [scan.id, locals.user.id],
      platform?.env
    );
    const membership = membershipResult.rows[0] || null;

    if (!membership) {
      throw error(403, `Você não possui permissão para acessar o painel de ${scan.name}.`);
    }
  }

  // Redirect to unified /scan?id=...
  throw redirect(303, `/scan?id=${scan.id}`);
};
