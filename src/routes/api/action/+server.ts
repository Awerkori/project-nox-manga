import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { member } from '$lib/server/db';
import { readRequestText } from '$lib/server/request-body';
import type { Json } from '$lib/database.types';
export const POST = async ({ request, locals }) => {
  member(locals);
  const text = await readRequestText(request, 60_000);
  let body;
  try {
    body = z
      .object({
        scope: z.enum(['member', 'editor', 'owner']),
        action: z.string().max(40),
        data: z.record(z.string(), z.unknown())
      })
      .parse(JSON.parse(text));
  } catch {
    error(400, 'Solicitação inválida');
  }
  const { data, error: problem } = await locals.db.rpc(`${body.scope}_action`, {
    p_action: body.action,
    p_data: body.data as Json
  });
  if (problem) error(problem.code === '42501' ? 403 : 400, problem.message);
  return json(data);
};
