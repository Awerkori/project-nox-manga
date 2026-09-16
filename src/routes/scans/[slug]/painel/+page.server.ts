import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, schema, safeQuerySingle } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) {
    throw redirect(303, `/entrar?redirect=/scans/${params.slug}/painel`);
  }

  const { data: scan } = await safeQuerySingle(
    db.select({ id: schema.scans.id, name: schema.scans.name, slug: schema.scans.slug })
      .from(schema.scans)
      .where(eq(schema.scans.slug, params.slug))
  );

  if (!scan) {
    // Check slug history for 301/308 redirection
    const { data: hist } = await safeQuerySingle(
      db.select({ scanId: schema.scanSlugHistory.scanId, slug: schema.scans.slug })
        .from(schema.scanSlugHistory)
        .leftJoin(schema.scans, eq(schema.scanSlugHistory.scanId, schema.scans.id))
        .where(eq(schema.scanSlugHistory.oldSlug, params.slug))
    );

    if (hist?.slug) {
      throw redirect(301, `/scans/${hist.slug}/painel`);
    }

    throw error(404, 'Scan não encontrada');
  }

  // Check authorization
  if (locals.role !== 'ADMIN') {
    const { data: membership } = await safeQuerySingle(
      db.select({ role: schema.scanMembers.role })
        .from(schema.scanMembers)
        .where(and(eq(schema.scanMembers.scanId, scan.id), eq(schema.scanMembers.userId, locals.user!.id)))
    );

    if (!membership) {
      throw error(403, `Você não possui permissão para acessar o painel de ${scan.name}.`);
    }
  }

  // Redirect to unified /scan?id=...
  throw redirect(303, `/scan?id=${scan.id}`);
};
