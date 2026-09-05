import { json, error } from '@sveltejs/kit';
import { editor, privileged } from '$lib/server/db';
import { staffRequest } from '$lib/server/staff';
import { slugify } from '$lib/types';
export const POST = async ({ locals }) => {
  editor(locals);
  const db = privileged();
  const { works } = await staffRequest(locals, 'works');
  let added = 0;
  for (const work of works || []) {
    const { data: existing } = await db.from('works').select('id').eq('source_id', work.id).maybeSingle();
    if (existing) continue;
    const slug = slugify(work.title) || 'obra';
    const { data: collision } = await db.from('works').select('id').eq('slug', slug).maybeSingle();
    const { error: insertError } = await db.from('works').insert({
      title: work.title,
      aliases: work.aliases,
      synopsis: work.synopsis,
      slug: collision ? `${slug}-${work.id.slice(0, 8)}` : slug,
      source_id: work.id,
      status: work.status === 'COMPLETED' ? 'COMPLETED' : work.status === 'PAUSED' ? 'HIATUS' : 'ONGOING',
      published: false
    });
    if (insertError && insertError.code !== '23505')
      error(500, 'A importação encontrou um erro. As obras já importadas foram preservadas.');
    if (!insertError) added++;
  }
  return json({
    message: added
      ? `${added} obra(s) importada(s) como rascunho. Complete a capa e as informações antes de publicar.`
      : 'O catálogo já está sincronizado. Nenhum cadastro duplicado.'
  });
};
export const GET = async ({ locals, url }) => {
  editor(locals);
  const db = privileged();
  const chapterId = url.searchParams.get('chapter');
  if (chapterId) {
    return json(await staffRequest(locals, 'final', chapterId), {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  }
  const workId = url.searchParams.get('work');
  if (!workId) error(400, 'Selecione uma obra.');
  const { data: work } = await db.from('works').select('source_id').eq('id', workId).maybeSingle();
  if (!work?.source_id) return json({ chapters: [] });
  return json(await staffRequest(locals, 'chapters', work.source_id), {
    headers: { 'Cache-Control': 'private, no-store' }
  });
};
