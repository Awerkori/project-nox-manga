import { json, error } from '@sveltejs/kit';
import { editor, db, schema, safeQuery, safeQuerySingle } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { staffRequest } from '$lib/server/staff';
import { slugify } from '$lib/types';
export const POST = async ({ locals }) => {
  editor(locals);
  const { works } = await staffRequest(locals, 'works');
  let added = 0;
  for (const work of works || []) {
    const { data: existing } = await safeQuerySingle(
      db.select({ id: schema.works.id }).from(schema.works).where(eq(schema.works.sourceId, work.id))
    );
    if (existing) continue;
    const slug = slugify(work.title) || 'obra';
    const { data: collision } = await safeQuerySingle(
      db.select({ id: schema.works.id }).from(schema.works).where(eq(schema.works.slug, slug))
    );
    const { error: insertError } = await safeQuery(
      db.insert(schema.works).values({
        title: work.title,
        aliases: work.aliases || [],
        synopsis: work.synopsis || '',
        slug: collision ? `${slug}-${work.id.slice(0, 8)}` : slug,
        sourceId: work.id,
        status: work.status === 'COMPLETED' ? 'COMPLETED' : work.status === 'PAUSED' ? 'HIATUS' : 'ONGOING',
        published: false,
        author: '',
        artist: '',
        description: '',
        kind: 'MANHWA',
        contentRating: 'SAFE',
        viewsTotal: 0,
        ageRating: 0,
        featured: false,
        searchText: '',
        metadataProvenance: 'MIHON'
      })
    );
    if (insertError && insertError.code !== '23505')
      error(500, 'A importao encontrou um erro. As obras j importadas foram preservadas.');
    if (!insertError) added++;
  }
  return json({
    message: added
      ? `${added} obra(s) importada(s) como rascunho. Complete a capa e as informaes antes de publicar.`
      : 'O catlogo j est sincronizado. Nenhum cadastro duplicado.'
  });
};
export const GET = async ({ locals, url }) => {
  editor(locals);
  const chapterId = url.searchParams.get('chapter');
  if (chapterId) {
    return json(await staffRequest(locals, 'final', chapterId), {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
  const workId = url.searchParams.get('work');
  if (!workId) error(400, 'Selecione uma obra.');
  const { data: work } = await safeQuerySingle(
    db.select({ sourceId: schema.works.sourceId }).from(schema.works).where(eq(schema.works.id, workId))
  );
  if (!work?.sourceId) return json({ chapters: [] });
  return json(await staffRequest(locals, 'chapters', work.sourceId), {
    headers: { 'Cache-Control': 'private, no-store' }
  });
};
