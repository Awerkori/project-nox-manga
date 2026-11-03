import { json, error } from '@sveltejs/kit';
import { editor } from '$lib/server/db';
import { staffRequest } from '$lib/server/staff';
import { slugify } from '$lib/types';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ locals, platform }: any) => {
  editor(locals);
  const { works } = await staffRequest(locals, 'works');
  let added = 0;
  for (const work of works || []) {
    const existing = await executeYugabyteSql(
      `SELECT id FROM public.works WHERE source_id = $1 LIMIT 1;`,
      [work.id],
      platform?.env
    ).catch(() => ({ rows: [] }));
    if (existing.rows.length > 0) continue;

    const baseSlug = slugify(work.title) || 'obra';
    const collision = await executeYugabyteSql(
      `SELECT id FROM public.works WHERE slug = $1 LIMIT 1;`,
      [baseSlug],
      platform?.env
    ).catch(() => ({ rows: [] }));

    const slug = collision.rows.length > 0 ? `${baseSlug}-${work.id.slice(0, 8)}` : baseSlug;
    const status = work.status === 'COMPLETED' ? 'COMPLETED' : work.status === 'PAUSED' ? 'HIATUS' : 'ONGOING';

    try {
      await executeYugabyteSql(
        `INSERT INTO public.works (title, aliases, synopsis, slug, source_id, status, published)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (slug) DO NOTHING;`,
        [work.title, work.aliases, work.synopsis, slug, work.id, status],
        platform?.env
      );
      added++;
    } catch (insertErr: any) {
      if (insertErr?.code !== '23505') {
        error(500, 'A importação encontrou um erro. As obras já importadas foram preservadas.');
      }
    }
  }

  return json({
    message: added
      ? `${added} obra(s) importada(s) como rascunho. Complete a capa e as informações antes de publicar.`
      : 'O catálogo já está sincronizado. Nenhum cadastro duplicado.'
  });
};

export const GET = async ({ locals, url, platform }: any) => {
  editor(locals);
  const chapterId = url.searchParams.get('chapter');
  if (chapterId) {
    return json(await staffRequest(locals, 'final', chapterId), {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
  const workId = url.searchParams.get('work');
  if (!workId) error(400, 'Selecione uma obra.');

  const workRes = await executeYugabyteSql(
    `SELECT source_id FROM public.works WHERE id = $1 LIMIT 1;`,
    [workId],
    platform?.env
  ).catch(() => ({ rows: [] }));

  const work = workRes.rows[0];
  if (!work?.source_id) return json({ chapters: [] });

  return json(await staffRequest(locals, 'chapters', work.source_id), {
    headers: { 'Cache-Control': 'private, no-store' }
  });
};
