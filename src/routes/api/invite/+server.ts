import { json, error } from '@sveltejs/kit';
import { inviteEditor } from '$lib/server/invites';
import { db, schema, safeQuery } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const POST = async ({ request, locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail invlido');
  await inviteEditor(locals, email);
  return json({
    message:
      'Convite de editor registrado. A permisso ser vinculada quando essa pessoa confirmar o e-mail e entrar na conta.'
  });
};
export const DELETE = async ({ request, locals }) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail invlido');
  const { error: problem } = await safeQuery(db.delete(schema.editorInvites).where(eq(schema.editorInvites.email, email)));
  if (problem) error(400, (problem as any).message);
  return json({
    message: 'Convite revogado. Para remover o acesso de quem j entrou, altere o cargo na lista de usurios.'
  });
};
