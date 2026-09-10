import { json } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST = async ({ params, locals, request, getClientAddress }) => {
  const chapterId = params.id;
  if (!chapterId) {
    return json({ counted: false, error: 'Capítulo não informado' }, { status: 400 });
  }

  const userId = locals.user?.id || null;
  let anonHash: string | null = null;

  if (!userId) {
    try {
      const ip = getClientAddress() || '';
      const ua = request.headers.get('user-agent') || '';
      anonHash = await hashString(`${ip}-${ua}`);
    } catch {
      anonHash = 'anonymous-visitor';
    }
  }

  const db = privileged();
  const { data, error } = await db.rpc('record_chapter_view', {
    p_chapter_id: chapterId,
    p_user_id: userId ?? undefined,
    p_anon_hash: anonHash ?? undefined,
    p_origin: 'WEB'
  });

  if (error) {
    return json({ counted: false, error: error.message }, { status: 500 });
  }

  return json(data || { counted: false });
};
