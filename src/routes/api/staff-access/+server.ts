import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { staffRequest } from '$lib/server/staff';
import { readRequestJson } from '$lib/server/request-body';
export const GET = async ({ locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  return json(await staffRequest(locals, 'members'), { headers: { 'Cache-Control': 'private, no-store' } });
};
export const POST = async ({ locals, request }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const input = z.object({ id: z.uuid() }).safeParse(await readRequestJson(request));
  if (!input.success) error(400, 'Selecione um membro válido da staff.');
  return json(await staffRequest(locals, 'authorize_staff', input.data.id));
};
