const fs = require('fs');
const content = `
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, safeQuery, safeQuerySingle } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { withTimeout } from '$lib/server/resilience';

let readerCache = new Map<string, any>();

async function safeDbQuery(promise: Promise<any>, ms: number, label: string) {
  try {
    const res = await withTimeout(promise, ms, null, label);
    if (!res) return { data: null, status: 'TIMEOUT' };
    return { data: res, status: 'OK' };
  } catch(e) {
    return { data: null, status: 'ERROR' };
  }
}

export const load: PageServerLoad = async ({ params, locals, url, cookies, setHeaders }: any) => {
  const isPreviewRequested = url.searchParams.has('preview');
  const isStaff = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  const canAccessUnpublished = isStaff;

  let queryRaw = \`SELECT c.id, c.number, c.title, c.work_id, c.published_at, w.id as w_id, w.title as w_title, w.slug as w_slug, w.kind as w_kind, w.published as w_published, w.content_rating as w_content_rating FROM chapters c LEFT JOIN works w ON w.id = c.work_id WHERE c.id = ?\`;
  if (!canAccessUnpublished) queryRaw += " AND c.published_at IS NOT NULL";

  let chapter = null;
  const cRes = await safeDbQuery(db.get(sql.raw(queryRaw), [params.id]), 4500, 'reader_chapter');
  
  if (cRes.data) {
    chapter = {
      id: cRes.data.id, number: cRes.data.number, title: cRes.data.title, work_id: cRes.data.work_id, published_at: cRes.data.published_at,
      works: { id: cRes.data.w_id, title: cRes.data.w_title, slug: cRes.data.w_slug, kind: cRes.data.w_kind, published: cRes.data.w_published, content_rating: cRes.data.w_content_rating }
    };
  }

  if (!chapter) error(404, 'Capítulo indisponível');
  if (!canAccessUnpublished && !chapter.works?.published) error(404, 'Obra ainda não publicada');

  const preview = !chapter.published_at || (isPreviewRequested && isStaff);

  const pagesRes = await safeDbQuery(db.all(sql\`SELECT position, media_id, width, height FROM pages WHERE chapter_id = \${chapter.id} ORDER BY position\`), 6000, 'reader_pages');
  const siblingsRes = await safeDbQuery(db.all(sql\`SELECT id, number FROM chapters WHERE work_id = \${chapter.work_id} AND published_at IS NOT NULL ORDER BY number\`), 5000, 'reader_siblings');

  const pagesData = pagesRes.data || [];
  const all = siblingsRes.data || [];
  const index = all.findIndex((c: any) => c.id === chapter.id);

  let scans = [{ id: '04872e99-37ad-4d45-aed4-35759d0eae33', name: 'Project Nox', slug: 'project-nox' }];

  return {
    chapter, pages: pagesData, previous: all[index - 1] || null, next: all[index + 1] || null, siblings: all, progress: null, comments: [], scans, preview
  };
};
`;
fs.writeFileSync('src/routes/ler/[id]/+page.server.ts', content);
