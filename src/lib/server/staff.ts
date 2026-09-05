import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
export function staffSource() {
  if (!env.STAFF_SUPABASE_URL || !env.STAFF_SUPABASE_SERVICE_ROLE_KEY)
    error(503, 'A conexão com a central ainda não está configurada.');
  return createClient(env.STAFF_SUPABASE_URL, env.STAFF_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
export async function approvedChapter(id: string) {
  const db = staffSource();
  const { data: ready, error: problem } = await db
    .from('chapter_stages')
    .select('chapter_id')
    .eq('chapter_id', id)
    .eq('stage', 'READY')
    .eq('status', 'COMPLETED')
    .maybeSingle();
  if (problem || !ready) error(403, 'Somente capítulos finais aprovados pela revisão podem ser importados.');
  const { data: chapter } = await db
    .from('chapters')
    .select('id,number,title,work_id')
    .eq('id', id)
    .maybeSingle();
  const { data: files } = await db
    .from('artifacts')
    .select('provider,provider_key,original_name,byte_size')
    .eq('chapter_id', id)
    .in('stage', ['TYPESET', 'REVIEW'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (!chapter || !files?.[0])
    error(404, 'O capítulo aprovado ainda não possui um arquivo final de Type ou Revisão.');
  return { db, chapter, file: files[0] };
}
