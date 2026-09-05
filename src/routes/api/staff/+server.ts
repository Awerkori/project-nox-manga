import { json, error } from '@sveltejs/kit';
import { editor, privileged } from '$lib/server/db';
import { staffSource, approvedChapter } from '$lib/server/staff';
import { slugify } from '$lib/types';
export const POST = async ({ locals }) => {
  editor(locals);
  const source = staffSource(),
    db = privileged();
  const { data: works, error: problem } = await source
    .from('works')
    .select('id,title,aliases,synopsis,status')
    .limit(1000);
  if (problem) error(502, 'Não foi possível consultar a central.');
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
  const db = privileged(),
    source = staffSource();
  const chapterId = url.searchParams.get('chapter');
  if (chapterId) {
    const { db: staff, chapter, file } = await approvedChapter(chapterId);
    if (file.provider !== 'supabase')
      error(400, 'O arquivo final da central precisa estar disponível para importação.');
    if (file.byte_size > 300_000_000) error(413, 'O arquivo final deve ter até 300 MB.');
    const { data: link, error: problem } = await staff.storage
      .from('scan-artifacts')
      .createSignedUrl(file.provider_key, 120);
    if (problem || !link) error(502, 'Não foi possível abrir o arquivo final.');
    return json(
      { url: link.signedUrl, name: file.original_name, number: chapter.number, title: chapter.title },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
  const workId = url.searchParams.get('work');
  if (!workId) error(400, 'Selecione uma obra.');
  const { data: work } = await db.from('works').select('source_id').eq('id', workId).maybeSingle();
  if (!work?.source_id) return json({ chapters: [] });
  const { data: chapters } = await source
    .from('chapters')
    .select('id,number,title,chapter_stages!inner(stage,status)')
    .eq('work_id', work.source_id)
    .eq('chapter_stages.stage', 'READY')
    .eq('chapter_stages.status', 'COMPLETED')
    .limit(200);
  return json(
    { chapters: (chapters || []).map((c) => ({ id: c.id, number: c.number, title: c.title })) },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
};
