import { json, error } from '@sveltejs/kit';
import { inviteEditor } from '$lib/server/invites';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const POST = async ({ request, locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail inválido');
  await inviteEditor(locals, email);
  return json({
    message:
      'Convite de editor registrado. A permissão será vinculada quando essa pessoa confirmar o e-mail e entrar na conta.'
  });
};
export const DELETE = async ({ request, locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail inválido');
  const { error: problem } = await safeQuery(db.delete(schema.editorInvites).where(eq(schema.editorInvites.email, email)));
  if (problem) error(400, problem.message);
  return json({
    message: 'Convite revogado. Para remover o acesso de quem já entrou, altere o cargo na lista de usuários.'
  });
};
