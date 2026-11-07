import { json } from '@sveltejs/kit';
import { member } from '$lib/server/db';
import { generateMihonToken, invalidateMihonTokenCache } from '$lib/server/mihon';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const GET = async ({ locals, platform }) => {
  const userId = member(locals);

  try {
    const res = await executeYugabyteSql(
      `SELECT id, device_name, created_at, expires_at 
       FROM public.mihon_tokens 
       WHERE user_id = $1 AND revoked = false 
       ORDER BY created_at DESC;`,
      [userId],
      platform?.env
    );
    return json({ tokens: res.rows || [] });
  } catch (err: any) {
    return json({ error: 'Erro ao carregar tokens' }, { status: 500 });
  }
};

export const POST = async ({ request, locals, platform }) => {
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
    const { token, expiresAt } = await generateMihonToken(userId, deviceName, platform?.env);
    return json({ token, expires_at: expiresAt });
  } catch (err) {
    return json({ error: (err as Error).message || 'Erro ao gerar token' }, { status: 500 });
  }
};

export const DELETE = async ({ request, locals, platform }) => {
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

  try {
    await executeYugabyteSql(
      `UPDATE public.mihon_tokens SET revoked = true WHERE id = $1 AND user_id = $2;`,
      [tokenId, userId],
      platform?.env
    );
    invalidateMihonTokenCache();
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: 'Erro ao revogar token' }, { status: 500 });
  }
};
