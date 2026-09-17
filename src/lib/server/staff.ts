import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

export async function staffRequest(locals: App.Locals, action: string, id?: string) {
  if (!env.STAFF_BRIDGE_URL) error(503, 'A conexo com a central ainda no est configurada.');
  
  const session = locals.session;
  if (!session) error(401, 'Entre novamente.');
  
  const response = await fetch(env.STAFF_BRIDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id }),
    signal: AbortSignal.timeout(15000)
  });
  
  const result = await response.json();
  if (!response.ok)
    error(
      response.status >= 500 ? 502 : response.status,
      (result as any).message || 'Falha na conexo com a central.'
    );
  
  return result;
}
