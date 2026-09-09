import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
export async function staffRequest(locals: App.Locals, action: string, id?: string) {
  if (!env.STAFF_BRIDGE_URL) error(503, 'A conexão com a central ainda não está configurada.');
  const {
    data: { session }
  } = await locals.db.auth.getSession();
  if (!session) error(401, 'Entre novamente.');
  const response = await fetch(env.STAFF_BRIDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) error(response.status >= 500 ? 502 : response.status, 'Falha na conexão com a central.');
  return result;
}
