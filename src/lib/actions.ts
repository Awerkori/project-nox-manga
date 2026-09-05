export async function action(scope: string, action: string, data: Record<string, unknown>) {
  const response = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, action, data })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir. Tente novamente.');
  return result;
}
