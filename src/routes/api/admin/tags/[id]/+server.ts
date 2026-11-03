import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { executeYugabyteSql } from '$lib/server/yugabyte';

const paramsSchema = z.object({ id: z.uuid() });
const bodySchema = z.object({ confirmUnassign: z.boolean().optional().default(false) });

export const DELETE = async ({ locals, params, request, platform }: any) => {
  // This route mirrors the database guard below. Keep both layers: hiding the
  // UI must never be the only authorization check for a destructive action.
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores podem excluir gêneros e tags');

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) error(400, 'Termo inválido');
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) error(400, 'Confirmação inválida');

  try {
    const res = await executeYugabyteSql(
      `SELECT public.delete_taxonomy_term($1::uuid, $2::boolean) AS result;`,
      [parsedParams.data.id, parsedBody.data.confirmUnassign],
      platform?.env
    );
    return json(res.rows[0]?.result || { ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err: any) {
    error(err?.code === '42501' ? 403 : 400, err?.message || 'Erro ao excluir termo');
  }
};
