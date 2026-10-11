import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

const paramsSchema = z.object({ id: z.uuid() });
const bodySchema = z.object({ confirmUnassign: z.boolean().optional().default(false) });

export const DELETE = async ({ locals, params, request }) => {
  // This route mirrors the database guard below. Keep both layers: hiding the
  // UI must never be the only authorization check for a destructive action.
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores podem excluir gêneros e tags');

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) error(400, 'Termo inválido');
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) error(400, 'Confirmação inválida');

  const { data, error: rpcError } = await (locals.db as any).rpc('delete_taxonomy_term', {
    p_tag_id: parsedParams.data.id,
    p_confirm_unassign: parsedBody.data.confirmUnassign
  });

  if (rpcError) error(rpcError.code === '42501' ? 403 : 400, rpcError.message);
  return json(data, { headers: { 'Cache-Control': 'private, no-store' } });
};
