import { json, error } from '@sveltejs/kit';
import { inviteEditor } from '$lib/server/invites';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const POST = async ({ request, locals, platform }: any) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail inválido');
  await inviteEditor(locals, email, platform?.env);
  return json({
    message:
      'Convite de editor registrado. A permissão será vinculada quando essa pessoa confirmar o e-mail e entrar na conta.'
  });
};

export const DELETE = async ({ request, locals, platform }: any) => {
  if (locals.role !== 'ADMIN') error(403, 'Somente administradores');
  const { email } = await request.json();
  if (typeof email !== 'string' || email.length > 254) error(400, 'E-mail inválido');
  
  await executeYugabyteSql(
    `DELETE FROM public.editor_invites WHERE LOWER(email) = LOWER($1);`,
    [email.trim().toLowerCase()],
    platform?.env
  );

  return json({
    message: 'Convite revogado. Para remover o acesso de quem já entrou, altere o cargo na lista de usuários.'
  });
};
