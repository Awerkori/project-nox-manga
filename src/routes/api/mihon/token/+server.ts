import { json } from '@sveltejs/kit';
import { member, privileged } from '$lib/server/db';
import { generateMihonToken } from '$lib/server/mihon';

export const GET = async ({ locals }) => {
  const userId = member(locals);
  const db = privileged();

  const { data, error } = await db
    .from('mihon_tokens')
    .select('id, device_name, created_at, expires_at')
    .eq('user_id', userId)
    .eq('revoked', false)
    .order('created_at', { ascending: false });

  if (error) {
    return json({ error: 'Erro ao carregar tokens' }, { status: 500 });
  }

  return json({ tokens: data || [] });
};

export const POST = async ({ request, locals }) => {
  const userId = member(locals);

  let deviceName = 'Mihon App';
  try {
    const body = await request.json();
    if (body.device_name && typeof body.device_name === 'string') {
      deviceName = body.device_name.slice(0, 50);
    }
  } catch {
    // Body optional
  }

  try {
    const { token, expiresAt } = await generateMihonToken(userId, deviceName);
    return json({ token, expires_at: expiresAt });
  } catch (err) {
    return json({ error: (err as Error).message || 'Erro ao gerar token' }, { status: 500 });
  }
};

export const DELETE = async ({ request, locals }) => {
  const userId = member(locals);

  let tokenId = '';
  try {
    const body = await request.json();
    tokenId = body.id;
  } catch {
    return json({ error: 'ID do token é obrigatório' }, { status: 400 });
  }

  if (!tokenId) {
    return json({ error: 'ID do token é obrigatório' }, { status: 400 });
  }

  const db = privileged();
  const { error } = await db
    .from('mihon_tokens')
    .update({ revoked: true })
    .eq('id', tokenId)
    .eq('user_id', userId);

  if (error) {
    return json({ error: 'Erro ao revogar token' }, { status: 500 });
  }

  return json({ ok: true });
};
