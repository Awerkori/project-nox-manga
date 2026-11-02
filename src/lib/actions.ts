import { getSupabaseBrowserClient } from '$lib/supabase';

export async function action(scope: string, actionName: string, data: Record<string, unknown>) {
  // Camada C: Direct Supabase RPC for authenticated member actions in the browser.
  // Eliminates Cloudflare Worker executions while enforcing PostgreSQL RLS & anti-fraud RPCs.
  if (typeof window !== 'undefined' && scope === 'member') {
    try {
      const client = getSupabaseBrowserClient();
      if (client) {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData?.session) {
          const { data: rpcRes, error: rpcErr } = await client.rpc('member_action', {
            p_action: actionName,
            p_data: data as any
          });
          if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
            return rpcRes;
          }
        }
      }
    } catch {
      // Fall through to standard /api/action route on failure
    }
  }

  const response = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, action: actionName, data })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir. Tente novamente.');
  return result;
}
